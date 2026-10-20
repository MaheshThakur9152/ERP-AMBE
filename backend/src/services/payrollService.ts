import { pool, withTransaction } from '../db/pool';

export interface RateCard {
  id?: string;
  post_name?: string;
  gross_salary?: number;
  basic_da?: number;
  hra?: number;
  washing_allowance?: number;
  conveyance_allowance?: number;
  other_cash_allowance?: number;
  other_allowance?: number;
  incentive_amount?: number;
  incentive?: number;
  is_flat_wage?: boolean;
  bonus_amount?: number | null;
  part_bonus_amount?: number | null;
  remark?: string;
  [key: string]: any;
}

export interface EmployeeInfo {
  gender?: string;
  monthly_incentive?: number;
  [key: string]: any;
}

export interface PayrollCalculationResult {
  payableDays: number;
  earnedBasic: number;
  earnedHRA: number;
  earnedOther: number;
  earnedWashing: number;
  earnedConveyance: number;
  earnedIncentive: number;
  earnedGross: number;
  taxableForEsic: number;
  epf: number;
  esic: number;
  pt: number;
  earnedBonus: number;
  incentive: number;
  netSalary: number;
  bonusAmountSnapshot: number | null;
  partBonusAmountSnapshot: number | null;
  rateCardRemarkSnapshot: string;
  earnedPartBonus: number;
  remainingPartBonus: number;
  totalNetSalary: number;
}

export function normalizeGender(raw: string | null | undefined): 'M' | 'F' | 'O' {
  if (!raw) return 'M';
  const g = raw.trim().toUpperCase();
  if (g.startsWith('F')) return 'F';
  if (g.startsWith('M')) return 'M';
  return 'O';
}

