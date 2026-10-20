import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { SiteService } from '../services/siteService';
import { CompressionService } from '../services/compressionService';
import { OracleStorageService } from '../services/oracleStorageService';
import {
  buildEmployeeStorageKey,
  buildInvoiceStorageKey,
} from '../utils/storageKeys';
import {
  enrichDocumentsWithViewUrl,
  enrichDocumentWithViewUrl,
  getDocumentViewUrl,
} from '../utils/documentViewHelper';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { buildInvoiceFileName, sanitizeSegment } from '../utils/fileUtils';

function sanitizeFileName(name?: string): string {
  if (!name) return 'document';
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return `${sanitizeSegment(base)}${ext}`;
}

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  let uploadedStorageKey: string | null = null;
  try {
    const file = req.file;
    const staffId = req.body.staff_id;
    let employeeName = req.body.employee_name || '';
    const docType = req.body.doc_type || 'Document';
    const siteName = req.body.site_name || '';
    const designation = req.body.designation || '';

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!staffId) {
      res.status(400).json({ error: 'staff_id is required' });
      return;
    }

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(403).json({ error: 'Access denied: User has no authorized company scope' });
        return;
      }
      const staffOwnership = await pool.query(
        `SELECT s.id, s.is_locked, st.company_id
         FROM public.staff s
         LEFT JOIN public.sites st ON st.id = s.site_id
         WHERE s.id = $1 LIMIT 1;`,
        [staffId]
      );
      if (!staffOwnership.rows?.[0] || staffOwnership.rows[0].company_id !== userCompanyId) {
        res.status(403).json({ error: 'Access denied: Unauthorized staff document upload' });
        return;
      }
      if (staffOwnership.rows[0].is_locked) {
        res.status(423).json({ error: 'Cannot upload document to locked staff record' });
        return;
      }
    }

    const safeOriginalName = sanitizeFileName(file.originalname);

    // If employeeName was not supplied in body, query staff table
    if (!employeeName) {
      const staffRes = await pool.query('SELECT employee_name, designation FROM public.staff WHERE id = $1', [staffId]);
      if (staffRes.rows?.[0]) {
        employeeName = staffRes.rows[0].employee_name || '';
      }
    }

    if (!employeeName) {
      employeeName = `Staff_${staffId.slice(0, 8)}`;
    }

    // 1. Run file compression unchanged before storage call
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    // 2. Build storage key: employees/{siteName}/{designation}/{employeeName}/{DocumentType}-{shortUuid}.{ext}
    const storageKey = buildEmployeeStorageKey({
      siteName,
      designation,
      employeeName,
      documentType: docType,
      originalName: file.originalname,
    });

    // 3. Upload to MinIO / Oracle Object Storage
    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );
    uploadedStorageKey = storageResult.storageKey;

    // 4. Generate signed read URL for immediate client preview
    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    // 5. Save metadata to PostgreSQL employee_documents table
    let insertedDoc = null;
    const insertRes = await pool.query(
      `INSERT INTO public.employee_documents (
        staff_id, document_type, file_name, storage_provider, storage_key, gcp_file_url, uploaded_at
      ) VALUES ($1, $2, $3, 'minio', $4, null, now())
      RETURNING *;`,
      [staffId, docType, safeOriginalName, storageResult.storageKey]
    );

    const insertedData = insertRes.rows[0];
    const staffInfo = await pool.query(
      'SELECT id, employee_name, biometric_code, designation FROM public.staff WHERE id = $1',
      [staffId]
    );
    insertedData.staff = staffInfo.rows?.[0] || null;
    insertedDoc = insertedData;

    const enrichedDoc = await enrichDocumentWithViewUrl(insertedDoc);

    res.status(200).json({
      success: true,
      data: enrichedDoc,
      file_name: safeOriginalName,
      document_type: docType,
      view_url: viewUrl,
      webViewLink: viewUrl,
      storage_key: storageResult.storageKey,
      storage_provider: 'minio',
    });
  } catch (error: any) {
    if (uploadedStorageKey) {
      await OracleStorageService.deleteFile(uploadedStorageKey).catch(() => {});
    }
    console.error('Direct Upload Error:', error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload document', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
  }
};

