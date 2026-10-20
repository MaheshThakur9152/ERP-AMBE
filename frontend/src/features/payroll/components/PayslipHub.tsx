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
  Plus,
  Trash2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { fetchWithRetry } from '@/lib/apiClient';

export interface SiteOption {
  id: string;
  site_name: string;
  code_name?: string;
}

export interface CustomLineItem {
  id: string;
  name: string;
  amount: number;
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

  // Edit Payslip Modal State
  const [activeEditPayslipRecord, setActiveEditPayslipRecord] = useState<any | null>(null);

  // Employee details fields
  const [editEmpName, setEditEmpName] = useState<string>('');
  const [editEmpId, setEditEmpId] = useState<string>('');
  const [editDesignation, setEditDesignation] = useState<string>('');
  const [editPfNo, setEditPfNo] = useState<string>('');
  const [editEsicNo, setEditEsicNo] = useState<string>('');
  const [editBankAccountNo, setEditBankAccountNo] = useState<string>('');
  const [editBankIfscCode, setEditBankIfscCode] = useState<string>('');

  // Attendance fields
  const [editPd, setEditPd] = useState<number>(0);
  const [editWo, setEditWo] = useState<number>(0);
  const [editPayableDays, setEditPayableDays] = useState<number>(0);
  const [editDaysInMonth, setEditDaysInMonth] = useState<number>(30);

  // Earnings fields
  const [editEarnedBasic, setEditEarnedBasic] = useState<number>(0);
  const [editEarnedHra, setEditEarnedHra] = useState<number>(0);
  const [editEarnedOther, setEditEarnedOther] = useState<number>(0);
  const [editEarnedConveyance, setEditEarnedConveyance] = useState<number>(0);
  const [editEarnedIncentive, setEditEarnedIncentive] = useState<number>(0);
  const [editCustomEarnings, setEditCustomEarnings] = useState<CustomLineItem[]>([]);

  // Deductions fields
  const [editEpf, setEditEpf] = useState<number>(0);
  const [editEsic, setEditEsic] = useState<number>(0);
  const [editPt, setEditPt] = useState<number>(0);
  const [editAdvances, setEditAdvances] = useState<number>(0);
  const [editCustomDeductions, setEditCustomDeductions] = useState<CustomLineItem[]>([]);

  // Net Payable editable field
  const [editNetPayable, setEditNetPayable] = useState<number>(0);
  const [isCustomNetPayable, setIsCustomNetPayable] = useState<boolean>(false);

  const [editReason, setEditReason] = useState<string>('');

  // Live computed totals for Edit Payslip Modal
  const modalTotalCustomEarnings = editCustomEarnings.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const modalTotalEarnings =
    editEarnedBasic +
    editEarnedHra +
    editEarnedOther +
    editEarnedConveyance +
    editEarnedIncentive +
    modalTotalCustomEarnings;

  const modalTotalCustomDeductions = editCustomDeductions.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const modalTotalDeductions =
    editEpf + editEsic + editPt + editAdvances + modalTotalCustomDeductions;

  const modalAutoNetPayable = modalTotalEarnings - modalTotalDeductions;

  // Auto-sync Net Payable if user has not manually set a custom net payable amount
  useEffect(() => {
    if (!isCustomNetPayable && activeEditPayslipRecord) {
      setEditNetPayable(modalAutoNetPayable);
    }
  }, [
    modalAutoNetPayable,
    isCustomNetPayable,
    activeEditPayslipRecord,
  ]);

