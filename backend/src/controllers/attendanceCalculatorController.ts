import { Request, Response } from 'express';
import { parseAttendanceDurationExcel } from '../services/attendanceDurationParser';
import { pool, withTransaction } from '../db/pool';

export class AttendanceCalculatorController {
  /**
   * POST /api/attendance-calculator/preview
   * Uploads Excel file, parses Duration rows, matches staff by biometric_code ACROSS ALL SITES.
   */
  static async preview(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No Excel file uploaded. Please upload a .xlsx file.' });
        return;
      }

      const thresholdParam = req.query.thresholdHours || req.body.thresholdHours;
      const thresholdHours = thresholdParam !== undefined && thresholdParam !== null && thresholdParam !== ''
        ? parseFloat(String(thresholdParam))
        : 8.0;

      if (isNaN(thresholdHours) || thresholdHours < 0) {
        res.status(400).json({ error: 'Invalid thresholdHours. Must be a positive number.' });
        return;
      }

      const month = Number(req.query.month || req.body.month || 0);
      const year = Number(req.query.year || req.body.year || 0);

      // 1. Parse workbook
      const parsedEmployees = await parseAttendanceDurationExcel(req.file.buffer, thresholdHours);

      // 2. Fresh query of ALL staff from database with joined sites
      const staffRes = await pool.query(`
        SELECT s.id, s.employee_name, s.biometric_code, s.designation, s.weekly_off, s.site_id,
               json_build_object('id', st.id, 'site_name', st.site_name, 'client_name', st.client_name, 'code_name', st.code_name, 'company_id', st.company_id) AS sites
        FROM public.staff s
        LEFT JOIN public.sites st ON st.id = s.site_id;
      `);

      const staffList = staffRes.rows || [];

      console.log(`[AttendanceCalculator:preview] Total parsed Excel sheets: ${parsedEmployees.length}, Total staff fetched from DB: ${staffList.length}`);

      const matched: any[] = [];
      const unmatched: any[] = [];

      for (const emp of parsedEmployees) {
        const normalizedExcelCode = String(emp.code ?? '').trim();
        const strippedExcelCode = normalizedExcelCode.replace(/^0+/, '');

        // Exact match with fallback to stripped leading zeroes
        const matchedStaff = staffList.find((s) => {
          const staffCode = String(s.biometric_code ?? '').trim();
          if (!staffCode) return false;
          const strippedStaffCode = staffCode.replace(/^0+/, '');
          return (
            staffCode === normalizedExcelCode ||
            strippedStaffCode === strippedExcelCode ||
            staffCode.toLowerCase() === normalizedExcelCode.toLowerCase()
          );
        });

        if (matchedStaff) {
          const siteObj = matchedStaff.sites;
          const resolvedSiteName =
            siteObj?.site_name ||
            siteObj?.client_name ||
            siteObj?.code_name ||
            (matchedStaff.site_id ? 'Assigned Site' : 'Unassigned Site');

          matched.push({
            ...emp,
            staffId: matchedStaff.id,
            siteId: matchedStaff.site_id || null,
            siteName: resolvedSiteName,
            matchedStaffName: matchedStaff.employee_name || emp.name,
            role: matchedStaff.designation || 'Staff',
            weeklyOff: matchedStaff.weekly_off || 'SUN',
            isMatched: true,
          });
        } else {
          unmatched.push({
            ...emp,
            staffId: null,
            siteId: null,
            siteName: null,
            isMatched: false,
          });
        }
      }

