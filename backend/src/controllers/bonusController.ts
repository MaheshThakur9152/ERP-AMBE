import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';

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
      let staffQuery = supabaseAdmin
        .from('staff')
        .select('id, employee_name, biometric_code, designation, status, site_id, sites(site_name, code_name)')
        .order('employee_name', { ascending: true });

      if (siteId && siteId !== 'all') {
        staffQuery = staffQuery.eq('site_id', siteId);
      }

      const { data: staffData, error: staffErr } = await staffQuery;
      if (staffErr) {
        console.error('[BonusController:getSummary] Staff query error:', staffErr);
        res.status(500).json({ error: staffErr.message });
        return;
      }

      const staffList = staffData || [];
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
      let payrollQuery = supabaseAdmin
        .from('payroll_records')
        .select('staff_id, month_year, remaining_part_bonus, earned_bonus, earned_part_bonus')
        .in('month_year', fyMonths)
        .in('staff_id', staffIds);

      const { data: payrollData, error: payrollErr } = await payrollQuery;
      if (payrollErr) {
        console.error('[BonusController:getSummary] Payroll query error:', payrollErr);
      }

      // 3. Fetch Bonus Disbursements for FY
      let disbQuery = supabaseAdmin
        .from('bonus_disbursements')
        .select('*')
        .eq('financial_year', financialYear)
        .in('staff_id', staffIds)
        .order('disbursed_date', { ascending: false });

      const { data: disbData, error: disbErr } = await disbQuery;
      if (disbErr) {
        console.error('[BonusController:getSummary] Disbursements query error:', disbErr);
      }

      // 4. Map & aggregate
      const payrollMap = new Map<string, { totalAccrued: number; months: Record<string, number> }>();
      (payrollData || []).forEach((pr: any) => {
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
      (disbData || []).forEach((d: any) => {
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

        const siteObj = Array.isArray(s.sites) ? s.sites[0] : s.sites;

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

      const { staff_id, site_id, financial_year, amount, disbursed_date, remark } = parsed.data;

      // 1. Calculate accrued total for this FY
      const fyMonths = getFYMonths(financial_year);
      const { data: prs, error: prErr } = await supabaseAdmin
        .from('payroll_records')
        .select('remaining_part_bonus')
        .in('month_year', fyMonths)
        .eq('staff_id', staff_id);

      if (prErr) {
        console.error('[BonusController:recordDisbursement] PR fetch error:', prErr);
      }

      const accrued = (prs || []).reduce((acc: number, r: any) => acc + (Number(r.remaining_part_bonus) || 0), 0);

      // 2. Calculate existing disbursements
      const { data: priorDisb, error: priorErr } = await supabaseAdmin
        .from('bonus_disbursements')
        .select('amount')
        .eq('financial_year', financial_year)
        .eq('staff_id', staff_id);

      if (priorErr) {
        console.error('[BonusController:recordDisbursement] Prior disb error:', priorErr);
      }

      const alreadyDisbursed = (priorDisb || []).reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);
      const outstanding = Math.max(0, Math.round(accrued - alreadyDisbursed));

      if (amount > outstanding + 1) { // 1 rupee margin for rounding
        res.status(400).json({
          error: `Disbursement amount (₹${amount}) exceeds outstanding balance (₹${outstanding}).`,
          outstanding_balance: outstanding,
        });
        return;
      }

      // 3. Insert disbursement record
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('bonus_disbursements')
        .insert([
          {
            staff_id,
            site_id: site_id || null,
            financial_year,
            amount,
            disbursed_date,
            remark: remark || '',
          },
        ])
        .select()
        .single();

      if (insErr) {
        console.error('[BonusController:recordDisbursement] Insert error:', insErr);
        res.status(500).json({ error: `Failed to record bonus disbursement: ${insErr.message}` });
        return;
      }

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
      const { data, error } = await supabaseAdmin
        .from('bonus_disbursements')
        .select('*, sites(site_name, code_name)')
        .eq('staff_id', staffId)
        .order('disbursed_date', { ascending: false });

      if (error) {
        console.error('[BonusController:getHistory] Error fetching history:', error);
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({
        success: true,
        history: data || [],
      });
    } catch (err: any) {
      console.error('[BonusController:getHistory] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch history' });
    }
  },
};
