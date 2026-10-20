import { Request, Response } from 'express';
import { pool } from '../db/pool';

export interface PendingLockItem {
  id: string;
  entityType: 'companies' | 'sites' | 'invoices' | 'attendance_sheets' | 'payroll_records' | 'materials' | 'staff' | 'employee_documents' | 'company_documents';
  title: string;
  subtitle: string;
  createdAt: string;
  hoursOld: number;
  is_locked: boolean;
  uploadedDocUrl?: string | null;
  details?: Record<string, any>;
}

interface EntityLockConfig {
  table: PendingLockItem['entityType'];
  select: string;
  useCutoff?: boolean;
  timeColumn?: string;
  mapFn: (row: any, hoursOld: number, createdAt: string) => PendingLockItem;
}

async function fetchEntityPendingLocks(config: EntityLockConfig): Promise<PendingLockItem[]> {
  try {
    const cutoffTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const timeCol = config.timeColumn || 'created_at';
    let sql = '';
    const params: any[] = [];

    if (config.table === 'companies') {
      sql = 'SELECT id, name, entity_code, gstin, cin_no, tax_prefix, created_at, is_locked FROM public.companies WHERE (is_locked = false OR is_locked IS NULL)';
    } else if (config.table === 'sites') {
      sql = 'SELECT id, site_name, client_name, created_at, updated_at, is_locked FROM public.sites WHERE (is_locked = false OR is_locked IS NULL)';
    } else if (config.table === 'invoices') {
      sql = 'SELECT i.id, i.invoice_no, i.type, i.grand_total, i.created_at, i.is_locked, i.certified_doc_url, i.certified_attendance_url, s.site_name FROM public.invoices i LEFT JOIN public.sites s ON s.id = i.site_id WHERE (i.is_locked = false OR i.is_locked IS NULL)';
    } else if (config.table === 'attendance_sheets') {
      sql = 'SELECT a.id, a.month_year, a.created_at, a.is_locked, s.site_name FROM public.attendance_sheets a LEFT JOIN public.sites s ON s.id = a.site_id WHERE (a.is_locked = false OR a.is_locked IS NULL)';
    } else if (config.table === 'payroll_records') {
      sql = 'SELECT p.id, p.month_year, p.created_at, p.is_locked, s.employee_name FROM public.payroll_records p LEFT JOIN public.staff s ON s.id = p.staff_id WHERE (p.is_locked = false OR p.is_locked IS NULL)';
    } else if (config.table === 'staff') {
      sql = 'SELECT s.id, s.employee_name, s.biometric_code, s.designation, s.created_at, s.is_locked, st.site_name FROM public.staff s LEFT JOIN public.sites st ON st.id = s.site_id WHERE (s.is_locked = false OR s.is_locked IS NULL)';
    } else {
      sql = `SELECT * FROM public.${config.table} WHERE (is_locked = false OR is_locked IS NULL)`;
    }

    if (config.useCutoff !== false) {
      params.push(cutoffTime);
      sql += ` AND ${timeCol} < $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return (res.rows || []).map((row: any) => {
      const createdAt = row[timeCol] || row.created_at || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
      return config.mapFn(row, hoursOld, createdAt);
    });
  } catch (err: any) {
    console.error(`[fetchEntityPendingLocks] Error querying ${config.table}:`, err.message);
    return [];
  }
}

export class AdminController {
  /**
   * GET /api/admin/pending-locks
   */
  static async getPendingLocks(req: Request, res: Response): Promise<void> {
    try {
      const lockConfigs: EntityLockConfig[] = [
        {
          table: 'companies',
          select: 'id, name, entity_code, gstin, cin_no, tax_prefix, created_at, is_locked',
          useCutoff: false,
          mapFn: (comp, hoursOld, createdAt) => ({
            id: comp.id,
            entityType: 'companies',
            title: comp.name || comp.entity_code || 'Company Entity Profile',
            subtitle: `GSTIN: ${comp.gstin || 'N/A'} | Code: ${comp.entity_code || 'COMP'}`,
            createdAt,
            hoursOld,
            is_locked: false,
            details: {
              company_name: comp.name,
              entity_code: comp.entity_code,
              gstin: comp.gstin,
              cin: comp.cin_no,
              tax_prefix: comp.tax_prefix,
            },
          }),
        },
        {
          table: 'sites',
          select: 'id, site_name, client_name, created_at, updated_at, is_locked',
          timeColumn: 'updated_at',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'sites',
            title: st.site_name || 'Unnamed Site',
            subtitle: `Client: ${st.client_name || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: false,
          }),
        },
        {
          table: 'invoices',
          select: 'id, invoice_no, type, grand_total, created_at, is_locked, certified_doc_url, certified_attendance_url, site_name',
          mapFn: (inv, hoursOld, createdAt) => ({
            id: inv.id,
            entityType: 'invoices',
            title: `Invoice #${inv.invoice_no || inv.id}`,
            subtitle: `${inv.type || 'Invoice'} - ₹${inv.grand_total || 0}`,
            createdAt,
            hoursOld,
            is_locked: false,
            uploadedDocUrl: inv.certified_doc_url || inv.certified_attendance_url || null,
          }),
        },
        {
          table: 'attendance_sheets',
          select: 'id, month_year, site_name, created_at, is_locked',
          mapFn: (att, hoursOld, createdAt) => ({
            id: att.id,
            entityType: 'attendance_sheets',
            title: `${att.site_name || 'Site Attendance'} - ${att.month_year || 'Attendance'}`,
            subtitle: `Attendance Sheet`,
            createdAt,
            hoursOld,
            is_locked: false,
            details: { month_year: att.month_year },
          }),
        },
        {
          table: 'payroll_records',
          select: 'id, month_year, created_at, is_locked, employee_name',
          mapFn: (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: pr.employee_name ? `Staff: ${pr.employee_name}` : 'Payroll Record',
            createdAt,
            hoursOld,
            is_locked: false,
            details: { month_year: pr.month_year },
          }),
        },
        {
          table: 'staff',
          select: 'id, employee_name, biometric_code, designation, created_at, is_locked, site_name',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'staff',
            title: st.employee_name || 'Staff Member',
            subtitle: `Designation: ${st.designation || 'Staff'} | Bio Code: ${st.biometric_code || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: false,
          }),
        },
      ];

      const settleResults = await Promise.allSettled(
        lockConfigs.map((cfg) => fetchEntityPendingLocks(cfg))
      );

      const pendingItems = settleResults
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .sort((a, b) => b.hoursOld - a.hoursOld);

      res.status(200).json({
        success: true,
        count: pendingItems.length,
        data: pendingItems,
      });
    } catch (err: any) {
      console.error('[AdminController.getPendingLocks] Error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch pending locks', details: err.message });
    }
  }

  /**
   * GET /api/admin/locked-items
   */
  static async getLockedItems(req: Request, res: Response): Promise<void> {
    try {
      const fetchEntityLocked = async (table: string, sql: string, mapFn: (row: any, hoursOld: number, createdAt: string) => PendingLockItem): Promise<PendingLockItem[]> => {
        try {
          const res = await pool.query(sql);
          return (res.rows || []).map((row: any) => {
            const createdAt = row.updated_at || row.created_at || new Date().toISOString();
            const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
            return mapFn(row, hoursOld, createdAt);
          });
        } catch (err: any) {
          console.error(`[fetchEntityLocked] Error querying ${table}:`, err.message);
          return [];
        }
      };

      const queries = [
        fetchEntityLocked(
          'companies',
          'SELECT id, name, entity_code, gstin, cin_no, tax_prefix, created_at, is_locked FROM public.companies WHERE is_locked = true',
          (comp, hoursOld, createdAt) => ({
            id: comp.id,
            entityType: 'companies',
            title: comp.name || comp.entity_code || 'Company Entity Profile',
            subtitle: `GSTIN: ${comp.gstin || 'N/A'} | Code: ${comp.entity_code || 'COMP'}`,
            createdAt,
            hoursOld,
            is_locked: true,
            details: {
              company_name: comp.name,
              entity_code: comp.entity_code,
              gstin: comp.gstin,
              cin: comp.cin_no,
              tax_prefix: comp.tax_prefix,
            },
          })
        ),
        fetchEntityLocked(
          'sites',
          'SELECT id, site_name, client_name, created_at, updated_at, is_locked FROM public.sites WHERE is_locked = true',
          (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'sites',
            title: st.site_name || 'Unnamed Site',
            subtitle: `Client: ${st.client_name || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: true,
          })
        ),
        fetchEntityLocked(
          'invoices',
          'SELECT i.id, i.invoice_no, i.type, i.grand_total, i.created_at, i.is_locked, i.certified_doc_url, i.certified_attendance_url, s.site_name FROM public.invoices i LEFT JOIN public.sites s ON s.id = i.site_id WHERE i.is_locked = true',
          (inv, hoursOld, createdAt) => ({
            id: inv.id,
            entityType: 'invoices',
            title: `Invoice #${inv.invoice_no || inv.id}`,
            subtitle: `${inv.type || 'Invoice'} - ₹${inv.grand_total || 0}`,
            createdAt,
            hoursOld,
            is_locked: true,
            uploadedDocUrl: inv.certified_doc_url || inv.certified_attendance_url || null,
          })
        ),
        fetchEntityLocked(
          'attendance_sheets',
          'SELECT a.id, a.month_year, a.created_at, a.is_locked, s.site_name FROM public.attendance_sheets a LEFT JOIN public.sites s ON s.id = a.site_id WHERE a.is_locked = true',
          (att, hoursOld, createdAt) => ({
            id: att.id,
            entityType: 'attendance_sheets',
            title: `${att.site_name || 'Site Attendance'} - ${att.month_year || 'Attendance'}`,
            subtitle: 'Attendance Sheet',
            createdAt,
            hoursOld,
            is_locked: true,
            details: { month_year: att.month_year },
          })
        ),
        fetchEntityLocked(
          'payroll_records',
          'SELECT p.id, p.month_year, p.created_at, p.is_locked, s.employee_name FROM public.payroll_records p LEFT JOIN public.staff s ON s.id = p.staff_id WHERE p.is_locked = true',
          (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: pr.employee_name ? `Staff: ${pr.employee_name}` : 'Payroll Record',
            createdAt,
            hoursOld,
            is_locked: true,
            details: { month_year: pr.month_year },
          })
        ),
        fetchEntityLocked(
          'staff',
          'SELECT s.id, s.employee_name, s.biometric_code, s.designation, s.created_at, s.is_locked, st.site_name FROM public.staff s LEFT JOIN public.sites st ON st.id = s.site_id WHERE s.is_locked = true',
          (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'staff',
            title: st.employee_name || 'Staff Member',
            subtitle: `Designation: ${st.designation || 'Staff'} | Bio Code: ${st.biometric_code || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: true,
          })
        ),
      ];

      const settleResults = await Promise.allSettled(queries);
      const lockedItems = settleResults
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .sort((a, b) => b.hoursOld - a.hoursOld);

      res.status(200).json({
        success: true,
        count: lockedItems.length,
        data: lockedItems,
      });
    } catch (err: any) {
      console.error('[AdminController.getLockedItems] Error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch locked items', details: err.message });
    }
  }

  /**
   * POST /api/admin/lock-item
   */
  static async toggleLock(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, id, is_locked } = req.body;

      if (!entityType || !id) {
        res.status(400).json({ error: 'entityType and id are required' });
        return;
      }

      const validTables = ['companies', 'sites', 'invoices', 'attendance_sheets', 'payroll_records', 'materials', 'staff', 'employee_documents', 'company_documents'];
      if (!validTables.includes(entityType)) {
        res.status(400).json({ error: `Invalid entityType: ${entityType}` });
        return;
      }

      const lockStatus = is_locked !== undefined ? Boolean(is_locked) : true;
      const resUpdate = await pool.query(`UPDATE public.${entityType} SET is_locked = $1 WHERE id = $2 RETURNING id;`, [lockStatus, id]);

      if (!resUpdate.rows || resUpdate.rows.length === 0) {
        res.status(404).json({ error: `Item ${id} in ${entityType} not found` });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Item ${id} in ${entityType} ${lockStatus ? 'locked' : 'unlocked'} successfully`,
      });
    } catch (err: any) {
      console.error('[admin:lock-item:error]', err.message);
      res.status(500).json({ error: 'Failed to update lock status', details: err.message });
    }
  }

  /**
   * POST /api/admin/lock-bulk
   */
  static async lockBulk(req: Request, res: Response): Promise<void> {
    try {
      const { items, is_locked } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'items array is required and must not be empty' });
        return;
      }

      const lockStatus = is_locked !== undefined ? Boolean(is_locked) : true;
      const validTables = ['companies', 'sites', 'invoices', 'attendance_sheets', 'payroll_records', 'materials', 'staff', 'employee_documents', 'company_documents'];

      // Group IDs by table
      const itemsByTable = new Map<string, string[]>();
      for (const item of items) {
        const table = item.entityType || item.type;
        if (table && item.id && validTables.includes(table)) {
          if (!itemsByTable.has(table)) {
            itemsByTable.set(table, []);
          }
          itemsByTable.get(table)!.push(item.id);
        }
      }

      for (const [table, ids] of itemsByTable.entries()) {
        await pool.query(`UPDATE public.${table} SET is_locked = $1 WHERE id = ANY($2::uuid[])`, [lockStatus, ids]);
      }

      res.status(200).json({
        success: true,
        count: items.length,
        message: `Bulk ${lockStatus ? 'lock' : 'unlock'} completed for ${items.length} items`,
      });
    } catch (err: any) {
      console.error('[admin:lock-bulk:error]', err.message);
      res.status(500).json({ error: 'Failed to process bulk lock', details: err.message });
    }
  }

  static lockItem = AdminController.toggleLock;
}
