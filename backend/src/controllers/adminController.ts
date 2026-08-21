import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export interface PendingLockItem {
  id: string;
  entityType: 'sites' | 'invoices' | 'attendance_sheets' | 'payroll_records' | 'staff';
  title: string;
  subtitle: string;
  createdAt: string;
  hoursOld: number;
  is_locked: boolean;
}

export class AdminController {
  /**
   * GET /api/admin/pending-locks
   * Protected: SuperAdmin only
   * Queries database for items created >24 hours ago that remain unlocked.
   */
  static async getPendingLocks(req: Request, res: Response): Promise<void> {
    try {
      const pendingItems: PendingLockItem[] = [];
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Sites
      const { data: sites } = await supabaseAdmin
        .from('sites')
        .select('id, site_name, client_name, created_at, is_locked')
        .or('is_locked.eq.false,is_locked.is.null')
        .lt('created_at', cutoffTime);

      if (sites) {
        sites.forEach((st: any) => {
          const hoursOld = Math.floor((Date.now() - new Date(st.created_at).getTime()) / (1000 * 60 * 60));
          pendingItems.push({
            id: st.id,
            entityType: 'sites',
            title: st.site_name || 'Unnamed Site',
            subtitle: `Client: ${st.client_name || 'N/A'}`,
            createdAt: st.created_at,
            hoursOld,
            is_locked: false,
          });
        });
      }

      // 2. Invoices
      const { data: invoices } = await supabaseAdmin
        .from('invoices')
        .select('id, invoice_no, type, grand_total, created_at, is_locked, sites(site_name)')
        .or('is_locked.eq.false,is_locked.is.null')
        .lt('created_at', cutoffTime);

      if (invoices) {
        invoices.forEach((inv: any) => {
          const hoursOld = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60));
          pendingItems.push({
            id: inv.id,
            entityType: 'invoices',
            title: `Invoice #${inv.invoice_no || inv.id}`,
            subtitle: `${inv.type || 'Invoice'} - ₹${inv.grand_total || 0}`,
            createdAt: inv.created_at,
            hoursOld,
            is_locked: false,
          });
        });
      }

      // 3. Attendance Sheets
      const { data: attendance } = await supabaseAdmin
        .from('attendance_sheets')
        .select('id, month_year, site_id, created_at, is_locked, sites(site_name)')
        .or('is_locked.eq.false,is_locked.is.null')
        .lt('created_at', cutoffTime);

      if (attendance) {
        attendance.forEach((att: any) => {
          const hoursOld = Math.floor((Date.now() - new Date(att.created_at).getTime()) / (1000 * 60 * 60));
          const siteName = att.sites?.site_name || 'Site Attendance';
          pendingItems.push({
            id: att.id,
            entityType: 'attendance_sheets',
            title: `${siteName} - ${att.month_year || 'Attendance'}`,
            subtitle: `Attendance Sheet`,
            createdAt: att.created_at,
            hoursOld,
            is_locked: false,
          });
        });
      }

      // 4. Payroll Records
      const { data: payroll } = await supabaseAdmin
        .from('payroll_records')
        .select('id, month_year, created_at, is_locked')
        .or('is_locked.eq.false,is_locked.is.null')
        .lt('created_at', cutoffTime);

      if (payroll) {
        payroll.forEach((pr: any) => {
          const hoursOld = Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60));
          pendingItems.push({
            id: pr.id,
            entityType: 'payroll_records',
            title: `Payroll Record - ${pr.month_year || 'Monthly'}`,
            subtitle: `Payroll Batch`,
            createdAt: pr.created_at,
            hoursOld,
            is_locked: false,
          });
        });
      }

      // Sort by oldest first
      pendingItems.sort((a, b) => b.hoursOld - a.hoursOld);

      res.status(200).json({
        success: true,
        count: pendingItems.length,
        data: pendingItems,
      });
    } catch (err: any) {
      console.error('[AdminController.getPendingLocks] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch pending locks' });
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

      const validTables = ['sites', 'invoices', 'attendance_sheets', 'payroll_records', 'staff', 'employees'];
      if (!validTables.includes(entityType)) {
        res.status(400).json({ error: 'Invalid entityType table name' });
        return;
      }

      const lockStatus = is_locked ?? true;

      const { error } = await supabaseAdmin
        .from(entityType)
        .update({ is_locked: lockStatus })
        .eq('id', id);

      if (error) {
        res.status(500).json({ error: `Failed to update lock status: ${error.message}` });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Item ${id} in ${entityType} ${lockStatus ? 'locked' : 'unlocked'} successfully`,
      });
    } catch (err: any) {
      console.error('[AdminController.lockItem] Error:', err);
      res.status(500).json({ error: err.message || 'Failed to update lock status' });
    }
  }

  /**
   * POST /api/admin/lock-bulk
   * Protected: SuperAdmin only
   * Bulk locks multiple entities in parallel.
   */
  static async lockBulk(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'items array is required and must not be empty' });
        return;
      }

      const validTables = ['sites', 'invoices', 'attendance_sheets', 'payroll_records', 'staff', 'employees'];

      const lockPromises = items.map(async (item: { entityType?: string; type?: string; id: string }) => {
        const table = item.entityType || item.type;
        if (!table || !item.id || !validTables.includes(table)) {
          return null;
        }

        const { error } = await supabaseAdmin
          .from(table)
          .update({ is_locked: true })
          .eq('id', item.id);

        if (error) {
          console.error(`Error locking ${table} id ${item.id}:`, error.message);
        }
        return !error;
      });

      await Promise.all(lockPromises);

      res.status(200).json({
        success: true,
        count: items.length,
        message: `Bulk lock completed for ${items.length} items`,
      });
    } catch (err: any) {
      console.error('[AdminController.lockBulk] Error:', err);
      res.status(500).json({ error: err.message || 'Failed to process bulk lock' });
    }
  }
}
