import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { AttendanceSheet } from '../types/attendance';
import { AuthUser } from '../types/express';

const AttendanceSheetSchema = z
  .object({
    id: z.string(),
    site_id: z.string().optional(),
    siteId: z.string().optional(),
    company_id: z.string().optional(),
    companyId: z.string().optional(),
    site_name: z.string().optional(),
    siteName: z.string().optional(),
    company_name: z.string().optional(),
    companyName: z.string().optional(),
    month: z.string().optional().default(''),
    year: z.string().optional().default(''),
    records: z.array(z.any()).optional().default([]),
    summary: z.record(z.any()).optional().default({}),
    file_url: z.string().optional().nullable(),
    is_locked: z.boolean().optional().default(false),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

function mapRowToAttendanceSheet(rawRow: any): AttendanceSheet {
  const row = AttendanceSheetSchema.parse(rawRow || {});
  return {
    id: row.id,
    site_id: row.site_id || row.siteId || '',
    siteId: row.siteId || row.site_id || '',
    company_id: row.company_id || row.companyId || '',
    companyId: row.companyId || row.company_id || '',
    siteName: row.siteName || row.site_name || '',
    companyName: row.companyName || row.company_name || '',
    month: row.month,
    year: row.year,
    records: Array.isArray(row.records) ? row.records : [],
    summary: row.summary || {},
    is_locked: row.is_locked ?? false,
    isLocked: row.is_locked ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class AttendanceService {
  /**
   * Validates tenant ownership of a target attendance sheet before mutation
   */
  static async verifySheetOwnership(sheetId: string, user?: AuthUser): Promise<void> {
    if (!user || user.role === 'superadmin' || !user.company_id) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('attendance_sheets')
      .select('id, company_id')
      .eq('id', sheetId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Attendance sheet not found');
    }

    if (data.company_id && data.company_id !== user.company_id) {
      throw new Error('FORBIDDEN_TENANT_ACCESS: You do not have permission to access this attendance sheet');
    }
  }

  /**
   * Get all attendance sheets with optional filters and tenant scoping
   */
  static async getAllSheets(
    siteId?: string,
    month?: string,
    year?: string,
    user?: AuthUser
  ): Promise<AttendanceSheet[]> {
    let query = supabaseAdmin
      .from('attendance_sheets')
      .select('*')
      .order('created_at', { ascending: false });

    if (user && user.role !== 'superadmin' && user.company_id) {
      query = query.eq('company_id', user.company_id);
    }
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
   * Get sheet by ID with tenant verification
   */
  static async getSheetById(id: string, user?: AuthUser): Promise<AttendanceSheet | null> {
    await this.verifySheetOwnership(id, user);

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
   * Save / Create attendance sheet with tenant scoping
   */
  static async createSheet(payload: any, user?: AuthUser): Promise<AttendanceSheet> {
    const now = new Date().toISOString();
    let companyId = payload.company_id || payload.companyId || '';

    if (user && user.role !== 'superadmin' && user.company_id) {
      companyId = user.company_id;
    }

    const insertRow = {
      site_id: payload.site_id || payload.siteId || '',
      company_id: companyId,
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
   * Update attendance sheet with tenant verification
   */
  static async updateSheet(id: string, payload: any, user?: AuthUser): Promise<AttendanceSheet> {
    await this.verifySheetOwnership(id, user);

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
   * Delete sheet with tenant verification
   */
  static async deleteSheet(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifySheetOwnership(id, user);

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
