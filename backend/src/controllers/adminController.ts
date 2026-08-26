import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface PendingLockItem {
  id: string;
  entityType: 'sites' | 'invoices' | 'attendance_sheets' | 'payroll_records' | 'staff' | 'companies';
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
  mapFn: (row: any, hoursOld: number, createdAt: string) => PendingLockItem;
}

async function fetchEntityPendingLocks(config: EntityLockConfig): Promise<PendingLockItem[]> {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from(config.table)
    .select(config.select)
    .or('is_locked.eq.false,is_locked.is.null');

  if (config.useCutoff !== false) {
    query = query.lt('created_at', cutoffTime);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => {
    const createdAt = row.created_at || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
    return config.mapFn(row, hoursOld, createdAt);
  });
}

export class AdminController {
  /**
   * GET /api/admin/pending-locks
   * Protected: SuperAdmin only
   * Queries database for items created >24 hours ago that remain unlocked.
   */
  static async getPendingLocks(req: Request, res: Response): Promise<void> {
    try {
      const results = await Promise.all([
        // 0. Companies
        fetchEntityPendingLocks({
          table: 'companies',
          select: '*',
          useCutoff: false,
          mapFn: (comp, hoursOld, createdAt) => ({
            id: comp.id,
            entityType: 'companies',
            title: comp.name || comp.legal_name || comp.entity_code || 'Company Entity Profile',
            subtitle: `GSTIN: ${comp.gstin || 'N/A'} | Code: ${comp.entity_code || comp.code || 'COMP'}`,
            createdAt,
            hoursOld,
            is_locked: false,
            details: {
              company_name: comp.name || comp.legal_name,
              entity_code: comp.entity_code || comp.code,
              gstin: comp.gstin,
              cin: comp.cin_no || comp.cin,
              tax_prefix: comp.tax_prefix,
            },
          }),
        }),
        // 1. Sites
        fetchEntityPendingLocks({
          table: 'sites',
          select: 'id, site_name, client_name, created_at, is_locked',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'sites',
            title: st.site_name || 'Unnamed Site',
            subtitle: `Client: ${st.client_name || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: false,
          }),
        }),
        // 2. Invoices
        fetchEntityPendingLocks({
          table: 'invoices',
          select: 'id, invoice_no, type, grand_total, created_at, is_locked, certified_doc_url, certified_attendance_url, sites(site_name)',
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
        }),
        // 3. Attendance Sheets
        fetchEntityPendingLocks({
          table: 'attendance_sheets',
          select: 'id, month_year, site_id, created_at, is_locked, file_url, sites(site_name)',
          mapFn: (att, hoursOld, createdAt) => ({
            id: att.id,
            entityType: 'attendance_sheets',
            title: `${att.sites?.site_name || 'Site Attendance'} - ${att.month_year || 'Attendance'}`,
            subtitle: `Attendance Sheet`,
            createdAt,
            hoursOld,
            is_locked: false,
            uploadedDocUrl: att.file_url || null,
          }),
        }),
        // 4. Payroll Records
        fetchEntityPendingLocks({
          table: 'payroll_records',
          select: 'id, month_year, created_at, is_locked, excel_url',
          mapFn: (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: `Payroll Batch`,
            createdAt,
            hoursOld,
            is_locked: false,
            uploadedDocUrl: pr.excel_url || null,
          }),
        }),
      ]);

      const pendingItems = results.flat().sort((a, b) => b.hoursOld - a.hoursOld);

      res.status(200).json({
        success: true,
        count: pendingItems.length,
        data: pendingItems,
      });
    } catch (err: any) {
      console.error('[AdminController.getPendingLocks] Error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch pending locks', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
    }
  }

  /**
   * GET /api/admin/locked-items
   * Protected: SuperAdmin only
   * Queries database for all records across all 6 tables where is_locked = true.
   */
  static async getLockedItems(req: Request, res: Response): Promise<void> {
    try {
      const fetchEntityLocked = async (config: {
        table: PendingLockItem['entityType'];
        select: string;
        mapFn: (row: any, hoursOld: number, createdAt: string) => PendingLockItem;
      }): Promise<PendingLockItem[]> => {
        const { data, error } = await supabaseAdmin
          .from(config.table)
          .select(config.select)
          .eq('is_locked', true);

        if (error || !data) return [];

        return data.map((row: any) => {
          const createdAt = row.created_at || new Date().toISOString();
          const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
          return config.mapFn(row, hoursOld, createdAt);
        });
      };

      const results = await Promise.all([
        // 0. Companies
        fetchEntityLocked({
          table: 'companies',
          select: '*',
          mapFn: (comp, hoursOld, createdAt) => ({
            id: comp.id,
            entityType: 'companies',
            title: comp.name || comp.legal_name || comp.entity_code || 'Company Entity Profile',
            subtitle: `GSTIN: ${comp.gstin || 'N/A'} | Code: ${comp.entity_code || comp.code || 'COMP'}`,
            createdAt,
            hoursOld,
            is_locked: true,
            details: {
              company_name: comp.name || comp.legal_name,
              entity_code: comp.entity_code || comp.code,
              gstin: comp.gstin,
              cin: comp.cin_no || comp.cin,
              tax_prefix: comp.tax_prefix,
            },
          }),
        }),
        // 1. Sites
        fetchEntityLocked({
          table: 'sites',
          select: 'id, site_name, client_name, created_at, updated_at, is_locked',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'sites',
            title: st.site_name || 'Unnamed Site',
            subtitle: `Client: ${st.client_name || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: true,
          }),
        }),
        // 2. Invoices
        fetchEntityLocked({
          table: 'invoices',
          select: 'id, invoice_no, type, grand_total, created_at, updated_at, is_locked, certified_doc_url, certified_attendance_url, sites(site_name)',
          mapFn: (inv, hoursOld, createdAt) => ({
            id: inv.id,
            entityType: 'invoices',
            title: `Invoice #${inv.invoice_no || inv.id}`,
            subtitle: `${inv.type || 'Invoice'} - ₹${inv.grand_total || 0}`,
            createdAt,
            hoursOld,
            is_locked: true,
            uploadedDocUrl: inv.certified_doc_url || inv.certified_attendance_url || null,
          }),
        }),
        // 3. Attendance Sheets
        fetchEntityLocked({
          table: 'attendance_sheets',
          select: 'id, month_year, site_id, created_at, updated_at, is_locked, file_url, sites(site_name)',
          mapFn: (att, hoursOld, createdAt) => ({
            id: att.id,
            entityType: 'attendance_sheets',
            title: `${att.sites?.site_name || 'Site Attendance'} - ${att.month_year || 'Attendance'}`,
            subtitle: `Attendance Sheet`,
            createdAt,
            hoursOld,
            is_locked: true,
            uploadedDocUrl: att.file_url || null,
          }),
        }),
        // 4. Payroll Records
        fetchEntityLocked({
          table: 'payroll_records',
          select: 'id, month_year, created_at, updated_at, is_locked, excel_url',
          mapFn: (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: `Payroll Batch`,
            createdAt,
            hoursOld,
            is_locked: true,
            uploadedDocUrl: pr.excel_url || null,
          }),
        }),
        // 5. Staff
        fetchEntityLocked({
          table: 'staff',
          select: 'id, name, full_name, employee_code, designation, created_at, updated_at, is_locked, sites(site_name)',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'staff',
            title: st.full_name || st.name || `Staff #${st.employee_code || st.id}`,
            subtitle: `Designation: ${st.designation || 'Staff'} | Code: ${st.employee_code || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: true,
          }),
        }),
      ]);

      const lockedItems = results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.status(200).json({
        success: true,
        count: lockedItems.length,
        data: lockedItems,
      });
    } catch (err: any) {
      console.error('[AdminController.getLockedItems] Error:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch locked items', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
    }
  }

  /**
   * POST /api/admin/lock-item
   * Protected: SuperAdmin only
   * Locks or unlocks a specific entity item.
   */
  static async lockItem(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, id, is_locked } = req.body;

      if (!entityType || !id) {
        res.status(400).json({ error: 'entityType and id are required' });
        return;
      }

      const validTables = ['companies', 'sites', 'invoices', 'attendance_sheets', 'payroll_records', 'materials', 'staff', 'employee_documents', 'company_documents'];
      if (!validTables.includes(entityType)) {
        res.status(400).json({ error: 'Invalid entityType table name' });
        return;
      }

      const lockStatus = is_locked ?? true;

      const { error } = await supabaseAdmin
        .from(entityType)
        .update({ is_locked: lockStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        res.status(500).json({ error: 'Failed to update lock status', ...(process.env.NODE_ENV === 'development' && { details: error.message }) });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Item ${id} in ${entityType} ${lockStatus ? 'locked' : 'unlocked'} successfully`,
      });
    } catch (err: any) {
      console.error('[AdminController.lockItem] Error:', err);
      res.status(500).json({ error: 'Failed to update lock status', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
    }
  }

  /**
   * POST /api/admin/lock-bulk
   * Protected: SuperAdmin only
   * Bulk locks or unlocks multiple entities in parallel.
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

      const lockPromises = items.map(async (item: { entityType?: string; type?: string; id: string }) => {
        const table = item.entityType || item.type;
        if (!table || !item.id || !validTables.includes(table)) {
          return null;
        }

        const { error } = await supabaseAdmin
          .from(table)
          .update({ is_locked: lockStatus, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (error) {
          console.error(`Error updating lock status on ${table} id ${item.id}:`, error.message);
        }
        return !error;
      });

      await Promise.all(lockPromises);

      res.status(200).json({
        success: true,
        count: items.length,
        message: `Bulk ${lockStatus ? 'lock' : 'unlock'} completed for ${items.length} items`,
      });
    } catch (err: any) {
      console.error('[AdminController.lockBulk] Error:', err);
      res.status(500).json({ error: 'Failed to process bulk lock', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
    }
  }
}
