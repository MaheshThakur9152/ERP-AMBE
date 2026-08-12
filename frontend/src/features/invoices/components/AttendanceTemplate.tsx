import React from 'react';

export interface AttendanceEmployeeData {
  id?: string;
  srNo?: number;
  biometricCode: string;
  employeeName: string;
  weeklyOff: string;
  designation?: string;
  shifts: {
    regular: string[]; // 31 days e.g. ['P', 'P', 'W/O', 'HD', 'A', ...]
    overtime?: string[]; // 31 days e.g. ['', 'P', '', '', ...]
  };
  totals?: {
    presentDays?: number;
    weeklyOff?: number;
    holidays?: number;
    totalDays?: number;
    otDays?: number;
  };
}

export interface AttendanceTemplateData {
  companyName?: string;
  siteName: string;
  month: string;
  year: number | string;
  daysCount?: number;
  daysOfWeek?: string[]; // Array of 31 day names e.g. ['SUN', 'MON', ...]
  employees: AttendanceEmployeeData[];
  summary?: {
    approvedManpower?: number;
    janitorsTotal?: number;
    excessShortage?: number;
    monthlyPercentage?: number;
  };
}

interface AttendanceTemplateProps {
  data: AttendanceTemplateData;
}

const DEFAULT_DAYS_OF_WEEK = [
  'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
  'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
  'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
  'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
  'SUN', 'MON', 'TUE',
];