export const uploadCompanyDocument = async (req: Request, res: Response): Promise<void> => {
  let uploadedStorageKey: string | null = null;
  try {
    const file = req.file;
    const companyId = req.body.company_id || req.body.companyId;
    const documentType = req.body.document_type || req.body.documentType || 'General';
    const documentLabel = req.body.document_label || req.body.documentLabel || file?.originalname;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!companyId) {
      res.status(400).json({ error: 'company_id is required' });
      return;
    }

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(403).json({ error: 'Access denied: User has no authorized company scope' });
        return;
      }
      if (userCompanyId !== companyId) {
        res.status(403).json({ error: 'Access denied: Unauthorized company access' });
        return;
      }
      const compCheck = await pool.query('SELECT is_locked FROM public.companies WHERE id = $1 LIMIT 1;', [companyId]);
      if (compCheck.rows?.[0]?.is_locked) {
        res.status(423).json({ error: 'Cannot upload document to locked company record' });
        return;
      }
    }

    const safeOriginalName = sanitizeFileName(file.originalname);
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    const safeCompanyId = sanitizeSegment(companyId);
    const safeDocType = sanitizeSegment(documentType);
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const storageKey = `companies/${safeCompanyId}/${safeDocType}/${Date.now()}_${uniqueSuffix}_${safeOriginalName}`;

    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );
    uploadedStorageKey = storageResult.storageKey;

    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    const insertRes = await pool.query(
      `INSERT INTO public.company_documents (
        company_id, document_type, document_label, file_name, storage_provider, storage_key, gcp_file_url, uploaded_at, created_at
      ) VALUES ($1, $2, $3, $4, 'minio', $5, null, now(), now())
      RETURNING *;`,
      [companyId, documentType, documentLabel, safeOriginalName, storageResult.storageKey]
    );

    const enrichedDoc = await enrichDocumentWithViewUrl(insertRes.rows[0]);

    res.status(200).json({
      success: true,
      data: enrichedDoc,
      file_name: safeOriginalName,
      view_url: viewUrl,
      storage_key: storageResult.storageKey,
      storage_provider: 'minio',
    });
  } catch (error: any) {
    if (uploadedStorageKey) {
      await OracleStorageService.deleteFile(uploadedStorageKey).catch(() => {});
    }
    console.error('Upload Company Document Error:', error);
    res.status(500).json({ error: 'Failed to upload company document', details: error?.message });
  }
};

