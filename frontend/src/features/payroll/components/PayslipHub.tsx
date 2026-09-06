import React, { useState, useEffect } from 'react';
import {
  Printer,
  Calendar,
  Building2,
  Loader2,
  Filter,
  FileText,
  Edit,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

function numberToWordsINR(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  let amount = Math.floor(num);
  let words = '';

  if (amount >= 10000000) {
    words += convertChunk(Math.floor(amount / 10000000)) + ' Crore ';
    amount %= 10000000;
  }
  if (amount >= 100000) {
    words += convertChunk(Math.floor(amount / 100000)) + ' Lakh ';
    amount %= 100000;
  }
  if (amount >= 1000) {
    words += convertChunk(Math.floor(amount / 1000)) + ' Thousand ';
    amount %= 1000;
  }
  if (amount > 0) {
    words += convertChunk(amount);
  }

  return words.trim();
}

export const PayslipHub: React.FC = () => {
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
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Manual PT Modal State
  const [activePtRecord, setActivePtRecord] = useState<any | null>(null);
  const [manualPtVal, setManualPtVal] = useState<number>(0);
  const [manualPtReasonVal, setManualPtReasonVal] = useState<string>('');

  const openPtModal = (record: any) => {
    setActivePtRecord(record);
    setManualPtVal(Number(record.manual_pt_adjustment || 0));
    setManualPtReasonVal(record.manual_pt_adjustment_reason || '');
  };

  const handleSavePtModal = async () => {
    if (!activePtRecord) return;
    const manualPt = manualPtVal;
    const currentTotalPt = Number(activePtRecord.pt ?? activePtRecord.pt_deduction ?? 0);
    const currentManualPt = Number(activePtRecord.manual_pt_adjustment || 0);
    const systemPt = currentTotalPt - currentManualPt;
    const newTotalPt = systemPt + manualPt;

    const earnedGross = Number(activePtRecord.earned_gross || 0);
    const epf = Number(activePtRecord.epf || activePtRecord.epf_deduction || 0);
    const esic = Number(activePtRecord.esic || activePtRecord.esic_deduction || 0);
    const advances = Number(activePtRecord.advances ?? activePtRecord.in_this_mth ?? 0);
    const earnedPartBonus = Number(activePtRecord.earned_part_bonus || 0);

    const netSalary = earnedGross - epf - esic - newTotalPt - advances;
    const totalNetSalary = netSalary + earnedPartBonus;

    const recordToSave: any = {
      ...activePtRecord,
      pt: newTotalPt,
      pt_deduction: newTotalPt,
      manual_pt_adjustment: manualPt,
      manual_pt_adjustment_reason: manualPtReasonVal,
      net_salary: netSalary,
      total_net_salary: totalNetSalary,
      updated_at: new Date().toISOString(),
    };
    delete recordToSave.staff;

    const { error: fullError } = await supabase.from('payroll_records').upsert([recordToSave], {
      onConflict: 'staff_id,month_year',
    });

    if (fullError) {
      console.warn('Fallback save for payslip record:', fullError.message);
      const fallbackRecord = { ...recordToSave };
      delete fallbackRecord.manual_pt_adjustment;
      delete fallbackRecord.manual_pt_adjustment_reason;
      await supabase.from('payroll_records').upsert([fallbackRecord], {
        onConflict: 'staff_id,month_year',
      });
    }

    setRecords((prev) =>
      prev.map((r) => (r.id === activePtRecord.id ? { ...r, ...recordToSave } : r))
    );
    setActivePtRecord(null);
  };

  // Sync filter changes to localStorage
  useEffect(() => {
    localStorage.setItem('payroll_filter_month', selectedMonth);
    localStorage.setItem('payroll_filter_year', selectedYear.toString());
    localStorage.setItem('payroll_filter_site', selectedSiteId);
  }, [selectedMonth, selectedYear, selectedSiteId]);

  // Fetch sites dropdown
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const { data, error } = await supabase.from('sites').select('id, site_name, code_name').order('site_name');
        if (data) setSites(data);
      } catch (err) {
        console.error('Error fetching sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Fetch Payroll Records for Payslips
  const loadPayslips = async () => {
    setIsLoading(true);
    try {
      const monthYearStr = `${selectedMonth} ${selectedYear}`;
      let query = supabase.from('payroll_records').select('*, staff(*)').eq('month_year', monthYearStr);

      if (selectedSiteId !== 'all') {
        query = query.eq('site_id', selectedSiteId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching payslips:', error);
      } else {
        const fetchedData = data || [];
        setRecords(fetchedData);
        // Default state: ALL staff checked/selected
        setSelectedRecordIds(new Set(fetchedData.map((r: any) => r.id)));
      }
    } catch (err) {
      console.error('Failed to load payslips:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayslips();
  }, [selectedMonth, selectedYear, selectedSiteId]);

  const isAllSelected = records.length > 0 && records.every((r: any) => selectedRecordIds.has(r.id));
  const isSomeSelected = selectedRecordIds.size > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map((r: any) => r.id)));
    }
  };

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const printableRecords = records.filter((r: any) => selectedRecordIds.has(r.id));

  const renderPayslipCard = (record: any, index: number, isPrintOnly: boolean = false) => {
    const isSelected = selectedRecordIds.has(record.id);
    const totalNetPayable =
      record.total_net_salary != null && Number(record.total_net_salary) > 0
        ? Number(record.total_net_salary)
        : Number(record.net_salary || 0);

    const advanceDeducted = Number(record.advances ?? record.in_this_mth ?? 0);
    const totalDeductions =
      (record.epf || record.epf_deduction || 0) +
      (record.esic || record.esic_deduction || 0) +
      (record.pt || record.pt_deduction || 0) +
      advanceDeducted;

    const staff = record.staff || {};

    return (
      <div
        key={record.id || index}
        className={`payslip-card w-full h-auto print:min-h-[90mm] border-[2px] border-solid border-black p-3 print:p-2 flex flex-col justify-between mb-6 print:mb-2 box-border bg-white rounded-lg print:rounded-none ${
          !isPrintOnly && !isSelected ? 'opacity-50 bg-gray-50/70 border-gray-300' : ''
        }`}
      >
        {/* Screen-only Row Selection Bar */}
        {!isPrintOnly && (
          <div className="no-print flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800 select-none">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleSelectRecord(record.id)}
                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
              />
              <span>{record.employee_name || staff.name || 'Employee'} ({record.emp_id || staff.biometric_code || '-'})</span>
            </label>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isSelected ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-600'
              }`}>
                {isSelected ? 'Included in Batch' : 'Excluded'}
              </span>
              <button
                type="button"
                onClick={() => openPtModal(record)}
                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Edit Manual PT Adjustment"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit PT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRecordIds(new Set([record.id]));
                  setTimeout(() => window.print(), 100);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Print only this employee's payslip"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Single</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b border-gray-800 pb-1">
          <h1 className="font-bold text-sm text-center uppercase tracking-wider text-gray-900">
            Ambe Service Facilities Pvt. Ltd.
          </h1>
          <p className="text-[9px] font-semibold text-gray-700">
            {record.site_name ? `SITE: ${record.site_name.toUpperCase()} | ` : ''}PAYSLIP FOR THE MONTH OF {selectedMonth.toUpperCase()} {selectedYear}
          </p>
        </div>

        {/* SIDE-BY-SIDE LAYOUT: Info (Left) | Financials (Right) */}
        <div className="flex border-b border-gray-800 flex-1">
          {/* Left: Employee Details */}
          <div className="w-[40%] border-r border-gray-800 py-1 pr-2 flex flex-col justify-start space-y-0.5 text-[8.5px] font-mono">
            <div className="flex justify-between"><span className="font-sans font-bold">NAME:</span> <span>{record.employee_name || staff.name || '-'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">EMP ID:</span> <span>{record.emp_id || staff.biometric_code || '-'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">DESIGNATION:</span> <span>{staff.designation || 'Staff'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">PF NO:</span> <span>{staff.pf_no || staff.pfNo || staff.uan_no || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">ESIC NO:</span> <span>{staff.esic_no || staff.esicNo || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">BANK A/C:</span> <span>{staff.bank_account_no || staff.bank_account || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">IFSC:</span> <span>{staff.bank_ifsc_code || staff.ifsc || 'N/A'}</span></div>
            {(record.adv_total || 0) > 0 && (
              <div className="flex justify-between border-t border-gray-300 mt-0.5 pt-0.5"><span className="font-sans font-bold">ADVANCE TOTAL:</span> <span>₹{(record.adv_total || 0).toLocaleString('en-IN')}</span></div>
            )}
            <div className="flex justify-between border-t border-gray-300 mt-0.5 pt-0.5">
              <span className="font-sans font-bold">PD (PRESENT):</span> 
              <span>{record.pd ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans font-bold">WO (WEEKLY OFF):</span> 
              <span>{record.wo ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans font-bold">TOTAL PAYABLE:</span> 
              <span>{record.payable_days ?? ((record.pd || 0) + (record.wo || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans font-bold">DAYS IN MONTH:</span> 
              <span>{new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate()}</span>
            </div>
          </div>

          {/* Right: Financial Table */}
          <div className="w-[60%] flex flex-col">
            <div className="flex flex-1">
              {/* Earnings Column */}
              <div className="w-1/2 border-r border-gray-300 pl-2 pr-1 py-1 flex flex-col text-[8.5px] font-mono">
                <div className="flex justify-between font-bold font-sans border-b border-gray-400 pb-0.5 mb-0.5 text-[8px] uppercase">
                  <span>EARNINGS</span><span>₹</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Basic Pay</span><span>{(record.earned_basic || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>HRA</span><span>{(record.earned_hra || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Washing Allow.</span><span>{(record.earned_other || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Conveyance</span><span>{(record.earned_conveyance || 0).toLocaleString('en-IN')}</span></div>
                {(record.earned_incentive || 0) > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200"><span>Incentive</span><span>{(record.earned_incentive || 0).toLocaleString('en-IN')}</span></div>
                )}
                <div className="mt-1 pt-1 flex justify-between font-bold text-[9px] border-t border-gray-800">
                  <span>TOTAL EARNINGS</span><span>₹{(record.earned_gross || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              {/* Deductions Column */}
              <div className="w-1/2 pl-2 py-1 flex flex-col text-[8.5px] font-mono">
                <div className="flex justify-between font-bold font-sans border-b border-gray-400 pb-0.5 mb-0.5 text-[8px] uppercase">
                  <span>DEDUCTIONS</span><span>₹</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>EPF</span><span>{(record.epf || record.epf_deduction || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>ESIC</span><span>{(record.esic || record.esic_deduction || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200">
                  <span className="flex items-center gap-1">
                    <span>PT</span>
                    {!isPrintOnly && Number(record.manual_pt_adjustment || 0) !== 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 animate-pulse"
                        title={`Manual PT: ${Number(record.manual_pt_adjustment) > 0 ? '+' : ''}₹${record.manual_pt_adjustment} (${record.manual_pt_adjustment_reason || ''})`}
                      />
                    )}
                  </span>
                  <span>{(record.pt || record.pt_deduction || 0).toLocaleString('en-IN')}</span>
                </div>
                {advanceDeducted > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200 leading-tight py-0 text-[7.5px]"><span>Advance (This Month)</span><span>{advanceDeducted.toLocaleString('en-IN')}</span></div>
                )}
                {(record.in_next_mth || 0) > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200 leading-tight py-0 text-[7.5px]"><span>Advance (Next Month)</span><span>{(record.in_next_mth || 0).toLocaleString('en-IN')}</span></div>
                )}
                <div className="mt-1 pt-1 flex justify-between font-bold text-[9px] border-t border-gray-800">
                  <span>TOTAL DEDUCT.</span><span>₹{totalDeductions.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Signatures */}
        <div className="pt-1 text-[9px]">
          <div className="flex justify-between items-center font-bold font-mono">
            <span>TOTAL NET PAYABLE: ₹{totalNetPayable.toLocaleString('en-IN')}</span>
            <span className="font-sans text-[8px] italic text-gray-700">
              (Rupees {numberToWordsINR(totalNetPayable)} Only)
            </span>
          </div>
          <div className="flex justify-between items-end mt-4 print:mt-3 pt-2 text-[9px] font-bold text-gray-800 font-sans">
            <div className="text-center w-40 border-t border-gray-900 pt-1">
              Employee Signature
            </div>
            <div className="text-center w-40 relative">
              <img
                src="/employer-signature.jpeg"
                alt="Employer Signature"
                className="h-12 mx-auto object-contain print:h-10"
                style={{ marginBottom: '-6px' }}
              />
              <div className="border-t border-gray-900 pt-1">
                Employer Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          
          html, body {
            background-color: #FFF !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          .print-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-wrapper, .print-wrapper * {
            visibility: visible !important;
          }

          .payslip-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 2px solid #000 !important;
            width: 100% !important;
          }

          .payslip-card:nth-child(3n) {
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* Top Header Bar (Hidden during print) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">3-Up Printable Payslips</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              3-per-A4 page printable payslips formatted with pure Tailwind print modifiers.
            </p>
          </div>
        </div>

        {/* Filters & Print Action */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!selectedRecordIds.size || isLoading}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Payslips ({selectedRecordIds.size} selected)</span>
          </button>
        </div>
      </div>

      {/* Selection Control Bar (Hidden during print) */}
      {!isLoading && records.length > 0 && (
        <div className="no-print bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-800 select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
            />
            <span>Select All Employees ({records.length})</span>
          </label>
          <div className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-900">{selectedRecordIds.size}</strong> of <strong className="text-gray-900">{records.length}</strong> payslips selected for batch print
          </div>
        </div>
      )}

      {/* Screen Preview Container (Hidden during print) */}
      <div className="no-print space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Loading payslip records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-500 space-y-2 bg-white rounded-2xl border border-gray-200 shadow-xs">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No payroll records found for selected period.</p>
            <p>Process payroll in the Payroll tab first to generate printable payslips.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {records.map((record: any, index: number) => renderPayslipCard(record, index, false))}
          </div>
        )}
      </div>

      {/* Dedicated Print-Only Container (Render ONLY printableRecords, Hidden on screen, Visible during print) */}
      {/* Manual PT Adjustment Popover Modal */}
      {activePtRecord && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">
                    Manual PT Adjustment
                  </h2>
                  <p className="text-xs text-gray-500">
                    {activePtRecord.employee_name || activePtRecord.staff?.employee_name || 'Employee'} ({activePtRecord.emp_id || activePtRecord.staff?.biometric_code || '-'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePtRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formula vs Manual Breakdown Card */}
            {(() => {
              const currentTotalPt = Number(activePtRecord.pt ?? activePtRecord.pt_deduction ?? 0);
              const currentManualPt = Number(activePtRecord.manual_pt_adjustment || 0);
              const systemPt = currentTotalPt - currentManualPt;
              const newTotalPt = systemPt + manualPtVal;

              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-700">
                    <span className="font-semibold">System calculated:</span>
                    <span className="font-mono font-bold">₹{systemPt}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-900">
                    <span className="font-semibold">Manual adjustment:</span>
                    <span className="font-mono font-bold">
                      {manualPtVal >= 0 ? '+' : ''}₹{manualPtVal}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-amber-950 border-t border-amber-200/80 pt-2 text-sm">
                    <span>Total PT:</span>
                    <span className="font-mono">₹{newTotalPt}</span>
                  </div>
                </div>
              );
            })()}

            {/* Input Form Fields */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Manual PT Adjustment (₹)
                </label>
                <input
                  type="number"
                  value={manualPtVal === 0 ? '' : manualPtVal}
                  onChange={(e) => setManualPtVal(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Use positive amount (e.g. 200) to add PT paid out of pocket, or negative to reduce.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={manualPtReasonVal}
                  onChange={(e) => setManualPtReasonVal(e.target.value)}
                  placeholder="e.g. Paid out of pocket - attendance shortfall"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setActivePtRecord(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePtModal}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Adjustment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print-Only Container (Render ONLY printableRecords, Hidden on screen, Visible during print) */}
      <div className="print-wrapper hidden print:block print:w-full print:m-0 print:p-0">
        {printableRecords.map((record: any, index: number) => renderPayslipCard(record, index, true))}
      </div>
    </div>
  );
};
