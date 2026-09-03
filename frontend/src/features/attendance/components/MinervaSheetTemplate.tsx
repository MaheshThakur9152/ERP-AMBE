import React from 'react';
import { EmployeeAttendanceData, AttendanceRecord } from '../types/attendance';

export interface MinervaSheetTemplateProps {
  month: number | string;
  year: number;
  siteName?: string;
  clientName?: string;
  workOrderRef?: string;
  employees: EmployeeAttendanceData[];
  attendanceByEmployee: Map<string, Map<string, AttendanceRecord>>;
}

export const MinervaSheetTemplate: React.FC<MinervaSheetTemplateProps> = ({
  month,
  year,
  siteName,
  clientName,
  workOrderRef,
  employees,
  attendanceByEmployee,
}) => {
  const monthNum = Number(month);
  const daysInMonth = new Date(Number(year), monthNum, 0).getDate();
  const monthName =
    typeof month === 'string' && isNaN(Number(month))
      ? month
      : new Date(2000, monthNum - 1, 1).toLocaleString('default', { month: 'long' });

  const siteHeader = (clientName || siteName || 'LOKHANDWALA MINERVA CHS LTD (REGD)').toUpperCase();
  const woHeader = workOrderRef ? ` &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; WO NO : ${workOrderRef}` : '';

  // Group employees by designation / role
  const groupsMap = React.useMemo(() => {
    const map = new Map<string, EmployeeAttendanceData[]>();
    for (const emp of employees) {
      const groupKey = (emp.role || emp.shift || 'HK - HO').trim();
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(emp);
    }
    return map;
  }, [employees]);

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let grandPresent = 0;
  let grandWO = 0;
  let grandWoExtra = 0;
  let grandTotal = 0;

  return (
    <div
      className="w-full bg-white text-black p-4 text-xs select-none print:p-0"
      style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
    >
      {/* 1. Force Landscape Print Orientation */}
      <style>{`
        @media print {
          @page {
            size: landscape !important;
            margin: 5mm !important;
          }
        }
      `}</style>

      {/* Table without outer border */}
      <table className="w-full border-collapse text-[11px]" style={{ border: 'none' }}>
        <thead>
          {/* Header Row 1: Company Name (Completely unbordered free-floating) */}
          <tr>
            <td
              colSpan={12}
              className="text-center font-black text-sm uppercase py-2 tracking-wide border-none !border-0"
              style={{ border: 'none' }}
            >
              AMBE SERVICE FACILITY PVT. LTD.
            </td>
          </tr>
          {/* Header Row 2: Site & WO Number (Completely unbordered free-floating) */}
          <tr>
            <td
              colSpan={12}
              className="text-center font-bold text-xs py-1 border-none !border-0"
              style={{ border: 'none' }}
              dangerouslySetInnerHTML={{
                __html: `SITE - ${siteHeader}${woHeader}`,
              }}
            />
          </tr>
          {/* Header Row 3: Month & Year (Completely unbordered free-floating) */}
          <tr>
            <td
              colSpan={12}
              className="text-center font-bold text-xs py-1 uppercase border-none !border-0"
              style={{ border: 'none' }}
            >
              ATTENDANCE FOR THE MONTH OF {monthName.toUpperCase()} - {year}
            </td>
          </tr>
          {/* Columns Header: Stays Centered */}
          <tr className="bg-white font-bold text-center text-[10px]">
            <th className="border border-black px-1.5 py-1.5 w-[38px] text-center">SR NO</th>
            <th className="border border-black px-2 py-1.5 text-left w-[110px]">DESIGNATION</th>
            <th className="border border-black px-2 py-1.5 text-left w-[180px]">NAME</th>
            <th className="border border-black px-2 py-1.5 text-left w-[85px]">WO Day</th>
            <th className="border border-black px-1.5 py-1.5 w-[55px] text-center">PRESENT</th>
            <th className="border border-black px-1.5 py-1.5 w-[45px] text-center">WO</th>
            <th className="border border-black px-1.5 py-1.5 w-[65px] text-center">WO EXTRA</th>
            <th className="border border-black px-1.5 py-1.5 w-[55px] text-center">HOLIDAY</th>
            <th className="border border-black px-1.5 py-1.5 w-[75px] text-center">HOLIDAY EXTRA</th>
            <th className="border border-black px-1.5 py-1.5 w-[65px] text-center">Night Shift</th>
            <th className="border border-black px-1.5 py-1.5 w-[55px] text-center">TOTAL</th>
            <th className="border border-black px-1.5 py-1.5 w-[40px] text-center">OT</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groupsMap.entries()).map(([groupName, groupEmps]) => {
            let groupPresent = 0;
            let groupWO = 0;
            let groupWoExtra = 0;
            let groupTotal = 0;

            const rows = groupEmps.map((emp, idx) => {
              let empPresent = 0;
              let empWO = 0;
              let empWoExtra = 0;

              const offDays = (emp.weeklyOff || '')
                .toLowerCase()
                .split(/[,/&]+/)
                .map((s) => s.trim());

              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const dayDate = new Date(Number(year), monthNum - 1, d);
                const dayName = DAY_NAMES[dayDate.getDay()];
                const isWeeklyOff = Boolean(
                  emp.weeklyOff && emp.weeklyOff !== 'None' && offDays.includes(dayName.toLowerCase())
                );

                const rec = attendanceByEmployee.get(emp.id)?.get(dateStr);
                const st = (rec?.status || '').toUpperCase().trim();

                if (st === 'P') {
                  if (isWeeklyOff) {
                    empWoExtra += 1;
                  } else {
                    empPresent += 1;
                  }
                } else if (st === 'WOP') {
                  empWoExtra += 1;
                } else if (st === 'W/O' || (isWeeklyOff && (!st || st === 'A'))) {
                  empWO += 1;
                } else if (st === 'HD') {
                  empPresent += 0.5;
                }
              }

              const empTotal = empPresent + empWO + empWoExtra;

              groupPresent += empPresent;
              groupWO += empWO;
              groupWoExtra += empWoExtra;
              groupTotal += empTotal;

              return (
                <tr key={emp.id} className="h-6 hover:bg-slate-50 transition-colors">
                  <td className="border border-black text-center px-1 py-0.5">{idx + 1}</td>
                  <td className="border border-black text-left px-2 py-0.5 font-medium">{groupName}</td>
                  <td className="border border-black text-left px-2 py-0.5 font-bold">{emp.name}</td>
                  <td className="border border-black text-left px-2 py-0.5">{emp.weeklyOff || 'Sunday'}</td>
                  {/* Numbers right-aligned with pr-2 padding */}
                  <td className="border border-black text-right pr-2 py-0.5 font-semibold">{empPresent}</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-semibold">{empWO}</td>
                  <td className="border border-black text-right pr-2 py-0.5">{empWoExtra > 0 ? empWoExtra : ''}</td>
                  <td className="border border-black text-right pr-2 py-0.5"></td>
                  <td className="border border-black text-right pr-2 py-0.5"></td>
                  <td className="border border-black text-right pr-2 py-0.5"></td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold">{empTotal}</td>
                  <td className="border border-black text-right pr-2 py-0.5"></td>
                </tr>
              );
            });

            grandPresent += groupPresent;
            grandWO += groupWO;
            grandWoExtra += groupWoExtra;
            grandTotal += groupTotal;

            return (
              <React.Fragment key={groupName}>
                {rows}
                {/* Group Subtotal Row: Left colSpan={4} is completely border-free */}
                <tr className="font-bold h-6">
                  <td
                    colSpan={4}
                    className="border-none !border-0 bg-transparent text-right px-2"
                    style={{ border: 'none' }}
                  />
                  {/* Numbers right-aligned with pr-2 padding */}
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">{groupPresent}</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">{groupWO}</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">{groupWoExtra}</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">0</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">0</td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">0</td>
                  <td className="border border-black text-right pr-2 py-0.5 bg-[#375623] print:bg-[#375623] text-white font-extrabold">
                    {groupTotal}
                  </td>
                  <td className="border border-black text-right pr-2 py-0.5 font-bold bg-[#c6efce] print:bg-[#c6efce]">0</td>
                </tr>
                {/* Spacer row between designation groups: completely border-free across edges */}
                <tr className="h-3 border-none !border-0 bg-transparent print:border-none" style={{ border: 'none' }}>
                  <td
                    colSpan={12}
                    className="border-none !border-0 p-0 h-3 bg-transparent"
                    style={{ border: 'none' }}
                  />
                </tr>
              </React.Fragment>
            );
          })}

          {/* Grand Total Row */}
          <tr className="font-black text-[11px] h-7">
            <td colSpan={4} className="border border-black bg-white text-center uppercase tracking-widest font-black py-1">
              GRAND TOTAL
            </td>
            {/* Numbers right-aligned with pr-2 padding */}
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">{grandPresent}</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">{grandWO}</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">{grandWoExtra}</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">0</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">0</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">0</td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#274e13] print:bg-[#274e13] text-white">
              {grandTotal}
            </td>
            <td className="border border-black text-right pr-2 py-1 font-black bg-[#a9d08e] print:bg-[#a9d08e]">0</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
