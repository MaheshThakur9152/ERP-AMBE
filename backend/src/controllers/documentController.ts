import { Request, Response } from 'express';
import { GoogleDriveService } from '../services/googleDriveService';
import { supabaseAdmin } from '../config/supabase';
import path from 'path';

function sanitizeFileName(name?: string): string {
  if (!name) return 'document';
  return path.basename(name.replace(/[^a-zA-Z0-9._-]/g, '_'));
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

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileName = sanitizeFileName(rawFileName);

    // Direct single-folder upload for max speed using process.env.DRIVE_INVOICE_FOLDER_ID
    const driveResult = await GoogleDriveService.uploadSingleFolderFile({
      fileBuffer: file.buffer,
      fileName,
      mimeType: file.mimetype,
    });

    const webViewLink = driveResult.webViewLink;
    const isAttendance =
      req.body.doc_type === 'attendance' ||
      req.body.docType === 'attendance' ||
      rawFileName?.toLowerCase().includes('attendance');

    // Save link to Supabase using supabaseAdmin if invoiceId provided
    if (invoiceId && supabaseAdmin) {
      const updateData = isAttendance
        ? { certified_attendance_url: webViewLink }
        : { certified_doc_url: webViewLink };

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
      certified_doc_url: !isAttendance ? webViewLink : undefined,
      certified_attendance_url: isAttendance ? webViewLink : undefined,
    });
  } catch (error: any) {
    console.error('Direct Invoice Upload Error:', error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to upload invoice attachment', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
  }
};
