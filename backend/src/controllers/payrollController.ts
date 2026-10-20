import { Request, Response } from 'express';
import { z } from 'zod';
import { PayrollService } from '../services/payrollService';
import { pool } from '../db/pool';

const CalculatePayrollSchema = z.object({
  site_id: z.string().uuid('Invalid site_id'),
  month_year: z.string().min(1, 'month_year is required'),
  days_in_month: z.number().int().positive().default(30),
});

export const PayrollController = {
  /**
   * POST /api/payroll/calculate
   */
  async calculate(req: Request, res: Response): Promise<void> {
    try {
      const parsed = CalculatePayrollSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message || 'Validation error' });
        return;
      }

      const { site_id, month_year, days_in_month } = parsed.data;
      const records = await PayrollService.calculateSitePayroll(site_id, month_year, days_in_month);

      res.status(200).json({
        success: true,
        message: `Calculated and saved payroll for ${records.length} staff member(s)`,
        data: records,
      });
    } catch (err: any) {
      console.error('[PayrollController:calculate] Error:', err);
      res.status(500).json({ error: err.message || 'Server error calculating payroll' });
    }
  },

  /**
   * GET /api/payroll
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { site_id, month_year } = req.query;
      let query = 'SELECT * FROM public.payroll_records WHERE 1=1';
      const params: any[] = [];

      if (month_year) {
        params.push(month_year);
        query += ` AND month_year = $${params.length}`;
      }
      if (site_id) {
        params.push(site_id);
        query += ` AND site_id = $${params.length}`;
      }

      query += ' ORDER BY employee_name ASC';

      const result = await pool.query(query, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      console.error('[PayrollController:list] Error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/payroll/records
   */
  async upsertRecords(req: Request, res: Response): Promise<void> {
    try {
      const { withTransaction } = await import('../db/pool');
      const records = Array.isArray(req.body) ? req.body : [req.body];
      if (records.length === 0) {
        res.status(400).json({ error: 'No payroll records provided' });
        return;
      }

      const results = await withTransaction(async (client) => {
        const savedRows = [];
        for (const rec of records) {
          if (!rec.staff_id || !rec.month_year) {
            continue;
          }

          if (rec.site_id && rec.month_year) {
            const lockCheck = await client.query(
              `SELECT is_locked FROM public.payroll_records WHERE site_id = $1 AND month_year = $2 AND is_locked = true LIMIT 1;`,
              [rec.site_id, rec.month_year]
            );
            if (lockCheck.rows.length > 0) {
              const err: any = new Error(`Payroll for site ${rec.site_id} for ${rec.month_year} is locked.`);
              err.statusCode = 423;
              throw err;
            }
          }

          const allowedCols = [
            'staff_id', 'site_id', 'month_year', 'site_name', 'emp_id', 'employee_name',
            'designation', 'rate_card_id', 'days_in_month', 'pd', 'wo', 'payable_days',
            'earned_basic', 'earned_hra', 'earned_other', 'earned_conveyance', 'earned_incentive',
            'earned_gross', 'earned_bonus', 'earned_part_bonus', 'remaining_part_bonus',
            'bonus_amount_snapshot', 'part_bonus_amount_snapshot', 'part_bonus_percent_snapshot',
            'rate_card_remark_snapshot', 'bonus_full_entitlement', 'bonus_monthly_allocation',
            'epf_deduction', 'esic_deduction', 'pt_deduction', 'epf', 'esic', 'pt',
            'manual_pt_adjustment', 'manual_pt_adjustment_reason',
            'advances', 'adv_amt', 'shirt', 'pant', 'shoes', 'id_card', 'other_amt',
            'adv_total', 'in_this_mth', 'in_next_mth', 'adv_date', 'remark',
            'net_salary', 'total_net_salary', 'is_paid', 'is_locked',
            'pf_no', 'esic_no', 'bank_account_no', 'bank_ifsc_code',
            'custom_earnings', 'custom_deductions', 'is_manually_edited', 'manual_override_data'
          ];

          const dataToInsert: Record<string, any> = {};
          for (const col of allowedCols) {
            if (rec[col] !== undefined) {
              dataToInsert[col] = (typeof rec[col] === 'object' && rec[col] !== null && !(rec[col] instanceof Date))
                ? JSON.stringify(rec[col])
                : rec[col];
            }
          }

          const cols = Object.keys(dataToInsert);
          const vals = Object.values(dataToInsert);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
          const updateSets = cols
            .filter((c) => c !== 'staff_id' && c !== 'month_year')
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');

          const query = `
            INSERT INTO public.payroll_records (${cols.map(c => `"${c}"`).join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (staff_id, month_year)
            DO UPDATE SET ${updateSets}, updated_at = NOW()
            RETURNING *;
          `;

          const result = await client.query(query, vals);
          savedRows.push(result.rows[0]);
        }
        return savedRows;
      });

      res.status(200).json({ success: true, data: results });
    } catch (err: any) {
      console.error('[PayrollController:upsertRecords] Error:', err);
      res.status(err.statusCode || 500).json({ error: err.message || 'Failed to save payroll records' });
    }
  },
};
