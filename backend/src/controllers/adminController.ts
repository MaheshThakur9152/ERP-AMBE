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
  timeColumn?: string;
  mapFn: (row: any, hoursOld: number, createdAt: string) => PendingLockItem;
}

async function fetchEntityPendingLocks(config: EntityLockConfig): Promise<PendingLockItem[]> {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const timeCol = config.timeColumn || 'created_at';
    let query = supabaseAdmin
      .from(config.table)
      .select(config.select)
      .or('is_locked.eq.false,is_locked.is.null');

    if (config.useCutoff !== false) {
      query = query.lt(timeCol, cutoffTime);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[fetchEntityPendingLocks] Error querying ${config.table}:`, error.message);
      return [];
    }
    if (!data) return [];

    return data.map((row: any) => {
      const createdAt = row[timeCol] || row.created_at || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
      return config.mapFn(row, hoursOld, createdAt);
    });
  } catch (err: any) {
    console.error(`[fetchEntityPendingLocks] Unhandled exception querying ${config.table}:`, err.message);
    return [];
  }
}

export class AdminController {
  /**
   * GET /api/admin/pending-locks
   * Protected: SuperAdmin only
   * Queries database for items created >24 hours ago that remain unlocked.
   */
  static async getPendingLocks(req: Request, res: Response): Promise<void> {
    try {
      const lockConfigs: EntityLockConfig[] = [
        // 0. Companies
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
        // 1. Sites
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
        // 2. Invoices
        {
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
        },
        // 3. Attendance Sheets
        {
          table: 'attendance_sheets',
          select: 'id, month, year, site_id, created_at, is_locked, sites(site_name)',
          mapFn: (att, hoursOld, createdAt) => {
            const monthYear = [att.month, att.year].filter(Boolean).join(' ') || 'Attendance';
            return {
              id: att.id,
              entityType: 'attendance_sheets',
              title: `${att.sites?.site_name || 'Site Attendance'} - ${monthYear}`,
              subtitle: `Attendance Sheet`,
              createdAt,
              hoursOld,
              is_locked: false,
              details: { month_year: monthYear },
            };
          },
        },
        // 4. Payroll Records
        {
          table: 'payroll_records',
          select: 'id, month_year, created_at, is_locked, staff(employee_name)',
          mapFn: (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: pr.staff?.employee_name ? `Staff: ${pr.staff.employee_name}` : 'Payroll Record',
            createdAt,
            hoursOld,
            is_locked: false,
            details: { month_year: pr.month_year },
          }),
        },
        // 5. Staff
        {
          table: 'staff',
          select: 'id, employee_name, biometric_code, designation, created_at, is_locked, sites(site_name)',
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
        try {
          const { data, error } = await supabaseAdmin
            .from(config.table)
            .select(config.select)
            .eq('is_locked', true);

          if (error) {
            console.error(`[fetchEntityLocked] Error querying ${config.table}:`, error.message);
            return [];
          }
          if (!data) return [];

          return data.map((row: any) => {
            const createdAt = row.updated_at || row.created_at || new Date().toISOString();
            const hoursOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
            return config.mapFn(row, hoursOld, createdAt);
          });
        } catch (err: any) {
          console.error(`[fetchEntityLocked] Unhandled exception querying ${config.table}:`, err.message);
          return [];
        }
      };

      const lockedConfigs = [
        // 0. Companies
        fetchEntityLocked({
          table: 'companies',
          select: 'id, name, entity_code, gstin, cin_no, tax_prefix, created_at, is_locked',
          mapFn: (comp, hoursOld, createdAt) => ({
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
          select: 'id, month, year, site_id, created_at, updated_at, is_locked, sites(site_name)',
          mapFn: (att, hoursOld, createdAt) => {
            const monthYear = [att.month, att.year].filter(Boolean).join(' ') || 'Attendance';
            return {
              id: att.id,
              entityType: 'attendance_sheets',
              title: `${att.sites?.site_name || 'Site Attendance'} - ${monthYear}`,
              subtitle: `Attendance Sheet`,
              createdAt,
              hoursOld,
              is_locked: true,
              details: { month_year: monthYear },
            };
          },
        }),
        // 4. Payroll Records
        fetchEntityLocked({
          table: 'payroll_records',
          select: 'id, month_year, created_at, updated_at, is_locked, staff(employee_name)',
          mapFn: (pr, hoursOld, createdAt) => ({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: pr.staff?.employee_name ? `Staff: ${pr.staff.employee_name}` : 'Payroll Record',
            createdAt,
            hoursOld,
            is_locked: true,
            details: { month_year: pr.month_year },
          }),
        }),
        // 5. Staff
        fetchEntityLocked({
          table: 'staff',
          select: 'id, employee_name, biometric_code, designation, created_at, is_locked, sites(site_name)',
          mapFn: (st, hoursOld, createdAt) => ({
            id: st.id,
            entityType: 'staff',
            title: st.employee_name || 'Staff Member',
            subtitle: `Designation: ${st.designation || 'Staff'} | Code: ${st.biometric_code || 'N/A'}`,
            createdAt,
            hoursOld,
            is_locked: true,
          }),
        }),
      ];

      const settleLocked = await Promise.allSettled(lockedConfigs);
      const lockedItems = settleLocked
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
    const userEmail = (req as any).user?.email || (req as any).user?.id || 'unknown';
    console.warn(`[admin:lock-item:start] user=${userEmail} body=${JSON.stringify(req.body)}`);

    try {
      const { entityType, id, is_locked } = req.body;

      if (!entityType || !id) {
        console.error(`[admin:lock-item:invalid-payload] user=${userEmail} missing entityType or id:`, req.body);
        res.status(400).json({ error: 'entityType and id are required' });
        return;
      }

      const validTables = ['companies', 'sites', 'invoices', 'attendance_sheets', 'payroll_records', 'materials', 'staff', 'employee_documents', 'company_documents'];
      if (!validTables.includes(entityType)) {
        console.error(`[admin:lock-item:invalid-table] user=${userEmail} invalid table=${entityType}`);
        res.status(400).json({ error: `Invalid entityType table name: ${entityType}` });
        return;
      }

      const lockStatus = is_locked !== undefined ? Boolean(is_locked) : true;

      // 1. Try update with updated_at
      let { error } = await supabaseAdmin
        .from(entityType)
        .update({ is_locked: lockStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      // 2. If updated_at column does not exist on table, fallback to is_locked only
      if (error) {
        console.warn(`[admin:lock-item:warn] update with updated_at failed for ${entityType} id=${id}: ${error.message}. Retrying with is_locked only...`);
        const retryRes = await supabaseAdmin
          .from(entityType)
          .update({ is_locked: lockStatus })
          .eq('id', id);
        error = retryRes.error;
      }

      if (error) {
        console.error(`[admin:lock-item:db-error] table=${entityType} id=${id} lockStatus=${lockStatus} error:`, error.message, error);
        res.status(500).json({ error: `Database lock update failed: ${error.message}`, details: error.message });
        return;
      }

      console.warn(`[admin:lock-item:success] table=${entityType} id=${id} lockStatus=${lockStatus}`);
      res.status(200).json({
        success: true,
        message: `Item ${id} in ${entityType} ${lockStatus ? 'locked' : 'unlocked'} successfully`,
      });
    } catch (err: any) {
      console.error(`[admin:lock-item:fatal-error] body=${JSON.stringify(req.body)} error:`, err.message, err.stack);
      res.status(500).json({ error: 'Failed to update lock status', details: err.message });
    }
  }

  /**
   * POST /api/admin/lock-bulk
   * Protected: SuperAdmin only
   * Bulk locks or unlocks multiple entities in parallel.
   */
  static async lockBulk(req: Request, res: Response): Promise<void> {
    const userEmail = (req as any).user?.email || (req as any).user?.id || 'unknown';
    console.warn(`[admin:lock-bulk:start] user=${userEmail} body=${JSON.stringify(req.body)}`);

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

        let { error } = await supabaseAdmin
          .from(table)
          .update({ is_locked: lockStatus, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (error) {
          const retryRes = await supabaseAdmin
            .from(table)
            .update({ is_locked: lockStatus })
            .eq('id', item.id);
          error = retryRes.error;
        }

        if (error) {
          console.error(`[admin:lock-bulk:item-error] table=${table} id=${item.id} error:`, error.message);
        }
        return !error;
      });

      await Promise.all(lockPromises);

      console.warn(`[admin:lock-bulk:success] count=${items.length} lockStatus=${lockStatus}`);
      res.status(200).json({
        success: true,
        count: items.length,
        message: `Bulk ${lockStatus ? 'lock' : 'unlock'} completed for ${items.length} items`,
      });
    } catch (err: any) {
      console.error('[admin:lock-bulk:fatal-error] Error:', err.message, err.stack);
      res.status(500).json({ error: 'Failed to process bulk lock', details: err.message });
    }
  }
}
