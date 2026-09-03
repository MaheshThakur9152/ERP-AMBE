import ExcelJS from 'exceljs';

export interface EmployeeAttendancePreview {
  code: string;
  name: string;
  dailyHours: number[];
  dailyStatus: ('P' | 'A')[];
  dailyInTime: (string | null)[];
  dailyOutTime: (string | null)[];
  dailyDuration: (string | null)[];
  presentDays: number;
  absentDays: number;
}

export function getSafeCellText(cell: ExcelJS.Cell | undefined | null): string {
  try {
    if (!cell) return '';
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') {
      if ('text' in val && typeof (val as any).text === 'string') return (val as any).text;
      if ('result' in val && (val as any).result !== undefined && (val as any).result !== null) {
        return String((val as any).result);
      }
      if ('richText' in val && Array.isArray((val as any).richText)) {
        return (val as any).richText.map((t: any) => t.text || '').join('');
      }
    }
    return String(val);
  } catch {
    return '';
  }
}

export function parseTimeCell(val: any): string | null {
  if (val === null || val === undefined) return null;

  const str = typeof val === 'string' ? val : (typeof val === 'object' && 'value' in val ? getSafeCellText(val) : String(val));
  const trimmed = str.trim();
  if (!trimmed || trimmed === '-' || trimmed === '0' || trimmed === '00:00:00' || trimmed === '00:00') return null;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const hours = parts[0].padStart(2, '0');
    const minutes = (parts[1] || '00').slice(0, 2).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  if (val instanceof Date) {
    const hours = String(val.getUTCHours()).padStart(2, '0');
    const minutes = String(val.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    if (val < 1.0) {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const minutes = String(totalMinutes % 60).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return String(val);
  }

  return trimmed;
}

export function parseDurationCell(val: any): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-' || trimmed === '0' || trimmed === '00:00') return 0;

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return Number((hours + minutes / 60).toFixed(2));
    }

    const parsedNum = parseFloat(trimmed);
    return isNaN(parsedNum) ? 0 : Number(parsedNum.toFixed(2));
  }

  if (val instanceof Date) {
    const hours = val.getUTCHours();
    const minutes = val.getUTCMinutes();
    return Number((hours + minutes / 60).toFixed(2));
  }

  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    if (val > 0 && val < 1.0) {
      return Number((val * 24).toFixed(2));
    }
    return Number(val.toFixed(2));
  }

  if (typeof val === 'object') {
    if (val.result !== undefined && val.result !== null) return parseDurationCell(val.result);
    if (val.text) return parseDurationCell(val.text);
    if ('value' in val) return parseDurationCell(getSafeCellText(val));
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
    const dayDurationMap = new Map<number, string | null>();
    const dayInTimeMap = new Map<number, string | null>();
    const dayOutTimeMap = new Map<number, string | null>();
    let hasDurationRow = false;

    // Pass 1: Extract header info and identify "Days" row column mappings
    worksheet.eachRow((row) => {
      const firstCellText = getSafeCellText(row.getCell(1)).trim();

      if (/^Employee\s*:/i.test(firstCellText)) {
        const extracted = extractEmployeeHeader(firstCellText);
        employeeCode = extracted.code;
        employeeName = extracted.name;
      }

      if (firstCellText.toLowerCase() === 'days') {
        // Read each column from B onward to detect real day numbers
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (colNumber < 2) return;
          const cellStr = getSafeCellText(cell).trim();
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

    // Pass 2: Extract Duration, In Time, Out Time and map values via colToDayMap
    worksheet.eachRow((row) => {
      const firstCellText = getSafeCellText(row.getCell(1)).trim();

      if (/^(duration|work\s*duration|total\s*duration|total\s*hours?)$/i.test(firstCellText)) {
        hasDurationRow = true;
        for (const [colIdx, dayNum] of colToDayMap.entries()) {
          const raw = getSafeCellText(row.getCell(colIdx)).trim();
          const decimal = parseDurationCell(raw);
          dayHoursMap.set(dayNum, decimal);

          // Retain exact duration as given in the Excel without decimal calculation
          let exactDuration: string | null = null;
          if (raw && raw !== '-' && raw !== '0' && raw !== '00:00') {
            exactDuration = raw;
          }
          dayDurationMap.set(dayNum, exactDuration);
        }
      } else if (/^(in\s*time|intime|in|punch\s*in|first\s*in)$/i.test(firstCellText)) {
        for (const [colIdx, dayNum] of colToDayMap.entries()) {
          const raw = getSafeCellText(row.getCell(colIdx));
          const timeStr = parseTimeCell(raw);
          dayInTimeMap.set(dayNum, timeStr);
        }
      } else if (/^(out\s*time|outtime|out|punch\s*out|last\s*out)$/i.test(firstCellText)) {
        for (const [colIdx, dayNum] of colToDayMap.entries()) {
          const raw = getSafeCellText(row.getCell(colIdx));
          const timeStr = parseTimeCell(raw);
          dayOutTimeMap.set(dayNum, timeStr);
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
      const dailyDuration: (string | null)[] = [];
      const dailyInTime: (string | null)[] = [];
      const dailyOutTime: (string | null)[] = [];
      for (let day = 1; day <= 31; day++) {
        dailyHours.push(dayHoursMap.get(day) ?? 0);
        dailyDuration.push(dayDurationMap.get(day) ?? null);
        dailyInTime.push(dayInTimeMap.get(day) ?? null);
        dailyOutTime.push(dayOutTimeMap.get(day) ?? null);
      }

      const dailyStatus: ('P' | 'A')[] = dailyHours.map((h) => (h >= thresholdHours ? 'P' : 'A'));
      const presentDays = dailyStatus.filter((s) => s === 'P').length;
      const absentDays = dailyStatus.filter((s) => s === 'A').length;

      results.push({
        code: employeeCode || `EMP-${worksheet.id}`,
        name: employeeName || worksheet.name,
        dailyHours,
        dailyStatus,
        dailyInTime,
        dailyOutTime,
        dailyDuration,
        presentDays,
        absentDays,
      });
    }
  });

  return results;
}
