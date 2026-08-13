import { EmployeeAttendanceData, AttendanceRecord } from '../types/attendance';
import { AttendanceTemplateData } from '@/features/invoices/components/AttendanceTemplate';

export const getWeeklyOffDayNum = (wOffStr: string = ''): number => {
  const s = wOffStr.toUpperCase().trim();
  if (s.startsWith('SUN')) return 0;
  if (s.startsWith('MON')) return 1;
  if (s.startsWith('TUE')) return 2;
  if (s.startsWith('WED')) return 3;
  if (s.startsWith('THU')) return 4;
  if (s.startsWith('FRI')) return 5;
  if (s.startsWith('SAT')) return 6;
  return -1;
};

export function getDaysInMonth(year: number, month: number | string): number {
  let mIndex = 7; // August default
  if (typeof month === 'number') {
    mIndex = month - 1;
  } else if (typeof month === 'string') {
    const parsed = Date.parse(`${month} 1, ${year}`);
    if (!isNaN(parsed)) {
      mIndex = new Date(parsed).getMonth();
    }
  }
  return new Date(year, mIndex + 1, 0).getDate();
}

/**
 * Transforms database rows / live records into AttendanceTemplateData for AttendanceTemplate
 */
export function mapDbToAttendanceTemplate(
  employees: EmployeeAttendanceData[],
  records: AttendanceRecord[],
  siteName: string,
  month: string | number,
  year: number,
  approvedManpower: number = 5
): AttendanceTemplateData {
  const numericYear = typeof year === 'number' ? year : parseInt(String(year), 10) || 2026;
  const monthStr = typeof month === 'number' 
    ? new Date(numericYear, month - 1, 1).toLocaleString('default', { month: 'long' })
    : month;
  
  const monthIndex = typeof month === 'number'
    ? month - 1
    : new Date(`${monthStr} 1, ${numericYear}`).getMonth();

  const daysCount = getDaysInMonth(numericYear, month);

  // Group records by employeeId -> date -> AttendanceRecord
  const attendanceByEmployee = new Map<string, Map<string, AttendanceRecord>>();
  for (const r of records) {
    if (!attendanceByEmployee.has(r.employeeId)) {
      attendanceByEmployee.set(r.employeeId, new Map());
    }
    attendanceByEmployee.get(r.employeeId)!.set(r.date, r);
  }

  const mappedEmployees = employees.map((emp, idx) => {
    const empRecordsMap = attendanceByEmployee.get(emp.id) || new Map<string, AttendanceRecord>();

    // Calculate lastActiveIndex (highest day index 0..daysCount-1 where emp has recorded status)
    let lastActiveIndex = -1;
    for (let i = 0; i < daysCount; i++) {
      const d = i + 1;
      const dateStr = `${numericYear}-${(monthIndex + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const rec = empRecordsMap.get(dateStr);
      if (rec && rec.status) {
        lastActiveIndex = Math.max(lastActiveIndex, i);
      }
    }

    // Cap at today's date if current month & year
    const now = new Date();
    if (now.getFullYear() === numericYear && now.getMonth() === monthIndex) {
      lastActiveIndex = Math.max(lastActiveIndex, now.getDate() - 1);
    }

    const empWeeklyOffDay = getWeeklyOffDayNum(emp.weeklyOff);

    const regularShifts: string[] = [];
    const overtimeShifts: string[] = [];

    for (let i = 0; i < daysCount; i++) {
      const d = i + 1;
      const dateStr = `${numericYear}-${(monthIndex + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const rec = empRecordsMap.get(dateStr);

      if (rec) {
        if (rec.status === 'WOP') {
          regularShifts.push('W/O');
          overtimeShifts.push('P');
        } else {
          regularShifts.push(rec.status || '');
          overtimeShifts.push(rec.overtimeStatus || '');
        }
      } else {
        const dateObj = new Date(numericYear, monthIndex, d);
        if (i <= lastActiveIndex && empWeeklyOffDay !== -1 && dateObj.getDay() === empWeeklyOffDay) {
          regularShifts.push('W/O');
        } else {
          regularShifts.push('');
        }
        overtimeShifts.push('');
      }
    }

    return {
      id: emp.id,
      srNo: idx + 1,
      biometricCode: emp.biometricCode || '',
      employeeName: emp.name || '',
      weeklyOff: emp.weeklyOff || 'SUN',
      designation: emp.role,
      shifts: {
        regular: regularShifts,
        overtime: overtimeShifts,
      },
    };
  });

  return {
    siteName: siteName || 'ALL SITES',
    month: monthStr,
    year: numericYear,
    daysCount,
    employees: mappedEmployees,
    summary: {
      approvedManpower,
    },
  };
}
