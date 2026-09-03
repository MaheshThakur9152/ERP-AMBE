import { Request, Response } from 'express';
import { parseAttendanceDurationExcel } from '../services/attendanceDurationParser';
import { supabaseAdmin } from '../config/supabase';

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
      const { data: dbStaff, error: staffError } = await supabaseAdmin
        .from('staff')
        .select('id, employee_name, biometric_code, designation, weekly_off, site_id, sites(id, site_name, client_name, code_name, company_id)');

      if (staffError) {
        console.error('❌ Error querying staff for biometric matching:', staffError.message);
      }

      const staffList = dbStaff || [];

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
          const siteObj = Array.isArray(matchedStaff.sites) ? matchedStaff.sites[0] : matchedStaff.sites;
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
        data: matched,
        debugStaffList: staffList.map((s) => ({
          id: s.id,
          employee_name: s.employee_name,
          biometric_code: s.biometric_code,
          site_id: s.site_id,
        })),
        staffError: staffError ? staffError.message : null,
      });
    } catch (error: any) {
      console.error('❌ Attendance Calculator preview error:', error);
      res.status(500).json({
        error: 'Failed to parse Excel file',
        message: error.message || 'Unknown error occurred while processing workbook',
      });
    }
  }

  /**
   * POST /api/attendance-calculator/save
   * Saves calculated attendance records to attendance_records (per-day rows) grouped by resolved site_id.
   */
  static async save(req: Request, res: Response): Promise<void> {
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
      const { data: staffData } = await supabaseAdmin
        .from('staff')
        .select('id, weekly_off')
        .in('id', rawStaffIds);
      const staffWeeklyOffMap = new Map((staffData || []).map((s: any) => [s.id, s.weekly_off || 'Sunday']));

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
          const duration = emp.dailyDuration?.[d - 1] || (durationHours > 0 ? `${durationHours}h` : null);

          let finalStatus = rawStatus;
          let shiftType = 'regular';

          if (isWeeklyOff) {
            if (rawStatus === 'P') {
              finalStatus = 'WOP';
              shiftType = 'overtime';
            } else {
              finalStatus = 'W/O';
            }
          } else {
            finalStatus = rawStatus === 'P' ? 'P' : 'A';
          }

          attendanceRecordRows.push({
            staff_id: emp.staffId,
            site_id: emp.siteId,
            record_date: dateStr,
            shift_type: shiftType,
            status: finalStatus,
            in_time: inTime,
            out_time: outTime,
            duration_hours: durationHours,
            duration: duration,
          });
        }
      }

      if (attendanceRecordRows.length === 0) {
        res.status(400).json({
          error: 'No valid matched staff with site assignments found in records to save.',
        });
        return;
      }

      // 1. Delete existing daily records for these staff members within this month range
      const uniqueStaffIds = Array.from(new Set(staffIds));
      const { error: deleteErr } = await supabaseAdmin
        .from('attendance_records')
        .delete()
        .in('staff_id', uniqueStaffIds)
        .gte('record_date', startDateStr)
        .lte('record_date', endDateStr);

      if (deleteErr) {
        console.warn('⚠️ Warning during attendance_records delete cleanup:', deleteErr.message);
      }

      // 2. Insert fresh per-day rows in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < attendanceRecordRows.length; i += CHUNK_SIZE) {
        const chunk = attendanceRecordRows.slice(i, i + CHUNK_SIZE);
        const { error: insertErr } = await supabaseAdmin
          .from('attendance_records')
          .insert(chunk);

        if (insertErr) {
          console.error('❌ Error inserting attendance_records chunk:', insertErr);
          throw new Error(`Failed to save attendance_records: ${insertErr.message}`);
        }
      }

      // 3. Upsert attendance_sheets entry for each affected site (summary store)
      for (const [siteId, siteEmployees] of recordsBySite.entries()) {
        try {
          const { data: siteData } = await supabaseAdmin
            .from('sites')
            .select('id, site_name, company_id')
            .eq('id', siteId)
            .maybeSingle();

          const siteName = siteData?.site_name || 'Site';
          const companyId = siteData?.company_id || (req.user as any)?.company_id || null;

          const { data: existingSheet } = await supabaseAdmin
            .from('attendance_sheets')
            .select('id')
            .eq('site_id', siteId)
            .eq('month', String(month))
            .eq('year', String(year))
            .maybeSingle();

          const sheetPayload = {
            site_id: siteId,
            company_id: companyId,
            site_name: siteName,
            month: String(month),
            year: String(year),
            records: siteEmployees,
            summary: {
              totalEmployees: siteEmployees.length,
              thresholdHours,
              savedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          };

          if (existingSheet?.id) {
            await supabaseAdmin
              .from('attendance_sheets')
              .update(sheetPayload)
              .eq('id', existingSheet.id);
          } else {
            await supabaseAdmin
              .from('attendance_sheets')
              .insert([{ ...sheetPayload, created_at: new Date().toISOString() }]);
          }
        } catch (sheetErr: any) {
          console.warn(`⚠️ Warning syncing attendance_sheets for site ${siteId}:`, sheetErr.message);
        }
      }

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
}
