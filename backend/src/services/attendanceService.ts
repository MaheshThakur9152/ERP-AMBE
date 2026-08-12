import { supabaseAdmin } from '../config/supabase';
import { AttendanceSheet } from '../types/attendance';

function mapRowToAttendanceSheet(row: any): AttendanceSheet {
  return {
    id: row.id,
    site_id: row.site_id || row.siteId || '',
    siteId: row.site_id || row.siteId || '',
    company_id: row.company_id || row.companyId || '',
    companyId: row.company_id || row.companyId || '',
    siteName: row.site_name || row.siteName || '',
    companyName: row.company_name || row.companyName || '',
    month: row.month || '',
    year: row.year || '',
    records: Array.isArray(row.records) ? row.records : [],
    summary: row.summary || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class AttendanceService {
  /**
   * Get all attendance sheets with optional filters
   */
  static async getAllSheets(siteId?: string, month?: string, year?: string): Promise<AttendanceSheet[]> {
    let query = supabaseAdmin
      .from('attendance_sheets')
      .select('*')
      .order('created_at', { ascending: false });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }
    if (month) {
      query = query.eq('month', month);
    }
    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('⚠️ Error querying attendance_sheets from Supabase:', error.message);
      return [];
    }

    return (data || []).map(mapRowToAttendanceSheet);
  }

  /**
   * Get sheet by ID
   */
  static async getSheetById(id: string): Promise<AttendanceSheet | null> {
    const { data, error } = await supabaseAdmin
      .from('attendance_sheets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching attendance sheet by ID:', error.message);
      return null;
    }

    return mapRowToAttendanceSheet(data);
  }

  /**
   * Save / Create attendance sheet
   */
  static async createSheet(payload: any): Promise<AttendanceSheet> {
    const now = new Date().toISOString();
    const insertRow = {
      site_id: payload.site_id || payload.siteId || '',
      company_id: payload.company_id || payload.companyId || '',
      site_name: payload.site_name || payload.siteName || '',
      company_name: payload.company_name || payload.companyName || '',
      month: payload.month || '',
      year: payload.year || '',
      records: payload.records || [], // Save entire array into records JSONB column
      summary: payload.summary || {},
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('attendance_sheets')
      .insert([insertRow])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error inserting attendance sheet:', error.message);
      throw new Error(`Failed to create attendance sheet: ${error.message}`);
    }

    return mapRowToAttendanceSheet(data);
  }

  /**
   * Update attendance sheet
   */
  static async updateSheet(id: string, payload: any): Promise<AttendanceSheet> {
    const updateRow: any = {
      updated_at: new Date().toISOString(),
    };
    if (payload.site_id !== undefined || payload.siteId !== undefined) {
      updateRow.site_id = payload.site_id || payload.siteId;
    }
    if (payload.company_id !== undefined || payload.companyId !== undefined) {
      updateRow.company_id = payload.company_id || payload.companyId;
    }
    if (payload.site_name !== undefined || payload.siteName !== undefined) {
      updateRow.site_name = payload.site_name || payload.siteName;
    }
    if (payload.month !== undefined) updateRow.month = payload.month;
    if (payload.year !== undefined) updateRow.year = payload.year;
    if (payload.records !== undefined) updateRow.records = payload.records;
    if (payload.summary !== undefined) updateRow.summary = payload.summary;

    const { data, error } = await supabaseAdmin
      .from('attendance_sheets')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error updating attendance sheet:', error.message);
      throw new Error(`Failed to update attendance sheet: ${error.message}`);
    }

    return mapRowToAttendanceSheet(data);
  }

  /**
   * Delete sheet
   */
  static async deleteSheet(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('attendance_sheets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting attendance sheet:', error.message);
      throw new Error(`Failed to delete attendance sheet: ${error.message}`);
    }

    return true;
  }
}