export const uploadInvoiceAttachment = async (req: Request, res: Response): Promise<void> => {
  let uploadedStorageKey: string | null = null;
  try {
    const file = req.file;
    const rawFileName = req.body.file_name || req.body.fileName || file?.originalname || 'invoice-doc';
    const invoiceId = req.body.invoice_id || req.body.invoiceId;
    let invoiceNo = req.body.invoice_no || req.body.invoiceNo;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const isAttendance =
      req.body.is_attendance === true ||
      req.body.is_attendance === 'true' ||
      req.body.category === 'Attendance' ||
      req.body.doc_type === 'attendance' ||
      req.body.docType === 'attendance';

    const isGenerated =
      req.body.is_generated === true ||
      req.body.is_generated === 'true' ||
      req.body.category === 'Generated' ||
      req.body.doc_type === 'generated' ||
      req.body.docType === 'generated';

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    if (!isSuperAdmin && invoiceId) {
      if (!userCompanyId) {
        res.status(403).json({ error: 'Access denied: User has no authorized company scope' });
        return;
      }
      const invCheck = await pool.query('SELECT company_id, is_locked FROM public.invoices WHERE id = $1 LIMIT 1;', [invoiceId]);
      if (!invCheck.rows?.[0] || invCheck.rows[0].company_id !== userCompanyId) {
        res.status(403).json({ error: 'Access denied: Unauthorized invoice document upload' });
        return;
      }
      if (invCheck.rows[0].is_locked) {
        res.status(423).json({ error: 'Cannot upload document to locked invoice' });
        return;
      }
    }

    if (!invoiceNo && invoiceId) {
      try {
        const invRes = await pool.query('SELECT invoice_no FROM public.invoices WHERE id = $1', [invoiceId]);
        if (invRes.rows?.[0]?.invoice_no) {
          invoiceNo = invRes.rows[0].invoice_no;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch invoice_no for naming:', err);
      }
    }

    const category = isAttendance ? 'Certified-Attendance' : (isGenerated ? 'Generated' : 'Certified');
    let fileName = sanitizeFileName(rawFileName);
    if (invoiceNo) {
      fileName = buildInvoiceFileName(invoiceNo, category.replace('-', '_'), path.extname(file.originalname));
    }

    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    const storageKey = buildInvoiceStorageKey({
      entity: 'Invoices',
      year: new Date().getFullYear(),
      month: String(new Date().getMonth() + 1).padStart(2, '0'),
      documentType: category,
      originalName: file.originalname,
    });

    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );
    uploadedStorageKey = storageResult.storageKey;

    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    if (invoiceId) {
      let col = 'certified_doc_storage_key';
      if (isAttendance) col = 'certified_attendance_storage_key';
      else if (isGenerated) col = 'generated_pdf_storage_key';

      await pool.query(
        `UPDATE public.invoices SET ${col} = $1, invoice_storage_provider = 'minio', updated_at = now() WHERE id = $2`,
        [storageResult.storageKey, invoiceId]
      );
    }

    res.status(200).json({
      success: true,
      view_url: viewUrl,
      webViewLink: viewUrl,
      file_name: fileName,
      storage_key: storageResult.storageKey,
      storage_provider: 'minio',
      gcp_file_url: viewUrl,
      generated_pdf_url: isGenerated ? viewUrl : undefined,
      certified_doc_url: (!isAttendance && !isGenerated) ? viewUrl : undefined,
      certified_attendance_url: isAttendance ? viewUrl : undefined,
    });
  } catch (error: any) {
    if (uploadedStorageKey) {
      await OracleStorageService.deleteFile(uploadedStorageKey).catch(() => {});
    }
    console.error('Direct Invoice Upload Error:', error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload invoice attachment', details: error.message });
  }
};

export const getAllSiteDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { site_id, document_type, search } = req.query;

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    let query = `
      SELECT sd.*, json_build_object('id', s.id, 'site_name', s.site_name, 'code_name', s.code_name, 'client_name', s.client_name, 'company_id', s.company_id) AS sites
      FROM public.site_documents sd
      LEFT JOIN public.sites s ON s.id = sd.site_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      params.push(userCompanyId);
      query += ` AND s.company_id = $${params.length}`;
    }

    if (site_id && typeof site_id === 'string' && site_id.trim()) {
      params.push(site_id.trim());
      query += ` AND sd.site_id = $${params.length}`;
    }

    if (document_type && typeof document_type === 'string' && document_type.trim() && document_type !== 'All') {
      params.push(document_type.trim());
      query += ` AND sd.document_type = $${params.length}`;
    }

    query += ' ORDER BY sd.uploaded_at DESC;';

    const result = await pool.query(query, params);
    let filtered = result.rows || [];

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((doc: any) => {
        const siteName = (doc.sites?.site_name || '').toLowerCase();
        const codeName = (doc.sites?.code_name || '').toLowerCase();
        const clientName = (doc.sites?.client_name || '').toLowerCase();
        const fileName = (doc.file_name || '').toLowerCase();
        const docLabel = (doc.document_label || '').toLowerCase();
        const docType = (doc.document_type || '').toLowerCase();
        return (
          siteName.includes(q) ||
          codeName.includes(q) ||
          clientName.includes(q) ||
          fileName.includes(q) ||
          docLabel.includes(q) ||
          docType.includes(q)
        );
      });
    }

    const enriched = await enrichDocumentsWithViewUrl(filtered);
    res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('GET /api/documents Error:', error);
    res.status(500).json({ error: 'Failed to fetch documents', details: error?.message });
  }
};

export const getEmployeeDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id } = req.query;

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    let query = `
      SELECT ed.*, json_build_object('id', s.id, 'employee_name', s.employee_name, 'biometric_code', s.biometric_code, 'designation', s.designation) AS staff
      FROM public.employee_documents ed
      LEFT JOIN public.staff s ON s.id = ed.staff_id
      LEFT JOIN public.sites st ON st.id = s.site_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      params.push(userCompanyId);
      query += ` AND st.company_id = $${params.length}`;
    }

    if (staff_id && typeof staff_id === 'string' && staff_id.trim()) {
      params.push(staff_id.trim());
      query += ` AND ed.staff_id = $${params.length}`;
    }

    query += ' ORDER BY ed.uploaded_at DESC;';

    const result = await pool.query(query, params);
    const enriched = await enrichDocumentsWithViewUrl(result.rows || []);
    res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('GET /api/documents/employee Error:', error);
    res.status(500).json({ error: 'Failed to fetch employee documents', details: error?.message });
  }
};

