import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

const CreateStaffSchema = z.object({
  employee_name: z.string().min(1, 'Employee name is required'),
  biometric_code: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  weekly_off: z.string().optional().default('Sunday'),
  status: z.string().optional().default('Active'),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().default('Male'),
  site_id: z.string().uuid().optional().nullable(),
  rate_card_id: z.string().uuid().optional().nullable(),
  monthly_incentive: z.number().optional().default(0),
  compliance_name: z.string().optional().nullable(),
  bank_account_no: z.string().optional().nullable(),
  bank_ifsc_code: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  payee_name: z.string().optional().nullable(),
  aadhar_no: z.string().optional().nullable(),
  pan_no: z.string().optional().nullable(),
  uan_no: z.string().optional().nullable(),
  esic_no: z.string().optional().nullable(),
  aadhar_doc_url: z.string().optional().nullable(),
  pan_doc_url: z.string().optional().nullable(),
  passbook_doc_url: z.string().optional().nullable(),
  uan_card_doc_url: z.string().optional().nullable(),
  esic_card_doc_url: z.string().optional().nullable(),
  left_date: z.string().optional().nullable(),
  inactive_reason: z.string().optional().default(''),
  is_locked: z.boolean().optional().default(false),
});

const BulkAssignRateCardSchema = z.object({
  rate_card_id: z.string().uuid('Invalid rate card ID'),
  added: z.array(z.string().uuid()).default([]),
  removed: z.array(z.string().uuid()).default([]),
});

export const StaffController = {
  /**
   * POST /api/staff
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = CreateStaffSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message || 'Validation error' });
        return;
      }

      const payload: Record<string, any> = { ...parsed.data };
      if (payload.site_id === '') payload.site_id = null;
      if (payload.rate_card_id === '') payload.rate_card_id = null;
      if (payload.left_date === '') payload.left_date = null;
      payload.is_locked = false;

      const keys = Object.keys(payload);
      const values = keys.map((k) => payload[k]);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO public.staff (${cols}) VALUES (${placeholders}) RETURNING *;`;
      const result = await pool.query(query, values);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      console.error('[StaffController:create] Fatal error:', err.message);
      res.status(500).json({ error: err.message || 'Internal server error creating staff' });
    }
  },

  /**
   * GET /api/staff
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const siteId = (req.query.site_id || req.query.siteId) as string | undefined;
      const user = req.user;
      const isSuperAdmin = user?.role === 'superadmin';
      const userCompanyId = user?.company_id || user?.companyId;

      const conditions: string[] = [];
      const values: any[] = [];

      if (siteId && siteId.trim()) {
        values.push(siteId.trim());
        conditions.push(`s.site_id = $${values.length}`);
      }

      if (!isSuperAdmin && userCompanyId) {
        values.push(userCompanyId);
        conditions.push(`st.company_id = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT s.*,
               row_to_json(rc.*) AS rate_cards,
               json_build_object('id', st.id, 'site_name', st.site_name, 'code_name', st.code_name, 'company_id', st.company_id) AS sites
        FROM public.staff s
        LEFT JOIN public.rate_cards rc ON rc.id = s.rate_card_id
        LEFT JOIN public.sites st ON st.id = s.site_id
        ${whereClause}
        ORDER BY s.employee_name;
      `;
      const result = await pool.query(query, values);
      res.status(200).json({ success: true, data: result.rows || [] });
    } catch (err: any) {
      console.error('[StaffController:list] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/staff/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const query = `
        SELECT s.*,
               row_to_json(rc.*) AS rate_cards,
               json_build_object('id', st.id, 'site_name', st.site_name, 'code_name', st.code_name) AS sites
        FROM public.staff s
        LEFT JOIN public.rate_cards rc ON rc.id = s.rate_card_id
        LEFT JOIN public.sites st ON st.id = s.site_id
        WHERE s.id = $1;
      `;
      const result = await pool.query(query, [id]);
      if (!result.rows || result.rows.length === 0) {
        res.status(404).json({ error: 'Staff record not found' });
        return;
      }
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      console.error('[StaffController:getById] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * PUT/PATCH /api/staff/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const updateData: Record<string, any> = {};

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
      if (body.left_date !== undefined || body.leftDate !== undefined) {
        updateData.left_date = body.left_date || body.leftDate || null;
      }
      if (body.inactive_reason !== undefined || body.inactiveReason !== undefined) {
        updateData.inactive_reason = body.inactive_reason || body.inactiveReason || '';
      }
      if (body.weekly_off !== undefined || body.weeklyOff !== undefined) {
        updateData.weekly_off = body.weekly_off || body.weeklyOff || 'Sunday';
      }
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

      const keys = Object.keys(updateData);
      if (keys.length === 0) {
        const getRes = await pool.query('SELECT * FROM public.staff WHERE id = $1', [id]);
        res.status(200).json({ success: true, data: getRes.rows[0], message: 'No updates provided' });
        return;
      }

      const values = keys.map((k) => updateData[k]);
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

      const updateResult = await pool.query(
        `UPDATE public.staff SET ${setClauses} WHERE id = $${keys.length + 1} RETURNING *;`,
        [...values, id]
      );

      if (!updateResult.rows || updateResult.rows.length === 0) {
        res.status(404).json({ error: 'Staff record not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: updateResult.rows[0],
        message: 'Staff record updated successfully',
      });
    } catch (err: any) {
      console.error('[StaffController:update] Fatal error:', err.message);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  },

  /**
   * DELETE /api/staff/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM public.staff WHERE id = $1', [id]);

      if ((result.rowCount ?? 0) === 0) {
        res.status(404).json({ error: 'Staff record not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Staff deleted successfully', id });
    } catch (err: any) {
      console.error('[StaffController:delete] Fatal error:', err.message);
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

      if (added.length > 0) {
        await pool.query(
          'UPDATE public.staff SET rate_card_id = $1 WHERE id = ANY($2::uuid[])',
          [rate_card_id, added]
        );
      }

      if (removed.length > 0) {
        await pool.query(
          'UPDATE public.staff SET rate_card_id = NULL WHERE id = ANY($1::uuid[])',
          [removed]
        );
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
      console.error('[StaffController:bulkAssignRateCard] Unexpected error:', err.message);
      res.status(500).json({ error: err.message || 'Internal server error while assigning rate card roster' });
    }
  },
};
