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
