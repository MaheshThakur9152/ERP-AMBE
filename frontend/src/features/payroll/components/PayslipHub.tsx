import React, { useState, useEffect } from 'react';
import {
  Printer,
  Calendar,
  Building2,
  Loader2,
  Filter,
  FileText,
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
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        setRecords(data || []);
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

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          
          /* 1. Hide absolutely everything in the app by default */
          body * {
            visibility: hidden !important;
          }
          
          /* 2. Force the background to be pure white */
          html, body {
            background-color: #FFF !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 3. Make ONLY the print-wrapper and its children visible */
          .print-wrapper, .print-wrapper * {
            visibility: visible !important;
          }
          
          /* 4. Rip the wrapper out of the layout flow and snap it to the top-left */
          .print-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 5. Clean up grid and borders for the Canon printer */
          .grid {
            display: block !important;
          }
          .payslip-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 2px solid #000 !important;
            width: 100% !important;
          }

          /* Force a clean page break after every 3rd slip */
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
            disabled={!records.length || isLoading}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Payslips ({records.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area / Print Container */}
      <div className="print-wrapper">
        {isLoading ? (
          <div className="no-print flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Loading payslip records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="no-print text-center py-16 text-xs text-gray-500 space-y-2 bg-white rounded-2xl border border-gray-200 shadow-xs">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No payroll records found for selected period.</p>
            <p>Process payroll in the Payroll tab first to generate printable payslips.</p>
          </div>
        ) : (
          <div className="grid gap-6 print:block print:w-full print:m-0 print:p-0">
            {records.map((record: any, index: number) => {
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
                  className="payslip-card w-full h-auto print:h-[90mm] border-[2px] border-solid border-black p-3 print:p-2 flex flex-col justify-between mb-6 print:mb-2 box-border bg-white rounded-lg print:rounded-none"
                >
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
                      <div className="flex justify-between"><span className="font-sans font-bold">DOJ:</span> <span>{staff.joining_date ? new Date(staff.joining_date).toLocaleDateString('en-GB') : '01/01/2026'}</span></div>
                      <div className="flex justify-between"><span className="font-sans font-bold">PF NO:</span> <span>{staff.pf_no || staff.pfNo || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="font-sans font-bold">ESIC NO:</span> <span>{staff.esic_no || staff.esicNo || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="font-sans font-bold">BANK A/C:</span> <span>{staff.bank_account_no || staff.bank_account || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="font-sans font-bold">IFSC:</span> <span>{staff.bank_ifsc_code || staff.ifsc || 'N/A'}</span></div>
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
                          <div className="flex justify-between border-b border-dotted border-gray-200"><span>PT</span><span>{(record.pt || record.pt_deduction || 0).toLocaleString('en-IN')}</span></div>
                          {advanceDeducted > 0 && (
                            <div className="flex justify-between border-b border-dotted border-gray-200"><span>Advances</span><span>{advanceDeducted.toLocaleString('en-IN')}</span></div>
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
                      <span>NET PAYABLE: ₹{(record.net_salary || 0).toLocaleString('en-IN')}</span>
                      <span className="font-sans text-[8px] italic text-gray-700">
                        (Rupees {numberToWordsINR(record.net_salary || 0)} Only)
                      </span>
                    </div>
                    <div className="flex justify-between items-end mt-4 pt-2 text-[9px] font-bold text-gray-800 font-sans">
                      <div className="text-center w-40 border-t border-gray-900 pt-1">
                        Employee Signature
                      </div>
                      <div className="text-center w-40 border-t border-gray-900 pt-1">
                        Employer Signature
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
