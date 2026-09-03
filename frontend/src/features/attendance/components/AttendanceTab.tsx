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
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  EmployeeAttendanceData,
} from '../types/attendance';
import { AttendanceTemplate } from '@/features/invoices/components/AttendanceTemplate';
import { mapDbToAttendanceTemplate, getWeeklyOffDayNum } from '../utils/attendanceMapper';
import { supabase } from '@/lib/supabase';
import { AddStaffModal } from './AddStaffModal';

interface AttendanceTabProps {
  initialEmployees?: EmployeeAttendanceData[];
  initialRecords?: AttendanceRecord[];
  sites?: { id: string; name: string; codeName?: string; attendanceGridName?: string; approvedManpower?: number }[];
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
  const [siteList, setSiteList] = useState<{ id: string; name: string; codeName?: string; attendanceGridName?: string; approvedManpower?: number }[]>(sites);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Aug
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [searchTerm] = useState<string>('');

  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modals & Controls
  const [showAutoInvoiceDropdown, setShowAutoInvoiceDropdown] = useState<boolean>(false);
  const [editingCell, setEditingCell] = useState<{
    empId: string;
    empName: string;
    date: string;
    currentRecord?: AttendanceRecord;
  } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  const attendanceStats = useMemo(() => {
    let presentToday = 0;
    let absentToday = 0;
    let totalWorkingScore = 0;
    const todayStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-12`;

    for (const emp of filteredEmployees) {
      const empAttendance = attendanceByEmployee.get(emp.id);
      if (empAttendance) {
        for (const [dateStr, record] of empAttendance.entries()) {
          const [rYear, rMonth] = dateStr.split('-').map(Number);
          if (rMonth === selectedMonth && rYear === selectedYear) {
            if (record.status === 'P') totalWorkingScore += 1;
            else if (record.status === 'W/O') totalWorkingScore += 1;
            else if (record.status === 'WOP') totalWorkingScore += 2;
            else if (record.status === 'HD') totalWorkingScore += 0.5;
          }
        }
        const todayRecord = empAttendance.get(todayStr);
        if (todayRecord) {
          if (todayRecord.status === 'P') presentToday++;
          else if (todayRecord.status === 'A') absentToday++;
        }
      }
    }
    return { presentToday, absentToday, totalWorkingScore };
  }, [filteredEmployees, attendanceByEmployee, selectedMonth, selectedYear]);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const handleSaveStatus = (status: AttendanceStatus | null) => {
    if (!editingCell) return;
    const { empId, date } = editingCell;
    const emp = employees.find((e) => e.id === empId);

    const [rYear, rMonth, rDay] = date.split('-').map(Number);
    const dateObj = new Date(rYear, rMonth - 1, rDay);
    const dayOfWeekNum = dateObj.getDay();
    const isWeeklyOffDay = emp && getWeeklyOffDayNum(emp.weeklyOff) === dayOfWeekNum;

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

    // Save directly to Supabase attendance_records table
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

      if (existingRec?.id) {
        supabase
          .from('attendance_records')
          .update({
            status: targetStatus,
            shift_type: overtimeVal ? 'overtime' : 'regular',
          })
          .eq('id', existingRec.id)
          .then(({ error }) => {
            if (error) console.warn('⚠️ Error updating attendance_record:', error.message);
          });
      } else {
        supabase
          .from('attendance_records')
          .insert([recordPayload])
          .then(({ error }) => {
            if (error) console.warn('⚠️ Error inserting attendance_record:', error.message);
          });
      }
    } catch (e) {
      console.warn('⚠️ Could not save attendance_record:', e);
    }

    setEditingCell(null);
  };

  // True relational fetch sequence: sites -> staff -> attendance_records
  useEffect(() => {
    let isMounted = true;

    async function loadRelationalData() {
      try {
        // 1. Fetch Sites from Supabase sites table
        const { data: dbSites, error: sitesErr } = await supabase
          .from('sites')
          .select('*')
          .order('created_at', { ascending: false });

        if (!sitesErr && dbSites && dbSites.length > 0) {
          const mappedSites = dbSites.map((s: any) => ({
            id: s.id,
            name: s.site_name || s.siteName || s.name || '',
            codeName: s.code_name || s.codeName || '',
            attendanceGridName: s.site_name || s.siteName || s.name || '',
            approvedManpower: Number(s.approved_manpower || s.approvedManpower || s.contracted_manpower || 5),
          }));
          if (isMounted) {
            setSiteList(mappedSites);
            if (selectedSiteFilter === 'all' && mappedSites.length > 0) {
              setSelectedSiteFilter(mappedSites[0].id);
            }
          }
        }

        // 2. Query 1: Fetch staff for selected site
        let staffQuery = supabase.from('staff').select('*');
        if (selectedSiteFilter && selectedSiteFilter !== 'all') {
          staffQuery = staffQuery.eq('site_id', selectedSiteFilter);
        }

        const { data: dbStaff, error: staffErr } = await staffQuery;

        if (!staffErr && dbStaff) {
          const mappedStaff: EmployeeAttendanceData[] = dbStaff.map((st: any) => ({
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

        let recQuery = supabase
          .from('attendance_records')
          .select('*')
          .gte('record_date', startDateStr)
          .lte('record_date', endDateStr);

        if (selectedSiteFilter && selectedSiteFilter !== 'all') {
          recQuery = recQuery.eq('site_id', selectedSiteFilter);
        }

        const { data: dbRecords, error: recErr } = await recQuery;

        if (!recErr && dbRecords) {
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
        <AttendanceTemplate data={templateData} />
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Left Title & Live Badges */}
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Grid</h2>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-xs border border-emerald-200">
              ● LIVE DATA
            </span>
          </div>
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
              onClick={() => window.print()}
              className="bg-[#10B981] hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>PDF Download</span>
            </button>

            {/* Stats pills matching Screenshot 2 */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <CheckCircle size={14} />
                <span>{attendanceStats.presentToday} PRESENT</span>
              </div>

              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-2xs">
                <XCircle size={14} />
                <span>{attendanceStats.absentToday} ABSENT</span>
              </div>

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
                      <td colSpan={daysInMonth} className="bg-slate-50/60" />
                    </tr>
                  )}

                  {/* Row 1: Main / Regular Shift */}
                  <tr className="border-b border-slate-200 hover:bg-slate-50/80 transition-colors h-8">
                    {/* Employee Profile Cell (Spans 2 rows with thick bottom & right borders) */}
                    <td
                      rowSpan={2}
                      className="p-3 sticky left-0 bg-white z-20 border-r-2 border-b-2 border-slate-400 text-left font-medium text-gray-900 shadow-xs align-middle"
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

                        {onEditDeductions && (
                          <button
                            type="button"
                            onClick={() => onEditDeductions(emp)}
                            className="p-1 text-gray-400 hover:text-teal-600 rounded transition-colors"
                          >
                            <Banknote size={14} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Day Cells (Regular Shift) */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dateStr = `${selectedYear}-${selectedMonth
                        .toString()
                        .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                      const record = empMap.get(dateStr);

                      let regStatus = record?.status;
                      if (regStatus === 'WOP') regStatus = 'W/O';

                      let statusBadge = <span className="text-slate-300 font-bold text-xs">-</span>;
                      let cellBg = 'bg-white hover:bg-slate-100/70';

                      if (regStatus) {
                        switch (regStatus) {
                          case 'P':
                            cellBg = 'bg-emerald-100/70 hover:bg-emerald-200/70';
                            statusBadge = (
                              <span className="font-extrabold text-emerald-800 text-xs">P</span>
                            );
                            break;
                          case 'A':
                            cellBg = 'bg-red-100/70 hover:bg-red-200/70';
                            statusBadge = (
                              <span className="font-extrabold text-red-700 text-xs">A</span>
                            );
                            break;
                          case 'HD':
                            cellBg = 'bg-amber-100/80 hover:bg-amber-200/80';
                            statusBadge = (
                              <span className="font-extrabold text-amber-800 text-[11px]">HD</span>
                            );
                            break;
                          case 'W/O':
                            cellBg = 'bg-blue-100/80 hover:bg-blue-200/80';
                            statusBadge = (
                              <span className="font-extrabold text-blue-800 text-[11px]">W/O</span>
                            );
                            break;
                          default:
                            statusBadge = (
                              <span className="font-bold text-gray-700 text-xs">
                                {regStatus}
                              </span>
                            );
                        }
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

                      return (
                        <td
                          key={`reg-${d}`}
                          title={punchTooltip}
                          onClick={() =>
                            setEditingCell({
                              empId: emp.id,
                              empName: emp.name,
                              date: dateStr,
                              currentRecord: record,
                            })
                          }
                          className={`border-r border-b border-slate-300 p-1 text-center align-middle cursor-pointer transition-colors w-[54px] min-w-[54px] max-w-[54px] h-9 ${cellBg}`}
                        >
                          {statusBadge}
                        </td>
                      );
                    })}
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

                      return (
                        <td
                          key={`ot-${d}`}
                          title={subTooltip}
                          onClick={() =>
                            setEditingCell({
                              empId: emp.id,
                              empName: emp.name,
                              date: dateStr,
                              currentRecord: record,
                            })
                          }
                          className={`border-r border-b-2 border-slate-400 p-0.5 text-center align-middle cursor-pointer transition-colors w-[54px] min-w-[54px] max-w-[54px] h-[52px] ${
                            isOt
                              ? 'bg-emerald-200/90 hover:bg-emerald-300/90'
                              : 'hover:bg-amber-100/60'
                          }`}
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
    </div>
  );
};