export const getCompanyDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id, document_type } = req.query;

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    let query = `
      SELECT cd.*, json_build_object('id', c.id, 'name', c.name, 'entity_code', c.entity_code) AS company
      FROM public.company_documents cd
      LEFT JOIN public.companies c ON c.id = cd.company_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(200).json({ success: true, data: [] });
        return;
      }
      params.push(userCompanyId);
      query += ` AND cd.company_id = $${params.length}`;
    } else if (company_id && typeof company_id === 'string' && company_id.trim()) {
      params.push(company_id.trim());
      query += ` AND cd.company_id = $${params.length}`;
    }

    if (document_type && typeof document_type === 'string' && document_type.trim() && document_type !== 'All') {
      params.push(document_type.trim());
      query += ` AND cd.document_type = $${params.length}`;
    }
    query += ' ORDER BY cd.created_at DESC;';
    const result = await pool.query(query, params);
    const enriched = await enrichDocumentsWithViewUrl(result.rows || []);
    res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('GET /api/documents/company Error:', error);
    res.status(500).json({ error: 'Failed to fetch company documents', details: error?.message });
  }
};

export const uploadSiteDocumentGlobal = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const siteId = req.body.site_id || req.body.siteId;
    const documentType = req.body.document_type || req.body.documentType || 'Work Order';
    const documentLabel = req.body.document_label || req.body.documentLabel;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!siteId) {
      res.status(400).json({ error: 'site_id is required' });
      return;
    }

    if (documentType === 'Other' && (!documentLabel || !documentLabel.trim())) {
      res.status(400).json({ error: 'document_label is required when document_type is Other' });
      return;
    }

    const result = await SiteService.uploadSiteDocument(
      siteId,
      file,
      documentType,
      documentLabel,
      req.user
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error('POST /api/documents/upload Error:', error);
    res.status(500).json({ error: 'Failed to upload document', details: error?.message });
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = req.params.documentId || req.params.id;
    if (!documentId) {
      res.status(400).json({ error: 'Document ID is required' });
      return;
    }

    let foundTable: string | null = null;
    let docRecord: any = null;

    // 1. Check employee_documents
    const empRes = await pool.query('SELECT * FROM public.employee_documents WHERE id = $1', [documentId]);
    if (empRes.rows?.[0]) {
      foundTable = 'employee_documents';
      docRecord = empRes.rows[0];
    }

    // 2. Check site_documents
    if (!docRecord) {
      const siteRes = await pool.query('SELECT * FROM public.site_documents WHERE id = $1', [documentId]);
      if (siteRes.rows?.[0]) {
        foundTable = 'site_documents';
        docRecord = siteRes.rows[0];
      }
    }

    // 3. Check company_documents
    if (!docRecord) {
      const compRes = await pool.query('SELECT * FROM public.company_documents WHERE id = $1', [documentId]);
      if (compRes.rows?.[0]) {
        foundTable = 'company_documents';
        docRecord = compRes.rows[0];
      }
    }

    if (!docRecord || !foundTable) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    // Direct document lock check
    if (docRecord.is_locked && !isSuperAdmin) {
      res.status(423).json({ error: 'Document is locked and cannot be deleted' });
      return;
    }

    // Entity-level lock and tenant authorization check
    if (foundTable === 'employee_documents') {
      const staffRes = await pool.query(
        `SELECT s.id, s.is_locked, st.company_id
         FROM public.staff s
         LEFT JOIN public.sites st ON st.id = s.site_id
         WHERE s.id = $1 LIMIT 1;`,
        [docRecord.staff_id]
      );
      if (staffRes.rows?.[0]) {
        const staff = staffRes.rows[0];
        if (staff.is_locked && !isSuperAdmin) {
          res.status(423).json({ error: 'Cannot delete document of locked staff record' });
          return;
        }
        if (!isSuperAdmin) {
          if (!userCompanyId || !staff.company_id || userCompanyId !== staff.company_id) {
            res.status(403).json({ error: 'Access denied: Unauthorized company access' });
            return;
          }
        }
      } else if (!isSuperAdmin) {
        res.status(403).json({ error: 'Access denied: Target staff record not found' });
        return;
      }
    } else if (foundTable === 'site_documents') {
      const siteRes = await pool.query(
        'SELECT id, is_locked, company_id FROM public.sites WHERE id = $1 LIMIT 1;',
        [docRecord.site_id]
      );
      if (siteRes.rows?.[0]) {
        const site = siteRes.rows[0];
        if (site.is_locked && !isSuperAdmin) {
          res.status(423).json({ error: 'Cannot delete document of locked site record' });
          return;
        }
        if (!isSuperAdmin) {
          if (!userCompanyId || !site.company_id || userCompanyId !== site.company_id) {
            res.status(403).json({ error: 'Access denied: Unauthorized company access' });
            return;
          }
        }
      } else if (!isSuperAdmin) {
        res.status(403).json({ error: 'Access denied: Target site record not found' });
        return;
      }
    } else if (foundTable === 'company_documents') {
      const compRes = await pool.query(
        'SELECT id, is_locked FROM public.companies WHERE id = $1 LIMIT 1;',
        [docRecord.company_id]
      );
      if (compRes.rows?.[0]) {
        const comp = compRes.rows[0];
        if (comp.is_locked && !isSuperAdmin) {
          res.status(423).json({ error: 'Cannot delete document of locked company record' });
          return;
        }
        if (!isSuperAdmin) {
          if (!userCompanyId || userCompanyId !== comp.id) {
            res.status(403).json({ error: 'Access denied: Unauthorized company access' });
            return;
          }
        }
      } else if (!isSuperAdmin) {
        res.status(403).json({ error: 'Access denied: Target company record not found' });
        return;
      }
    }

    // Authorization and lock checks passed: safe to delete MinIO object and DB row
    if (docRecord.storage_provider === 'minio' && docRecord.storage_key) {
      try {
        await OracleStorageService.deleteFile(docRecord.storage_key);
        console.warn(`[deleteDocument] Removed MinIO object: ${docRecord.storage_key}`);
      } catch (minioErr) {
        console.error(`[deleteDocument] Failed to delete MinIO object ${docRecord.storage_key}:`, minioErr);
      }
    }

    // Delete DB row
    await pool.query(`DELETE FROM public.${foundTable} WHERE id = $1`, [documentId]);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      id: documentId,
      table: foundTable,
    });
  } catch (error: any) {
    console.error('DELETE /api/documents/:documentId Error:', error);
    res.status(500).json({ error: 'Failed to delete document', details: error?.message });
  }
};

export const deleteSiteDocument = deleteDocument;

export const viewDocumentProxy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;
    const docTypeParam = (req.query.type as string)?.toLowerCase();

    if (!documentId) {
      res.status(400).json({ error: 'documentId is required' });
      return;
    }

    let docRecord: any = null;
    let storageKey: string | null = null;
    let storageProvider: string = 'minio';
    let gcpFileUrl: string | null = null;
    let fileName: string = 'document.pdf';

    let foundTable: string | null = null;

    // 1. Check employee_documents
    const empRes = await pool.query('SELECT * FROM public.employee_documents WHERE id = $1', [documentId]);
    if (empRes.rows?.[0]) {
      foundTable = 'employee_documents';
      docRecord = empRes.rows[0];
      storageKey = docRecord.storage_key;
      storageProvider = docRecord.storage_provider || 'minio';
      gcpFileUrl = docRecord.gcp_file_url;
      fileName = docRecord.file_name || 'employee-document.pdf';
    }

    // 2. Check site_documents
    if (!docRecord) {
      const siteRes = await pool.query('SELECT * FROM public.site_documents WHERE id = $1', [documentId]);
      if (siteRes.rows?.[0]) {
        foundTable = 'site_documents';
        docRecord = siteRes.rows[0];
        storageKey = docRecord.storage_key;
        storageProvider = docRecord.storage_provider || 'minio';
        gcpFileUrl = docRecord.gcp_file_url;
        fileName = docRecord.file_name || 'site-document.pdf';
      }
    }

    // 3. Check company_documents
    if (!docRecord) {
      const compRes = await pool.query('SELECT * FROM public.company_documents WHERE id = $1', [documentId]);
      if (compRes.rows?.[0]) {
        foundTable = 'company_documents';
        docRecord = compRes.rows[0];
        storageKey = docRecord.storage_key;
        storageProvider = docRecord.storage_provider || 'minio';
        gcpFileUrl = docRecord.gcp_file_url;
        fileName = compRes.rows[0].file_name || 'company-document.pdf';
      }
    }

    // 4. Check invoices
    if (!docRecord) {
      const invRes = await pool.query('SELECT * FROM public.invoices WHERE id = $1', [documentId]);
      if (invRes.rows?.[0]) {
        foundTable = 'invoices';
        docRecord = invRes.rows[0];
        storageProvider = docRecord.invoice_storage_provider || docRecord.storage_provider || 'minio';

        if (docTypeParam === 'attendance') {
          storageKey = docRecord.certified_attendance_storage_key;
          gcpFileUrl = docRecord.certified_attendance_url;
          fileName = `${docRecord.invoice_no || 'invoice'}_attendance.pdf`;
        } else if (docTypeParam === 'generated') {
          storageKey = docRecord.generated_pdf_storage_key;
          gcpFileUrl = docRecord.generated_pdf_url;
          fileName = `${docRecord.invoice_no || 'invoice'}_generated.pdf`;
        } else {
          storageKey = docRecord.certified_doc_storage_key;
          gcpFileUrl = docRecord.certified_doc_url;
          fileName = `${docRecord.invoice_no || 'invoice'}_certified.pdf`;
        }
      }
    }

    if (!docRecord) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'superadmin';
    const userCompanyId = user?.company_id || user?.companyId;

    if (!isSuperAdmin) {
      if (!userCompanyId) {
        res.status(403).json({ error: 'Access denied: User has no authorized company scope' });
        return;
      }
      let docCompanyId: string | null = null;
      if (foundTable === 'employee_documents') {
        const staffRes = await pool.query(
          'SELECT st.company_id FROM public.staff s LEFT JOIN public.sites st ON st.id = s.site_id WHERE s.id = $1 LIMIT 1;',
          [docRecord.staff_id]
        );
        docCompanyId = staffRes.rows?.[0]?.company_id || null;
      } else if (foundTable === 'site_documents') {
        const siteRes = await pool.query(
          'SELECT company_id FROM public.sites WHERE id = $1 LIMIT 1;',
          [docRecord.site_id]
        );
        docCompanyId = siteRes.rows?.[0]?.company_id || null;
      } else if (foundTable === 'company_documents') {
        docCompanyId = docRecord.company_id;
      } else if (foundTable === 'invoices') {
        docCompanyId = docRecord.company_id;
      }

      if (!docCompanyId || docCompanyId !== userCompanyId) {
        res.status(403).json({ error: 'Access denied: Unauthorized document access' });
        return;
      }
    }

    const download = req.query.download === 'true';

    if (storageProvider === 'minio' && storageKey) {
      try {
        const obj = await OracleStorageService.getObject(storageKey);
        const disposition = download ? 'attachment' : 'inline';
        if (obj.contentType) {
          res.setHeader('Content-Type', obj.contentType);
        } else if (fileName.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (fileName.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        }
        if (obj.contentLength) {
          res.setHeader('Content-Length', obj.contentLength);
        }
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName)}"`);
        await pipeline(obj.body, res);
        return;
      } catch (storageErr: any) {
        if (res.headersSent) {
          if (!res.writableEnded) {
            res.destroy(storageErr);
          }
          return;
        }
        if (storageErr?.name === 'NoSuchKey' || storageErr?.Code === 'NoSuchKey') {
          res.status(404).json({ error: 'File not found in object storage' });
          return;
        }
        res.status(502).json({ error: 'Storage streaming error' });
        return;
      }
    }

    if (gcpFileUrl) {
      return res.redirect(gcpFileUrl);
    }

    res.status(404).json({ error: 'Document file storage target not found' });
  } catch (error: any) {
    console.error('viewDocumentProxy Error:', error);
    res.status(500).json({ error: 'Failed to view document', details: error?.message });
  }
};

export const uploadCompanyInvoiceDocument = uploadCompanyDocument;
export const uploadInvoiceDirect = uploadInvoiceAttachment;
