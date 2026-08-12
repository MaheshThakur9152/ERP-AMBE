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

export const AttendanceTemplate: React.FC<AttendanceTemplateProps> = ({ data }) => {
  const daysCount = data.daysCount || 31;
  const monthStr = (data.month || 'AUGUST').toString();
  const yearNum = data.year || 2026;
  const monthYear = `${monthStr.toUpperCase()} ${yearNum}`;
  const siteName = (data.siteName || 'ALL SITES').toUpperCase();
  const dayIndices = Array.from({ length: daysCount }, (_, i) => i);

  // Dynamically calculate correct days of the week for the given month/year
  const daysOfWeek = React.useMemo(() => {
    if (data.daysOfWeek && data.daysOfWeek.length > 0) return data.daysOfWeek;
    const days: string[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let mIndex = 7; // Default August (0-indexed 7)
    if (typeof data.month === 'number') {
      mIndex = data.month - 1;
    } else if (typeof data.month === 'string') {
      const parsed = Date.parse(`${monthStr} 1, ${yearNum}`);
      if (!isNaN(parsed)) {
        mIndex = new Date(parsed).getMonth();
      }
    }

    const numericYear = typeof yearNum === 'number' ? yearNum : parseInt(String(yearNum), 10) || 2026;

    for (let i = 0; i < daysCount; i++) {
      const dObj = new Date(numericYear, mIndex, i + 1);
      days.push(dayNames[dObj.getDay()]);
    }
    return days;
  }, [data.daysOfWeek, monthStr, yearNum, daysCount]);

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
        <colgroup>
          <col style={{ width: '2.5%' }} />
          <col style={{ width: '3%' }} />
          <col style={{ width: '16.5%' }} />
          <col style={{ width: '3%' }} />
          {dayIndices.map((d) => (
            <col key={d} style={{ width: '2%' }} />
          ))}
          <col style={{ width: '3.5%' }} />
          <col style={{ width: '3%' }} />
          <col style={{ width: '2.5%' }} />
          <col style={{ width: '4%' }} />
        </colgroup>
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
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                SR
              </div>
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                Biometric Code
              </div>
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[11px] font-extrabold text-center align-middle uppercase"
            >
              Employee Name
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                Weekly Off
              </div>
            </th>

            {dayIndices.map((dayIdx) => (
              <th key={dayIdx + 1} className="border border-black text-[9px] font-extrabold text-center">
                {dayIdx + 1}
              </th>
            ))}

            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                TOTAL PRESENT DAYS
              </div>
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                WEEKLY OFF
              </div>
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                HD
              </div>
            </th>
            <th
              rowSpan={2}
              className="border border-black text-[10px] font-extrabold text-center align-middle uppercase"
            >
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                TOTAL DAYS
              </div>
            </th>
          </tr>

          {/* Column Header Row 2 (Day Names) */}
          <tr>
            {dayIndices.map((dayIdx) => (
              <th
                key={dayIdx}
                className="border border-black h-16 text-[7.5px] uppercase tracking-[0.1em] text-center font-bold align-middle"
              >
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto' }}>
                  {daysOfWeek[dayIdx] || 'Sunday'}
                </div>
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
                <tr className="h-8">
                  <td rowSpan={2} className="border border-black text-center font-bold text-[10px]">
                    {idx + 1}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold text-[9px]">
                    {emp.biometricCode}
                  </td>
                  <td rowSpan={2} className="border border-black font-extrabold text-[11px] uppercase text-center align-middle whitespace-nowrap">
                    {emp.employeeName}
                  </td>
                  <td rowSpan={2} className="border border-black text-center font-bold text-[9px] uppercase">
                    {emp.weeklyOff}
                  </td>

                  {dayIndices.map((dIdx) => {
                    const st = (regShifts[dIdx] || '').toUpperCase().trim();
                    let colorClass = 'text-black font-extrabold';
                    if (st === 'A') colorClass = 'text-red-600 font-extrabold';
                    if (st === 'W/O' || st === 'WO') colorClass = 'text-blue-900 bg-gray-200 font-extrabold';

                    return (
                      <td key={dIdx} className={`border border-black text-center align-middle ${colorClass}`}>
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
                <tr className="h-6">
                  {dayIndices.map((dIdx) => {
                    const ot = (otShifts[dIdx] || '').toUpperCase().trim();
                    let colorClass = 'text-black font-extrabold';
                    if (ot === 'A') colorClass = 'text-red-600 font-extrabold';
                    if (ot === 'W/O' || ot === 'WO') colorClass = 'text-blue-900 bg-gray-200 font-extrabold';

                    return (
                      <td key={dIdx} className={`border border-black text-center text-[6px] align-middle ${colorClass}`}>
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
            <td colSpan={4} className="border border-black text-right font-extrabold text-[9px] pr-1">
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
            <td colSpan={4} className="border border-black text-right font-extrabold text-[9px] pr-1">
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
            <td colSpan={4} className="border border-black text-right font-extrabold text-[9px] pr-1">
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
        <table className="border-collapse border border-black w-48 text-left uppercase text-[9px]">
          <tbody>
            <tr>
              <td className="border border-black font-extrabold p-2 w-10 text-center">N/J</td>
              <td className="border border-black font-extrabold p-2">NEW JOINING</td>
            </tr>
            <tr>
              <td className="border border-black font-extrabold p-2 text-center">W/O</td>
              <td className="border border-black font-extrabold p-2">WEEKLY OFF</td>
            </tr>
            <tr>
              <td className="border border-black font-extrabold p-2 text-red-600 text-center">HD</td>
              <td className="border border-black font-extrabold p-2 text-red-600">HOLI, LABOUR DAY</td>
            </tr>
            <tr>
              <td className="border border-black font-extrabold p-2 text-center">H/F</td>
              <td className="border border-black font-extrabold p-2">IN BIOMETRIC MISSING</td>
            </tr>
            <tr>
              <td className="border border-black font-extrabold p-2 text-center">H/F</td>
              <td className="border border-black font-extrabold p-2">OUT BIOMETRIC MISSING</td>
            </tr>
            <tr>
              <td className="border border-black font-extrabold p-2 text-center"></td>
              <td className="border border-black font-extrabold p-2">IN &amp; OUT BIOMETRIC MISSING</td>
            </tr>
          </tbody>
        </table>

        {/* Right Calculation Table */}
        <table className="border-collapse border border-black w-80 text-center font-extrabold">
          <tbody>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">
                JANITORS
              </td>
              <td className="border border-black p-2">
                {sumTotalStrengthTotal.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-2 text-left pl-2">Monthly Approved Manpower</td>
              <td className="border border-black p-2">{data.summary?.approvedManpower || 5}</td>
              <td className="border border-black p-2">{daysCount}</td>
              <td className="border border-black p-2">
                {((data.summary?.approvedManpower || 5) * daysCount).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-red-600 text-left pl-2">
                (Excess)/Shortage Manpower
              </td>
              <td className="border border-black p-2">
                {(((data.summary?.approvedManpower || 5) * daysCount) - sumTotalStrengthTotal).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-left pl-2">Monthly %</td>
              <td className="border border-black p-2">
                {(((sumTotalStrengthTotal / ((data.summary?.approvedManpower || 5) * daysCount)) * 100) || 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
