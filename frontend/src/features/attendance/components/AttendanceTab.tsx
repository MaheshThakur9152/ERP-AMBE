import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  EmployeeAttendanceData,
} from '../types/attendance';
import { AttendanceTemplate } from '@/features/invoices/components/AttendanceTemplate';

interface AttendanceTabProps {
  initialEmployees?: EmployeeAttendanceData[];
  initialRecords?: AttendanceRecord[];
  sites?: { id: string; name: string; attendanceGridName?: string }[];
  onAddStaff?: () => void;
  onEditDeductions?: (emp: EmployeeAttendanceData) => void;
}

const MOCK_SITES = [
  { id: 'site-1', name: 'Acme Metal Industries Pvt Ltd', attendanceGridName: 'Acme Metal Industries Pvt Ltd' },
  { id: 'site-2', name: 'Ajmera', attendanceGridName: 'Ajmera' },
  { id: 'site-3', name: 'Ajmera-keyman', attendanceGridName: 'Ajmera-keyman' },
  { id: 'site-4', name: 'Ambe Service- Office', attendanceGridName: 'Ambe Service- Office' },
  { id: 'site-5', name: 'Ceejay', attendanceGridName: 'Ceejay' },
  { id: 'site-6', name: 'Lokhandwala Minerva CHS LTD', attendanceGridName: 'Lokhandwala Minerva CHS LTD (Prop.)' },
];

const MOCK_EMPLOYEES: EmployeeAttendanceData[] = [
  {
    id: 'emp-101',
    name: 'Alok',
    biometricCode: '1234',
    phone: '9082089316',
    role: 'Janitor',
    shift: 'KEYMAN',
    siteId: 'site-3',
    siteName: 'Ajmera-keyman',
    weeklyOff: 'FRI',
    status: 'Active',
  },
  {
    id: 'emp-102',
    name: 'Feroj',
    biometricCode: '1234',
    phone: '8594258810',
    role: 'Janitor',
    shift: 'KEYMAN',
    siteId: 'site-3',
    siteName: 'Ajmera-keyman',
    weeklyOff: 'MON',
    status: 'Active',
  },
];

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  initialEmployees = MOCK_EMPLOYEES,
  initialRecords = [],
  sites = MOCK_SITES,
  onAddStaff,
  onEditDeductions,
}) => {
  const [employees] = useState<EmployeeAttendanceData[]>(initialEmployees);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Aug
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('site-3'); // Ajmera-keyman
  const [searchTerm] = useState<string>('');

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
          const [rYear, rMonth, rDay] = dateStr.split('-').map(Number);
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

    setAttendanceRecords((prev) => {
      const filtered = prev.filter((r) => !(r.employeeId === empId && r.date === date));
      if (status !== null) {
        filtered.push({
          id: Date.now().toString(),
          employeeId: empId,
          date,
          status,
          checkInTime: 'Manual',
          timestamp: new Date().toISOString(),
          remarks: 'Added by Admin',
        });
      }
      return filtered;
    });

    setEditingCell(null);
  };

  return (
    <div className="space-y-6 font-sans text-gray-800 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
      {/* Printable Template (hidden on screen, visible during window.print()) */}
      <div className="attendance-print-area">
        <AttendanceTemplate
          data={{
            siteName: sites.find((s) => s.id === selectedSiteFilter)?.name || (selectedSiteFilter === 'all' ? 'All Sites' : selectedSiteFilter),
            month: new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' }),
            year: selectedYear,
            daysCount: daysInMonth,
            employees: filteredEmployees.map((emp, idx) => ({
              id: emp.id,
              srNo: idx + 1,
              biometricCode: emp.biometricCode || '',
              employeeName: emp.name || '',
              weeklyOff: emp.weeklyOff || 'SUN',
              designation: emp.role,
              shifts: {
                regular: Array.from({ length: daysInMonth }, (_, i) => {
                  const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
                  return attendanceByEmployee.get(emp.id)?.get(dateStr)?.status || '';
                }),
                overtime: Array.from({ length: daysInMonth }, () => ''),
              },
            })),
          }}
        />
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Left Title & Live Badges */}
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Grid</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Updated 41s ago</span>
          </div>
        </div>

        {/* Right Actions Grid */}
        <div className="flex flex-col items-end gap-3">
          {/* Row 1 Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAddStaff}
              className="bg-[#20B2AA] hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-bold transition-all"
            >
              <Plus size={16} />
              <span>Add Staff</span>
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
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.attendanceGridName || s.name}
                  </option>
                ))}
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
        <table className="w-full text-center text-xs border-collapse min-w-[1550px]">
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
                    className="p-1.5 sticky top-0 z-20 border-r border-gray-100 min-w-[38px] font-medium bg-white text-gray-500"
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

                  <tr className="border-b border-gray-100 hover:bg-slate-50/60 transition-colors">
                    {/* Employee Profile Cell */}
                    <td className="p-3 sticky left-0 bg-white z-20 border-r border-gray-200 text-left font-medium text-gray-900 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 min-w-[210px]">
                        <div className="flex items-center gap-3">
                          {/* Circle Avatar with Initials */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                            NS
                          </div>

                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 text-xs">{emp.name}</span>
                              {emp.weeklyOff && (
                                <span className="text-[9px] font-extrabold text-red-600 bg-red-100/80 px-1.5 py-0.2 rounded uppercase">
                                  {emp.weeklyOff}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
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
                            className="p-1 text-gray-300 hover:text-teal-600 rounded transition-colors"
                          >
                            <Banknote size={14} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Day Cells */}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dateStr = `${selectedYear}-${selectedMonth
                        .toString()
                        .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                      const record = empMap.get(dateStr);

                      let statusBadge = <span className="text-gray-300/80">-</span>;
                      let cellBg = 'hover:bg-gray-50';

                      if (record) {
                        switch (record.status) {
                          case 'P':
                            cellBg = 'bg-emerald-50/70 hover:bg-emerald-100/70';
                            statusBadge = (
                              <span className="font-extrabold text-emerald-700 text-xs">P</span>
                            );
                            break;
                          case 'A':
                            cellBg = 'bg-red-50 hover:bg-red-100';
                            statusBadge = (
                              <span className="font-extrabold text-red-600 text-xs">A</span>
                            );
                            break;
                          case 'HD':
                            cellBg = 'bg-amber-50 hover:bg-amber-100';
                            statusBadge = (
                              <span className="font-bold text-amber-700 text-[11px]">HD</span>
                            );
                            break;
                          case 'W/O':
                            cellBg = 'bg-blue-50/70 hover:bg-blue-100/70';
                            statusBadge = (
                              <span className="font-bold text-blue-600 text-[11px]">W/O</span>
                            );
                            break;
                          case 'WOP':
                            cellBg = 'bg-purple-50 hover:bg-purple-100';
                            statusBadge = (
                              <span className="font-bold text-purple-700 text-[11px]">WOP</span>
                            );
                            break;
                          default:
                            statusBadge = (
                              <span className="font-medium text-gray-600 text-xs">
                                {record.status}
                              </span>
                            );
                        }
                      }

                      return (
                        <td
                          key={d}
                          onClick={() =>
                            setEditingCell({
                              empId: emp.id,
                              empName: emp.name,
                              date: dateStr,
                              currentRecord: record,
                            })
                          }
                          className={`border-r border-gray-100 p-1 text-center align-middle cursor-pointer transition-colors ${cellBg}`}
                        >
                          {statusBadge}
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
