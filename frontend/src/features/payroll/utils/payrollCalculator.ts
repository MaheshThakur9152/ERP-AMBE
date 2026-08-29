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
  advances: number = 0
): PayrollCalculationResult | null {
  if (!rateCard) return null;

  const payableDays = pd + wo;
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
  const earnedIncentive = Math.round(incentive_amount * factor);

  // Flat Wage Bypass Logic (Non-Compliance)
  if (rateCard.is_flat_wage) {
    const flatEarned = Math.round((Number(rateCard.gross_salary) || 0) * factor);
    const earnedGross = flatEarned + earnedIncentive;
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
      netSalary: earnedGross - advances,
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
  } else if (normGender === 'M') {
    pt = earnedGross >= 10000 ? 200 : 0;
  } else {
    console.warn(`[PT Calculation] Unhandled gender '${employee?.gender}' (normalized: 'O') for employee. Rule unassigned.`);
    pt = 0;
  }

  // Bonus Accrual (8.33% of Basic)
  const earnedBonus = Math.round(earnedBasic * 0.0833);

  const netSalary = earnedGross - epf - esic - pt - advances;

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
  };
}
