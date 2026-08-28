import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
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
import { buildInvoiceFileName, sanitizeSegment } from '../utils/fileUtils';

function sanitizeFileName(name?: string): string {
  if (!name) return 'document';
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return `${sanitizeSegment(base)}${ext}`;
}

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
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

    const safeOriginalName = sanitizeFileName(file.originalname);

    // If employeeName was not supplied in body, query staff table
    if (!employeeName && supabaseAdmin) {
      const { data: staffData } = await supabaseAdmin
        .from('staff')
        .select('employee_name, designation')
        .eq('id', staffId)
        .maybeSingle();

      if (staffData) {
        employeeName = (staffData as any).employee_name || '';
      }
    }

    if (!employeeName) {
      employeeName = `Staff_${staffId.slice(0, 8)}`;
    }

    // 1. Run file compression unchanged before storage call
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    // 2. Build storage key matching convention: employees/{siteName}/{designation}/{employeeName}/{timestamp}-{fileName}
    const storageKey = buildEmployeeStorageKey({
      siteName,
      designation,
      employeeName,
      fileName: safeOriginalName,
    });

    // 3. Upload to MinIO / Oracle Object Storage
    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );

    // 4. Generate signed read URL for immediate client preview
    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    // 5. Save metadata to Supabase employee_documents table
    let insertedDoc = null;
    if (supabaseAdmin) {
      const { data: insertedData, error: dbError } = await supabaseAdmin
        .from('employee_documents')
        .insert([
          {
            staff_id: staffId,
            document_type: docType,
            file_name: safeOriginalName,
            storage_provider: 'minio',
            storage_key: storageResult.storageKey,
            gcp_file_url: null,
          },
        ])
        .select(`
          id,
          staff_id,
          document_type,
          file_name,
          storage_provider,
          storage_key,
          gcp_file_url,
          uploaded_at,
          staff:staff_id (id, employee_name, biometric_code, designation)
        `)
        .single();

      if (dbError) {
        console.error('❌ Supabase insert error:', dbError);
        res.status(500).json({
          error: 'Uploaded to storage, but failed to insert metadata',
          ...(process.env.NODE_ENV === 'development' && { details: dbError.message }),
          view_url: viewUrl,
          gcp_file_url: viewUrl,
          file_name: safeOriginalName,
        });
        return;
      }
      insertedDoc = insertedData ? await enrichDocumentWithViewUrl(insertedData) : null;
    }

    res.status(200).json({
      success: true,
      view_url: viewUrl,
      gcp_file_url: viewUrl, // Backward compatibility
      file_name: safeOriginalName,
      storage_key: storageResult.storageKey,
      storage_provider: 'minio',
      document: insertedDoc,
    });
  } catch (error: any) {
    console.error("Document Upload Error:", error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
  }
};

export const uploadCompanyInvoiceDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const entity = req.body.entity || 'Ambe';
    const docType = req.body.doc_type || 'Tax Invoice';
    const month = req.body.month || 'Jan';
    const year = req.body.year || '2026';
    const siteName = req.body.site_name || '';
    const rawGeneratedName = req.body.generatedName || file?.originalname;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const generatedName = sanitizeFileName(rawGeneratedName);
    const safeOriginalName = sanitizeFileName(file.originalname);
    const effectiveFileName = generatedName || safeOriginalName;

    // 1. Run file compression unchanged before storage call
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    // 2. Build storage key matching convention: invoices/{entity}/{year}/{month}/{timestamp}-{fileName}
    const storageKey = buildInvoiceStorageKey({
      entity,
      year,
      month,
      fileName: effectiveFileName,
    });

    // 3. Upload to MinIO / Oracle Object Storage
    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );

    // 4. Generate signed read URL
    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    // 5. Save metadata to Supabase company_documents table if present
    let insertedDoc = null;
    if (supabaseAdmin) {
      try {
        const { data: insertedData, error: dbError } = await supabaseAdmin
          .from('company_documents')
          .insert([
            {
              entity,
              doc_type: docType,
              month,
              year,
              site_name: siteName,
              file_name: effectiveFileName,
              storage_provider: 'minio',
              storage_key: storageResult.storageKey,
              gcp_file_url: null,
            },
          ])
          .select()
          .single();

        if (dbError) {
          console.warn('ℹ️ company_documents insert skipped or table absent:', dbError.message);
        } else {
          insertedDoc = insertedData ? await enrichDocumentWithViewUrl(insertedData) : null;
        }
      } catch (err: any) {
        console.warn('ℹ️ company_documents table handling:', err?.message);
      }
    }

    res.status(200).json({
      success: true,
      view_url: viewUrl,
      gcp_file_url: viewUrl, // Backward compatibility
      file_name: effectiveFileName,
      storage_key: storageResult.storageKey,
      storage_provider: 'minio',
      document: insertedDoc,
    });
  } catch (error: any) {
    console.error("Invoice Document Upload Error:", error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload invoice document', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
  }
};

