import { z } from 'zod';
import { pool, withTransaction } from '../db/pool';
import { AttendanceSheet } from '../types/attendance';
import { AuthUser } from '../types/express';

const DateOrString = z.union([z.string(), z.date()]).optional();

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
    created_at: DateOrString,
    updated_at: DateOrString,
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
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || undefined),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || undefined),
  };
}

export class AttendanceService {
  /**
   * Validates tenant ownership of a target attendance sheet before mutation
   */
  static async verifySheetOwnership(sheetId: string, user?: AuthUser): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sheetId)) {
      const err: any = new Error('Attendance sheet not found');
      err.statusCode = 404;
      throw err;
    }
    const res = await pool.query('SELECT id, company_id FROM public.attendance_sheets WHERE id = $1 LIMIT 1', [sheetId]);
    if (!res.rows || res.rows.length === 0) {
      const err: any = new Error('Attendance sheet not found');
      err.statusCode = 404;
      throw err;
    }
    const sheet = res.rows[0];
    const userCompanyId = user?.company_id || user?.companyId;
    if (user && user.role !== 'superadmin' && userCompanyId && sheet.company_id && userCompanyId !== sheet.company_id) {
      const authErr: any = new Error('Access denied: Unauthorized company access');
      authErr.statusCode = 403;
      throw authErr;
    }
  }

  /**
   * Get all attendance sheets with optional filters
   */
  static async getAllSheets(
    siteId?: string,
    month?: string,
    year?: string,
    user?: AuthUser
  ): Promise<AttendanceSheet[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    if (siteId) {
      values.push(siteId);
      conditions.push(`site_id = $${values.length}`);
    }
    if (month) {
      values.push(month);
      conditions.push(`month = $${values.length}`);
    }
    if (year) {
      values.push(year);
      conditions.push(`year = $${values.length}`);
    }
    const userCompanyId = user?.company_id || user?.companyId;
    if (user && user.role !== 'superadmin') {
      if (!userCompanyId) {
        return [];
      }
      values.push(userCompanyId);
      conditions.push(`company_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM public.attendance_sheets ${whereClause} ORDER BY created_at DESC;`;
    const res = await pool.query(sql, values);
    return (res.rows || []).map(mapRowToAttendanceSheet);
  }

  /**
   * Get sheet by ID with tenant verification
   */
  static async getSheetById(id: string, user?: AuthUser): Promise<AttendanceSheet | null> {
    await this.verifySheetOwnership(id, user);

    const res = await pool.query('SELECT * FROM public.attendance_sheets WHERE id = $1 LIMIT 1;', [id]);
    if (res.rows?.[0]) {
      return mapRowToAttendanceSheet(res.rows[0]);
    }

    return null;
  }

  /**
   * Save / Create attendance sheet with tenant scoping & month lock check
   */
  static async createSheet(payload: any, user?: AuthUser): Promise<AttendanceSheet> {
    const userCompanyId = user?.company_id || user?.companyId;
    let companyId = payload.company_id || payload.companyId || '';
    if (user && user.role !== 'superadmin') {
      if (!userCompanyId) {
        const err: any = new Error('Access denied: User has no authorized company scope');
        err.statusCode = 403;
        throw err;
      }
      if (companyId && companyId !== userCompanyId) {
        const err: any = new Error('Unauthorized company reassignment');
        err.statusCode = 403;
        throw err;
      }
      companyId = userCompanyId;
    }

    const siteId = payload.site_id || payload.siteId || '';
    if (siteId && user && user.role !== 'superadmin') {
      const siteCheck = await pool.query('SELECT company_id FROM public.sites WHERE id = $1 LIMIT 1;', [siteId]);
      if (!siteCheck.rows?.[0] || siteCheck.rows[0].company_id !== userCompanyId) {
        const err: any = new Error('Unauthorized site reference: site does not belong to authorized company');
        err.statusCode = 403;
        throw err;
      }
    }
    const month = payload.month || '';
    const year = payload.year || '';

    // Check month lock
    if (siteId && month && year) {
      const lockCheck = await pool.query(
        `SELECT is_locked FROM public.attendance_sheets WHERE site_id = $1 AND month = $2 AND year = $3 AND is_locked = true LIMIT 1;`,
        [siteId, month, year]
      );
      if (lockCheck.rows && lockCheck.rows.length > 0) {
        const lockErr: any = new Error(`Attendance for site ${siteId} for ${month}/${year} is locked. Modifications prohibited.`);
        lockErr.statusCode = 423;
        throw lockErr;
      }
    }

    const insertSql = `
      INSERT INTO public.attendance_sheets (
        site_id, company_id, site_name, company_name, month, year,
        records, summary, is_locked, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, false, NOW(), NOW()
      )
      RETURNING *;
    `;

    const res = await pool.query(insertSql, [
      siteId || null,
      companyId || null,
      payload.site_name || payload.siteName || '',
      payload.company_name || payload.companyName || '',
      month,
      year,
      JSON.stringify(payload.records || []),
      JSON.stringify(payload.summary || {}),
    ]);

    return mapRowToAttendanceSheet(res.rows[0]);
  }

  /**
   * Update attendance sheet with tenant verification & month lock check
   */
  static async updateSheet(id: string, payload: any, user?: AuthUser): Promise<AttendanceSheet> {
    const userCompanyId = user?.company_id || user?.companyId;
    const targetCompanyId = payload.company_id !== undefined ? payload.company_id : payload.companyId;

    if (user && user.role !== 'superadmin') {
      if (!userCompanyId) {
        const err: any = new Error('Access denied: User has no authorized company scope');
        err.statusCode = 403;
        throw err;
      }
      if (targetCompanyId !== undefined && targetCompanyId !== userCompanyId) {
        const err: any = new Error('Unauthorized company reassignment');
        err.statusCode = 403;
        throw err;
      }
    }

    await this.verifySheetOwnership(id, user);

    return await withTransaction(async (client) => {
      // 1. Lock check
      const sheetRes = await client.query(
        `SELECT id, is_locked FROM public.attendance_sheets WHERE id = $1 FOR UPDATE;`,
        [id]
      );
      if (!sheetRes.rows || sheetRes.rows.length === 0) {
        throw new Error('Attendance sheet not found');
      }
      if (sheetRes.rows[0].is_locked) {
        const lockErr: any = new Error('Attendance sheet is locked. Modifications prohibited.');
        lockErr.statusCode = 423;
        throw lockErr;
      }

      const newSiteId = payload.site_id !== undefined ? payload.site_id : payload.siteId;
      if (newSiteId !== undefined && newSiteId !== null && user && user.role !== 'superadmin') {
        const siteCheck = await client.query('SELECT company_id FROM public.sites WHERE id = $1 LIMIT 1;', [newSiteId]);
        if (!siteCheck.rows?.[0] || siteCheck.rows[0].company_id !== userCompanyId) {
          const err: any = new Error('Unauthorized site reference: site does not belong to authorized company');
          err.statusCode = 403;
          throw err;
        }
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [id];

      if (payload.site_id !== undefined || payload.siteId !== undefined) {
        values.push(payload.site_id || payload.siteId);
        updates.push(`site_id = $${values.length}`);
      }
      if (targetCompanyId !== undefined && (!user || user.role === 'superadmin')) {
        values.push(targetCompanyId);
        updates.push(`company_id = $${values.length}`);
      }
      if (payload.site_name !== undefined || payload.siteName !== undefined) {
        values.push(payload.site_name || payload.siteName);
        updates.push(`site_name = $${values.length}`);
      }
      if (payload.month !== undefined) {
        values.push(payload.month);
        updates.push(`month = $${values.length}`);
      }
      if (payload.year !== undefined) {
        values.push(payload.year);
        updates.push(`year = $${values.length}`);
      }
      if (payload.records !== undefined) {
        values.push(JSON.stringify(payload.records));
        updates.push(`records = $${values.length}`);
      }
      if (payload.summary !== undefined) {
        values.push(JSON.stringify(payload.summary));
        updates.push(`summary = $${values.length}`);
      }

      const updateSql = `
        UPDATE public.attendance_sheets
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *;
      `;

      const res = await client.query(updateSql, values);
      return mapRowToAttendanceSheet(res.rows[0]);
    });
  }

  /**
   * Delete sheet with tenant verification & lock check
   */
  static async deleteSheet(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifySheetOwnership(id, user);

    const sheetRes = await pool.query(
      `SELECT id, is_locked FROM public.attendance_sheets WHERE id = $1;`,
      [id]
    );
    if (sheetRes.rows?.[0]?.is_locked) {
      const lockErr: any = new Error('Cannot delete locked attendance sheet.');
      lockErr.statusCode = 423;
      throw lockErr;
    }

    await pool.query(`DELETE FROM public.attendance_sheets WHERE id = $1;`, [id]);
    return true;
  }

  /**
   * Batch update attendance records inside transaction with month-lock verification
   */
  static async batchUpdateAttendanceRecords(
    sheetId: string,
    records: any[],
    summary?: any,
    user?: AuthUser
  ): Promise<AttendanceSheet> {
    await this.verifySheetOwnership(sheetId, user);

    return await withTransaction(async (client) => {
      const sheetRes = await client.query(
        `SELECT id, is_locked, site_id, month, year FROM public.attendance_sheets WHERE id = $1 FOR UPDATE;`,
        [sheetId]
      );
      if (!sheetRes.rows || sheetRes.rows.length === 0) {
        throw new Error('Attendance sheet not found');
      }
      if (sheetRes.rows[0].is_locked) {
        const lockErr: any = new Error('Attendance sheet is locked. Modifications prohibited.');
        lockErr.statusCode = 423;
        throw lockErr;
      }

      const updateSql = `
        UPDATE public.attendance_sheets
        SET records = $2,
            summary = COALESCE($3, summary),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;

      const res = await client.query(updateSql, [
        sheetId,
        JSON.stringify(records),
        summary ? JSON.stringify(summary) : null,
      ]);

      return mapRowToAttendanceSheet(res.rows[0]);
    });
  }
}
