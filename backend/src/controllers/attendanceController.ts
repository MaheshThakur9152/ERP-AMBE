import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendanceService';
import { ApiResponse } from '../types/api';

export class AttendanceController {
  static async getAllSheets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const siteId = req.query.siteId as string | undefined;
      const month = req.query.month as string | undefined;
      const year = req.query.year as string | undefined;

      const sheets = await AttendanceService.getAllSheets(siteId, month, year, req.user);
      const response: ApiResponse = { success: true, data: sheets };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheets:', error.message);
      next(error);
    }
  }

  static async getSheetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.getSheetById(id, req.user);
      if (!sheet) {
        res.status(404).json({ success: false, error: 'Attendance sheet not found' });
        return;
      }
      const response: ApiResponse = { success: true, data: sheet };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheet:', error.message);
      next(error);
    }
  }

  static async createSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await AttendanceService.createSheet(req.body, req.user);
      const response: ApiResponse = { success: true, data: sheet };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('❌ Controller error creating attendance sheet:', error.message);
      next(error);
    }
  }

  static async updateSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.updateSheet(id, req.body, req.user);
      const response: ApiResponse = { success: true, data: sheet };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error updating attendance sheet:', error.message);
      next(error);
    }
  }

  static async batchUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { records, summary } = req.body;
      const sheet = await AttendanceService.batchUpdateAttendanceRecords(id, records || [], summary, req.user);
      const response: ApiResponse = { success: true, data: sheet };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error batch updating attendance:', error.message);
      next(error);
    }
  }

  static async deleteSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await AttendanceService.deleteSheet(id, req.user);
      const response: ApiResponse = { success: true, message: 'Attendance sheet deleted successfully' };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error deleting attendance sheet:', error.message);
      next(error);
    }
  }

  static async getRecords(req: Request, res: Response): Promise<void> {
    try {
      const { pool } = await import('../db/pool');
      const { site_id, start_date, end_date, month, year } = req.query;
      let query = `
        SELECT 
          id, staff_id, site_id, record_date::text AS record_date,
          shift_type, status, in_time, out_time, duration_hours, duration,
          '' AS remarks, created_at, updated_at
        FROM public.attendance_records 
        WHERE 1=1
      `;
      const params: any[] = [];

      if (site_id && site_id !== 'all') {
        params.push(site_id);
        query += ` AND site_id = $${params.length}`;
      }
      if (start_date) {
        params.push(start_date);
        query += ` AND record_date >= $${params.length}`;
      }
      if (end_date) {
        params.push(end_date);
        query += ` AND record_date <= $${params.length}`;
      }
      if (month && year) {
        const mStr = String(month).padStart(2, '0');
        const startDateStr = `${year}-${mStr}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const endDateStr = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        params.push(startDateStr);
        query += ` AND record_date >= $${params.length}`;
        params.push(endDateStr);
        query += ` AND record_date <= $${params.length}`;
      }

      query += ' ORDER BY record_date ASC, staff_id ASC';
      const result = await pool.query(query, params);
      const normalizedRows = (result.rows || []).map((row: any) => ({
        ...row,
        record_date: row.record_date ? String(row.record_date).split('T')[0].split(' ')[0] : row.record_date,
      }));
      res.status(200).json({ success: true, data: normalizedRows });
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance records:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  static async upsertRecords(req: Request, res: Response): Promise<void> {
    try {
      const { withTransaction } = await import('../db/pool');
      const records = Array.isArray(req.body) ? req.body : [req.body];
      if (records.length === 0) {
        res.status(400).json({ error: 'No attendance records provided' });
        return;
      }

      const results = await withTransaction(async (client) => {
        const savedRows = [];
        for (const rec of records) {
          const staff_id = rec.staff_id || rec.employeeId;
          const site_id = rec.site_id || rec.siteId || null;
          const record_date = rec.record_date || rec.date;
          const shift_type = rec.shift_type || (rec.overtime ? 'overtime' : 'regular');
          const status = rec.status;
          const in_time = rec.in_time || rec.inTime || null;
          const out_time = rec.out_time || rec.outTime || null;
          const duration_hours = rec.duration_hours || rec.durationHours || 0;
          const duration = rec.duration || null;

          if (!staff_id || !record_date) {
            continue;
          }

          const query = `
            INSERT INTO public.attendance_records (
              staff_id, site_id, record_date, shift_type, status,
              in_time, out_time, duration_hours, duration
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
            ON CONFLICT (staff_id, record_date)
            DO UPDATE SET
              site_id = COALESCE(EXCLUDED.site_id, attendance_records.site_id),
              shift_type = EXCLUDED.shift_type,
              status = EXCLUDED.status,
              in_time = EXCLUDED.in_time,
              out_time = EXCLUDED.out_time,
              duration_hours = EXCLUDED.duration_hours,
              duration = EXCLUDED.duration
            RETURNING *;
          `;

          const result = await client.query(query, [
            staff_id,
            site_id,
            record_date,
            shift_type,
            status,
            in_time,
            out_time,
            duration_hours,
            duration,
          ]);
          savedRows.push(result.rows[0]);
        }
        return savedRows;
      });

      res.status(200).json({ success: true, data: results });
    } catch (error: any) {
      console.error('❌ Controller error upserting attendance records:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

