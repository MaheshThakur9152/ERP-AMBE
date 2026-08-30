import React, { useState, useEffect, useMemo } from 'react';
import {
  Gift,
  Calendar,
  Building2,
  Search,
  Filter,
  Loader2,
  DollarSign,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  History,
  Info,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '@/lib/supabase';
import { toast, ToastContainer } from '@/components/ui/toast';

export interface SiteOption {
  id: string;
  site_name: string;
  code_name?: string;
}

export interface BonusRecord {
  staff_id: string;
  employee_name: string;
  biometric_code: string;
  designation: string;
  status: string;
  site_id: string;
  site_name: string;
  accrued_this_fy: number;
  disbursed_this_fy: number;
  balance_outstanding: number;
  monthly_breakdown: Record<string, number>;
  disbursements: any[];
}

const FINANCIAL_YEARS = ['2026-27', '2025-26', '2024-25', '2023-24'];

const getDefaultFY = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan, 3 = Apr
  const year = now.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

function getFYMonths(financialYear: string): string[] {
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

export const BonusHub: React.FC = () => {
  const [selectedFY, setSelectedFY] = useState<string>(() => {
    return localStorage.getItem('bonus_filter_fy') || getDefaultFY();
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    return localStorage.getItem('bonus_filter_site') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [records, setRecords] = useState<BonusRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Expandable row detail state
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Record Payout Modal State
  const [payoutModalStaff, setPayoutModalStaff] = useState<BonusRecord | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number | ''>('');
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payoutRemark, setPayoutRemark] = useState<string>('');
  const [isSavingPayout, setIsSavingPayout] = useState<boolean>(false);

  // Sync filters to localStorage
  useEffect(() => {
    localStorage.setItem('bonus_filter_fy', selectedFY);
    localStorage.setItem('bonus_filter_site', selectedSiteId);
  }, [selectedFY, selectedSiteId]);

  // Load Sites Dropdown
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const { data } = await supabase.from('sites').select('id, site_name, code_name').order('site_name');
        if (data) setSites(data);
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Fetch Bonus Summary Data
  const loadBonusData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      // 1. Try Backend API first
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const response = await fetch(
        `${apiBase}/bonus/summary?financial_year=${encodeURIComponent(selectedFY)}&site_id=${encodeURIComponent(selectedSiteId)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.records)) {
          setRecords(json.records);
          return;
        }
      }

      // 2. Direct Supabase Fallback if API fails/unavailable
      console.warn('[BonusHub] Falling back to direct Supabase queries for bonus summary');
      const fyMonths = getFYMonths(selectedFY);

      let staffQuery = supabase
        .from('staff')
        .select('id, employee_name, biometric_code, designation, status, site_id, sites(site_name, code_name)')
        .order('employee_name', { ascending: true });

      if (selectedSiteId !== 'all') {
        staffQuery = staffQuery.eq('site_id', selectedSiteId);
      }

      const { data: staffData, error: staffErr } = await staffQuery;
      if (staffErr) throw staffErr;

      const staffList = staffData || [];
      const staffIds = staffList.map((s: any) => s.id);

      if (staffIds.length === 0) {
        setRecords([]);
        return;
      }

      // Query payroll_records for FY
      const { data: payrollData } = await supabase
        .from('payroll_records')
        .select('staff_id, month_year, remaining_part_bonus')
        .in('month_year', fyMonths)
        .in('staff_id', staffIds);

      // Query bonus_disbursements for FY
      const { data: disbData } = await supabase
        .from('bonus_disbursements')
        .select('*')
        .eq('financial_year', selectedFY)
        .in('staff_id', staffIds)
        .order('disbursed_date', { ascending: false });

      const payrollMap = new Map<string, { totalAccrued: number; months: Record<string, number> }>();
      (payrollData || []).forEach((pr: any) => {
        const sid = pr.staff_id;
        if (!payrollMap.has(sid)) payrollMap.set(sid, { totalAccrued: 0, months: {} });
        const entry = payrollMap.get(sid)!;
        const val = Number(pr.remaining_part_bonus) || 0;
        entry.totalAccrued += val;
        entry.months[pr.month_year] = val;
      });

      const disbMap = new Map<string, { totalDisbursed: number; list: any[] }>();
      (disbData || []).forEach((d: any) => {
        const sid = d.staff_id;
        if (!disbMap.has(sid)) disbMap.set(sid, { totalDisbursed: 0, list: [] });
        const entry = disbMap.get(sid)!;
        const amt = Number(d.amount) || 0;
        entry.totalDisbursed += amt;
        entry.list.push(d);
      });

      const mapped: BonusRecord[] = staffList.map((s: any) => {
        const pInfo = payrollMap.get(s.id) || { totalAccrued: 0, months: {} };
        const dInfo = disbMap.get(s.id) || { totalDisbursed: 0, list: [] };
        const accrued = Math.round(pInfo.totalAccrued);
        const disbursed = Math.round(dInfo.totalDisbursed);
        const balance = Math.max(0, accrued - disbursed);
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

      setRecords(mapped);
    } catch (err: any) {
      console.error('Failed to load bonus reconciliation data:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load bonus reconciliation data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBonusData();
  }, [selectedFY, selectedSiteId]);

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const name = (r.employee_name || '').toLowerCase();
      const code = (r.biometric_code || '').toLowerCase();
      const des = (r.designation || '').toLowerCase();
      const site = (r.site_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || des.includes(q) || site.includes(q);
    });
  }, [records, searchQuery]);

  // Grand Totals for Footer & Summary KPI Cards
  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => {
        acc.accrued += r.accrued_this_fy;
        acc.disbursed += r.disbursed_this_fy;
        acc.balance += r.balance_outstanding;
        if (r.accrued_this_fy > 0) acc.staffWithAccrual += 1;
        return acc;
      },
      { accrued: 0, disbursed: 0, balance: 0, staffWithAccrual: 0 }
    );
  }, [filteredRecords]);

  // Open Record Payout Modal
  const handleOpenPayoutModal = (rec: BonusRecord) => {
    setPayoutModalStaff(rec);
    setPayoutAmount(rec.balance_outstanding > 0 ? rec.balance_outstanding : '');
    setPayoutDate(new Date().toISOString().split('T')[0]);
    setPayoutRemark(`Statutory Bonus Payout FY ${selectedFY}`);
  };

  // Submit Payout Disbursement
  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalStaff) return;
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      toast.error('Please enter a valid payout amount greater than ₹0.');
      return;
    }

    const amt = Number(payoutAmount);
    if (amt > payoutModalStaff.balance_outstanding) {
      toast.error(`Amount (₹${amt}) cannot exceed outstanding balance (₹${payoutModalStaff.balance_outstanding}).`);
      return;
    }

    setIsSavingPayout(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const payload = {
        staff_id: payoutModalStaff.staff_id,
        site_id: payoutModalStaff.site_id || null,
        financial_year: selectedFY,
        amount: amt,
        disbursed_date: payoutDate,
        remark: payoutRemark,
      };

      let savedOk = false;

      // Try Backend API
      try {
        const response = await fetch(`${apiBase}/bonus/disburse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          savedOk = true;
        }
      } catch (e) {
        console.warn('Backend /bonus/disburse endpoint note:', e);
      }

      // Supabase direct fallback if needed
      if (!savedOk) {
        const { error } = await supabase.from('bonus_disbursements').insert([payload]);
        if (error) throw error;
      }

      toast.success(`Bonus payout of ₹${amt.toLocaleString('en-IN')} recorded for ${payoutModalStaff.employee_name}!`);
      setPayoutModalStaff(null);
      await loadBonusData();
    } catch (err: any) {
      console.error('Failed to record bonus payout:', err);
      toast.error(err.message || 'Failed to record payout');
    } finally {
      setIsSavingPayout(false);
    }
  };

  // Export Bonus Register to Excel
  const handleDownloadExcel = async () => {
    if (!filteredRecords.length) {
      toast.error('No bonus records to export.');
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Ambe Enterprises ERP';
      workbook.created = new Date();

      const activeSiteName =
        selectedSiteId === 'all'
          ? 'All Sites'
          : sites.find((s) => s.id === selectedSiteId)?.site_name || 'Site';

      const worksheet = workbook.addWorksheet(`Bonus FY ${selectedFY}`, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 5, activeCell: 'D6' }],
      });

      const fyMonths = getFYMonths(selectedFY);

      // Define Columns
      worksheet.columns = [
        { header: 'SR NO', key: 'sr_no', width: 8 },
        { header: 'EMP ID', key: 'emp_id', width: 12 },
        { header: 'EMPLOYEE NAME', key: 'employee_name', width: 24 },
        { header: 'DESIGNATION', key: 'designation', width: 16 },
        { header: 'SITE NAME', key: 'site_name', width: 20 },
        { header: 'ACCRUED THIS FY (₹)', key: 'accrued', width: 18 },
        { header: 'DISBURSED THIS FY (₹)', key: 'disbursed', width: 18 },
        { header: 'BALANCE OUTSTANDING (₹)', key: 'balance', width: 22 },
        { header: 'STATUS', key: 'status', width: 12 },
        ...fyMonths.map((m) => ({
          header: m.toUpperCase(),
          key: `m_${m}`,
          width: 14,
        })),
      ];

      // Insert Row Index at Row 2
      const totalColCount = 9 + fyMonths.length;
      const indexRowValues = Array.from({ length: totalColCount }, (_, i) => i + 1);
      worksheet.spliceRows(2, 0, indexRowValues);

      // Add Data Rows
      filteredRecords.forEach((rec, idx) => {
        const rowData: Record<string, any> = {
          sr_no: idx + 1,
          emp_id: rec.biometric_code || '—',
          employee_name: rec.employee_name,
          designation: rec.designation || 'Staff',
          site_name: rec.site_name,
          accrued: rec.accrued_this_fy,
          disbursed: rec.disbursed_this_fy,
          balance: rec.balance_outstanding,
          status: rec.balance_outstanding === 0 ? 'Settled' : 'Pending',
        };

        fyMonths.forEach((m) => {
          rowData[`m_${m}`] = rec.monthly_breakdown[m] || 0;
        });

        worksheet.addRow(rowData);
      });

      // Insert 3 blank rows on top for Header Block
      worksheet.spliceRows(1, 0, [], [], []);

      // Row 1: Title Block
      const titleRow = worksheet.getRow(1);
      titleRow.height = 30;
      titleRow.getCell('A').value = `AMBE ENTERPRISES - STATUTORY BONUS REGISTER (FY ${selectedFY}) - SITE: ${activeSiteName.toUpperCase()}`;
      worksheet.mergeCells(`A1:${String.fromCharCode(65 + Math.min(25, totalColCount - 1))}1`);
      const titleCell = titleRow.getCell('A');
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Row 3: Teal Groupings
      const groupRow = worksheet.getRow(3);
      groupRow.height = 26;
      groupRow.getCell('A').value = 'EMPLOYEE DETAILS';
      worksheet.mergeCells('A3:E3');
      groupRow.getCell('F').value = 'STATUTORY BONUS RECONCILIATION';
      worksheet.mergeCells('F3:I3');
      groupRow.getCell('J').value = 'MONTHLY ACCRUAL BREAKDOWN (REMAINING PART BONUS)';
      worksheet.mergeCells(`J3:${String.fromCharCode(65 + Math.min(25, totalColCount - 1))}3`);

      groupRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
        cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Row 4: Column Headers Styling
      const headerRow = worksheet.getRow(4);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Format Data Rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 5) {
          row.height = 20;
          row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 10 };
            cell.alignment = { vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };

            // Numeric columns
            if (colNumber >= 6) {
              cell.numFmt = '₹#,##0;[Red]-₹#,##0;"-"';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }

            // Highlight Balance Outstanding Column (Col H / 8)
            if (colNumber === 8) {
              const val = Number(cell.value) || 0;
              if (val > 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                cell.font = { name: 'Calibri', bold: true, color: { argb: 'FF92400E' }, size: 10 };
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                cell.font = { name: 'Calibri', bold: true, color: { argb: 'FF065F46' }, size: 10 };
              }
            }
          });
        }
      });

      // Add Grand Totals Row at the bottom
      const totalsRowData: any[] = ['TOTAL', '', `Grand Totals (${filteredRecords.length} Staff)`, '', ''];
      totalsRowData.push(totals.accrued);
      totalsRowData.push(totals.disbursed);
      totalsRowData.push(totals.balance);
      totalsRowData.push(totals.balance === 0 ? 'All Settled' : 'Pending');

      fyMonths.forEach((m) => {
        const mTotal = filteredRecords.reduce((sum, r) => sum + (r.monthly_breakdown[m] || 0), 0);
        totalsRowData.push(mTotal);
      });

      const grandTotalRow = worksheet.addRow(totalsRowData);
      grandTotalRow.height = 24;
      grandTotalRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF64748B' } },
          bottom: { style: 'double', color: { argb: 'FF64748B' } },
        };
        if (colNumber >= 6) {
          cell.numFmt = '₹#,##0;[Red]-₹#,##0;"-"';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `AMBE_BONUS_REGISTER_${selectedFY}_${activeSiteName.replace(/\s+/g, '_')}.xlsx`);

      toast.success('Bonus Register Excel downloaded successfully!');
    } catch (err: any) {
      console.error('Export Bonus Register failed:', err);
      toast.error(`Failed to export Bonus Register: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Year-End Statutory Bonus Reconciliation</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Tracks monthly accrued Part Bonus reserves vs. year-end statutory disbursements (Diwali / Annual).
            </p>
          </div>
        </div>

        {/* Filters & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Financial Year Dropdown */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-gray-500 text-[11px] font-normal">FY:</span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-gray-900"
            >
              {FINANCIAL_YEARS.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
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

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff, code, post..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 outline-none w-48 shadow-xs"
            />
          </div>

          {/* Download Bonus Register Button */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExporting || !filteredRecords.length}
            className="bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download Bonus Register</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Accrued This FY</span>
            <div className="text-xl font-extrabold text-teal-700 font-mono mt-1">
              ₹{totals.accrued.toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Sum of monthly Part Bonus reserves</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disbursed This FY</span>
            <div className="text-xl font-extrabold text-emerald-700 font-mono mt-1">
              ₹{totals.disbursed.toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Paid out statutory bonuses</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Balance Outstanding</span>
            <div className={`text-xl font-extrabold font-mono mt-1 ${totals.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              ₹{totals.balance.toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totals.balance > 0 ? 'Owed to employees for year-end' : 'All bonuses settled'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            totals.balance > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Staff Covered</span>
            <div className="text-xl font-extrabold text-gray-900 font-mono mt-1">
              {filteredRecords.length}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totals.staffWithAccrual} with active bonus accrual
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
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

      {/* Main Bonus Ledger Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Calculating statutory bonus accruals &amp; disbursements for FY {selectedFY}...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-500 space-y-2">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No staff records found for FY {selectedFY}.</p>
            <p>Process monthly payroll to accumulate remaining Part Bonus accruals.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse min-w-[950px]">
              <thead className="bg-slate-100/80 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[200px]">Employee Name</th>
                  <th className="p-3 min-w-[160px]">Designation / Site</th>
                  <th className="p-3 text-right text-teal-800 bg-teal-50/40 min-w-[140px]">
                    Accrued This FY (₹)
                  </th>
                  <th className="p-3 text-right text-emerald-800 bg-emerald-50/40 min-w-[140px]">
                    Disbursed This FY (₹)
                  </th>
                  <th className="p-3 text-right min-w-[160px]">
                    Balance Outstanding (₹)
                  </th>
                  <th className="p-3 text-center min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {filteredRecords.map((row, idx) => {
                  const isExpanded = expandedStaffId === row.staff_id;
                  const isSettled = row.balance_outstanding === 0;

                  return (
                    <React.Fragment key={row.staff_id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center text-gray-400 font-sans">{idx + 1}</td>

                        <td className="p-3 font-sans">
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            <span>{row.employee_name}</span>
                            {isSettled && row.disbursed_this_fy > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                                Settled
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{row.biometric_code || '—'}</div>
                        </td>

                        <td className="p-3 font-sans">
                          <div className="font-semibold text-gray-700">{row.designation || 'Staff'}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{row.site_name}</div>
                        </td>

                        {/* Accrued This FY */}
                        <td className="p-3 text-right text-teal-800 font-semibold bg-teal-50/30">
                          ₹{row.accrued_this_fy.toLocaleString('en-IN')}
                        </td>

                        {/* Disbursed This FY */}
                        <td className="p-3 text-right text-emerald-800 font-semibold bg-emerald-50/30">
                          ₹{row.disbursed_this_fy.toLocaleString('en-IN')}
                        </td>

                        {/* Balance Outstanding */}
                        <td className="p-3 text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${
                              row.balance_outstanding > 0
                                ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-2xs'
                                : 'bg-emerald-100/60 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            ₹{row.balance_outstanding.toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPayoutModal(row)}
                              disabled={row.balance_outstanding <= 0}
                              className="bg-[#20B2AA] hover:bg-teal-700 disabled:opacity-30 disabled:hover:bg-[#20B2AA] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
                              title="Record statutory bonus payout"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Record Payout</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedStaffId(isExpanded ? null : row.staff_id)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              title="View monthly accrual & payout history"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Detail Row (Monthly Accruals & Payout History) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200 font-sans">
                          <td colSpan={7} className="p-4 space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Monthly Accrual Grid */}
                              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-700">
                                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                                    <span>FY {selectedFY} Monthly Accrual Breakdown (Held Bonus)</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                    Total: ₹{row.accrued_this_fy.toLocaleString('en-IN')}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                                  {getFYMonths(selectedFY).map((m) => {
                                    const val = row.monthly_breakdown[m] || 0;
                                    const shortName = m.replace(` ${selectedFY.split('-')[0]}`, '').replace(` ${Number(selectedFY.split('-')[0]) + 1}`, '');
                                    return (
                                      <div
                                        key={m}
                                        className={`p-2 rounded-lg border text-center font-mono ${
                                          val > 0
                                            ? 'bg-teal-50/50 border-teal-200 text-teal-900'
                                            : 'bg-gray-50 border-gray-100 text-gray-400'
                                        }`}
                                      >
                                        <div className="text-[10px] font-sans font-semibold text-gray-500 uppercase">
                                          {shortName}
                                        </div>
                                        <div className="font-bold text-[11px] mt-0.5">
                                          {val > 0 ? `₹${val.toLocaleString('en-IN')}` : '—'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Payout History List */}
                              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-700">
                                    <History className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Recorded Disbursements ({row.disbursements.length})</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Disbursed: ₹{row.disbursed_this_fy.toLocaleString('en-IN')}
                                  </span>
                                </div>

                                {row.disbursements.length === 0 ? (
                                  <div className="py-6 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    No payouts recorded for this employee in FY {selectedFY}.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                                    {row.disbursements.map((d: any, dIdx: number) => (
                                      <div key={d.id || dIdx} className="py-2 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-gray-900 font-mono">
                                            ₹{Number(d.amount).toLocaleString('en-IN')}
                                          </div>
                                          <div className="text-[10px] text-gray-500">
                                            {d.remark || 'Statutory Bonus Payout'}
                                          </div>
                                        </div>
                                        <div className="text-right font-mono text-[10px] text-gray-400">
                                          <div>{new Date(d.disbursed_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-gray-300 font-mono font-bold text-xs">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase tracking-wider font-sans text-gray-600">
                    Grand Totals ({filteredRecords.length} Staff):
                  </td>
                  <td className="p-3 text-right text-teal-900 bg-teal-100/50">
                    ₹{totals.accrued.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-emerald-900 bg-emerald-100/50">
                    ₹{totals.disbursed.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-amber-900 bg-amber-100/60 text-sm">
                    ₹{totals.balance.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Record Payout Modal */}
      {payoutModalStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Record Bonus Payout</h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {payoutModalStaff.employee_name} ({payoutModalStaff.biometric_code || '—'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModalStaff(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reconciliation Snapshot */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">Accrued</span>
                <span className="font-bold font-mono text-teal-800">
                  ₹{payoutModalStaff.accrued_this_fy.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">Disbursed</span>
                <span className="font-bold font-mono text-emerald-800">
                  ₹{payoutModalStaff.disbursed_this_fy.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">Outstanding</span>
                <span className="font-bold font-mono text-amber-800">
                  ₹{payoutModalStaff.balance_outstanding.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePayout} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Disbursement Amount (₹) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={payoutModalStaff.balance_outstanding}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  placeholder="Enter payout amount"
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-teal-600 inline" />
                  Pre-filled with maximum outstanding balance of ₹{payoutModalStaff.balance_outstanding.toLocaleString('en-IN')}.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Disbursed Date *
                </label>
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Payment Remark / Settlement Note
                </label>
                <input
                  type="text"
                  value={payoutRemark}
                  onChange={(e) => setPayoutRemark(e.target.value)}
                  placeholder="e.g. Diwali 2026 Bonus Settlement"
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPayoutModalStaff(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayout}
                  className="bg-[#20B2AA] hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isSavingPayout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
};

export default BonusHub;