  const openEditPayslipModal = (record: any) => {
    const staff = record.staff || {};

    const initialCustomEarnings: CustomLineItem[] =
      Array.isArray(record.custom_earnings)
        ? record.custom_earnings
        : record.manual_override_data?.custom_earnings || [];

    const initialCustomDeductions: CustomLineItem[] =
      Array.isArray(record.custom_deductions)
        ? record.custom_deductions
        : record.manual_override_data?.custom_deductions || [];

    const defaultDaysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();

    setActiveEditPayslipRecord(record);
    setEditEmpName(record.employee_name || staff.employee_name || staff.name || '');
    setEditEmpId(record.emp_id || staff.biometric_code || staff.emp_id || '');
    setEditDesignation(record.designation || staff.designation || staff.role || 'Staff');
    setEditPfNo(record.pf_no || staff.pf_no || staff.pfNo || staff.uan_no || '');
    setEditEsicNo(record.esic_no || staff.esic_no || staff.esicNo || '');
    setEditBankAccountNo(record.bank_account_no || staff.bank_account_no || staff.bank_account || '');
    setEditBankIfscCode(record.bank_ifsc_code || staff.bank_ifsc_code || staff.ifsc || '');

    const pdVal = Number(record.pd ?? 0);
    const woVal = Number(record.wo ?? 0);
    setEditPd(pdVal);
    setEditWo(woVal);
    setEditPayableDays(Number(record.payable_days ?? (pdVal + woVal)));
    setEditDaysInMonth(Number(record.days_in_month ?? defaultDaysInMonth));

    const basic = Number(record.earned_basic || 0);
    const hra = Number(record.earned_hra || 0);
    const other = Number(record.earned_other || 0);
    const conveyance = Number(record.earned_conveyance || 0);
    const incentive = Number(record.earned_incentive || 0);
    setEditEarnedBasic(basic);
    setEditEarnedHra(hra);
    setEditEarnedOther(other);
    setEditEarnedConveyance(conveyance);
    setEditEarnedIncentive(incentive);
    setEditCustomEarnings(initialCustomEarnings);

    const epf = Number(record.epf ?? record.epf_deduction ?? 0);
    const esic = Number(record.esic ?? record.esic_deduction ?? 0);
    const pt = Number(record.pt ?? record.pt_deduction ?? 0);
    const adv = Number(record.advances ?? record.in_this_mth ?? 0);
    setEditEpf(epf);
    setEditEsic(esic);
    setEditPt(pt);
    setEditAdvances(adv);
    setEditCustomDeductions(initialCustomDeductions);

    const totalCustEarn = initialCustomEarnings.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const calcEarnedGross = basic + hra + other + conveyance + incentive + totalCustEarn;
    const totalCustDeduct = initialCustomDeductions.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const calcTotalDeduct = epf + esic + pt + adv + totalCustDeduct;
    const autoCalculatedNet = calcEarnedGross - calcTotalDeduct;

    const hasCustomNetFlag = Boolean(record.manual_override_data?.is_custom_net_payable);
    const isManuallyEdited = Boolean(record.is_manually_edited);

    if (isManuallyEdited && hasCustomNetFlag && record.total_net_salary != null) {
      setEditNetPayable(Number(record.total_net_salary));
      setIsCustomNetPayable(true);
    } else {
      setEditNetPayable(autoCalculatedNet);
      setIsCustomNetPayable(false);
    }

    setEditReason(record.manual_override_data?.audit_log?.[0]?.reason || '');
  };

  const handleOpenAddPayslipModal = () => {
    const defaultDaysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
    const currentSite = sites.find((s) => s.id === selectedSiteId);
    const defaultSiteName = currentSite ? (currentSite.code_name || currentSite.site_name) : (sites[0]?.site_name || 'Main Site');
    const defaultSiteId = currentSite ? currentSite.id : (sites[0]?.id || null);

    const newRecord = {
      isNew: true,
      id: `new-${Date.now()}`,
      staff_id: null,
      month_year: `${selectedMonth} ${selectedYear}`,
      site_id: defaultSiteId,
      site_name: defaultSiteName,
      employee_name: '',
      emp_id: '',
      designation: 'Staff',
      pf_no: '',
      esic_no: '',
      bank_account_no: '',
      bank_ifsc_code: '',
      pd: 26,
      wo: 4,
      payable_days: 30,
      days_in_month: defaultDaysInMonth,
      earned_basic: 0,
      earned_hra: 0,
      earned_other: 0,
      earned_conveyance: 0,
      earned_incentive: 0,
      earned_gross: 0,
      epf_deduction: 0,
      esic_deduction: 0,
      pt_deduction: 0,
      epf: 0,
      esic: 0,
      pt: 0,
      advances: 0,
      custom_earnings: [],
      custom_deductions: [],
      is_manually_edited: true,
      manual_override_data: null,
      net_salary: 0,
      total_net_salary: 0,
    };

    openEditPayslipModal(newRecord);
  };

