import { Request, Response } from 'express';
import { GoogleDriveService } from '../services/googleDriveService';
import { supabaseAdmin } from '../config/supabase';
import { SiteService } from '../services/siteService';
import path from 'path';
import { buildFileName, buildInvoiceFileName, sanitizeSegment } from '../utils/fileUtils';

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
        .select('employee_name')
        .eq('id', staffId)
        .maybeSingle();

      if (staffData) {
        employeeName = (staffData as any).employee_name || '';
      }
    }

    if (!employeeName) {
      employeeName = `Staff_${staffId.slice(0, 8)}`;
    }

    // 1. Upload to Google Drive
    const driveResult = await GoogleDriveService.uploadEmployeeDocument({
      fileBuffer: file.buffer,
      originalName: safeOriginalName,
      mimeType: file.mimetype,
      employeeName,
      docType,
      siteName,
      designation,
    });

    // 2. Save metadata to Supabase employee_documents table
    let insertedDoc = null;
    if (supabaseAdmin) {
      const { data: insertedData, error: dbError } = await supabaseAdmin
        .from('employee_documents')
        .insert([
          {
            staff_id: staffId,
            document_type: docType,
            file_name: driveResult.name,
            gcp_file_url: driveResult.webViewLink,
          },
        ])
        .select(`
          id,
          staff_id,
          document_type,
          file_name,
          gcp_file_url,
          uploaded_at,
          staff:staff_id (id, employee_name, biometric_code, designation)
        `)
        .single();

      if (dbError) {
        console.error('❌ Supabase insert error:', dbError);
        res.status(500).json({
          error: 'Uploaded to Drive, but failed to insert metadata',
          ...(process.env.NODE_ENV === 'development' && { details: dbError.message }),
          gcp_file_url: driveResult.webViewLink,
          file_name: driveResult.name,
        });
        return;
      }
      insertedDoc = insertedData;
    }

    res.status(200).json({
      success: true,
      gcp_file_url: driveResult.webViewLink,
      file_name: driveResult.name,
      document: insertedDoc,
    });
  } catch (error: any) {
    console.error("Google Drive Upload Error:", error.response?.data || error.message || error);
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

    // 1. Upload to Google Drive
    const driveResult = await GoogleDriveService.uploadCompanyDocument({
      fileBuffer: file.buffer,
      originalName: safeOriginalName,
      mimeType: file.mimetype,
      generatedName,
      entity,
      year,
      month,
    });

    // 2. Save metadata to Supabase company_documents table
    let insertedDoc = null;
    if (supabaseAdmin) {
      const { data: insertedData, error: dbError } = await supabaseAdmin
        .from('company_documents')
        .insert([
          {
            entity,
            doc_type: docType,
            month,
            year,
            site_name: siteName,
            file_name: driveResult.name,
            gcp_file_url: driveResult.webViewLink,
          },
        ])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Supabase insert error:', dbError);
        res.status(500).json({
          error: 'Uploaded to Drive, but failed to insert metadata',
          ...(process.env.NODE_ENV === 'development' && { details: dbError.message }),
          gcp_file_url: driveResult.webViewLink,
          file_name: driveResult.name,
        });
        return;
      }
      insertedDoc = insertedData;
    }

    res.status(200).json({
      success: true,
      gcp_file_url: driveResult.webViewLink,
      file_name: driveResult.name,
      document: insertedDoc,
    });
  } catch (error: any) {
    console.error("Google Drive Invoice Upload Error:", error.response?.data || error.message || error);
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

    // Direct single-folder upload for max speed using process.env.DRIVE_INVOICE_FOLDER_ID
    const driveResult = await GoogleDriveService.uploadSingleFolderFile({
      fileBuffer: file.buffer,
      fileName,
      mimeType: file.mimetype,
    });

    const webViewLink = driveResult.webViewLink;

    // Save link to Supabase using supabaseAdmin if invoiceId provided
    if (invoiceId && supabaseAdmin) {
      let updateData: any = {};
      if (isAttendance) {
        updateData = { certified_attendance_url: webViewLink };
      } else if (isGenerated) {
        updateData = { generated_pdf_url: webViewLink };
      } else {
        updateData = { certified_doc_url: webViewLink };
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
      webViewLink,
      file_name: driveResult.name,
      gcp_file_url: webViewLink,
      generated_pdf_url: isGenerated ? webViewLink : undefined,
      certified_doc_url: (!isAttendance && !isGenerated) ? webViewLink : undefined,
      certified_attendance_url: isAttendance ? webViewLink : undefined,
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
      res.status(200).json({ success: true, data: fallback.data || [] });
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

    res.status(200).json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('GET /api/documents Error:', error);
    res.status(500).json({ error: 'Failed to fetch documents', details: error?.message });
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