export function calculatePayroll(
  rateCard: RateCard | null | undefined,
  employee: EmployeeInfo | null | undefined,
  pd: number,
  wo: number,
  daysInMonth: number,
  advances: number = 0,
  manualPtAdj: number = 0
): PayrollCalculationResult | null {
  if (!rateCard) return null;

  const payableDays = (Number(pd) || 0) + (Number(wo) || 0);
  const factor = daysInMonth > 0 ? payableDays / daysInMonth : 0;

  const basic_da = Number(rateCard.basic_da) || 0;
  const hra = Number(rateCard.hra) || 0;
  const other_allowance = Number(rateCard.other_allowance ?? rateCard.washing_allowance ?? rateCard.other_cash_allowance ?? 0);
  const conveyance_allowance = Number(rateCard.conveyance_allowance) || 0;
  const incentive_amount = Number(rateCard.incentive_amount ?? rateCard.incentive ?? employee?.monthly_incentive ?? 0);

  const earnedBasic = Math.round(basic_da * factor);
  const earnedHRA = Math.round(hra * factor);
  const earnedOther = Math.round(other_allowance * factor);
  const earnedConveyance = Math.round(conveyance_allowance * factor);
  const earnedIncentive = Math.round(incentive_amount);

  // Flat Wage Bypass Logic
  if (rateCard.is_flat_wage) {
    const flatEarned = Math.round((Number(rateCard.gross_salary) || 0) * factor);
    const earnedGross = flatEarned + earnedIncentive;
    const netSalary = earnedGross - advances;
    return {
      payableDays,
      earnedBasic: 0,
      earnedHRA: 0,
      earnedOther: 0,
      earnedWashing: 0,
      earnedConveyance: 0,
      earnedIncentive,
      earnedGross,
      taxableForEsic: 0,
      epf: 0,
      esic: 0,
      pt: 0,
      earnedBonus: 0,
      incentive: earnedIncentive,
      netSalary,
      bonusAmountSnapshot: null,
      partBonusAmountSnapshot: null,
      rateCardRemarkSnapshot: rateCard.remark || '',
      earnedPartBonus: 0,
      remainingPartBonus: 0,
      totalNetSalary: netSalary,
    };
  }

  // Standard Compliance Calculation
  const taxableForEsic = earnedBasic + earnedHRA + earnedIncentive;
  const esic = Math.ceil(taxableForEsic * 0.0075);
  const epf = Math.round(earnedBasic * 0.12);
  const earnedGross = earnedBasic + earnedHRA + earnedOther + earnedConveyance + earnedIncentive;

  // Maharashtra PT Logic
  let pt = 0;
  const normGender = normalizeGender(employee?.gender);
  if (normGender === 'F') {
    pt = earnedGross > 25000 ? 200 : 0;
  } else {
    pt = earnedGross >= 10000 ? 200 : 0;
  }
  pt = Math.max(0, pt + manualPtAdj);

  const netSalary = earnedGross - epf - esic - pt - advances;

  const bonusAmount = rateCard.bonus_amount != null && Number(rateCard.bonus_amount) > 0 ? Number(rateCard.bonus_amount) : null;
  const partBonusAmount = rateCard.part_bonus_amount != null && Number(rateCard.part_bonus_amount) > 0 ? Number(rateCard.part_bonus_amount) : null;

  const earnedBonus = (rateCard.is_flat_wage || !bonusAmount)
    ? 0
    : Math.round(bonusAmount * factor);

  const earnedPartBonus = (rateCard.is_flat_wage || !partBonusAmount)
    ? 0
    : Math.round(partBonusAmount * factor);

  const remainingPartBonus = (rateCard.is_flat_wage || !bonusAmount || !partBonusAmount)
    ? 0
    : Math.max(0, bonusAmount - partBonusAmount);

  const totalNetSalary = netSalary + earnedPartBonus;

  return {
    payableDays,
    earnedBasic,
    earnedHRA,
    earnedOther,
    earnedWashing: earnedOther,
    earnedConveyance,
    earnedIncentive,
    earnedGross,
    taxableForEsic,
    epf,
    esic,
    pt,
    earnedBonus,
    incentive: earnedIncentive,
    netSalary,
    bonusAmountSnapshot: bonusAmount,
    partBonusAmountSnapshot: partBonusAmount,
    rateCardRemarkSnapshot: rateCard.remark || '',
    earnedPartBonus,
    remainingPartBonus,
    totalNetSalary,
  };
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function parseMonthYearRange(monthYear: string): { startDate: string; endDate: string } {
  const trimmed = monthYear.trim();
  let year: number | null = null;
  let month: number | null = null;

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const match = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/) || trimmed.match(/^(\d{4})\s+([a-zA-Z]+)$/);
    if (match) {
      const monthStr = (match[1].match(/^[a-zA-Z]+$/) ? match[1] : match[2]).toLowerCase();
      const yearStr = match[1].match(/^\d{4}$/) ? match[1] : match[2];
      if (MONTH_NAME_MAP[monthStr]) {
        month = MONTH_NAME_MAP[monthStr];
        year = parseInt(yearStr, 10);
      }
    }
  }

  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid monthYear format: "${monthYear}"`);
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const endDate = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;

  return { startDate, endDate };
}

export class PayrollService {
  /**
   * Calculate and transactionally persist site payroll for a given month_year
   */
  static async calculateSitePayroll(
    siteId: string,
    monthYear: string,
    daysInMonth: number = 30
  ): Promise<any[]> {
    const { startDate, endDate } = parseMonthYearRange(monthYear);

    // 1. Fetch site, staff, and assigned rate cards
    const staffRes = await pool.query(
      `SELECT s.*, rc.gross_salary, rc.basic_da, rc.hra, rc.washing_allowance, rc.conveyance_allowance,
              rc.other_allowance, rc.incentive_amount, rc.bonus_amount, rc.part_bonus_amount,
              rc.remark, rc.is_flat_wage, rc.post_name,
              sites.site_name
       FROM public.staff s
       LEFT JOIN public.sites ON sites.id = s.site_id
       LEFT JOIN public.rate_cards rc ON rc.id = s.rate_card_id
       WHERE s.site_id = $1 AND s.status != 'Inactive'`,
      [siteId]
    );

    if (staffRes.rows.length === 0) return [];

    const siteName = staffRes.rows[0].site_name || 'Site';
    const computedRecords: any[] = [];

    // 2. Fetch attendance summaries for each staff member for this month
    for (const staff of staffRes.rows) {
      // Count Present and Weekly Off from attendance_records
      const attRes = await pool.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'P') as present_days,
           COUNT(*) FILTER (WHERE status IN ('W/O', 'WOP')) as wo_days
         FROM public.attendance_records
         WHERE staff_id = $1 AND record_date >= $2::date AND record_date < $3::date`,
        [staff.id, startDate, endDate]
      );

      const pd = Number(attRes.rows[0]?.present_days || 0);
      const wo = Number(attRes.rows[0]?.wo_days || 0);

      const calc = calculatePayroll(staff, staff, pd, wo, daysInMonth, 0, 0);
      if (!calc) continue;

      computedRecords.push({
        month_year: monthYear,
        site_id: siteId,
        site_name: siteName,
        staff_id: staff.id,
        rate_card_id: staff.rate_card_id,
        payable_days: calc.payableDays,
        earned_basic: calc.earnedBasic,
        earned_hra: calc.earnedHRA,
        earned_other: calc.earnedOther,
        earned_gross: calc.earnedGross,
        epf_deduction: calc.epf,
        esic_deduction: calc.esic,
        pt_deduction: calc.pt,
        net_salary: calc.netSalary,
        total_net_salary: calc.totalNetSalary,
        pd,
        wo,
        earned_conveyance: calc.earnedConveyance,
        earned_incentive: calc.earnedIncentive,
        earned_bonus: calc.earnedBonus,
        epf: calc.epf,
        esic: calc.esic,
        pt: calc.pt,
        earned_part_bonus: calc.earnedPartBonus,
        remaining_part_bonus: calc.remainingPartBonus,
        bonus_amount_snapshot: calc.bonusAmountSnapshot,
        part_bonus_amount_snapshot: calc.partBonusAmountSnapshot,
        rate_card_remark_snapshot: calc.rateCardRemarkSnapshot,
        designation: staff.designation,
        employee_name: staff.employee_name,
        bank_account_no: staff.bank_account_no,
        bank_ifsc_code: staff.bank_ifsc_code,
        days_in_month: daysInMonth,
      });
    }

    // 3. Persist atomically in PostgreSQL
    await withTransaction(async (client) => {
      for (const rec of computedRecords) {
        const query = `
          INSERT INTO public.payroll_records (
            month_year, site_id, site_name, staff_id, rate_card_id,
            payable_days, earned_basic, earned_hra, earned_other, earned_gross,
            epf_deduction, esic_deduction, pt_deduction, net_salary, total_net_salary,
            pd, wo, earned_conveyance, earned_incentive, earned_bonus,
            epf, esic, pt, earned_part_bonus, remaining_part_bonus,
            bonus_amount_snapshot, part_bonus_amount_snapshot, rate_card_remark_snapshot,
            designation, employee_name, bank_account_no, bank_ifsc_code, days_in_month, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25,
            $26, $27, $28,
            $29, $30, $31, $32, $33, now()
          )
          ON CONFLICT (staff_id, month_year)
          DO UPDATE SET
            payable_days = EXCLUDED.payable_days,
            earned_basic = EXCLUDED.earned_basic,
            earned_hra = EXCLUDED.earned_hra,
            earned_other = EXCLUDED.earned_other,
            earned_gross = EXCLUDED.earned_gross,
            epf_deduction = EXCLUDED.epf_deduction,
            esic_deduction = EXCLUDED.esic_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            net_salary = EXCLUDED.net_salary,
            total_net_salary = EXCLUDED.total_net_salary,
            pd = EXCLUDED.pd,
            wo = EXCLUDED.wo,
            earned_conveyance = EXCLUDED.earned_conveyance,
            earned_incentive = EXCLUDED.earned_incentive,
            earned_bonus = EXCLUDED.earned_bonus,
            epf = EXCLUDED.epf,
            esic = EXCLUDED.esic,
            pt = EXCLUDED.pt,
            earned_part_bonus = EXCLUDED.earned_part_bonus,
            remaining_part_bonus = EXCLUDED.remaining_part_bonus,
            updated_at = now();
        `;
        await client.query(query, [
          rec.month_year, rec.site_id, rec.site_name, rec.staff_id, rec.rate_card_id,
          rec.payable_days, rec.earned_basic, rec.earned_hra, rec.earned_other, rec.earned_gross,
          rec.epf_deduction, rec.esic_deduction, rec.pt_deduction, rec.net_salary, rec.total_net_salary,
          rec.pd, rec.wo, rec.earned_conveyance, rec.earned_incentive, rec.earned_bonus,
          rec.epf, rec.esic, rec.pt, rec.earned_part_bonus, rec.remaining_part_bonus,
          rec.bonus_amount_snapshot, rec.part_bonus_amount_snapshot, rec.rateCardRemarkSnapshot,
          rec.designation, rec.employee_name, rec.bank_account_no, rec.bank_ifsc_code, rec.days_in_month,
        ]);
      }
    });

    return computedRecords;
  }
}