export const AttendanceTemplate: React.FC<AttendanceTemplateProps> = ({ data }) => {
  const daysCount = data.daysCount || 31;
  const daysOfWeek = data.daysOfWeek || DEFAULT_DAYS_OF_WEEK.slice(0, daysCount);
  const dayIndices = Array.from({ length: daysCount }, (_, i) => i);
  const monthYear = `${(data.month || 'AUGUST').toUpperCase()} ${data.year || 2026}`;
  const siteName = (data.siteName || 'ALL SITES').toUpperCase();

  // Calculate daily column totals across all employees
  const dailyWeeklyOffCount = dayIndices.map((dayIdx) =>
    (data.employees || []).reduce((acc, emp) => {
      const st = (emp.shifts?.regular?.[dayIdx] || '').toUpperCase().trim();
      return acc + (st === 'W/O' || st === 'WO' ? 1 : 0);
    }, 0)
  );

  const dailyPresentCount = dayIndices.map((dayIdx) =>
    (data.employees || []).reduce((acc, emp) => {
      const regP = (emp.shifts?.regular?.[dayIdx] || '').toUpperCase().trim() === 'P' ? 1 : 0;
      const otP = (emp.shifts?.overtime?.[dayIdx] || '').toUpperCase().trim() === 'P' ? 1 : 0;
      const hdP = (emp.shifts?.regular?.[dayIdx] || '').toUpperCase().trim() === 'HD' ? 0.5 : 0;
      return acc + regP + otP + hdP;
    }, 0)
  );

  const dailyTotalStrength = dayIndices.map(
    (dayIdx) => dailyWeeklyOffCount[dayIdx] + dailyPresentCount[dayIdx]
  );

  const sumWeeklyOffTotal = dailyWeeklyOffCount.reduce((a, b) => a + b, 0);
  const sumPresentTotal = dailyPresentCount.reduce((a, b) => a + b, 0);
  const sumTotalStrengthTotal = dailyTotalStrength.reduce((a, b) => a + b, 0);

  return (
    <div className="w-full bg-white text-black text-[7px] font-sans" style={{ tableLayout: 'fixed' }}>
      <style>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <table className="w-full border-collapse border border-black">
        <thead>
          {/* Top Titles */}
          <tr>
            <td colSpan={39} className="text-center font-bold text-lg border border-black uppercase py-1">
              AMBE SERVICE FACILITY PVT. LTD.
            </td>
          </tr>
          <tr>
            <td colSpan={39} className="text-center font-bold text-sm border border-black uppercase py-0.5">
              SITE - {siteName}
            </td>
          </tr>
          <tr>
            <td colSpan={39} className="text-center font-bold text-xs border border-black uppercase py-0.5">
              ATTENDANCE FOR THE MONTH OF {monthYear}
            </td>
          </tr>

          {/* Column Header Row 1 */}
          <tr>
            <th rowSpan={2} className="border border-black w-4 text-center">
              SR
            </th>
            <th
              rowSpan={2}
              className="border border-black w-10 text-center"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Biometric Code
            </th>
            <th rowSpan={2} className="border border-black w-24 text-left px-1">
              Employee Name
            </th>
            <th
              rowSpan={2}
              className="border border-black w-8 text-center"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Weekly Off
            </th>

            {dayIndices.map((dayIdx) => (
              <th key={dayIdx + 1} className="border border-black text-center w-4 font-bold">
                {dayIdx + 1}
              </th>
            ))}

            <th
              rowSpan={2}
              className="border border-black w-6 text-center font-bold"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              TOTAL PRESENT DAYS
            </th>
            <th
              rowSpan={2}
              className="border border-black w-6 text-center font-bold"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              WEEKLY OFF
            </th>
            <th
              rowSpan={2}
              className="border border-black w-6 text-center font-bold"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              HD
            </th>
            <th
              rowSpan={2}
              className="border border-black w-6 text-center font-bold"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              TOTAL DAYS
            </th>
          </tr>

          {/* Column Header Row 2 (Day Names) */}
          <tr>
            {dayIndices.map((dayIdx) => (
              <th
                key={dayIdx}
                className="border border-black h-12 text-[6px] text-center"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {daysOfWeek[dayIdx] || 'MON'}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {(data.employees || []).map((emp, idx) => {
            const regShifts = emp.shifts?.regular || [];
            const otShifts = emp.shifts?.overtime || [];

            let presentDays = 0;
            let weeklyOffDays = 0;
            let hdDays = 0;

            dayIndices.forEach((d) => {
              const st = (regShifts[d] || '').toUpperCase().trim();
              const ot = (otShifts[d] || '').toUpperCase().trim();

              if (st === 'P') presentDays += 1;
              if (ot === 'P') presentDays += 1;
              if (st === 'HD') {
                presentDays += 0.5;
                hdDays += 1;
              }
              if (st === 'W/O' || st === 'WO') weeklyOffDays += 1;
            });

            const totalDays = presentDays + weeklyOffDays;

            return (
              <React.Fragment key={emp.id || idx}>
                {/* Employee Row 1 (Main Shift) */}
                <tr>
                  <td rowSpan={2} className="border border-black text-center font-semibold">
                    {idx + 1}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-mono">
                    {emp.biometricCode}
                  </td>
                  <td rowSpan={2} className="border border-black font-bold text-left px-1">
                    {emp.employeeName}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-semibold uppercase">
                    {emp.weeklyOff}
                  </td>

                  {dayIndices.map((dIdx) => {
                    const st = regShifts[dIdx] || '';
                    return (
                      <td key={dIdx} className="border border-black text-center font-bold">
                        {st}
                      </td>
                    );
                  })}

                  <td rowSpan={2} className="border border-black text-center font-bold">
                    {emp.totals?.presentDays ?? presentDays}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold">
                    {emp.totals?.weeklyOff ?? weeklyOffDays}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold">
                    {emp.totals?.holidays ?? hdDays}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold">
                    {emp.totals?.totalDays ?? totalDays}
                  </td>
                </tr>

                {/* Employee Row 2 (Extra Shift / Overtime) */}
                <tr>
                  {dayIndices.map((dIdx) => {
                    const ot = otShifts[dIdx] || '';
                    return (
                      <td key={dIdx} className="border border-black text-center text-[6px]">
                        {ot}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}

          {/* Bottom Summary Row 1: WEEKLY OFF */}
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              WEEKLY OFF
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold">
                {dailyWeeklyOffCount[dIdx] || 0}
              </td>
            ))}
            <td colSpan={4} className="border border-black text-center font-bold">
              {sumWeeklyOffTotal}
            </td>
          </tr>

          {/* Bottom Summary Row 2: PRESENT STRENGTH */}
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              PRESENT STRENGTH
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold">
                {dailyPresentCount[dIdx] || 0}
              </td>
            ))}
            <td colSpan={4} className="border border-black text-center font-bold">
              {sumPresentTotal}
            </td>
          </tr>

          {/* Bottom Summary Row 3: TOTAL STRENGTH */}
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              TOTAL STRENGTH
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold">
                {dailyTotalStrength[dIdx] || 0}
              </td>
            ))}
            <td colSpan={4} className="border border-black text-center font-bold">
              {sumTotalStrengthTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