  const handleSaveEditPayslipModal = async () => {
    if (!activeEditPayslipRecord) return;

    const totalCustomEarnings = editCustomEarnings.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const totalEarnings =
      editEarnedBasic +
      editEarnedHra +
      editEarnedOther +
      editEarnedConveyance +
      editEarnedIncentive +
      totalCustomEarnings;

    const totalCustomDeductions = editCustomDeductions.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const totalDeductions =
      editEpf + editEsic + editPt + editAdvances + totalCustomDeductions;

    const finalNetSalary = editNetPayable;
    const finalTotalNetSalary = editNetPayable;

    const existingAuditLog =
      activeEditPayslipRecord.manual_override_data?.audit_log || [];

    const auditEntry = {
      edited_at: new Date().toISOString(),
      edited_by: 'Admin',
      reason: editReason || (activeEditPayslipRecord.isNew ? 'New ad-hoc payslip created' : 'Manual payslip override'),
      changes: [
        { field: 'employee_name', old: activeEditPayslipRecord.employee_name, new: editEmpName },
        { field: 'earned_gross', old: activeEditPayslipRecord.earned_gross, new: totalEarnings },
        { field: 'total_net_salary', old: activeEditPayslipRecord.total_net_salary, new: finalTotalNetSalary },
      ],
    };

    const manualOverrideData = {
      employee_name: editEmpName,
      emp_id: editEmpId,
      designation: editDesignation,
      pf_no: editPfNo,
      esic_no: editEsicNo,
      bank_account_no: editBankAccountNo,
      bank_ifsc_code: editBankIfscCode,
      pd: editPd,
      wo: editWo,
      payable_days: editPayableDays,
      days_in_month: editDaysInMonth,
      custom_earnings: editCustomEarnings,
      custom_deductions: editCustomDeductions,
      is_custom_net_payable: isCustomNetPayable,
      audit_log: [auditEntry, ...existingAuditLog],
    };

    const recordToSave: any = {
      ...activeEditPayslipRecord,
      employee_name: editEmpName || 'Unnamed Employee',
      emp_id: editEmpId || `EMP${Date.now().toString().slice(-4)}`,
      designation: editDesignation || 'Staff',
      pf_no: editPfNo,
      esic_no: editEsicNo,
      bank_account_no: editBankAccountNo,
      bank_ifsc_code: editBankIfscCode,

      pd: editPd,
      wo: editWo,
      payable_days: editPayableDays,
      days_in_month: editDaysInMonth,

      earned_basic: editEarnedBasic,
      earned_hra: editEarnedHra,
      earned_other: editEarnedOther,
      earned_conveyance: editEarnedConveyance,
      earned_incentive: editEarnedIncentive,
      earned_gross: totalEarnings,

      epf_deduction: editEpf,
      esic_deduction: editEsic,
      pt_deduction: editPt,
      epf: editEpf,
      esic: editEsic,
      pt: editPt,
      advances: editAdvances,

      custom_earnings: editCustomEarnings,
      custom_deductions: editCustomDeductions,
      is_manually_edited: true,
      manual_override_data: manualOverrideData,

      net_salary: finalNetSalary,
      total_net_salary: finalTotalNetSalary,
      updated_at: new Date().toISOString(),
    };
    delete recordToSave.staff;

    // Resolve or create staff_id if person does not exist in master table yet
    let staffId = activeEditPayslipRecord.staff_id;

    if (!staffId || activeEditPayslipRecord.isNew) {
      let existingStaff: any = null;

      try {
        const staffRes = await fetchWithRetry('/api/staff');
        if (staffRes.ok) {
          const staffJson = await staffRes.json();
          const allStaff = staffJson.data || [];
          if (editEmpId && editEmpId.trim()) {
            existingStaff = allStaff.find(
              (s: any) => (s.biometric_code || '').trim() === editEmpId.trim()
            );
          }
          if (!existingStaff && editEmpName && editEmpName.trim()) {
            existingStaff = allStaff.find(
              (s: any) => (s.employee_name || '').toLowerCase().trim() === editEmpName.toLowerCase().trim()
            );
          }
        }
      } catch (e) {
        console.warn('Error querying staff for payslip edit:', e);
      }

      if (existingStaff) {
        staffId = existingStaff.id;
      } else {
        const newStaffId = crypto.randomUUID();
        const newStaffObj = {
          id: newStaffId,
          employee_name: editEmpName || 'Ad-Hoc Staff',
          biometric_code: editEmpId || `ADHOC_${Date.now().toString().slice(-6)}`,
          designation: editDesignation || 'Staff',
          pf_no: editPfNo || null,
          esic_no: editEsicNo || null,
          bank_account_no: editBankAccountNo || null,
          bank_ifsc_code: editBankIfscCode || null,
          site_id: recordToSave.site_id || null,
          status: 'Active',
        };

        try {
          const createStaffRes = await fetchWithRetry('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStaffObj),
          });
          if (createStaffRes.ok) {
            const createStaffJson = await createStaffRes.json();
            staffId = createStaffJson.data?.id || newStaffId;
          } else {
            staffId = newStaffId;
          }
        } catch {
          staffId = newStaffId;
        }
      }
    }

