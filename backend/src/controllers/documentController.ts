import { Request, Response } from 'express';
import { GoogleDriveService } from '../services/googleDriveService';
import { supabaseAdmin } from '../config/supabase';
import path from 'path';

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const staffId = req.body.staff_id || req.body.staffId;
    let employeeName = req.body.employeeName || req.body.employee_name || '';
    const docType = req.body.docType || req.body.document_type || 'Document';
    const siteName = req.body.siteName || '';
    const designation = req.body.designation || '';

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!staffId) {
      res.status(400).json({ error: 'staff_id is required' });
      return;
    }

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
      originalName: file.originalname,
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
          error: 'Uploaded to Drive, but failed to insert metadata in Supabase',
          details: dbError.message,
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
    res.status(500).json({ error: 'Failed to upload', details: error.message });
  }
};

export const uploadCompanyInvoiceDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const entity = req.body.entity || 'Ambe';
    const docType = req.body.docType || req.body.document_type || 'Tax Invoice';
    const month = req.body.month || 'Jan';
    const year = req.body.year || '2026';
    const siteName = req.body.siteName || req.body.site_name || '';
    const generatedName = req.body.generatedName || req.body.file_name || file?.originalname;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // 1. Upload to Google Drive
    const driveResult = await GoogleDriveService.uploadCompanyDocument({
      fileBuffer: file.buffer,
      originalName: file.originalname,
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
          error: 'Uploaded to Drive, but failed to insert metadata in Supabase',
          details: dbError.message,
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
    res.status(500).json({ error: 'Failed to upload invoice document', details: error.message });
  }
};
