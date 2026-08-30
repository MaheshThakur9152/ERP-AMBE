import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';

const BulkAssignRateCardSchema = z.object({
  rate_card_id: z.string().uuid('Invalid rate card ID'),
  added: z.array(z.string().uuid()).default([]),
  removed: z.array(z.string().uuid()).default([]),
});

export const StaffController = {
  /**
   * GET /api/staff
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin
        .from('staff')
        .select('*, rate_cards(*), sites(id, site_name, code_name)')
        .order('employee_name');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/staff/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from('staff')
        .select('*, rate_cards(*), sites(id, site_name, code_name)')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        res.status(404).json({ error: 'Staff record not found' });
        return;
      }
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * PUT/PATCH /api/staff/:id
   * Protected by checkFieldLockBouncer('staff')
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const updateData: any = {};

      if (body.employee_name !== undefined || body.name !== undefined) {
        updateData.employee_name = (body.employee_name || body.name || '').trim();
      }
      if (body.biometric_code !== undefined || body.biometricCode !== undefined) {
        updateData.biometric_code = (body.biometric_code || body.biometricCode || '').trim() || null;
      }
      if (body.phone !== undefined) updateData.phone = (body.phone || '').trim() || null;
      if (body.gender !== undefined) updateData.gender = body.gender || 'Male';
      if (body.designation !== undefined || body.role !== undefined) {
        updateData.designation = (body.designation || body.role || 'Janitor').trim();
      }
      if (body.status !== undefined) updateData.status = body.status || 'Active';
      if (body.site_id !== undefined || body.siteId !== undefined) {
        updateData.site_id = body.site_id || body.siteId || null;
      }
      if (body.rate_card_id !== undefined || body.rateCardId !== undefined) {
        updateData.rate_card_id = body.rate_card_id || body.rateCardId || null;
      }
      if (body.compliance_name !== undefined || body.complianceName !== undefined) {
        updateData.compliance_name = (body.compliance_name || body.complianceName || '').trim() || null;
      }
      if (body.bank_account_no !== undefined || body.bankAccountNo !== undefined) {
        updateData.bank_account_no = (body.bank_account_no || body.bankAccountNo || '').trim() || null;
      }
      if (body.bank_ifsc_code !== undefined || body.bankIfsc !== undefined) {
        updateData.bank_ifsc_code = (body.bank_ifsc_code || body.bankIfsc || '').trim() || null;
      }
      if (body.bank_name !== undefined || body.bankName !== undefined) {
        updateData.bank_name = (body.bank_name || body.bankName || '').trim() || null;
      }
      if (body.payee_name !== undefined || body.payeeName !== undefined) {
        updateData.payee_name = (body.payee_name || body.payeeName || '').trim() || null;
      }
      if (body.uan_no !== undefined || body.uanNo !== undefined) {
        updateData.uan_no = (body.uan_no || body.uanNo || '').trim() || null;
      }
      if (body.esic_no !== undefined || body.esicNo !== undefined) {
        updateData.esic_no = (body.esic_no || body.esicNo || '').trim() || null;
      }
      if (body.aadhar_no !== undefined || body.aadharNo !== undefined) {
        updateData.aadhar_no = (body.aadhar_no || body.aadharNo || '').trim() || null;
      }
      if (body.pan_no !== undefined || body.panNo !== undefined) {
        updateData.pan_no = (body.pan_no || body.panNo || '').trim() || null;
      }
      if (body.monthly_incentive !== undefined) {
        updateData.monthly_incentive = Number(body.monthly_incentive) || 0;
      }
      if (req.user?.role === 'superadmin' && body.is_locked !== undefined) {
        updateData.is_locked = Boolean(body.is_locked);
      }
      updateData.updated_at = new Date().toISOString();

      let { data, error } = await supabaseAdmin
        .from('staff')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        delete updateData.updated_at;
        const retry = await supabaseAdmin
          .from('staff')
          .update(updateData)
          .eq('id', id)
          .select('*')
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('[StaffController:update] Error:', error);
        res.status(500).json({ error: `Failed to update staff: ${error.message}` });
        return;
      }

      res.status(200).json({ success: true, data, message: 'Staff record updated successfully' });
    } catch (err: any) {
      console.error('[StaffController:update] Fatal error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  },

  /**
   * DELETE /api/staff/:id
   * Protected by checkLockBouncer('staff')
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[StaffController:delete] Error:', error);
        res.status(500).json({ error: `Failed to delete staff: ${error.message}` });
        return;
      }

      res.status(200).json({ success: true, message: 'Staff deleted successfully', id });
    } catch (err: any) {
      console.error('[StaffController:delete] Fatal error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  },

  /**
   * Bulk assign or unassign staff to/from a specific rate card
   * PATCH /api/staff/bulk-assign-rate-card
   */
  async bulkAssignRateCard(req: Request, res: Response): Promise<void> {
    try {
      const parsed = BulkAssignRateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid request payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { rate_card_id, added, removed } = parsed.data;

      if (added.length === 0 && removed.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No changes requested',
          addedCount: 0,
          removedCount: 0,
        });
        return;
      }

      // Assign rate_card_id to added staff
      if (added.length > 0) {
        const { error: addError } = await supabaseAdmin
          .from('staff')
          .update({
            rate_card_id,
          })
          .in('id', added);

        if (addError) {
          console.error('[StaffController:bulkAssignRateCard] Error adding staff to rate card:', addError);
          res.status(500).json({ error: `Failed to assign staff: ${addError.message}` });
          return;
        }
      }

      // Unassign rate_card_id from removed staff
      if (removed.length > 0) {
        const { error: removeError } = await supabaseAdmin
          .from('staff')
          .update({
            rate_card_id: null,
          })
          .in('id', removed);

        if (removeError) {
          console.error('[StaffController:bulkAssignRateCard] Error removing staff from rate card:', removeError);
          res.status(500).json({ error: `Failed to unassign staff: ${removeError.message}` });
          return;
        }
      }

      console.info(
        `[StaffController:bulkAssignRateCard] rate_card_id=${rate_card_id} added=${added.length} removed=${removed.length}`
      );

      res.status(200).json({
        success: true,
        message: 'Rate card roster updated successfully',
        addedCount: added.length,
        removedCount: removed.length,
      });
    } catch (err: any) {
      console.error('[StaffController:bulkAssignRateCard] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Internal server error while assigning rate card roster' });
    }
  },
};