    recordToSave.staff_id = staffId;
    delete recordToSave.isNew;
    delete recordToSave.staff;

    const saveRes = await fetchWithRetry('/api/payroll/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([recordToSave]),
    });

    let finalSavedRecord = {
      ...recordToSave,
      id: recordToSave.id || `rec-${Date.now()}`,
    };

    if (saveRes.ok) {
      const saveJson = await saveRes.json();
      if (saveJson.data?.[0]) {
        finalSavedRecord = saveJson.data[0];
      }
    }

    setRecords((prev) => {
      const exists = prev.some(
        (r) => r.id === activeEditPayslipRecord.id || r.id === finalSavedRecord.id
      );
      if (exists) {
        return prev.map((r) =>
          r.id === activeEditPayslipRecord.id || r.id === finalSavedRecord.id
            ? { ...r, ...finalSavedRecord }
            : r
        );
      } else {
        return [finalSavedRecord, ...prev];
      }
    });

    setSelectedRecordIds((prev) => new Set([...prev, finalSavedRecord.id]));
    setActiveEditPayslipRecord(null);
  };

  const handleResetToPayrollData = async () => {
    if (!activeEditPayslipRecord) return;
    const staff = activeEditPayslipRecord.staff || {};

    const defaultPd = Number(activeEditPayslipRecord.original_pd ?? activeEditPayslipRecord.pd ?? 0);
    const defaultWo = Number(activeEditPayslipRecord.original_wo ?? activeEditPayslipRecord.wo ?? 4);

    const recordToSave: any = {
      ...activeEditPayslipRecord,
      employee_name: staff.employee_name || staff.name || activeEditPayslipRecord.employee_name,
      emp_id: staff.biometric_code || activeEditPayslipRecord.emp_id,
      designation: staff.designation || 'Staff',
      pf_no: staff.pf_no || staff.pfNo || staff.uan_no || '',
      esic_no: staff.esic_no || staff.esicNo || '',
      bank_account_no: staff.bank_account_no || staff.bank_account || '',
      bank_ifsc_code: staff.bank_ifsc_code || staff.ifsc || '',

      pd: defaultPd,
      wo: defaultWo,
      payable_days: defaultPd + defaultWo,
      days_in_month: new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate(),

      custom_earnings: [],
      custom_deductions: [],
      is_manually_edited: false,
      manual_override_data: null,
      manual_pt_adjustment: 0,
      manual_pt_adjustment_reason: '',
      updated_at: new Date().toISOString(),
    };
    delete recordToSave.staff;

    await fetchWithRetry('/api/payroll/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([recordToSave]),
    }).catch((err) => console.warn('Failed to reset manual override:', err));

    setRecords((prev) =>
      prev.map((r) => (r.id === activeEditPayslipRecord.id ? { ...r, ...recordToSave } : r))
    );
    setActiveEditPayslipRecord(null);
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
        const res = await fetchWithRetry('/api/sites');
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
          setSites(data.map((s: any) => ({
            id: s.id,
            site_name: s.site_name || s.name || '',
            code_name: s.code_name || s.codeName || '',
          })));
        }
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
      let url = `/api/payroll?month_year=${encodeURIComponent(monthYearStr)}`;
      if (selectedSiteId !== 'all') {
        url += `&site_id=${encodeURIComponent(selectedSiteId)}`;
      }

      const res = await fetchWithRetry(url);
      if (res.ok) {
        const json = await res.json();
        const fetchedData = json.data || [];
        setRecords(fetchedData);
        setSelectedRecordIds(new Set(fetchedData.map((r: any) => r.id)));
      } else {
        setRecords([]);
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
    const staff = record.staff || {};

    const customEarningsList: CustomLineItem[] =
      Array.isArray(record.custom_earnings)
        ? record.custom_earnings
        : record.manual_override_data?.custom_earnings || [];

    const customDeductionsList: CustomLineItem[] =
      Array.isArray(record.custom_deductions)
        ? record.custom_deductions
        : record.manual_override_data?.custom_deductions || [];

    const totalCustomEarnings = customEarningsList.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    const totalCustomDeductions = customDeductionsList.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    const advanceDeducted = Number(record.advances ?? record.in_this_mth ?? 0);

    const earnedBasic = Number(record.earned_basic || 0);
    const earnedHra = Number(record.earned_hra || 0);
    const earnedOther = Number(record.earned_other || 0);
    const earnedConveyance = Number(record.earned_conveyance || 0);
    const earnedIncentive = Number(record.earned_incentive || 0);

    const totalEarnings =
      earnedBasic + earnedHra + earnedOther + earnedConveyance + earnedIncentive + totalCustomEarnings;

    const epfVal = Number(record.epf || record.epf_deduction || 0);
    const esicVal = Number(record.esic || record.esic_deduction || 0);
    const ptVal = Number(record.pt || record.pt_deduction || 0);

    const totalDeductions = epfVal + esicVal + ptVal + advanceDeducted + totalCustomDeductions;

    const calculatedNet = totalEarnings - totalDeductions;

    const totalNetPayable =
      record.is_manually_edited && record.total_net_salary != null
        ? Number(record.total_net_salary)
        : calculatedNet;

    const designation = record.designation || staff.designation || 'Staff';
    const pfNo = record.pf_no || staff.pf_no || staff.pfNo || staff.uan_no || 'N/A';
    const esicNo = record.esic_no || staff.esic_no || staff.esicNo || 'N/A';
    const bankAcc = record.bank_account_no || staff.bank_account_no || staff.bank_account || 'N/A';
    const ifsc = record.bank_ifsc_code || staff.bank_ifsc_code || staff.ifsc || 'N/A';
    const defaultDaysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
    const daysInMonthVal = record.days_in_month ?? defaultDaysInMonth;

    const isEdited =
      record.is_manually_edited ||
      record.manual_override_data != null ||
      Number(record.manual_pt_adjustment || 0) !== 0;

    return (
      <div
        key={record.id || index}
        className={`payslip-card w-full h-auto print:min-h-[90mm] border-[2px] border-solid border-black p-3 print:p-2 flex flex-col justify-between mb-6 print:mb-2 box-border bg-white rounded-lg print:rounded-none ${
          !isPrintOnly && !isSelected ? 'opacity-50 bg-gray-50/70 border-gray-300' : ''
        }`}
      >
        {/* Screen-only Row Selection & Action Bar */}
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
              {isEdited && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                  Manually Edited
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isSelected ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-600'
              }`}>
                {isSelected ? 'Included in Batch' : 'Excluded'}
              </span>

              <button
                type="button"
                onClick={() => openEditPayslipModal(record)}
                className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Edit Employee Payslip"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Payslip</span>
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
            <div className="flex justify-between"><span className="font-sans font-bold">DESIGNATION:</span> <span>{designation}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">PF NO:</span> <span>{pfNo}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">ESIC NO:</span> <span>{esicNo}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">BANK A/C:</span> <span>{bankAcc}</span></div>
            <div className="flex justify-between"><span className="font-sans font-bold">IFSC:</span> <span>{ifsc}</span></div>
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
              <span>{daysInMonthVal}</span>
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
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Basic Pay</span><span>{earnedBasic.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>HRA</span><span>{earnedHra.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Washing Allow.</span><span>{earnedOther.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>Conveyance</span><span>{earnedConveyance.toLocaleString('en-IN')}</span></div>
                {earnedIncentive > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200"><span>Incentive</span><span>{earnedIncentive.toLocaleString('en-IN')}</span></div>
                )}
                {customEarningsList.map((item, idx) => (
                  <div key={item.id || idx} className="flex justify-between border-b border-dotted border-gray-200 text-teal-800">
                    <span>{item.name || 'Custom Earning'}</span>
                    <span>{(Number(item.amount) || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="mt-1 pt-1 flex justify-between font-bold text-[9px] border-t border-gray-800">
                  <span>TOTAL EARNINGS</span><span>₹{totalEarnings.toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              {/* Deductions Column */}
              <div className="w-1/2 pl-2 py-1 flex flex-col text-[8.5px] font-mono">
                <div className="flex justify-between font-bold font-sans border-b border-gray-400 pb-0.5 mb-0.5 text-[8px] uppercase">
                  <span>DEDUCTIONS</span><span>₹</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>EPF</span><span>{epfVal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between border-b border-dotted border-gray-200"><span>ESIC</span><span>{esicVal.toLocaleString('en-IN')}</span></div>
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
                  <span>{ptVal.toLocaleString('en-IN')}</span>
                </div>
                {advanceDeducted > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200 leading-tight py-0 text-[7.5px]"><span>Advance (This Month)</span><span>{advanceDeducted.toLocaleString('en-IN')}</span></div>
                )}
                {(record.in_next_mth || 0) > 0 && (
                  <div className="flex justify-between border-b border-dotted border-gray-200 leading-tight py-0 text-[7.5px]"><span>Advance (Next Month)</span><span>{(record.in_next_mth || 0).toLocaleString('en-IN')}</span></div>
                )}
                {customDeductionsList.map((item, idx) => (
                  <div key={item.id || idx} className="flex justify-between border-b border-dotted border-gray-200 text-amber-800">
                    <span>{item.name || 'Custom Deduction'}</span>
                    <span>{(Number(item.amount) || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
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
          {/* Add Payslip Action Button */}
          <button
            type="button"
            onClick={handleOpenAddPayslipModal}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            title="Create a new payslip for any person (existing or new)"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payslip</span>
          </button>

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
            <p>Process payroll in the Payroll tab or click "+ Add Payslip" to create manual payslips.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {records.map((record: any, index: number) => renderPayslipCard(record, index, false))}
          </div>
        )}
      </div>

      {/* EDIT / ADD PAYSLIP MODAL */}
      {activeEditPayslipRecord && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50/50 rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">
                    {activeEditPayslipRecord.isNew ? 'Add New Payslip' : 'Edit Payslip'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Employee: <span className="font-semibold text-gray-800">{editEmpName || activeEditPayslipRecord.employee_name || 'New Person'}</span> {editEmpId ? `(${editEmpId})` : ''} | Month: <span className="font-semibold text-gray-800">{selectedMonth} {selectedYear}</span> | Site: <span className="font-semibold text-gray-800">{activeEditPayslipRecord.site_name || 'All'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveEditPayslipRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">

              {/* Employee Details Section */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                  <span>Employee Details</span>
                  <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 lowercase">
                    (applies to this month's payslip)
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Employee Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={editEmpName}
                      onChange={(e) => setEditEmpName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Employee ID</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP102"
                      value={editEmpId}
                      onChange={(e) => setEditEmpId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Supervisor"
                      value={editDesignation}
                      onChange={(e) => setEditDesignation(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">PF Number</label>
                    <input
                      type="text"
                      placeholder="e.g. MH/12345/678"
                      value={editPfNo}
                      onChange={(e) => setEditPfNo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">ESIC Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 3100123456"
                      value={editEsicNo}
                      onChange={(e) => setEditEsicNo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Bank Account</label>
                    <input
                      type="text"
                      placeholder="e.g. 63090017002"
                      value={editBankAccountNo}
                      onChange={(e) => setEditBankAccountNo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PUNB0630900"
                      value={editBankIfscCode}
                      onChange={(e) => setEditBankIfscCode(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Section */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] border-b border-gray-200 pb-1.5">
                  Attendance & Days
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Present Days (PD)</label>
                    <input
                      type="number"
                      value={editPd}
                      onChange={(e) => {
                        const newPd = Number(e.target.value) || 0;
                        setEditPd(newPd);
                        setEditPayableDays(newPd + editWo);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Weekly Off (WO)</label>
                    <input
                      type="number"
                      value={editWo}
                      onChange={(e) => {
                        const newWo = Number(e.target.value) || 0;
                        setEditWo(newWo);
                        setEditPayableDays(editPd + newWo);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Total Payable Days</label>
                    <input
                      type="number"
                      value={editPayableDays}
                      onChange={(e) => setEditPayableDays(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Days in Month</label>
                    <input
                      type="number"
                      value={editDaysInMonth}
                      onChange={(e) => setEditDaysInMonth(Number(e.target.value) || 30)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Earnings */}
                <div className="space-y-3 bg-teal-50/40 p-4 rounded-xl border border-teal-100">
                  <div className="flex items-center justify-between border-b border-teal-200 pb-1.5">
                    <h3 className="font-bold text-teal-900 uppercase tracking-wider text-[11px]">
                      Earnings (₹)
                    </h3>
                    <span className="font-mono font-bold text-teal-800 text-xs">
                      Total: ₹{modalTotalEarnings.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">Basic Pay</span>
                      <input
                        type="number"
                        value={editEarnedBasic}
                        onChange={(e) => setEditEarnedBasic(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">HRA</span>
                      <input
                        type="number"
                        value={editEarnedHra}
                        onChange={(e) => setEditEarnedHra(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">Washing Allowance</span>
                      <input
                        type="number"
                        value={editEarnedOther}
                        onChange={(e) => setEditEarnedOther(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">Conveyance</span>
                      <input
                        type="number"
                        value={editEarnedConveyance}
                        onChange={(e) => setEditEarnedConveyance(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">Incentive</span>
                      <input
                        type="number"
                        value={editEarnedIncentive}
                        onChange={(e) => setEditEarnedIncentive(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* Custom Earnings Rows */}
                    {editCustomEarnings.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Earning Description"
                          value={item.name}
                          onChange={(e) => {
                            const newArr = [...editCustomEarnings];
                            newArr[idx].name = e.target.value;
                            setEditCustomEarnings(newArr);
                          }}
                          className="w-1/2 bg-white border border-teal-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => {
                            const newArr = [...editCustomEarnings];
                            newArr[idx].amount = Number(e.target.value) || 0;
                            setEditCustomEarnings(newArr);
                          }}
                          className="w-5/12 bg-white border border-teal-300 rounded-lg px-2 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomEarnings(editCustomEarnings.filter((c) => c.id !== item.id));
                          }}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                          title="Remove custom earning"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditCustomEarnings([
                        ...editCustomEarnings,
                        { id: Date.now().toString(), name: 'Other Earning', amount: 0 },
                      ]);
                    }}
                    className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Earning</span>
                  </button>
                </div>

                {/* Deductions */}
                <div className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <h3 className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                      Deductions (₹)
                    </h3>
                    <span className="font-mono font-bold text-amber-900 text-xs">
                      Total: ₹{modalTotalDeductions.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">EPF</span>
                      <input
                        type="number"
                        value={editEpf}
                        onChange={(e) => setEditEpf(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">ESIC</span>
                      <input
                        type="number"
                        value={editEsic}
                        onChange={(e) => setEditEsic(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">PT (Professional Tax)</span>
                      <input
                        type="number"
                        value={editPt}
                        onChange={(e) => setEditPt(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 w-1/2 font-medium">Advance (This Month)</span>
                      <input
                        type="number"
                        value={editAdvances}
                        onChange={(e) => setEditAdvances(Number(e.target.value) || 0)}
                        className="w-1/2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* Custom Deductions Rows */}
                    {editCustomDeductions.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Deduction Description"
                          value={item.name}
                          onChange={(e) => {
                            const newArr = [...editCustomDeductions];
                            newArr[idx].name = e.target.value;
                            setEditCustomDeductions(newArr);
                          }}
                          className="w-1/2 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => {
                            const newArr = [...editCustomDeductions];
                            newArr[idx].amount = Number(e.target.value) || 0;
                            setEditCustomDeductions(newArr);
                          }}
                          className="w-5/12 bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomDeductions(editCustomDeductions.filter((c) => c.id !== item.id));
                          }}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                          title="Remove custom deduction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditCustomDeductions([
                        ...editCustomDeductions,
                        { id: Date.now().toString(), name: 'Other Deduction', amount: 0 },
                      ]);
                    }}
                    className="mt-2 text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Deduction</span>
                  </button>
                </div>
              </div>

              {/* Net Payable & Amount in Words Editable Card */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono">Net Payable Amount:</span>
                    {isCustomNetPayable && (
                      <span className="text-[10px] font-semibold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                        Manually Overridden
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-teal-400 text-base font-bold">₹</span>
                    <input
                      type="number"
                      value={editNetPayable}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setEditNetPayable(val);
                        setIsCustomNetPayable(true);
                      }}
                      className="w-full sm:w-40 bg-slate-800 border border-teal-500/50 focus:border-teal-400 rounded-lg px-3 py-1.5 font-mono text-base font-bold text-teal-300 outline-none ring-2 ring-teal-500/20"
                    />
                    {isCustomNetPayable && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNetPayable(modalAutoNetPayable);
                          setIsCustomNetPayable(false);
                        }}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 underline whitespace-nowrap cursor-pointer"
                        title="Reset to Total Earnings - Total Deductions"
                      >
                        Auto Calc
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-300 font-sans italic border-t border-slate-800 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                  <span className="font-semibold text-slate-400 uppercase text-[10px]">Amount Chargeable in Words:</span>
                  <span className="text-teal-200 font-medium">Rupees {numberToWordsINR(editNetPayable)} Only</span>
                </div>
              </div>

              {/* Audit Reason & Notes */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Reason for Edit / Audit Notes
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Manual override for June 2026 performance bonus & attendance correction"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50/50 rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={handleResetToPayrollData}
                className="px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Discard manual overrides and restore original payroll values"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                <span>Reset to Payroll Data</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveEditPayslipRecord(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditPayslipModal}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Payslip</span>
                </button>
              </div>
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
