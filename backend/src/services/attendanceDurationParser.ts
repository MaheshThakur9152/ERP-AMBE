import ExcelJS from 'exceljs';

export interface EmployeeAttendancePreview {
  code: string;
  name: string;
  dailyHours: number[];
  dailyStatus: ('P' | 'A')[];
  presentDays: number;
  absentDays: number;
}

export function parseDurationCell(val: any): number {
  if (val === null || val === undefined) return 0;

  // If string, handle "H:MM", "HH:MM", "00:00", or numeric string
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === '0') return 0;

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return Number((hours + minutes / 60).toFixed(3));
    }

    const parsedNum = parseFloat(trimmed);
    return isNaN(parsedNum) ? 0 : Number(parsedNum.toFixed(3));
  }

  // If Date object (Excel sometimes formats time as Date)
  if (val instanceof Date) {
    const hours = val.getUTCHours();
    const minutes = val.getUTCMinutes();
    return Number((hours + minutes / 60).toFixed(3));
  }

  // If number (e.g. 0.375 = 9 hours as Excel fraction of day, or raw hours)
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    // If fractional day (< 1.0) and > 0, likely day fraction
    if (val > 0 && val < 1.0) {
      return Number((val * 24).toFixed(3));
    }
    return Number(val.toFixed(3));
  }

  // If object with text or result (Formula result)
  if (typeof val === 'object') {
    if (val.text) return parseDurationCell(val.text);
    if (val.result !== undefined) return parseDurationCell(val.result);
  }

  return 0;
}

export function extractEmployeeHeader(text: string): { code: string; name: string } {
  const clean = text.replace(/\s+/g, ' ').trim();

  // Pattern: "Employee: 20079 : VINOD PAWAR Total Work Duration:..."
  const match = clean.match(/Employee\s*:\s*([0-9A-Za-z_-]+)\s*:\s*([^:]+?)(?:\s+Total\s+Work|\s+Present:|$)/i);
  if (match) {
    return {
      code: match[1].trim(),
      name: match[2].trim(),
    };
  }

  // Fallback splitting by colon
  const parts = clean.split(':');
  if (parts.length >= 3) {
    const code = parts[1].replace(/[^\w-]/g, '').trim();
    const namePart = parts[2].split(/Total Work Duration|Present:/i)[0].trim();
    return { code: code || 'UNKNOWN', name: namePart || 'UNKNOWN' };
  }

  return { code: 'UNKNOWN', name: clean || 'UNKNOWN' };
}

export async function parseAttendanceDurationExcel(
  fileBuffer: Buffer,
  thresholdHours: number = 8.0
): Promise<EmployeeAttendancePreview[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const results: EmployeeAttendancePreview[] = [];

  workbook.eachSheet((worksheet) => {
    let employeeCode = '';
    let employeeName = '';
    const colToDayMap = new Map<number, number>();
    const dayHoursMap = new Map<number, number>();
    let hasDurationRow = false;

    // Pass 1: Extract header info and identify "Days" row column mappings
    worksheet.eachRow((row) => {
      const firstCellText = (row.getCell(1).text || String(row.getCell(1).value || '')).trim();

      if (/^Employee\s*:/i.test(firstCellText)) {
        const extracted = extractEmployeeHeader(firstCellText);
        employeeCode = extracted.code;
        employeeName = extracted.name;
      }

      if (firstCellText.toLowerCase() === 'days') {
        // Read each column from B onward to detect real day numbers
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (colNumber < 2) return;
          const cellStr = (cell.text || String(cell.value || '')).trim();
          // Extract leading digits: e.g. "1 St" -> 1, "6 Th" -> 6, "31 M" -> 31
          const match = cellStr.match(/^(\d{1,2})/);
          if (match) {
            const dayNum = parseInt(match[1], 10);
            if (dayNum >= 1 && dayNum <= 31) {
              colToDayMap.set(colNumber, dayNum);
            }
          }
        });
      }
    });

    // Fallback: If no "Days" row found, default col 2..32 -> day 1..31
    if (colToDayMap.size === 0) {
      for (let c = 2; c <= 32; c++) {
        colToDayMap.set(c, c - 1);
      }
    }

    // Pass 2: Extract Duration and map values via colToDayMap
    worksheet.eachRow((row) => {
      const firstCellText = (row.getCell(1).text || String(row.getCell(1).value || '')).trim();

      if (firstCellText.toLowerCase() === 'duration') {
        hasDurationRow = true;
        for (const [colIdx, dayNum] of colToDayMap.entries()) {
          const cell = row.getCell(colIdx);
          const cellRaw = cell.text ? cell.text : cell.value;
          const decimal = parseDurationCell(cellRaw);
          dayHoursMap.set(dayNum, decimal);
        }
      }
    });

    // Assertion / Diagnostic log
    const detectedDaysCount = colToDayMap.size;
    if (detectedDaysCount < 28 || detectedDaysCount > 31) {
      console.warn(
        `[attendanceDurationParser] Sheet "${worksheet.name}" (Emp ${employeeCode || 'Unknown'} - ${employeeName || 'Unknown'}): mapped ${detectedDaysCount} days from "Days" row.`
      );
    }

    // Only add if we found employee info or duration row
    if (employeeCode || employeeName || hasDurationRow) {
      // Build exactly 31-day array using day-number lookup (Day 1..31)
      const dailyHours: number[] = [];
      for (let day = 1; day <= 31; day++) {
        dailyHours.push(dayHoursMap.get(day) ?? 0);
      }

      const dailyStatus: ('P' | 'A')[] = dailyHours.map((h) => (h >= thresholdHours ? 'P' : 'A'));
      const presentDays = dailyStatus.filter((s) => s === 'P').length;
      const absentDays = dailyStatus.filter((s) => s === 'A').length;

      results.push({
        code: employeeCode || `EMP-${worksheet.id}`,
        name: employeeName || worksheet.name,
        dailyHours,
        dailyStatus,
        presentDays,
        absentDays,
      });
    }
  });

  return results;
}