      res.status(200).json({
        success: true,
        count: parsedEmployees.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        thresholdHours,
        month,
        year,
        matched,
        unmatched,
      });
    } catch (error: any) {
      console.error('❌ Attendance Calculator Preview error:', error);
      res.status(500).json({
        error: 'Failed to process Excel file',
        message: error.message || 'Unknown parsing error occurred',
      });
    }
  }

  /**
   * POST /api/attendance-calculator/commit
   * Saves matched attendance records into PostgreSQL attendance_records and attendance_sheets.
   */
  static async commit(req: Request, res: Response): Promise<void> {
    try {
      const { month, year, records, thresholdHours = 8.0 } = req.body;

      if (!month || !year) {
        res.status(400).json({ error: 'month and year are required.' });
        return;
      }
      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: 'No matched attendance records provided to save.' });
        return;
      }

      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const staffIds: string[] = [];
      const attendanceRecordRows: any[] = [];
      const recordsBySite = new Map<string, any[]>();

      // Fetch fresh weekly_off from staff table for exact day comparison
      const rawStaffIds = records.map((r: any) => r.staffId).filter(Boolean);
      const staffRes = await pool.query(
        'SELECT id, weekly_off FROM public.staff WHERE id = ANY($1::uuid[]);',
        [rawStaffIds]
      );
      const staffWeeklyOffMap = new Map((staffRes.rows || []).map((s: any) => [s.id, s.weekly_off || 'Sunday']));

      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      for (const emp of records) {
        if (!emp.staffId || !emp.siteId) continue;

        staffIds.push(emp.staffId);
        const wOff = staffWeeklyOffMap.get(emp.staffId) || emp.weeklyOff || emp.weekly_off || 'Sunday';

        // Group by site
        if (!recordsBySite.has(emp.siteId)) {
          recordsBySite.set(emp.siteId, []);
        }
        recordsBySite.get(emp.siteId)!.push(emp);

        // Build individual daily attendance records
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayDate = new Date(Number(year), Number(month) - 1, d);
          const dayName = DAY_NAMES[dayDate.getDay()];
          const offDays = (wOff || '').toLowerCase().split(/[,/&]+/).map((s: string) => s.trim());
          const isWeeklyOff = Boolean(wOff && wOff !== 'None' && offDays.includes(dayName.toLowerCase()));

          const rawStatus = emp.dailyStatus?.[d - 1] || 'A';
          const inTime = emp.dailyInTime?.[d - 1] || null;
          const outTime = emp.dailyOutTime?.[d - 1] || null;
          const durationHours = emp.dailyHours?.[d - 1] !== undefined ? Number(emp.dailyHours[d - 1]) : 0;
          const duration = emp.dailyDurationText?.[d - 1] || null;

          let status = rawStatus;
          if (rawStatus === 'P') {
            status = 'P';
          } else if (rawStatus === 'WO' || rawStatus === 'W/O') {
            status = 'W/O';
          } else if (isWeeklyOff) {
            status = 'W/O';
          } else if (rawStatus === 'A') {
            status = 'A';
          }

          attendanceRecordRows.push({
            staff_id: emp.staffId,
            site_id: emp.siteId,
            record_date: dateStr,
            shift_type: 'Day',
            status,
            in_time: inTime,
            out_time: outTime,
            duration_hours: durationHours,
            duration,
          });
        }
      }

      const uniqueStaffIds = Array.from(new Set(staffIds));

      // 1. Transactional PostgreSQL atomic save
      await withTransaction(async (client) => {
        // Delete previous daily records for these staff in this month window
        await client.query(
          `DELETE FROM public.attendance_records
           WHERE staff_id = ANY($1::uuid[])
             AND record_date >= $2::date
             AND record_date <= $3::date;`,
          [uniqueStaffIds, startDateStr, endDateStr]
        );

        // Batch insert attendance records
        for (const row of attendanceRecordRows) {
          await client.query(
            `INSERT INTO public.attendance_records
              (staff_id, site_id, record_date, shift_type, status, in_time, out_time, duration_hours, duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (staff_id, record_date)
             DO UPDATE SET
               site_id = EXCLUDED.site_id,
               status = EXCLUDED.status,
               in_time = EXCLUDED.in_time,
               out_time = EXCLUDED.out_time,
               duration_hours = EXCLUDED.duration_hours,
               duration = EXCLUDED.duration;`,
            [
              row.staff_id,
              row.site_id,
              row.record_date,
              row.shift_type,
              row.status,
              row.in_time,
              row.out_time,
              row.duration_hours,
              row.duration,
            ]
          );
        }

        // Upsert attendance_sheets entry for each affected site
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[Number(month) - 1] || String(month);
        const monthYearStr = `${monthName} ${year}`;

        for (const [siteId, siteEmployees] of recordsBySite.entries()) {
          const summaryObj = {
            totalEmployees: siteEmployees.length,
            thresholdHours,
            savedAt: new Date().toISOString(),
          };

          await client.query(
            `INSERT INTO public.attendance_sheets (site_id, month_year, summary, records, status, updated_at, created_at)
             VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               summary = EXCLUDED.summary,
               records = EXCLUDED.records,
               updated_at = NOW();`,
            [siteId, monthYearStr, JSON.stringify(summaryObj), JSON.stringify(siteEmployees)]
          );
        }
      });

      console.log(`✅ [attendance-calculator:save] Successfully saved ${uniqueStaffIds.length} staff (${attendanceRecordRows.length} daily rows) across ${recordsBySite.size} site(s).`);

      res.status(200).json({
        success: true,
        message: `Successfully saved ${uniqueStaffIds.length} employees (${attendanceRecordRows.length} daily records across ${recordsBySite.size} site(s)) to Attendance Grid.`,
        savedEmployeesCount: uniqueStaffIds.length,
        savedDaysCount: attendanceRecordRows.length,
        savedSitesCount: recordsBySite.size,
        month,
        year,
      });
    } catch (error: any) {
      console.error('❌ Attendance Calculator save error:', error);
      res.status(500).json({
        error: 'Failed to save attendance records',
        message: error.message || 'Unknown error occurred while saving attendance records',
      });
    }
  }

  static save = AttendanceCalculatorController.commit;
}
