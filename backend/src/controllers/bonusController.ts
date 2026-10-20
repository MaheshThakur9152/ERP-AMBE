import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

function getFYMonths(financialYear: string): string[] {
  // e.g. "2026-27" -> startYear = 2026, endYear = 2027
  const startYear = parseInt(financialYear.split('-')[0], 10);
  const endYear = startYear + 1;
  return [
    `April ${startYear}`,
    `May ${startYear}`,
    `June ${startYear}`,
    `July ${startYear}`,
    `August ${startYear}`,
    `September ${startYear}`,
    `October ${startYear}`,
    `November ${startYear}`,
    `December ${startYear}`,
    `January ${endYear}`,
    `February ${endYear}`,
    `March ${endYear}`,
  ];
}

const DisburseSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  site_id: z.string().uuid('Invalid site ID').optional().nullable(),
  financial_year: z.string().min(4, 'Financial year required'),
  amount: z.number().positive('Disbursement amount must be greater than 0'),
  disbursed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  remark: z.string().optional().default(''),
});

export const BonusController = {
  /**
   * GET /api/bonus/summary
   * Aggregates accrued remaining_part_bonus and disbursements for a site & FY
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const financialYear = (req.query.financial_year as string) || '2026-27';
      const siteId = req.query.site_id as string;
      const fyMonths = getFYMonths(financialYear);

      // 1. Fetch Staff
      let staffQuery = `
        SELECT s.id, s.employee_name, s.biometric_code, s.designation, s.status, s.site_id,
               json_build_object('site_name', st.site_name, 'code_name', st.code_name) AS sites
        FROM public.staff s
        LEFT JOIN public.sites st ON st.id = s.site_id
        WHERE 1=1
      `;
      const staffParams: any[] = [];
      if (siteId && siteId !== 'all') {
        staffParams.push(siteId);
        staffQuery += ` AND s.site_id = $${staffParams.length}`;
      }
      staffQuery += ' ORDER BY s.employee_name ASC;';

      const staffRes = await pool.query(staffQuery, staffParams);
      const staffList = staffRes.rows || [];
      const staffIds = staffList.map((s: any) => s.id);

      if (staffIds.length === 0) {
        res.status(200).json({
          success: true,
          financial_year: financialYear,
          fy_months: fyMonths,
          records: [],
          totals: { accrued: 0, disbursed: 0, balance: 0 },
        });
        return;
      }

      // 2. Fetch Payroll Records in FY Months
      const prRes = await pool.query(
        `SELECT staff_id, month_year, remaining_part_bonus, earned_bonus, earned_part_bonus
         FROM public.payroll_records
         WHERE month_year = ANY($1::text[]) AND staff_id = ANY($2::uuid[]);`,
        [fyMonths, staffIds]
      );
      const payrollData = prRes.rows || [];

      // 3. Fetch Bonus Disbursements for FY
      const disbRes = await pool.query(
        `SELECT id, staff_id, financial_year, amount, disbursed_at, notes, created_at,
                disbursed_at::date::text AS disbursed_date, notes AS remark
         FROM public.bonus_disbursements
         WHERE financial_year = $1 AND staff_id = ANY($2::uuid[])
         ORDER BY disbursed_at DESC;`,
        [financialYear, staffIds]
      );
      const disbData = disbRes.rows || [];

      // 4. Map & aggregate
      const payrollMap = new Map<string, { totalAccrued: number; months: Record<string, number> }>();
      payrollData.forEach((pr: any) => {
        const sid = pr.staff_id;
        if (!payrollMap.has(sid)) {
          payrollMap.set(sid, { totalAccrued: 0, months: {} });
        }
        const entry = payrollMap.get(sid)!;
        const val = Number(pr.remaining_part_bonus) || 0;
        entry.totalAccrued += val;
        entry.months[pr.month_year] = val;
      });

      const disbMap = new Map<string, { totalDisbursed: number; list: any[] }>();
      disbData.forEach((d: any) => {
        const sid = d.staff_id;
        if (!disbMap.has(sid)) {
          disbMap.set(sid, { totalDisbursed: 0, list: [] });
        }
        const entry = disbMap.get(sid)!;
        const amt = Number(d.amount) || 0;
        entry.totalDisbursed += amt;
        entry.list.push(d);
      });

      let grandAccrued = 0;
      let grandDisbursed = 0;
      let grandBalance = 0;

      const records = staffList.map((s: any) => {
        const pInfo = payrollMap.get(s.id) || { totalAccrued: 0, months: {} };
        const dInfo = disbMap.get(s.id) || { totalDisbursed: 0, list: [] };

        const accrued = Math.round(pInfo.totalAccrued);
        const disbursed = Math.round(dInfo.totalDisbursed);
        const balance = Math.max(0, accrued - disbursed);

        grandAccrued += accrued;
        grandDisbursed += disbursed;
        grandBalance += balance;

        const siteObj = s.sites;

        return {
          staff_id: s.id,
          employee_name: s.employee_name,
          biometric_code: s.biometric_code,
          designation: s.designation,
          status: s.status,
          site_id: s.site_id,
          site_name: siteObj?.site_name || siteObj?.code_name || 'Unassigned',
          accrued_this_fy: accrued,
          disbursed_this_fy: disbursed,
          balance_outstanding: balance,
          monthly_breakdown: pInfo.months,
          disbursements: dInfo.list,
        };
      });

      res.status(200).json({
        success: true,
        financial_year: financialYear,
        fy_months: fyMonths,
        records,
        totals: {
          accrued: grandAccrued,
          disbursed: grandDisbursed,
          balance: grandBalance,
        },
      });
    } catch (err: any) {
      console.error('[BonusController:getSummary] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch bonus reconciliation summary' });
    }
  },

  /**
   * POST /api/bonus/disburse
   * Records a statutory bonus payout
   */
  async recordDisbursement(req: Request, res: Response): Promise<void> {
    try {
      const parsed = DisburseSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid disbursement payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { staff_id, financial_year, amount, disbursed_date, remark } = parsed.data;

      // 1. Calculate accrued total for this FY
      const fyMonths = getFYMonths(financial_year);
      const prRes = await pool.query(
        `SELECT remaining_part_bonus FROM public.payroll_records
         WHERE month_year = ANY($1::text[]) AND staff_id = $2;`,
        [fyMonths, staff_id]
      );
      const accrued = (prRes.rows || []).reduce((acc: number, r: any) => acc + (Number(r.remaining_part_bonus) || 0), 0);

      // 2. Calculate existing disbursements
      const priorRes = await pool.query(
        `SELECT amount FROM public.bonus_disbursements
         WHERE financial_year = $1 AND staff_id = $2;`,
        [financial_year, staff_id]
      );
      const alreadyDisbursed = (priorRes.rows || []).reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);
      const outstanding = Math.max(0, Math.round(accrued - alreadyDisbursed));

      if (amount > outstanding + 1) { // 1 rupee margin for rounding
        res.status(400).json({
          error: `Disbursement amount (₹${amount}) exceeds outstanding balance (₹${outstanding}).`,
          outstanding_balance: outstanding,
        });
        return;
      }

      // 3. Insert disbursement record
      const insertRes = await pool.query(
        `INSERT INTO public.bonus_disbursements (staff_id, financial_year, amount, disbursed_at, notes, disbursed_by)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6)
         RETURNING id, staff_id, financial_year, amount, disbursed_at, notes, created_at,
                   disbursed_at::date::text AS disbursed_date, notes AS remark;`,
        [staff_id, financial_year, amount, disbursed_date, remark || '', req.user?.id || null]
      );
      const inserted = insertRes.rows[0];

      const updatedBalance = Math.max(0, outstanding - Math.round(amount));

      res.status(201).json({
        success: true,
        message: `Bonus payout of ₹${amount} recorded successfully.`,
        disbursement: inserted,
        updated_balance: updatedBalance,
      });
    } catch (err: any) {
      console.error('[BonusController:recordDisbursement] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Failed to record disbursement' });
    }
  },

  /**
   * GET /api/bonus/history/:staffId
   * Returns disbursement history for a single staff member
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { staffId } = req.params;
      const result = await pool.query(
        `SELECT bd.id, bd.staff_id, bd.financial_year, bd.amount, bd.disbursed_at, bd.notes, bd.created_at,
                bd.disbursed_at::date::text AS disbursed_date, bd.notes AS remark,
                json_build_object('site_name', st.site_name, 'code_name', st.code_name) AS sites
         FROM public.bonus_disbursements bd
         LEFT JOIN public.staff s ON s.id = bd.staff_id
         LEFT JOIN public.sites st ON st.id = s.site_id
         WHERE bd.staff_id = $1
         ORDER BY bd.disbursed_at DESC;`,
        [staffId]
      );

      res.status(200).json({
        success: true,
        history: result.rows || [],
      });
    } catch (err: any) {
      console.error('[BonusController:getHistory] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch history' });
    }
  },
};
