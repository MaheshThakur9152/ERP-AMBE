import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Download,
  Filter,
  Loader2,
  Calendar,
  Building2,
  CheckCircle,
  AlertCircle,
  Wallet,
  X,
  Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculatePayroll, RateCard, PayrollCalculationResult } from '../utils/payrollCalculator';
import { exportComplianceExcel, PayrollExportRecord, exportAxisPayoutExcel, AxisExportRecord } from '../utils/payrollExporter';

export interface EmployeePayrollRow {
  id: string;
  empId: string;
  name: string;
  designation: string;
  siteId: string;
  siteName: string;
  rateCard: RateCard | null;
  empRaw: any;
  pd: number;
  wo: number;
  advances: number;
  adv_amt?: number;
  shirt?: number;
  pant?: number;
  shoes?: number;
  id_card?: number;
  other_amt?: number;
  remark?: string;
  adv_date?: string;
  adv_total?: number;
  in_this_mth?: number;
  in_next_mth?: number;
  calc: PayrollCalculationResult | null;
  isSaved?: boolean;
  isPaid: boolean;
}

export interface SiteOption {
  id: string;
  site_name: string;
  code_name?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = [2026, 2025, 2024];

export const PayrollHub: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return localStorage.getItem('payroll_filter_month') || 'August';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem('payroll_filter_year');
    return saved ? Number(saved) : 2026;
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    return localStorage.getItem('payroll_filter_site') || 'all';
  });
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [rows, setRows] = useState<EmployeePayrollRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Advance Ledger Modal State
  const [activeAdvanceRow, setActiveAdvanceRow] = useState<EmployeePayrollRow | null>(null);
  const [advAmt, setAdvAmt] = useState<number>(0);
  const [advDate, setAdvDate] = useState<string>('');
  const [shirt, setShirt] = useState<number>(0);
  const [pant, setPant] = useState<number>(0);
  const [shoes, setShoes] = useState<number>(0);
  const [idCard, setIdCard] = useState<number>(0);
  const [otherAmt, setOtherAmt] = useState<number>(0);
  const [remark, setRemark] = useState<string>('');
  const [inThisMth, setInThisMth] = useState<number>(0);
  const [isCustomInThisMth, setIsCustomInThisMth] = useState<boolean>(false);

  // Save filters to local storage so they survive page refreshes
  useEffect(() => {
    localStorage.setItem('payroll_filter_month', selectedMonth);
    localStorage.setItem('payroll_filter_year', selectedYear.toString());
    localStorage.setItem('payroll_filter_site', selectedSiteId);
  }, [selectedMonth, selectedYear, selectedSiteId]);

  // Calculate Days in Selected Month
  const daysInMonth = useMemo(() => {
    const monthIndex = MONTHS.indexOf(selectedMonth);
    if (monthIndex === -1) return 31;
    return new Date(selectedYear, monthIndex + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  // Load Sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const { data, error } = await supabase.from('sites').select('id, site_name, code_name').order('site_name');
        if (error) {
          console.warn('Fallback: fetching sites via API', error);
          const res = await fetch('/api/sites');
          const json = await res.json();
          setSites(json.data || json || []);
        } else if (data) {
          setSites(data);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Fetch Staff and Payroll Records for selected Site / Month / Year
  const loadPayrollData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setSelectedIds(new Set());
    try {
      // 1. Fetch Staff assigned to site joined with rate_cards
      let staffQuery = supabase.from('staff').select('*, rate_cards(*), sites(site_name, code_name)');
      if (selectedSiteId !== 'all') {
        staffQuery = staffQuery.eq('site_id', selectedSiteId);
      }
      const { data: staffData, error: staffError } = await staffQuery;

      if (staffError) {
        console.error('Error fetching staff:', staffError);
      }

      const staffList = staffData || [];

      // 2. Fetch existing saved payroll records for month_year
      let payrollRecordsMap = new Map<string, any>();
      try {
        const monthYearStr = `${selectedMonth} ${selectedYear}`;
        const { data: savedRecs } = await supabase
          .from('payroll_records')
          .select('*')
          .eq('month_year', monthYearStr);

        if (savedRecs) {
          savedRecs.forEach((r: any) => {
            const key = r.staff_id || r.employee_id || r.emp_id;
            if (key) payrollRecordsMap.set(key, r);
          });
        }
      } catch (e) {
        console.warn('payroll_records table query skipped or failed:', e);
      }

      // 3. Map into UI state using real database rate cards & saved values
      const initialRows: EmployeePayrollRow[] = staffList.map((emp: any, index: number) => {
        const saved = payrollRecordsMap.get(emp.id) || payrollRecordsMap.get(emp.biometric_code) || payrollRecordsMap.get(emp.biometricCode);
        const pd = saved?.pd ?? saved?.present_days ?? 26;
        const wo = saved?.wo ?? saved?.weekly_offs ?? 4;
        
        // Itemized Advance & Uniform Ledger Mapping
        const adv_amt = Number(saved?.adv_amt || 0);
        const shirt = Number(saved?.shirt || 0);
        const pant = Number(saved?.pant || 0);
        const shoes = Number(saved?.shoes || 0);
        const id_card = Number(saved?.id_card || 0);
        const other_amt = Number(saved?.other_amt || 0);
        const remark = saved?.remark || '';
        const adv_date = saved?.adv_date || '';
        const itemSum = adv_amt + shirt + pant + shoes + id_card + other_amt;
        const adv_total = Number(saved?.adv_total || (itemSum > 0 ? itemSum : (saved?.advances ?? 0)));
        const in_this_mth = saved?.in_this_mth !== undefined && saved?.in_this_mth !== null ? Number(saved.in_this_mth) : (saved?.advances ?? adv_total);
        const in_next_mth = saved?.in_next_mth !== undefined && saved?.in_next_mth !== null ? Number(saved.in_next_mth) : Math.max(0, adv_total - in_this_mth);
        const advances = in_this_mth;

        const isPaid = saved?.is_paid ?? false;
        const rateCard: RateCard | null = emp.rate_cards || null;
        const calc = calculatePayroll(rateCard, emp, pd, wo, daysInMonth, advances);

        return {
          id: emp.id || `emp-${index}`,
          empId: emp.biometric_code || emp.biometricCode || emp.id?.substring(0, 6) || `EMP${index + 1}`,
          name: emp.employee_name || emp.name || 'Unnamed Employee',
          designation: emp.designation || emp.role || 'Staff',
          siteId: emp.site_id || selectedSiteId,
          siteName: emp.sites?.site_name || emp.site_name || 'General Site',
          rateCard,
          empRaw: emp,
          pd,
          wo,
          advances,
          adv_amt,
          shirt,
          pant,
          shoes,
          id_card,
          other_amt,
          remark,
          adv_date,
          adv_total,
          in_this_mth,
          in_next_mth,
          calc,
          isSaved: !!saved,
          isPaid,
        };
      });

      setRows(initialRows);
    } catch (err: any) {
      console.error('Error loading payroll data:', err);
      setStatusMessage({ type: 'error', text: `Failed to load payroll data: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth, selectedYear, selectedSiteId, daysInMonth]);

  // Instant Auto-Save onBlur Handler matching DB unique constraint (month_year, staff_id)
  const handleAutoSave = async (row: EmployeePayrollRow) => {
    if (!row.calc) return;
    try {
      const recordToSave = {
        month_year: `${selectedMonth} ${selectedYear}`,
        site_id: row.siteId,
        site_name: row.siteName,
        staff_id: row.id,
        emp_id: row.empId,
        employee_name: row.name,
        pd: row.pd,
        wo: row.wo,
        payable_days: row.calc.payableDays,
        earned_basic: row.calc.earnedBasic,
        earned_hra: row.calc.earnedHRA,
        earned_other: row.calc.earnedOther,
        earned_conveyance: row.calc.earnedConveyance,
        earned_incentive: row.calc.earnedIncentive,
        earned_bonus: row.calc.earnedBonus,
        earned_gross: row.calc.earnedGross,

        // Satisfy original NOT NULL constraints
        epf_deduction: row.calc.epf,
        esic_deduction: row.calc.esic,
        pt_deduction: row.calc.pt,

        // Populate new columns
        epf: row.calc.epf,
        esic: row.calc.esic,
        pt: row.calc.pt,

        // Itemized Advance Ledger Columns
        adv_amt: row.adv_amt ?? 0,
        shirt: row.shirt ?? 0,
        pant: row.pant ?? 0,
        shoes: row.shoes ?? 0,
        id_card: row.id_card ?? 0,
        other_amt: row.other_amt ?? 0,
        remark: row.remark ?? '',
        adv_date: row.adv_date ?? '',
        adv_total: row.adv_total ?? (row.advances || 0),
        in_this_mth: row.in_this_mth ?? row.advances,
        in_next_mth: row.in_next_mth ?? 0,

        advances: row.advances,
        net_salary: row.calc.netSalary,
        is_paid: row.isPaid,
        updated_at: new Date().toISOString(),
      };

      const { error: fullError } = await supabase.from('payroll_records').upsert([recordToSave], {
        onConflict: 'month_year,staff_id',
      });

      if (fullError) {
        console.warn('Full advance record upsert failed, retrying fallback to core advances column:', fullError.message);
        const fallbackRecord: any = { ...recordToSave };
        delete fallbackRecord.adv_amt;
        delete fallbackRecord.shirt;
        delete fallbackRecord.pant;
        delete fallbackRecord.shoes;
        delete fallbackRecord.id_card;
        delete fallbackRecord.other_amt;
        delete fallbackRecord.remark;
        delete fallbackRecord.adv_date;
        delete fallbackRecord.adv_total;
        delete fallbackRecord.in_this_mth;
        delete fallbackRecord.in_next_mth;

        const { error: fallbackError } = await supabase.from('payroll_records').upsert([fallbackRecord], {
          onConflict: 'month_year,staff_id',
        });

        if (fallbackError) {
          console.error('Supabase Upsert Error:', fallbackError);
          alert(`Failed to save! Supabase says: ${fallbackError.message}`);
        } else {
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isSaved: true } : r)));
        }
      } else {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isSaved: true } : r)));
      }
    } catch (err: any) {
      console.error('Auto-save error:', err);
      alert(`Auto-save error: ${err.message}`);
    }
  };

  // Open Advance Ledger Modal & Hydrate Form
  const openAdvanceModal = (row: EmployeePayrollRow) => {
    setActiveAdvanceRow(row);
    const aAmt = row.adv_amt ?? 0;
    const aDate = row.adv_date ?? '';
    const sh = row.shirt ?? 0;
    const pa = row.pant ?? 0;
    const shs = row.shoes ?? 0;
    const idc = row.id_card ?? 0;
    const oth = row.other_amt ?? 0;
    const rm = row.remark ?? '';
    const itemSum = aAmt + sh + pa + shs + idc + oth;
    const total = row.adv_total ?? (itemSum > 0 ? itemSum : row.advances);
    const inThis = row.in_this_mth ?? row.advances;

    setAdvAmt(aAmt);
    setAdvDate(aDate);
    setShirt(sh);
    setPant(pa);
    setShoes(shs);
    setIdCard(idc);
    setOtherAmt(oth);
    setRemark(rm);
    setInThisMth(inThis);
    setIsCustomInThisMth(inThis !== total && itemSum > 0);
  };

  const currentAdvTotal = advAmt + shirt + pant + shoes + idCard + otherAmt;
  const computedInNextMth = Math.max(0, currentAdvTotal - inThisMth);

  // Auto-recalculate inThisMth when itemized inputs change IF user hasn't overridden it
  const handleItemizedChange = (
    field: 'adv_amt' | 'shirt' | 'pant' | 'shoes' | 'id_card' | 'other_amt',
    val: number
  ) => {
    const num = Math.max(0, val);
    let newAdvAmt = advAmt;
    let newShirt = shirt;
    let newPant = pant;
    let newShoes = shoes;
    let newIdCard = idCard;
    let newOtherAmt = otherAmt;

    if (field === 'adv_amt') newAdvAmt = num;
    if (field === 'shirt') newShirt = num;
    if (field === 'pant') newPant = num;
    if (field === 'shoes') newShoes = num;
    if (field === 'id_card') newIdCard = num;
    if (field === 'other_amt') newOtherAmt = num;

    setAdvAmt(newAdvAmt);
    setShirt(newShirt);
    setPant(newPant);
    setShoes(newShoes);
    setIdCard(newIdCard);
    setOtherAmt(newOtherAmt);

    const newTotal = newAdvAmt + newShirt + newPant + newShoes + newIdCard + newOtherAmt;
    if (!isCustomInThisMth) {
      setInThisMth(newTotal);
    }
  };

  // Save Advance Ledger to State & Supabase
  const handleSaveAdvanceLedger = async () => {
    if (!activeAdvanceRow) return;
    const total = currentAdvTotal;
    const finalInThis = inThisMth;
    const finalInNext = Math.max(0, total - finalInThis);

    const updatedCalc = calculatePayroll(
      activeAdvanceRow.rateCard,
      activeAdvanceRow.empRaw,
      activeAdvanceRow.pd,
      activeAdvanceRow.wo,
      daysInMonth,
      finalInThis
    );

    const updatedRow: EmployeePayrollRow = {
      ...activeAdvanceRow,
      adv_amt: advAmt,
      adv_date: advDate,
      shirt,
      pant,
      shoes,
      id_card: idCard,
      other_amt: otherAmt,
      remark,
      adv_total: total,
      in_this_mth: finalInThis,
      in_next_mth: finalInNext,
      advances: finalInThis,
      calc: updatedCalc,
      isSaved: false,
    };

    setRows((prev) => prev.map((r) => (r.id === activeAdvanceRow.id ? updatedRow : r)));
    await handleAutoSave(updatedRow);
    setActiveAdvanceRow(null);
  };

  // Bulk Mark Selected Employees as PAID
  const handleMarkSelectedAsPaid = async () => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id) && r.calc !== null);
    if (!selectedRows.length) return;

    try {
      const recordsToSave = selectedRows.map((r) => ({
        month_year: `${selectedMonth} ${selectedYear}`,
        site_id: r.siteId,
        site_name: r.siteName,
        staff_id: r.id,
        emp_id: r.empId,
        employee_name: r.name,
        pd: r.pd,
        wo: r.wo,
        payable_days: r.calc!.payableDays,
        earned_basic: r.calc!.earnedBasic,
        earned_hra: r.calc!.earnedHRA,
        earned_other: r.calc!.earnedOther,
        earned_conveyance: r.calc!.earnedConveyance,
        earned_incentive: r.calc!.earnedIncentive,
        earned_bonus: r.calc!.earnedBonus,
        earned_gross: r.calc!.earnedGross,
        epf_deduction: r.calc!.epf,
        esic_deduction: r.calc!.esic,
        pt_deduction: r.calc!.pt,
        epf: r.calc!.epf,
        esic: r.calc!.esic,
        pt: r.calc!.pt,
        adv_amt: r.adv_amt ?? 0,
        shirt: r.shirt ?? 0,
        pant: r.pant ?? 0,
        shoes: r.shoes ?? 0,
        id_card: r.id_card ?? 0,
        other_amt: r.other_amt ?? 0,
        remark: r.remark ?? '',
        adv_date: r.adv_date ?? '',
        adv_total: r.adv_total ?? (r.advances || 0),
        in_this_mth: r.in_this_mth ?? r.advances,
        in_next_mth: r.in_next_mth ?? 0,
        advances: r.advances,
        net_salary: r.calc!.netSalary,
        is_paid: true,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('payroll_records').upsert(recordsToSave, {
        onConflict: 'month_year,staff_id',
      });

      if (error) {
        console.error('Bulk Paid Upsert Error:', error);
        alert(`Failed to mark paid: ${error.message}`);
      } else {
        setRows((prev) =>
          prev.map((r) => (selectedIds.has(r.id) ? { ...r, isPaid: true, isSaved: true } : r))
        );
        setSelectedIds(new Set());
        setStatusMessage({
          type: 'success',
          text: `Successfully marked ${selectedRows.length} employees as PAID!`,
        });
      }
    } catch (err: any) {
      console.error('Bulk paid error:', err);
      alert(`Error marking paid: ${err.message}`);
    }
  };

  // Export Axis Payout Excel for selected employees
  const handleExportAxis = async () => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id) && r.calc !== null);
    if (!selectedRows.length) return;

    const missingBank = selectedRows.filter(
      (r) =>
        !(
          r.empRaw?.bank_account_no ||
          r.empRaw?.bank_account_number ||
          r.empRaw?.bank_account ||
          r.empRaw?.account_no
        ) ||
        !(
          r.empRaw?.bank_ifsc_code ||
          r.empRaw?.ifsc_code ||
          r.empRaw?.ifsc
        )
    );

    if (missingBank.length) {
      const names = missingBank.map((r) => r.name).join(', ');
      alert(`Warning: ${missingBank.length} employee(s) missing bank details (Account No / IFSC): ${names}. Exporting with empty fields for missing values.`);
    }

    try {
      const activeSiteName =
        selectedSiteId === 'all'
          ? 'All_Sites'
          : sites.find((s) => s.id === selectedSiteId)?.site_name || 'Site';

      const axisRecords: AxisExportRecord[] = selectedRows.map((r) => {
        const emp = r.empRaw || {};
        return {
          empId: r.empId,
          name: r.name,
          payeeName: emp.payee_name || r.name,
          bankAccountNo: emp.bank_account_no || emp.bank_account_number || emp.bank_account || emp.account_no || '',
          bankIfscCode: emp.bank_ifsc_code || emp.ifsc_code || emp.ifsc || '',
          netSalary: r.calc!.netSalary,
        };
      });

      await exportAxisPayoutExcel({
        month: selectedMonth,
        year: selectedYear,
        siteName: activeSiteName,
        records: axisRecords,
      });

      setStatusMessage({ type: 'success', text: `Axis Payout file exported for ${selectedRows.length} employees!` });
    } catch (err: any) {
      console.error('Axis export error:', err);
      alert(`Axis export error: ${err.message}`);
    }
  };

  // Live input handlers for PD, WO, Advances
  const handlePdChange = (id: string, newPd: number) => {
    const pdVal = Math.max(0, Math.min(daysInMonth, newPd));
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== id) return row;
        const updatedCalc = calculatePayroll(row.rateCard, row.empRaw, pdVal, row.wo, daysInMonth, row.advances);
        return { ...row, pd: pdVal, calc: updatedCalc, isSaved: false };
      })
    );
  };

  const handleWoChange = (id: string, newWo: number) => {
    const woVal = Math.max(0, Math.min(daysInMonth, newWo));
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== id) return row;
        const updatedCalc = calculatePayroll(row.rateCard, row.empRaw, row.pd, woVal, daysInMonth, row.advances);
        return { ...row, wo: woVal, calc: updatedCalc, isSaved: false };
      })
    );
  };

  const handleAdvancesChange = (id: string, newAdv: number) => {
    const advVal = Math.max(0, newAdv);
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== id) return row;
        const updatedCalc = calculatePayroll(row.rateCard, row.empRaw, row.pd, row.wo, daysInMonth, advVal);
        return {
          ...row,
          advances: advVal,
          in_this_mth: advVal,
          calc: updatedCalc,
          isSaved: false,
        };
      })
    );
  };

  // Trigger Excel Exporter
  const handleDownloadExcel = async () => {
    const validRows = rows.filter((r) => r.calc !== null && r.rateCard !== null);
    if (!validRows.length) {
      setStatusMessage({ type: 'error', text: 'No rows with valid rate cards available to export.' });
      return;
    }
    setIsExporting(true);
    try {
      const activeSiteName =
        selectedSiteId === 'all'
          ? 'All Sites'
          : sites.find((s) => s.id === selectedSiteId)?.site_name || 'Site';

      const exportRecords: PayrollExportRecord[] = validRows.map((r, idx) => {
        const rc = r.rateCard!;
        const calc = r.calc!;
        const emp = r.empRaw || {};
        const otherAllowance = rc.other_allowance ?? rc.other_cash_allowance ?? rc.washing_allowance ?? 0;
        const conveyanceAllowance = rc.conveyance_allowance || 0;
        const incentive = Number(rc.incentive_amount ?? rc.incentive ?? calc.earnedIncentive ?? 0);
        const grossRate = rc.is_flat_wage
          ? (rc.gross_salary || 0)
          : ((rc.basic_da || 0) + (rc.hra || 0) + otherAllowance + conveyanceAllowance + incentive || (rc.gross_salary || 0));
        const totalDeductions = calc.epf + calc.esic + calc.pt + r.advances;
        return {
          srNo: idx + 1,
          empId: r.empId,
          empName: r.name,
          designation: r.designation,
          gender: emp.gender || 'Male',
          doj: emp.joining_date || emp.created_at ? new Date(emp.joining_date || emp.created_at).toLocaleDateString('en-GB') : '01/01/2026',
          pfNo: emp.pf_no || emp.pfNo || '',
          esicNo: emp.esic_no || emp.esicNo || '',
          siteName: r.siteName,
          basicDa: rc.basic_da || 0,
          hra: rc.hra || 0,
          washingAllowance: otherAllowance,
          otherAllowance,
          conveyanceAllowance,
          incentive,
          grossRate,
          daysInMonth,
          advances: r.advances,
          pd: r.pd,
          wo: r.wo,
          payableDays: calc.payableDays,
          earnedBasic: calc.earnedBasic,
          earnedHRA: calc.earnedHRA,
          earnedWashing: calc.earnedOther,
          earnedOther: calc.earnedOther,
          earnedConveyance: calc.earnedConveyance,
          earnedIncentive: calc.earnedIncentive,
          earnedBonus: calc.earnedBonus,
          earnedGross: calc.earnedGross,
          epf: calc.epf,
          esic: calc.esic,
          pt: calc.pt,
          totalDeductions,
          netSalary: calc.netSalary,
        };
      });

      await exportComplianceExcel({
        month: selectedMonth,
        year: selectedYear,
        siteName: activeSiteName,
        records: exportRecords,
      });

      setStatusMessage({ type: 'success', text: 'Compliance Excel generated & downloaded successfully!' });
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      setStatusMessage({ type: 'error', text: `Failed to export Excel: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  // Grand Totals for Footer
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (r.calc) {
          acc.earnedGross += r.calc.earnedGross;
          acc.epf += r.calc.epf;
          acc.esic += r.calc.esic;
          acc.pt += r.calc.pt;
          acc.advances += r.advances;
          acc.netSalary += r.calc.netSalary;
        }
        return acc;
      },
      { earnedGross: 0, epf: 0, esic: 0, pt: 0, advances: 0, netSalary: 0 }
    );
  }, [rows]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Payroll Processing &amp; Compliance</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Instant onBlur auto-saving (month_year, staff_id) &amp; itemized Advance / Uniform Ledger.
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Bulk Selection Action Buttons */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-gray-200 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={handleMarkSelectedAsPaid}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Mark Paid ({selectedIds.size})</span>
              </button>

              <button
                type="button"
                onClick={handleExportAxis}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Axis Payout ({selectedIds.size})</span>
              </button>
            </div>
          )}

          {/* Month Dropdown */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-gray-300">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Site Dropdown */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="all">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code_name || s.site_name}
                </option>
              ))}
            </select>
          </div>

          {/* Download Compliance Excel Button */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExporting || !rows.length}
            className="bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Compliance Excel</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Data Grid Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Loading database staff &amp; saved payroll records...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-500 space-y-2">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No staff members found for the selected Site.</p>
            <p>Select a different Site or add employees to this site in the Staff page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse min-w-[1550px]">
              <thead className="bg-slate-100/80 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                <tr>
                  <th className="p-3 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        rows.filter((r) => r.calc !== null).length > 0 &&
                        selectedIds.size === rows.filter((r) => r.calc !== null).length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(rows.filter((r) => r.calc !== null).map((r) => r.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Designation / Site</th>
                  <th className="p-3 text-center bg-blue-50/60 text-blue-900 border-x border-blue-100">
                    PD (Present)*
                  </th>
                  <th className="p-3 text-center bg-blue-50/60 text-blue-900 border-r border-blue-100">
                    WO (Weekly Off)*
                  </th>
                  <th className="p-3 text-center">Payable Days</th>
                  <th className="p-3 text-right">Earned Basic</th>
                  <th className="p-3 text-right">Earned HRA</th>
                  <th className="p-3 text-right">Washing</th>
                  <th className="p-3 text-right">Conveyance</th>
                  <th className="p-3 text-right">Other</th>
                  <th className="p-3 text-right font-bold text-gray-900">Earned Gross</th>
                  <th className="p-3 text-right text-indigo-700">Incentive</th>
                  <th className="p-3 text-right text-amber-700">EPF (12%)</th>
                  <th className="p-3 text-right text-amber-700">ESIC (0.75%)</th>
                  <th className="p-3 text-right text-amber-700">PT</th>
                  <th className="p-3 text-center bg-amber-50/50 text-amber-900 border-x border-amber-100">
                    Advances Ledger
                  </th>
                  <th className="p-3 text-right font-bold text-emerald-800 bg-emerald-50/60">
                    Net Salary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      row.isPaid ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        disabled={!row.calc}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          if (e.target.checked) {
                            newSet.add(row.id);
                          } else {
                            newSet.delete(row.id);
                          }
                          setSelectedIds(newSet);
                        }}
                        className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer disabled:opacity-30"
                      />
                    </td>

                    <td className="p-3 font-sans">
                      <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{row.name}</span>
                        {row.rateCard?.is_flat_wage && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Flat
                          </span>
                        )}
                        {row.isPaid && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider ml-1">
                            Paid
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openAdvanceModal(row)}
                          className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Add/Manage Advance & Uniform Ledger"
                        >
                          <Wallet className="w-2.5 h-2.5" />
                          <span>Adv</span>
                          {row.advances > 0 && (
                            <span className="font-mono text-amber-950 font-extrabold">(₹{row.advances.toLocaleString('en-IN')})</span>
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{row.empId}</div>
                    </td>

                    <td className="p-3 font-sans">
                      <div className="font-semibold text-gray-700">{row.designation}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{row.siteName}</div>
                    </td>

                    {/* PD Editable Input with onBlur Auto-Save */}
                    <td className="p-2 text-center bg-blue-50/30 border-x border-blue-100">
                      <input
                        type="number"
                        min={0}
                        max={daysInMonth}
                        value={row.pd === 0 ? '' : row.pd}
                        onChange={(e) => handlePdChange(row.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onBlur={() => handleAutoSave(row)}
                        className="w-16 bg-white border border-blue-300 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 text-center font-bold text-blue-900 shadow-2xs outline-none"
                      />
                    </td>

                    {/* WO Editable Input with onBlur Auto-Save */}
                    <td className="p-2 text-center bg-blue-50/30 border-r border-blue-100">
                      <input
                        type="number"
                        min={0}
                        max={daysInMonth}
                        value={row.wo === 0 ? '' : row.wo}
                        onChange={(e) => handleWoChange(row.id, e.target.value === '' ? 0 : Number(e.target.value))}
                        onBlur={() => handleAutoSave(row)}
                        className="w-16 bg-white border border-blue-300 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 text-center font-bold text-blue-900 shadow-2xs outline-none"
                      />
                    </td>

                    {/* If Rate Card is missing, display warning badge instead of numbers */}
                    {!row.calc ? (
                      <td colSpan={13} className="p-3 text-center bg-red-50/30 border-l border-red-100 font-sans">
                        <span className="text-red-600 font-bold px-3 py-1 bg-red-100 rounded-md border border-red-200 inline-block text-xs">
                          Rate Card Missing
                        </span>
                      </td>
                    ) : (
                      <>
                        {/* Read-Only Calculated Payable Days */}
                        <td className="p-3 text-center font-bold text-gray-800">
                          {row.calc.payableDays}
                        </td>

                        {/* Earned Breakup */}
                        <td className="p-3 text-right text-gray-700">
                          ₹{row.calc.earnedBasic.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-gray-700">
                          ₹{row.calc.earnedHRA.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-gray-700">
                          ₹{row.calc.earnedWashing.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-gray-700">
                          ₹{row.calc.earnedConveyance.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-gray-700">
                          ₹{row.calc.earnedOther.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900">
                          ₹{row.calc.earnedGross.toLocaleString('en-IN')}
                        </td>

                        {/* Personal Incentive */}
                        <td className="p-3 text-right text-indigo-700 font-semibold">
                          +₹{(row.calc.incentive || 0).toLocaleString('en-IN')}
                        </td>

                        {/* Statutory Deductions */}
                        <td className="p-3 text-right text-amber-700 font-semibold">
                          -₹{row.calc.epf.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-amber-700 font-semibold">
                          -₹{row.calc.esic.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-amber-700 font-semibold">
                          -₹{row.calc.pt.toLocaleString('en-IN')}
                        </td>

                        {/* Advances Input + Ledger Modal Button */}
                        <td className="p-2 text-center bg-amber-50/20 border-x border-amber-100">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              disabled={row.isPaid}
                              value={row.advances === 0 ? '' : row.advances}
                              onChange={(e) => handleAdvancesChange(row.id, e.target.value === '' ? 0 : Number(e.target.value))}
                              onBlur={() => handleAutoSave(row)}
                              className="w-16 bg-white border border-amber-300 focus:ring-2 focus:ring-amber-500 rounded px-1.5 py-1 text-center font-bold text-amber-900 shadow-2xs outline-none disabled:opacity-50 disabled:bg-gray-100 cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={() => openAdvanceModal(row)}
                              className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer flex-shrink-0"
                              title="Manage Itemized Advances & Uniform Ledger"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Net Salary Read-Only */}
                        <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/50 text-xs">
                          ₹{row.calc.netSalary.toLocaleString('en-IN')}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-gray-300 font-mono font-bold text-xs">
                <tr>
                  <td colSpan={11} className="p-3 text-right uppercase tracking-wider font-sans text-gray-600">
                    Grand Totals ({rows.filter((r) => r.calc).length} Staff):
                  </td>
                  <td className="p-3 text-right text-gray-900">
                    ₹{totals.earnedGross.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right text-amber-800">
                    -₹{totals.epf.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-amber-800">
                    -₹{totals.esic.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-amber-800">
                    -₹{totals.pt.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-center text-amber-900 bg-amber-100/50">
                    -₹{totals.advances.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-emerald-800 bg-emerald-100/60 text-sm">
                    ₹{totals.netSalary.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Advance & Uniform Ledger Modal */}
      {activeAdvanceRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">
                    Advance &amp; Item Deductions
                  </h2>
                  <p className="text-xs text-gray-500">
                    {activeAdvanceRow.name} ({activeAdvanceRow.empId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAdvanceRow(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cash Advance Section */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                Cash Advance
                {activeAdvanceRow.isPaid && (
                  <span className="ml-auto text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    LOCKED (PAID)
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Advance Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={advAmt === 0 ? '' : advAmt}
                    onChange={(e) => handleItemizedChange('adv_amt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Advance Date</label>
                  <input
                    type="date"
                    disabled={activeAdvanceRow.isPaid}
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Uniform & Gear Deductions Section */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Uniform &amp; Gear Deductions
              </h3>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Shirt (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={shirt === 0 ? '' : shirt}
                    onChange={(e) => handleItemizedChange('shirt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Pant (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={pant === 0 ? '' : pant}
                    onChange={(e) => handleItemizedChange('pant', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Shoes (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={shoes === 0 ? '' : shoes}
                    onChange={(e) => handleItemizedChange('shoes', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">ID Card (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={idCard === 0 ? '' : idCard}
                    onChange={(e) => handleItemizedChange('id_card', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Other Amt (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    value={otherAmt === 0 ? '' : otherAmt}
                    onChange={(e) => handleItemizedChange('other_amt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Remarks Notes Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks / Notes</label>
              <input
                type="text"
                disabled={activeAdvanceRow.isPaid}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="e.g. Emergency medical advance / Safety boots"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
              />
            </div>

            {/* Split-Month Recovery Schedule Card */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center font-bold text-amber-900 border-b border-amber-200/70 pb-1.5">
                <span>Total Advance / Deductions:</span>
                <span className="text-sm font-mono">₹{currentAdvTotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-amber-900 font-bold mb-1 text-[11px]">
                    Deduct In This Month (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeAdvanceRow.isPaid}
                    max={currentAdvTotal}
                    value={inThisMth === 0 ? '' : inThisMth}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setInThisMth(val);
                      setIsCustomInThisMth(true);
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-amber-900 font-bold mb-1 text-[11px]">
                    Carry to Next Month (₹)
                  </label>
                  <div className="w-full bg-amber-100/70 border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 flex items-center">
                    ₹{computedInNextMth.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setActiveAdvanceRow(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              {activeAdvanceRow.isPaid ? (
                <span className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 border border-gray-300 font-bold text-xs">
                  Locked (PAID)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveAdvanceLedger}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Advance Ledger</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
