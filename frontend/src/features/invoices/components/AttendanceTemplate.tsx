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
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  'Sunday', 'Monday', 'Tuesday',
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
    <div className="w-full bg-white text-black text-[8px] font-sans print:block print:pt-4 print:px-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body { -webkit-print-color-adjust: exact; background-color: white; }
        }
      `}</style>
      <table className="w-full border-collapse border border-black" style={{ tableLayout: 'fixed' }}>
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
                {daysOfWeek[dayIdx] || 'Sunday'}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {(data.employees || []).map((emp, idx) => {
            const regShifts = emp.shifts?.regular || [];
            const otShifts = emp.shifts?.overtime || [];

            let regPresent = 0;
            let otPresent = 0;
            let regWeeklyOff = 0;
            let regHd = 0;

            dayIndices.forEach((d) => {
              const st = (regShifts[d] || '').toUpperCase().trim();
              const ot = (otShifts[d] || '').toUpperCase().trim();

              if (st === 'P') regPresent += 1;
              if (ot === 'P') otPresent += 1;
              if (st === 'HD') {
                regPresent += 0.5;
                regHd += 1;
              }
              if (st === 'W/O' || st === 'WO') regWeeklyOff += 1;
            });

            const totalDays = regPresent + otPresent + regWeeklyOff;

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
                    const st = (regShifts[dIdx] || '').toUpperCase().trim();
                    let colorClass = 'text-black';
                    if (st === 'A') colorClass = 'text-red-600';
                    if (st === 'W/O' || st === 'WO') colorClass = 'text-blue-700 bg-blue-50/50';

                    return (
                      <td key={dIdx} className={`border border-black text-center font-bold ${colorClass}`}>
                        {st || '\u00A0'}
                      </td>
                    );
                  })}

                  <td className="border border-black text-center font-bold">
                    {regPresent > 0 ? regPresent.toFixed(2) : '-'}
                  </td>
                  <td className="border border-black text-center font-bold">
                    {regWeeklyOff > 0 ? regWeeklyOff.toFixed(2) : '-'}
                  </td>
                  <td className="border border-black text-center font-bold">
                    {regHd > 0 ? regHd.toFixed(2) : '-'}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold align-middle">
                    {totalDays > 0 ? totalDays.toFixed(2) : '-'}
                  </td>
                </tr>

                {/* Employee Row 2 (Extra Shift / Overtime) */}
                <tr className="h-4">
                  {dayIndices.map((dIdx) => {
                    const ot = (otShifts[dIdx] || '').toUpperCase().trim();
                    let colorClass = 'text-black';
                    if (ot === 'A') colorClass = 'text-red-600';
                    if (ot === 'W/O' || ot === 'WO') colorClass = 'text-blue-700 bg-blue-50/50';

                    return (
                      <td key={dIdx} className={`border border-black text-center text-[6px] font-bold ${colorClass}`}>
                        {ot || '\u00A0'}
                      </td>
                    );
                  })}
                  <td className="border border-black text-center font-bold">
                    {otPresent > 0 ? otPresent.toFixed(2) : '-'}
                  </td>
                  <td className="border border-black text-center font-bold">-</td>
                  <td className="border border-black text-center font-bold">-</td>
                </tr>
              </React.Fragment>
            );
          })}

          {/* Bottom Summary Row 1: WEEKLY OFF */}
          <tr className="font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              WEEKLY OFF
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold">
                {dailyWeeklyOffCount[dIdx] || 0}
              </td>
            ))}
            {/* 4 separate columns matching the header layout */}
            <td className="border border-black text-center font-bold">{sumPresentTotal.toFixed(2)}</td>
            <td className="border border-black text-center font-bold">{sumWeeklyOffTotal.toFixed(2)}</td>
            <td className="border border-black text-center font-bold">-</td>
            <td className="border border-black text-center font-bold">{sumTotalStrengthTotal.toFixed(2)}</td>
          </tr>

          {/* Bottom Summary Row 2: PRESENT STRENGTH */}
          <tr className="font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              PRESENT STRENGTH
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold text-red-600">
                {dailyPresentCount[dIdx] || 0}
              </td>
            ))}
            {/* Total Present Strength, then GOOD DAY merged cell */}
            <td className="border border-black text-center font-bold text-red-600">{sumPresentTotal.toFixed(2)}</td>
            <td colSpan={3} rowSpan={2} className="border border-black text-center font-bold align-middle uppercase tracking-wide">
              Good Day
            </td>
          </tr>

          {/* Bottom Summary Row 3: TOTAL STRENGTH */}
          <tr className="font-bold">
            <td colSpan={4} className="border border-black text-right font-bold pr-1">
              TOTAL STRENGTH
            </td>
            {dayIndices.map((dIdx) => (
              <td key={dIdx} className="border border-black text-center font-bold">
                {dailyTotalStrength[dIdx] || 0}
              </td>
            ))}
            {/* Final Total Strength cell (GOOD DAY takes up the remaining space) */}
            <td className="border border-black text-center font-bold">{sumTotalStrengthTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Bottom Summary Tables */}
      <div className="flex justify-between items-start mt-6 text-[8px]">
        {/* Left Legend Table */}
        <table className="border-collapse border border-black w-48 text-left uppercase">
          <tbody>
            <tr>
              <td className="border border-black font-bold p-1 w-8 text-center">N/J</td>
              <td className="border border-black font-bold p-1">NEW JOINING</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1 text-center">W/O</td>
              <td className="border border-black font-bold p-1">WEEKLY OFF</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1 text-red-600 text-center">HD</td>
              <td className="border border-black font-bold p-1 text-red-600">HOLI, LABOUR DAY</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1 text-center">H/F</td>
              <td className="border border-black font-bold p-1">IN BIOMETRIC MISSING</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1 text-center">H/F</td>
              <td className="border border-black font-bold p-1">OUT BIOMETRIC MISSING</td>
            </tr>
            <tr>
              <td className="border border-black font-bold p-1 text-center"></td>
              <td className="border border-black font-bold p-1">IN &amp; OUT BIOMETRIC MISSING</td>
            </tr>
          </tbody>
        </table>

        {/* Right Calculation Table */}
        <table className="border-collapse border border-black w-80 text-center font-bold">
          <tbody>
            <tr>
              <td colSpan={3} className="border border-black p-1 text-center">
                JANITORS
              </td>
              <td className="border border-black p-1">
                {sumTotalStrengthTotal.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-left pl-2">Monthly Approved Manpower</td>
              <td className="border border-black p-1">{data.summary?.approvedManpower || 5}</td>
              <td className="border border-black p-1">{daysCount}</td>
              <td className="border border-black p-1">
                {((data.summary?.approvedManpower || 5) * daysCount).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-1 text-red-600 text-left pl-2">
                (Excess)/Shortage Manpower
              </td>
              <td className="border border-black p-1">
                {(((data.summary?.approvedManpower || 5) * daysCount) - sumTotalStrengthTotal).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-1 text-left pl-2">Monthly %</td>
              <td className="border border-black p-1">
                {(((sumTotalStrengthTotal / ((data.summary?.approvedManpower || 5) * daysCount)) * 100) || 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