export const uploadInvoiceDirect = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const rawFileName = req.body.file_name || req.body.fileName || file?.originalname;
    const invoiceId = req.body.invoice_id || req.body.invoiceId || req.body.id;
    let invoiceNo = req.body.invoice_no || req.body.invoiceNo || '';

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const isAttendance =
      req.body.doc_type === 'attendance' ||
      req.body.docType === 'attendance' ||
      rawFileName?.toLowerCase().includes('attendance');

    const isGenerated =
      req.body.is_generated === true ||
      req.body.is_generated === 'true' ||
      req.body.category === 'Generated' ||
      req.body.doc_type === 'generated' ||
      req.body.docType === 'generated';

    // If invoice_no wasn't provided, fetch it from DB if invoiceId is given
    if (!invoiceNo && invoiceId && supabaseAdmin) {
      try {
        const { data: inv } = await supabaseAdmin
          .from('invoices')
          .select('invoice_no')
          .eq('id', invoiceId)
          .maybeSingle();
        if (inv?.invoice_no) {
          invoiceNo = inv.invoice_no;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch invoice_no for naming:', err);
      }
    }

    let fileName = sanitizeFileName(rawFileName);
    if (invoiceNo) {
      const category = isAttendance ? 'Certified_Attendance' : (isGenerated ? 'Generated' : 'Certified');
      fileName = buildInvoiceFileName(invoiceNo, category, path.extname(file.originalname));
    }

    // 1. Run file compression unchanged before storage call
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    // 2. Build storage key matching convention: invoices/{entity}/{year}/{month}/{timestamp}-{fileName}
    const storageKey = buildInvoiceStorageKey({
      entity: 'Invoices',
      year: new Date().getFullYear(),
      month: String(new Date().getMonth() + 1).padStart(2, '0'),
      fileName,
    });

    // 3. Upload to MinIO / Oracle Object Storage
    const storageResult = await OracleStorageService.uploadFile(
      compressed.buffer,
      storageKey,
      compressed.mimeType
    );

    // 4. Generate signed read URL
    const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

    // 5. Save storage key and provider to Supabase invoices table
    if (invoiceId && supabaseAdmin) {
      let updateData: any = {
        invoice_storage_provider: 'minio',
      };
      if (isAttendance) {
        updateData.certified_attendance_storage_key = storageResult.storageKey;
      } else if (isGenerated) {
        updateData.generated_pdf_storage_key = storageResult.storageKey;
      } else {
        updateData.certified_doc_storage_key = storageResult.storageKey;
      }

      const { error: dbError } = await supabaseAdmin
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (dbError) {
        console.error('Supabase invoice attachment update error:', dbError);
      }
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
    console.error('Direct Invoice Upload Error:', error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload invoice attachment', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
  }
};

export const getAllSiteDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { site_id, document_type, search } = req.query;
    const user = req.user;

    let query = supabaseAdmin
      .from('site_documents')
      .select('*, sites(id, site_name, code_name, client_name, company_id)')
      .order('uploaded_at', { ascending: false });

    if (site_id && typeof site_id === 'string' && site_id.trim()) {
      query = query.eq('site_id', site_id.trim());
    }

    if (document_type && typeof document_type === 'string' && document_type.trim() && document_type !== 'All') {
      query = query.eq('document_type', document_type.trim());
    }

    const { data, error } = await query;

    if (error) {
      console.warn('⚠️ Supabase error fetching all site_documents, attempting fallback:', error.message);
      const fallback = await supabaseAdmin
        .from('site_documents')
        .select('*, sites(id, site_name, code_name, client_name, company_id)');
      if (fallback.error) {
        throw new Error(fallback.error.message);
      }
      const enrichedFallback = await enrichDocumentsWithViewUrl(fallback.data || []);
      res.status(200).json({ success: true, data: enrichedFallback });
      return;
    }

    let filtered = data || [];

    // Tenant isolation if non-superadmin
    if (user && user.role !== 'superadmin' && user.company_id) {
      filtered = filtered.filter((doc: any) => doc.sites?.company_id === user.company_id);
    }

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
    let query = supabaseAdmin
      .from('employee_documents')
      .select('*, staff:staff_id(id, employee_name, biometric_code, designation)')
      .order('uploaded_at', { ascending: false });

    if (staff_id && typeof staff_id === 'string' && staff_id.trim()) {
      query = query.eq('staff_id', staff_id.trim());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const enriched = await enrichDocumentsWithViewUrl(data || []);
    res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('GET /api/documents/employee Error:', error);
    res.status(500).json({ error: 'Failed to fetch employee documents', details: error?.message });
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

export const deleteSiteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Document id is required' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('site_documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Delete site document error:', error);
      res.status(500).json({ error: 'Failed to delete document', details: error.message });
      return;
    }

    res.status(200).json({ success: true, message: 'Document deleted successfully', id });
  } catch (error: any) {
    console.error('DELETE /api/documents/:id Error:', error);
    res.status(500).json({ error: 'Failed to delete document', details: error?.message });
  }
};
