import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Plus,
  Camera,
  Banknote,
  FileText,
  ChevronDown,
  X,
  Check,
  Trash2,
  Calculator,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import {
  AttendanceRecord,
  AttendanceStatus,
  EmployeeAttendanceData,
} from '../types/attendance';
import { AttendanceTemplate } from '@/features/invoices/components/AttendanceTemplate';
import { MinervaSheetTemplate } from './MinervaSheetTemplate';
import { mapDbToAttendanceTemplate, getWeeklyOffDayNum } from '../utils/attendanceMapper';
import { fetchWithRetry } from '@/lib/apiClient';
import { pdfService } from '@/services/pdfService';
import { AddStaffModal } from './AddStaffModal';

interface SiteItem {
  id: string;
  name: string;
  codeName?: string;
  attendanceGridName?: string;
  approvedManpower?: number;
  workOrderRef?: string;
  clientName?: string;
}

interface AttendanceTabProps {
  initialEmployees?: EmployeeAttendanceData[];
  initialRecords?: AttendanceRecord[];
  sites?: SiteItem[];
  onAddStaff?: () => void;
  onEditDeductions?: (emp: EmployeeAttendanceData) => void;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  initialEmployees = [],
  initialRecords = [],
  sites = [],
  onAddStaff,
  onEditDeductions,
}) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeAttendanceData[]>(initialEmployees);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [siteList, setSiteList] = useState<SiteItem[]>(sites);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Aug
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [searchTerm] = useState<string>('');

  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isGeneratingMinervaPdf, setIsGeneratingMinervaPdf] = useState<boolean>(false);
  const [printMode, setPrintMode] = useState<'standard' | 'minerva'>('standard');

  // Google Sheets Integration state
  const [isSyncingGoogleSheet, setIsSyncingGoogleSheet] = useState<boolean>(false);
  const [googleSheetInfo, setGoogleSheetInfo] = useState<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    lastSyncedAt?: string;
  } | null>(null);
  const [googleAuthModal, setGoogleAuthModal] = useState<{
    isOpen: boolean;
    authUrl?: string;
    message?: string;
  }>({ isOpen: false });

  // Modals & Controls
  const [showAutoInvoiceDropdown, setShowAutoInvoiceDropdown] = useState<boolean>(false);
  const [editingCell, setEditingCell] = useState<{
    empId: string;
    empName: string;
    date: string;
    currentRecord?: AttendanceRecord;
  } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Multi-select state
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(new Set());
  const [anchorCell, setAnchorCell] = useState<{ empIdx: number; day: number } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ empIdx: number; day: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  const attendanceByEmployee = useMemo(() => {
    const map = new Map<string, Map<string, AttendanceRecord>>();
    for (const r of attendanceRecords) {
      if (!map.has(r.employeeId)) {
        map.set(r.employeeId, new Map());
      }
      map.get(r.employeeId)!.set(r.date, r);
    }
    return map;
  }, [attendanceRecords]);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        if (e.status === 'Deleted' || e.status === 'Stopped') return false;
        const matchesSearch =
          (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.biometricCode || '').includes(searchTerm);
        const matchesSite = selectedSiteFilter === 'all' || e.siteId === selectedSiteFilter;
        return matchesSearch && matchesSite;
      })
      .sort((a, b) => {
        const shiftA = (a.shift || a.role || 'Unassigned').toUpperCase();
        const shiftB = (b.shift || b.role || 'Unassigned').toUpperCase();
        if (shiftA !== shiftB) return shiftA.localeCompare(shiftB);
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [employees, searchTerm, selectedSiteFilter]);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const attendanceStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalWeeklyOff = 0;
    let totalWorkedOnWo = 0;
    let totalWorkingScore = 0;

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const emp of filteredEmployees) {
      const empAttendance = attendanceByEmployee.get(emp.id);
      const empWeeklyOff = emp.weeklyOff?.trim();

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const dayDate = new Date(selectedYear, selectedMonth - 1, d);
        const dayName = DAY_NAMES[dayDate.getDay()];
        const offDays = (empWeeklyOff || '').toLowerCase().split(/[,/&]+/).map((s: string) => s.trim());
        const isWeeklyOff = Boolean(
          empWeeklyOff &&
          empWeeklyOff !== 'None' &&
          offDays.includes(dayName.toLowerCase())
        );

        const record = empAttendance?.get(dateStr);
        const status = record?.status;

        if (status === 'P') {
          if (isWeeklyOff) {
            totalWorkedOnWo += 1;
            totalWorkingScore += 2;
          } else {
            totalPresent += 1;
            totalWorkingScore += 1;
          }
        } else if (status === 'WOP') {
          totalWorkedOnWo += 1;
          totalWorkingScore += 2;
        } else if (status === 'W/O' || (isWeeklyOff && (!status || status === 'A'))) {
          totalWeeklyOff += 1;
          totalWorkingScore += 1;
        } else if (status === 'HD') {
          totalPresent += 0.5;
          totalWorkingScore += 0.5;
        } else if (status === 'A') {
          totalAbsent += 1;
        }
      }
    }

    return {
      totalPresent,
      totalAbsent,
      totalWeeklyOff,
      totalWorkedOnWo,
      totalWorkingScore,
    };
  }, [filteredEmployees, attendanceByEmployee, selectedMonth, selectedYear, daysInMonth]);

  const handleSaveStatus = (status: AttendanceStatus | null) => {
    if (!editingCell) return;
    const { empId, date } = editingCell;
    const emp = employees.find((e) => e.id === empId);

    const [rYear, rMonth, rDay] = date.split('-').map(Number);
    const dateObj = new Date(rYear, rMonth - 1, rDay);
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = DAY_NAMES[dateObj.getDay()];
    const offDays = (emp?.weeklyOff || '').toLowerCase().split(/[,/&]+/).map((s: string) => s.trim());
    const isWeeklyOffDay = Boolean(emp?.weeklyOff && emp.weeklyOff !== 'None' && offDays.includes(dayName.toLowerCase()));

    let targetStatus = status;
    let overtimeVal: string | undefined = undefined;

    if (status === 'P' && isWeeklyOffDay) {
      targetStatus = 'WOP';
      overtimeVal = 'P';
    }

    const existingRec = editingCell.currentRecord;

    setAttendanceRecords((prev) => {
      const filtered = prev.filter((r) => !(r.employeeId === empId && r.date === date));
      if (targetStatus !== null) {
        filtered.push({
          id: existingRec?.id || Date.now().toString(),
          employeeId: empId,
          date,
          status: targetStatus,
          overtimeStatus: overtimeVal,
          checkInTime: existingRec?.checkInTime || 'Manual',
          timestamp: new Date().toISOString(),
          remarks: targetStatus === 'WOP' ? 'Present on Weekly Off' : 'Added by Admin',
          inTime: existingRec?.inTime || null,
          outTime: existingRec?.outTime || null,
          durationHours: existingRec?.durationHours || null,
          duration: existingRec?.duration || null,
        });
      }
      return filtered;
    });

    // Save to PostgreSQL attendance_records table via backend API
    try {
      const recordPayload = {
        staff_id: empId,
        site_id: selectedSiteFilter === 'all' ? (emp?.siteId || null) : selectedSiteFilter,
        record_date: date,
        shift_type: overtimeVal ? 'overtime' : 'regular',
        status: targetStatus,
        in_time: existingRec?.inTime || null,
        out_time: existingRec?.outTime || null,
        duration_hours: existingRec?.durationHours || 0,
        duration: existingRec?.duration || null,
      };

      fetchWithRetry('/api/attendance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordPayload),
      }).catch((e) => console.warn('⚠️ Error saving attendance_record:', e));
    } catch (e) {
      console.warn('⚠️ Could not save attendance_record:', e);
    }

    setEditingCell(null);
  };

  const computeRangeKeys = (
    startEmpIdx: number,
    endEmpIdx: number,
    startDay: number,
    endDay: number
  ) => {
    const minEmp = Math.max(0, Math.min(startEmpIdx, endEmpIdx));
    const maxEmp = Math.min(filteredEmployees.length - 1, Math.max(startEmpIdx, endEmpIdx));
    const minD = Math.max(1, Math.min(startDay, endDay));
    const maxD = Math.min(daysInMonth, Math.max(startDay, endDay));

    const keys = new Set<string>();
    for (let eIdx = minEmp; eIdx <= maxEmp; eIdx++) {
      const emp = filteredEmployees[eIdx];
      if (!emp) continue;
      for (let d = minD; d <= maxD; d++) {
        const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        keys.add(`${emp.id}:${dateStr}`);
      }
    }
    return keys;
  };

  const handleCellMouseDown = (
    empIdx: number,
    day: number,
    e: React.MouseEvent
  ) => {
    if (e.button !== 0) return;

    if (e.shiftKey && anchorCell) {
      const keys = computeRangeKeys(anchorCell.empIdx, empIdx, anchorCell.day, day);
      setSelectedCellKeys(keys);
      setFocusedCell({ empIdx, day });
    } else if (e.ctrlKey || e.metaKey) {
      const emp = filteredEmployees[empIdx];
      const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const key = `${emp.id}:${dateStr}`;
      setSelectedCellKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setAnchorCell({ empIdx, day });
      setFocusedCell({ empIdx, day });
    } else {
      const keys = computeRangeKeys(empIdx, empIdx, day, day);
      setSelectedCellKeys(keys);
      setAnchorCell({ empIdx, day });
      setFocusedCell({ empIdx, day });
      setIsMouseDown(true);
    }
  };

  const handleCellMouseEnter = (empIdx: number, day: number) => {
    if (isMouseDown && anchorCell) {
      const keys = computeRangeKeys(anchorCell.empIdx, empIdx, anchorCell.day, day);
      setSelectedCellKeys(keys);
      setFocusedCell({ empIdx, day });
    }
  };

  const handleSelectRow = (empIdx: number) => {
    const keys = computeRangeKeys(empIdx, empIdx, 1, daysInMonth);
    setSelectedCellKeys(keys);
    setAnchorCell({ empIdx, day: 1 });
    setFocusedCell({ empIdx, day: daysInMonth });
  };

  useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.tagName === 'TEXTAREA' ||
          editingCell)
      ) {
        return;
      }

      if (filteredEmployees.length === 0) return;

      const isArrowKey = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ].includes(e.key);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const keys = computeRangeKeys(
          0,
          filteredEmployees.length - 1,
          1,
          daysInMonth
        );
        setSelectedCellKeys(keys);
        setAnchorCell({ empIdx: 0, day: 1 });
        setFocusedCell({ empIdx: filteredEmployees.length - 1, day: daysInMonth });
        return;
      }

      if (!isArrowKey) return;

      e.preventDefault();

      const currentFocus = focusedCell || { empIdx: 0, day: daysInMonth };
      let { empIdx, day } = currentFocus;

      if (e.key === 'ArrowLeft') {
        day = Math.max(1, day - 1);
      } else if (e.key === 'ArrowRight') {
        day = Math.min(daysInMonth, day + 1);
      } else if (e.key === 'ArrowUp') {
        empIdx = Math.max(0, empIdx - 1);
      } else if (e.key === 'ArrowDown') {
        empIdx = Math.min(filteredEmployees.length - 1, empIdx + 1);
      } else if (e.key === 'Home') {
        day = 1;
      } else if (e.key === 'End') {
        day = daysInMonth;
      }

      if (e.shiftKey) {
        const currentAnchor = anchorCell || currentFocus;
        if (!anchorCell) setAnchorCell(currentAnchor);
        const keys = computeRangeKeys(currentAnchor.empIdx, empIdx, currentAnchor.day, day);
        setSelectedCellKeys(keys);
        setFocusedCell({ empIdx, day });
      } else {
        const keys = computeRangeKeys(empIdx, empIdx, day, day);
        setSelectedCellKeys(keys);
        setAnchorCell({ empIdx, day });
        setFocusedCell({ empIdx, day });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedCell,
    anchorCell,
    filteredEmployees,
    daysInMonth,
    selectedYear,
    selectedMonth,
    editingCell,
  ]);

  const handleBulkSaveStatus = (status: AttendanceStatus | null) => {
    if (selectedCellKeys.size === 0) return;

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const keysArray = Array.from(selectedCellKeys);

    const newRecordsToUpsert: any[] = [];
    let updatedAttendanceRecords = [...attendanceRecords];

    for (const key of keysArray) {
      const [empId, dateStr] = key.split(':');
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;

      const [rYear, rMonth, rDay] = dateStr.split('-').map(Number);
      const dateObj = new Date(rYear, rMonth - 1, rDay);
      const dayName = DAY_NAMES[dateObj.getDay()];
      const offDays = (emp.weeklyOff || '').toLowerCase().split(/[,/&]+/).map((s: string) => s.trim());
      const isWeeklyOffDay = Boolean(emp.weeklyOff && emp.weeklyOff !== 'None' && offDays.includes(dayName.toLowerCase()));

      let targetStatus = status;
      let overtimeVal: string | undefined = undefined;

      if (status === 'P' && isWeeklyOffDay) {
        targetStatus = 'WOP';
        overtimeVal = 'P';
      }

      const existingIdx = updatedAttendanceRecords.findIndex(
        (r) => r.employeeId === empId && r.date === dateStr
      );
      const existingRec = existingIdx >= 0 ? updatedAttendanceRecords[existingIdx] : undefined;

      if (existingIdx >= 0) {
        updatedAttendanceRecords.splice(existingIdx, 1);
      }

      if (targetStatus !== null) {
        const updatedRec: AttendanceRecord = {
          id: existingRec?.id || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          employeeId: empId,
          date: dateStr,
          status: targetStatus,
          overtimeStatus: overtimeVal,
          checkInTime: existingRec?.checkInTime || 'Manual',
          timestamp: new Date().toISOString(),
          remarks: targetStatus === 'WOP' ? 'Present on Weekly Off' : 'Bulk Updated',
          inTime: existingRec?.inTime || null,
          outTime: existingRec?.outTime || null,
          durationHours: existingRec?.durationHours || null,
          duration: existingRec?.duration || null,
        };
        updatedAttendanceRecords.push(updatedRec);

        newRecordsToUpsert.push({
          staff_id: empId,
          site_id: selectedSiteFilter === 'all' ? (emp.siteId || null) : selectedSiteFilter,
          record_date: dateStr,
          shift_type: overtimeVal ? 'overtime' : 'regular',
          status: targetStatus,
          in_time: existingRec?.inTime || null,
          out_time: existingRec?.outTime || null,
          duration_hours: existingRec?.durationHours || 0,
          duration: existingRec?.duration || null,
        });
      }
    }

    setAttendanceRecords(updatedAttendanceRecords);

    try {
      if (newRecordsToUpsert.length > 0) {
        fetchWithRetry('/api/attendance/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecordsToUpsert),
        }).catch((err) => console.warn('⚠️ Error bulk upserting attendance:', err));
      }
    } catch (err) {
      console.warn('⚠️ Could not save bulk attendance:', err);
    }
  };

  // True relational fetch sequence: sites -> staff -> attendance_records
  useEffect(() => {
    let isMounted = true;

    async function loadRelationalData() {
      try {
        // 1. Fetch Sites from backend API
        const sitesRes = await fetchWithRetry('/api/sites');
        if (sitesRes.ok) {
          const jsonSites = await sitesRes.json();
          const dbSites = jsonSites.data || jsonSites || [];
          if (Array.isArray(dbSites) && dbSites.length > 0) {
            const mappedSites = dbSites.map((s: any) => ({
              id: s.id,
              name: s.site_name || s.siteName || s.name || '',
              codeName: s.code_name || s.codeName || '',
              attendanceGridName: s.site_name || s.siteName || s.name || '',
              approvedManpower: Number(s.approved_manpower || s.approvedManpower || s.contracted_manpower || 5),
              workOrderRef: s.work_order_ref || '',
              clientName: s.client_name || '',
            }));
            if (isMounted) {
              setSiteList(mappedSites);
              if (selectedSiteFilter === 'all' && mappedSites.length > 0) {
                setSelectedSiteFilter(mappedSites[0].id);
              }
            }
          }
        }

        // 2. Query 1: Fetch staff for selected site
        const staffRes = await fetchWithRetry('/api/staff');
        if (staffRes.ok) {
          const jsonStaff = await staffRes.json();
          let dbStaff = jsonStaff.data || jsonStaff || [];
          if (selectedSiteFilter && selectedSiteFilter !== 'all') {
            dbStaff = dbStaff.filter((st: any) => (st.site_id || st.siteId) === selectedSiteFilter);
          }

          const monthStart = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);

          const activeStaffList = dbStaff.filter((st: any) => {
            if (st.status === 'Inactive') {
              const leftDStr = st.left_date || st.leftDate;
              if (leftDStr) {
                const leftDateObj = new Date(leftDStr);
                if (leftDateObj < monthStart) {
                  return false;
                }
              } else {
                return false;
              }
            }
            return true;
          });

          const mappedStaff: EmployeeAttendanceData[] = activeStaffList.map((st: any) => ({
            id: st.id,
            name: st.employee_name || st.name || st.employeeName || '',
            biometricCode: st.biometric_code || st.biometricCode || '',
            phone: st.phone || st.contact_no || '',
            role: st.designation || st.role || 'Janitor',
            shift: st.designation || st.shift || st.role || 'KEYMAN',
            siteId: st.site_id || st.siteId || '',
            siteName: st.site_name || st.siteName || '',
            weeklyOff: (st.weekly_off || st.weeklyOff || 'SUN').toUpperCase(),
            status: st.status || 'Active',
          }));

          if (isMounted) {
            setEmployees(mappedStaff);
          }
        }

        // 3. Query 2: Fetch attendance_records for selected month & year
        const startDateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const endDateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const qParams = new URLSearchParams({
          start_date: startDateStr,
          end_date: endDateStr,
        });
        if (selectedSiteFilter && selectedSiteFilter !== 'all') {
          qParams.append('site_id', selectedSiteFilter);
        }

        const recRes = await fetchWithRetry(`/api/attendance/records?${qParams.toString()}`);
        if (recRes.ok) {
          const jsonRec = await recRes.json();
          const dbRecords = jsonRec.data || jsonRec || [];

          const mappedRecords: AttendanceRecord[] = dbRecords.map((r: any) => ({
            id: r.id,
            employeeId: r.staff_id || r.employee_id || r.employeeId || r.staffId || '',
            date: r.record_date || r.date,
            status: r.status,
            overtimeStatus: r.shift_type === 'overtime' ? 'P' : (r.overtime_status || ''),
            remarks: r.remarks || '',
            inTime: r.in_time || null,
            outTime: r.out_time || null,
            durationHours: r.duration_hours !== null && r.duration_hours !== undefined ? Number(r.duration_hours) : null,
            duration: r.duration || null,
          }));

          if (isMounted) {
            setAttendanceRecords(mappedRecords);
          }
        }
      } catch (err) {
        console.warn('⚠️ Relational data fetch warning:', err);
      }
    }

    loadRelationalData();

    return () => {
      isMounted = false;
    };
  }, [selectedSiteFilter, selectedMonth, selectedYear, refreshKey]);

  // Derived live printable template data via mapper
  const templateData = useMemo(() => {
    const selectedSiteObj = siteList.find((s) => s.id === selectedSiteFilter);
    const siteName = selectedSiteObj?.name || (selectedSiteFilter === 'all' ? 'All Sites' : selectedSiteFilter);
    const approvedManpower = selectedSiteObj?.approvedManpower || 5;

    return mapDbToAttendanceTemplate(
      filteredEmployees,
      attendanceRecords,
      siteName,
      selectedMonth,
      selectedYear,
      approvedManpower
    );
  }, [filteredEmployees, attendanceRecords, siteList, selectedSiteFilter, selectedMonth, selectedYear]);

  const handlePrintMinervaSheet = () => {
    setPrintMode('minerva');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Check URL for Google OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      toast.success('Google Drive authorized successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_auth_error')) {
      toast.error(`Google authorization failed: ${params.get('google_auth_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch persistent Google Sheet status for currently selected site and month
  useEffect(() => {
    if (selectedSiteFilter === 'all') {
      setGoogleSheetInfo(null);
      return;
    }
    let isCancelled = false;
    const checkSheet = async () => {
      try {
        const res = await fetchWithRetry(
          `/api/attendance/google-sheet?siteId=${selectedSiteFilter}&month=${selectedMonth}&year=${selectedYear}`,
          { skipErrorToast: true }
        );
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data) {
            setGoogleSheetInfo(json.data);
          }
        }
      } catch {
        if (!isCancelled) setGoogleSheetInfo(null);
      }
    };
    checkSheet();
    return () => {
      isCancelled = true;
    };
  }, [selectedSiteFilter, selectedMonth, selectedYear]);

  // Handle Google Sheet Synchronization
  const handleSyncGoogleSheet = async () => {
    if (selectedSiteFilter === 'all') {
      toast.info('Please select a specific site location to generate or sync its Google Sheet.');
      return;
    }

    setIsSyncingGoogleSheet(true);
    try {
      const res = await fetchWithRetry('/api/attendance/google-sheet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSiteFilter,
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setGoogleSheetInfo(json.data);
        toast.success(
          json.data.isNew
            ? 'Created and synchronized new Google Sheet!'
            : 'Synchronized attendance to Google Sheet!'
        );
        if (json.data.spreadsheetUrl) {
          window.open(json.data.spreadsheetUrl, '_blank', 'noopener,noreferrer');
        }
      } else if (json.requiresAuth && json.authUrl) {
        setGoogleAuthModal({
          isOpen: true,
          authUrl: json.authUrl,
          message: json.error || 'Google Drive authorization is required to create or sync attendance spreadsheets.',
        });
      } else if (json.consoleUrl) {
        toast.error('Google Sheets API is disabled in your Google Cloud Project. Please enable it in GCP console.');
      } else {
        toast.error(json.error || 'Failed to sync with Google Sheets');
      }
    } catch (err: any) {
      console.error('Google Sheet sync error:', err);
      toast.error(err.message || 'Failed to sync with Google Sheets');
    } finally {
      setIsSyncingGoogleSheet(false);
    }
  };

  const handlePrintStandardSheet = () => {
    setPrintMode('standard');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6 font-sans text-gray-800 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <AddStaffModal
          isOpen={showAddStaffModal}
          onClose={() => setShowAddStaffModal(false)}
          onSuccess={() => {
            setRefreshKey((prev) => prev + 1);
            setShowAddStaffModal(false);
          }}
          sites={siteList}
        />
      )}

      {/* Printable Template (hidden on screen, visible during window.print()) */}
      <div className="attendance-print-area">
        {printMode === 'minerva' ? (
          <MinervaSheetTemplate
            month={selectedMonth}
            year={selectedYear}
            siteName={siteList.find((s) => s.id === selectedSiteFilter)?.attendanceGridName || siteList.find((s) => s.id === selectedSiteFilter)?.name || 'Minerva'}
            clientName={siteList.find((s) => s.id === selectedSiteFilter)?.clientName}
            workOrderRef={siteList.find((s) => s.id === selectedSiteFilter)?.workOrderRef}
            employees={filteredEmployees}
            attendanceByEmployee={attendanceByEmployee}
          />
        ) : (
          <AttendanceTemplate data={templateData} />
        )}
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Left Title & Live Badges */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Attendance Grid</h2>
            <span className="bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full text-xs border border-emerald-200 shadow-2xs flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE DATA
            </span>
          </div>
          <span className="bg-slate-100/80 text-slate-600 font-medium px-3 py-1 rounded-lg text-xs border border-slate-200/80 shadow-2xs flex items-center gap-1.5 w-fit">
            <span className="font-bold text-indigo-600">⌨️ Keyboard Selection:</span> Hold <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">← Arrow</kbd> to select range | Click employee to select row
          </span>
        </div>

        {/* Right Actions Grid */}
        <div className="flex flex-col items-end gap-3">
          {/* Row 1 Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (onAddStaff) onAddStaff();
                else setShowAddStaffModal(true);
              }}
              className="bg-[#20B2AA] hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all"
            >
              <Plus size={16} />
              <span>Add Staff</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/attendance-calculator')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all cursor-pointer"
              title="Upload Biometric Excel and Calculate Attendance"
            >
              <Calculator size={15} />
              <span>Attendance Calculator</span>
            </button>

            {/* Date selector */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 shadow-2xs">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent outline-none cursor-pointer font-bold"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })}
                  </option>
                ))}
              </select>
              <span className="text-gray-300 mx-2">|</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent outline-none cursor-pointer font-bold"
              >
                {[2024, 2025, 2026, 2027].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Site selector dropdown */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 shadow-2xs">
              <Filter size={14} className="text-gray-400 mr-2" />
              <select
                value={selectedSiteFilter}
                onChange={(e) => setSelectedSiteFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer font-semibold max-w-[180px] truncate"
              >
                <option value="all">All Sites</option>
                {siteList.map((s) => {
                  const baseName = s.attendanceGridName || s.name;
                  const label = s.codeName ? `${baseName} (${s.codeName})` : baseName;
                  return (
                    <option key={s.id} value={s.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Refresh Data button */}
            <button
              type="button"
              className="bg-[#FF5722] hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all"
            >
              <RotateCcw size={15} />
              <span>Refresh Data</span>
            </button>
          </div>

          {/* Row 2 Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAutoInvoiceDropdown(!showAutoInvoiceDropdown)}
                className="bg-[#9333EA] hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all"
              >
                <FileText size={15} />
                <span>Auto-Invoice</span>
                <ChevronDown size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrintStandardSheet}
              className="bg-[#10B981] hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all cursor-pointer"
              title="Print / Preview Standard Attendance Sheet"
            >
              <FileSpreadsheet size={15} />
              <span>PDF Download</span>
            </button>

            <button
              type="button"
              onClick={handlePrintMinervaSheet}
              className="bg-[#0284c7] hover:bg-sky-600 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all cursor-pointer"
              title="Print / Preview Minerva Format Attendance Sheet"
            >
              <FileSpreadsheet size={15} />
              <span>Minerva Sheet</span>
            </button>

            {/* Google Sheet Action */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isSyncingGoogleSheet}
                onClick={handleSyncGoogleSheet}
                className="bg-[#0F9D58] hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all cursor-pointer"
                title={
                  selectedSiteFilter === 'all'
                    ? 'Select a specific site to create or open Google Sheet'
                    : googleSheetInfo
                    ? 'Sync latest attendance data to persistent Google Sheet'
                    : 'Create and sync persistent Google Sheet for this site and month'
                }
              >
                {isSyncingGoogleSheet ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                <span>
                  {isSyncingGoogleSheet
                    ? 'Syncing Sheet...'
                    : googleSheetInfo
                    ? 'Sync Google Sheet'
                    : 'Google Sheet'}
                </span>
              </button>

              {googleSheetInfo?.spreadsheetUrl && (
                <a
                  href={googleSheetInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-all shadow-2xs"
                  title="Open existing Google Sheet in new tab"
                >
                  <ExternalLink size={13} />
                  <span>Open Sheet</span>
                </a>
              )}
            </div>

            {/* Stats pills matching Screenshot 2 with Weekly Off awareness */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <CheckCircle size={14} />
                <span>{attendanceStats.totalPresent} PRESENT</span>
              </div>

              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <XCircle size={14} />
                <span>{attendanceStats.totalAbsent} ABSENT</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <CalendarDays size={14} />
                <span>{attendanceStats.totalWeeklyOff} WEEKLY OFF</span>
              </div>

              {attendanceStats.totalWorkedOnWo > 0 && (
                <div className="bg-purple-50 border border-purple-300 text-purple-800 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-black shadow-2xs ring-1 ring-purple-300">
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                  <span>{attendanceStats.totalWorkedOnWo} WORKED ON WO</span>
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <CalendarDays size={14} />
                <span>{attendanceStats.totalWorkingScore} SCORE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Grid Table with adaptive height */}
      <div
        ref={tableContainerRef}
        className="bg-white rounded-xl border border-gray-200 attendance-grid-scroll max-h-[580px] shadow-2xs"
      >
        <table className="w-full text-center text-xs border-collapse min-w-[1900px]">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="p-3 sticky left-0 top-0 bg-white z-30 border-r border-gray-200 text-left min-w-[220px] font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                EMPLOYEE
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const dateObj = new Date(selectedYear, selectedMonth - 1, d);
                const weekday = dateObj
                  .toLocaleDateString('en-US', { weekday: 'short' })
                  .slice(0, 2);

                return (
                  <th
                    key={d}
                    className="p-1.5 sticky top-0 z-20 border-r border-gray-100 w-[54px] min-w-[54px] max-w-[54px] font-medium bg-white text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-xs text-gray-700">{d}</span>
                      <span className="text-[9px] uppercase font-semibold text-gray-400">
                        {weekday}
                      </span>
                    </div>
                  </th>
                );
              })}
              {/* Per-Employee Month Summary Headers */}
              <th
                className="p-2 sticky top-0 z-20 border-r border-gray-200 w-[48px] min-w-[48px] font-extrabold bg-emerald-50 text-emerald-800 text-[10px] text-center uppercase tracking-wider"
                title="Total Present Days"
              >
                PRES
              </th>
              <th
                className="p-2 sticky top-0 z-20 border-r border-gray-200 w-[48px] min-w-[48px] font-extrabold bg-blue-50 text-blue-800 text-[10px] text-center uppercase tracking-wider"
                title="Total Weekly Off Days"
              >
                W/O
              </th>
              <th
                className="p-2 sticky top-0 z-20 border-r border-gray-200 w-[48px] min-w-[48px] font-extrabold bg-purple-50 text-purple-800 text-[10px] text-center uppercase tracking-wider"
                title="Worked on Weekly Off (Extra)"
              >
                WOP
              </th>
              <th
                className="p-2 sticky top-0 z-20 border-r border-gray-200 w-[48px] min-w-[48px] font-extrabold bg-red-50 text-red-800 text-[10px] text-center uppercase tracking-wider"
                title="Total Absent Days"
              >
                ABS
              </th>
              <th
                className="p-2 sticky top-0 z-20 border-r border-gray-200 w-[56px] min-w-[56px] font-extrabold bg-indigo-100 text-indigo-950 text-[10px] text-center uppercase tracking-wider"
                title="Total Working / Payable Days (Present + W/O + WOP)"
              >
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp, index, arr) => {
              const empMap =
                attendanceByEmployee.get(emp.id) || new Map<string, AttendanceRecord>();
              const prevEmp = index > 0 ? arr[index - 1] : null;
              const currentGroup = emp.shift || emp.role || 'KEYMAN';
              const prevGroup = prevEmp ? prevEmp.shift || prevEmp.role || 'KEYMAN' : null;
              const showHeader = !prevEmp || currentGroup !== prevGroup;

              // Per-Employee Monthly Attendance Accumulator
              let empPresent = 0;
              let empWeeklyOff = 0;
              let empWorkedOnWo = 0;
              let empAbsent = 0;

              const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayDate = new Date(selectedYear, selectedMonth - 1, d);
                const dayName = DAY_NAMES[dayDate.getDay()];
                const offDays = (emp.weeklyOff || '').toLowerCase().split(/[,/&]+/).map(s => s.trim());
                const isWeeklyOff = Boolean(emp.weeklyOff && emp.weeklyOff !== 'None' && offDays.includes(dayName.toLowerCase()));

                const rec = empMap.get(dateStr);
                const st = rec?.status;

                if (st === 'P') {
                  if (isWeeklyOff) {
                    empWorkedOnWo += 1;
                  } else {
                    empPresent += 1;
                  }
                } else if (st === 'WOP') {
                  empWorkedOnWo += 1;
                } else if (st === 'W/O' || (isWeeklyOff && (!st || st === 'A'))) {
                  empWeeklyOff += 1;
                } else if (st === 'HD') {
                  empPresent += 0.5;
                } else if (st === 'A') {
                  empAbsent += 1;
                }
              }
              const empTotalDays = empPresent + empWeeklyOff + empWorkedOnWo;

              return (
                <React.Fragment key={emp.id}>
                  {showHeader && (
                    <tr className="bg-slate-50/80 border-b border-gray-200">
                      <td className="p-3 sticky left-0 bg-slate-50 z-20 border-r border-gray-200 text-left shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#20B2AA] rounded-full" />
                          <span className="text-xs font-black text-slate-800 tracking-wider uppercase">
                            {currentGroup}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {
                              filteredEmployees.filter(
                                (e) => (e.shift || e.role || 'KEYMAN') === currentGroup
                              ).length
                            }{' '}
                            ACTIVE STAFF
                          </span>
                        </div>
                      </td>
                      <td colSpan={daysInMonth + 5} className="bg-slate-50/60" />
                    </tr>
                  )}

                  {/* Row 1: Main / Regular Shift */}
                  <tr className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors h-8">
                    {/* Employee Profile Cell (Spans 2 rows with thick bottom & right borders) */}
                    <td
                      rowSpan={2}
                      className="p-3 sticky left-0 bg-white z-20 border-r-2 border-b-2 border-slate-400 text-left font-medium text-gray-900 shadow-xs align-middle group cursor-pointer"
                      onClick={() => handleSelectRow(index)}
                      title="Click to select entire row for this employee"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-[210px]">
                        <div className="flex items-center gap-3">
                          {/* Circle Avatar with Initials */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                            {(emp.name || 'NS').slice(0, 2).toUpperCase()}
                          </div>

                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 text-xs">{emp.name}</span>
                              {emp.weeklyOff && (
                                <span className="text-[9px] font-extrabold text-red-600 bg-red-100/90 border border-red-200 px-1.5 py-0.2 rounded uppercase">
                                  {emp.weeklyOff}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono mt-0.5">
                              <span>{emp.biometricCode}</span>
                              {emp.phone && (
                                <span className="text-blue-600 font-sans font-bold">
                                  {emp.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRow(index);
                            }}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded opacity-80 group-hover:opacity-100 hover:bg-blue-100"
                            title="Select entire row"
                          >
                            Row
                          </button>
                          {onEditDeductions && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditDeductions(emp);
                              }}
                              className="p-1 text-gray-400 hover:text-teal-600 rounded transition-colors"
                            >
                              <Banknote size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Day Cells (Regular Shift) */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dateStr = `${selectedYear}-${selectedMonth
                        .toString()
                        .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                      const record = empMap.get(dateStr);

                      const dayDate = new Date(selectedYear, selectedMonth - 1, d);
                      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const dayName = DAY_NAMES[dayDate.getDay()];
                      const offDays = (emp.weeklyOff || '').toLowerCase().split(/[,/&]+/).map((s: string) => s.trim());
                      const isWeeklyOff = Boolean(
                        emp.weeklyOff &&
                        emp.weeklyOff !== 'None' &&
                        offDays.includes(dayName.toLowerCase())
                      );

                      const rawStatus = record?.status;
                      let displayStatus = rawStatus;

                      if (isWeeklyOff) {
                        if (!rawStatus || rawStatus === 'A') {
                          displayStatus = 'W/O';
                        } else if (rawStatus === 'P' || rawStatus === 'WOP') {
                          displayStatus = 'WOP';
                        }
                      }

                      let statusBadge = <span className="text-slate-300 font-bold text-xs">-</span>;
                      let cellBg = 'bg-white hover:bg-slate-100/70';

                      if (displayStatus === 'WOP') {
                        cellBg = 'bg-purple-100/80 hover:bg-purple-200/80';
                        statusBadge = (
                          <div className="relative inline-flex items-center justify-center">
                            <span className="font-black text-purple-900 text-xs">P</span>
                            <span
                              className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full ring-1 ring-white"
                              title="Worked on Weekly Off"
                            />
                          </div>
                        );
                      } else if (displayStatus === 'W/O') {
                        cellBg = 'bg-blue-50/80 hover:bg-blue-100/80';
                        statusBadge = (
                          <span className="font-extrabold text-blue-700 text-[11px]">W/O</span>
                        );
                      } else if (displayStatus === 'P') {
                        cellBg = 'bg-emerald-100/70 hover:bg-emerald-200/70';
                        statusBadge = (
                          <span className="font-extrabold text-emerald-800 text-xs">P</span>
                        );
                      } else if (displayStatus === 'A') {
                        cellBg = 'bg-red-100/70 hover:bg-red-200/70';
                        statusBadge = (
                          <span className="font-extrabold text-red-700 text-xs">A</span>
                        );
                      } else if (displayStatus === 'HD') {
                        cellBg = 'bg-amber-100/80 hover:bg-amber-200/80';
                        statusBadge = (
                          <span className="font-extrabold text-amber-800 text-[11px]">HD</span>
                        );
                      } else if (displayStatus) {
                        statusBadge = (
                          <span className="font-bold text-gray-700 text-xs">
                            {displayStatus}
                          </span>
                        );
                      }

                      const durationStr =
                        record?.duration ||
                        (record?.durationHours && record.durationHours > 0
                          ? `${record.durationHours}h`
                          : null);

                      const hasPunchInfo = Boolean(
                        record?.inTime || record?.outTime || durationStr
                      );
                      const punchTooltip = hasPunchInfo
                        ? `In: ${record?.inTime || '--'} | Out: ${record?.outTime || '--'} | Duration: ${durationStr || '--'}`
                        : undefined;

                      const cellKey = `${emp.id}:${dateStr}`;
                      const isMultiSelected = selectedCellKeys.size > 1 && selectedCellKeys.has(cellKey);

                      let selectionStyle = '';
                      if (isMultiSelected) {
                        selectionStyle = '!bg-indigo-100/90 !ring-2 !ring-indigo-600 !ring-inset z-20 font-black text-indigo-950 shadow-2xs';
                      }

                      return (
                        <td
                          key={`reg-${d}`}
                          title={punchTooltip}
                          onMouseDown={(e) => handleCellMouseDown(index, d, e)}
                          onMouseEnter={() => handleCellMouseEnter(index, d)}
                          onClick={() => {
                            if (!isMouseDown) {
                              setEditingCell({
                                empId: emp.id,
                                empName: emp.name,
                                date: dateStr,
                                currentRecord: record,
                              });
                            }
                          }}
                          className={`border-r border-b border-slate-300 p-1 text-center align-middle cursor-pointer transition-colors w-[54px] min-w-[54px] max-w-[54px] h-9 select-none ${cellBg} ${selectionStyle}`}
                        >
                          {statusBadge}
                        </td>
                      );
                    })}

                    {/* Per-Employee Month Summary Totals (Spans 2 rows) */}
                    <td
                      rowSpan={2}
                      className="border-r border-b-2 border-slate-400 p-1 text-center align-middle bg-emerald-50/80 font-black text-emerald-800 text-xs w-[48px] min-w-[48px]"
                      title={`${emp.name}: ${empPresent} Present Days`}
                    >
                      {empPresent}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-r border-b-2 border-slate-400 p-1 text-center align-middle bg-blue-50/80 font-black text-blue-800 text-xs w-[48px] min-w-[48px]"
                      title={`${emp.name}: ${empWeeklyOff} Weekly Off Days`}
                    >
                      {empWeeklyOff}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-r border-b-2 border-slate-400 p-1 text-center align-middle bg-purple-50/80 font-black text-purple-800 text-xs w-[48px] min-w-[48px]"
                      title={`${emp.name}: ${empWorkedOnWo} Worked on Weekly Off`}
                    >
                      {empWorkedOnWo > 0 ? empWorkedOnWo : '-'}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-r border-b-2 border-slate-400 p-1 text-center align-middle bg-red-50/80 font-black text-red-700 text-xs w-[48px] min-w-[48px]"
                      title={`${emp.name}: ${empAbsent} Absent Days`}
                    >
                      {empAbsent}
                    </td>
                    <td
                      rowSpan={2}
                      className="border-r border-b-2 border-slate-400 p-1 text-center align-middle bg-indigo-100/90 font-black text-indigo-950 text-xs w-[56px] min-w-[56px]"
                      title={`${emp.name}: ${empTotalDays} Total Days (Present + W/O + WOP)`}
                    >
                      {empTotalDays}
                    </td>
                  </tr>

                  {/* Row 2: In-Time, Out-Time & Duration (Amber-tinted with thick bottom border) */}
                  <tr className="border-b-2 border-slate-400 hover:bg-amber-100/40 transition-colors bg-amber-50/40 h-[52px]">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dateStr = `${selectedYear}-${selectedMonth
                        .toString()
                        .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                      const record = empMap.get(dateStr);

                      const isOt = record?.status === 'WOP' || record?.overtimeStatus === 'P';
                      const durationDisplay =
                        record?.duration ||
                        (record?.durationHours && record.durationHours > 0
                          ? `${record.durationHours}h`
                          : null);
                      const hasSubPunchInfo = Boolean(
                        record?.inTime || record?.outTime || durationDisplay
                      );
                      const subTooltip = hasSubPunchInfo
                        ? `In: ${record?.inTime || '--'} | Out: ${record?.outTime || '--'} | Duration: ${durationDisplay || '--'}`
                        : undefined;

                      const cellKey = `${emp.id}:${dateStr}`;
                      const isMultiSelected = selectedCellKeys.size > 1 && selectedCellKeys.has(cellKey);

                      let selectionStyle = '';
                      if (isMultiSelected) {
                        selectionStyle = '!bg-indigo-100/90 !ring-2 !ring-indigo-600 !ring-inset z-20 font-black text-indigo-950 shadow-2xs';
                      }

                      return (
                        <td
                          key={`ot-${d}`}
                          title={subTooltip}
                          onMouseDown={(e) => handleCellMouseDown(index, d, e)}
                          onMouseEnter={() => handleCellMouseEnter(index, d)}
                          onClick={() => {
                            if (!isMouseDown) {
                              setEditingCell({
                                empId: emp.id,
                                empName: emp.name,
                                date: dateStr,
                                currentRecord: record,
                              });
                            }
                          }}
                          className={`border-r border-b-2 border-slate-400 p-0.5 text-center align-middle cursor-pointer transition-colors w-[54px] min-w-[54px] max-w-[54px] h-[52px] select-none ${
                            isOt
                              ? 'bg-emerald-200/90 hover:bg-emerald-300/90'
                              : 'hover:bg-amber-100/60'
                          } ${selectionStyle}`}
                        >
                          {isOt ? (
                            <span className="font-black text-emerald-900 text-xs bg-emerald-300/90 border border-emerald-400 px-1.5 py-0.5 rounded shadow-2xs">
                              P
                            </span>
                          ) : hasSubPunchInfo ? (
                            <div className="flex flex-col items-center justify-center py-0.5 leading-[11px] font-mono select-none">
                              <span className="text-[9px] font-bold text-emerald-700 tracking-tighter">
                                {record?.inTime || '--'}
                              </span>
                              <span className="text-[9px] font-bold text-blue-700 tracking-tighter">
                                {record?.outTime || '--'}
                              </span>
                              {durationDisplay && (
                                <span className="text-[9px] font-black text-slate-800 bg-white/95 border border-slate-300 px-1 rounded shadow-2xs mt-0.5 tracking-tighter">
                                  {durationDisplay}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Bulk Attendance Action Bar */}
      {selectedCellKeys.size > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
            <span className="bg-blue-600 text-white font-extrabold px-2.5 py-0.5 rounded-full text-xs shadow-xs">
              {selectedCellKeys.size}
            </span>
            <span className="text-xs font-bold text-slate-200">
              Cells Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkSaveStatus('P')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Check size={14} /> Present (P)
            </button>

            <button
              type="button"
              onClick={() => handleBulkSaveStatus('A')}
              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <X size={14} /> Absent (A)
            </button>

            <button
              type="button"
              onClick={() => handleBulkSaveStatus('HD')}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              Half Day (HD)
            </button>

            <button
              type="button"
              onClick={() => handleBulkSaveStatus('W/O')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              Week Off (W/O)
            </button>

            <button
              type="button"
              onClick={() => handleBulkSaveStatus(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
              title="Clear status for selected cells"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>

          <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
            <button
              type="button"
              onClick={() => {
                const keys = computeRangeKeys(0, filteredEmployees.length - 1, 1, daysInMonth);
                setSelectedCellKeys(keys);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedCellKeys(new Set())}
              className="text-xs text-slate-400 hover:text-white font-medium p-1 rounded-full hover:bg-slate-800 cursor-pointer"
              title="Deselect All"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Manual Edit Attendance Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{editingCell.empName}</h3>
                <p className="text-xs text-gray-500">Attendance for {editingCell.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleSaveStatus('P')}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> Present (P)
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('A')}
                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <X size={14} /> Absent (A)
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('HD')}
                className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 py-2 rounded-lg"
              >
                Half Day (HD)
              </button>

              <button
                type="button"
                onClick={() => handleSaveStatus('W/O')}
                className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 py-2 rounded-lg"
              >
                Week Off (W/O)
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between">
              <button
                type="button"
                onClick={() => handleSaveStatus(null)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
              >
                <Trash2 size={13} /> Clear Record
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google OAuth Re-Authorization Modal */}
      {googleAuthModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                Connect Google Account
              </h3>
              <button
                type="button"
                onClick={() => setGoogleAuthModal({ isOpen: false })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="py-4 text-sm text-gray-600 space-y-2">
              <p>
                {googleAuthModal.message || 'Google Drive authorization is required to create and synchronize attendance spreadsheets.'}
              </p>
              <p className="text-xs text-gray-500">
                Click below to authorize your Google account with Drive and Sheets permissions.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setGoogleAuthModal({ isOpen: false })}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {googleAuthModal.authUrl && (
                <a
                  href={googleAuthModal.authUrl}
                  className="px-4 py-1.5 text-xs font-bold bg-[#0F9D58] hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  <span>Authorize with Google</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
