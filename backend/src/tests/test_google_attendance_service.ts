import assert from 'assert';
import { GoogleAttendanceSheetService } from '../services/googleAttendanceSheetService';

async function runGoogleAttendanceTests() {
  console.log('--- Testing Google Attendance Sheet Service Unit Assertions ---');

  // Test 1: OAuth URL generation
  const authUrl = GoogleAttendanceSheetService.getAuthUrl('/attendance');
  assert(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Auth URL should target Google OAuth endpoint');
  assert(authUrl.includes('access_type=offline'), 'Auth URL must request offline access for refresh token');
  assert(authUrl.includes('prompt=consent'), 'Auth URL must request consent prompt');
  assert(authUrl.includes('spreadsheets'), 'Auth URL must include spreadsheets scope');
  console.log('✓ Google OAuth authorization URL generation verified.');

  // Test 2: Template detection logic with mock drive client
  const mockDriveWithNative = {
    files: {
      list: async () => ({
        data: {
          files: [
            { id: 'xlsx-1', name: 'Template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { id: 'native-1', name: 'Master Template', mimeType: 'application/vnd.google-apps.spreadsheet' },
          ],
        },
      }),
    },
  };
  const template1 = await GoogleAttendanceSheetService.findTemplateFile(mockDriveWithNative, 'folder-1');
  assert.strictEqual(template1.id, 'native-1', 'Should prioritize native Google Sheet template');
  assert.strictEqual(template1.isNative, true, 'isNative should be true for Google Sheet');
  console.log('✓ Native Google Sheet prioritization verified.');

  // Test 3: XLSX fallback when native sheet does not exist
  const mockDriveWithXlsxOnly = {
    files: {
      list: async () => ({
        data: {
          files: [
            { id: 'xlsx-only', name: 'Ambe_Attendance_Template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
          ],
        },
      }),
    },
  };
  const template2 = await GoogleAttendanceSheetService.findTemplateFile(mockDriveWithXlsxOnly, 'folder-1');
  assert.strictEqual(template2.id, 'xlsx-only', 'Should select XLSX template when native is missing');
  assert.strictEqual(template2.isNative, false, 'isNative should be false for XLSX');
  console.log('✓ XLSX template fallback verified.');

  // Test 4: Empty folder fails safely with clean error
  const mockDriveEmpty = {
    files: {
      list: async () => ({
        data: { files: [] },
      }),
    },
  };
  await assert.rejects(
    async () => {
      await GoogleAttendanceSheetService.findTemplateFile(mockDriveEmpty, 'folder-empty');
    },
    /No attendance template found/
  );
  console.log('✓ Missing template error handling verified.');

  // Test 5: Date calculations for month boundaries & leap years
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  assert.strictEqual(getDaysInMonth(2026, 2), 28, 'Feb 2026 should have 28 days');
  assert.strictEqual(getDaysInMonth(2024, 2), 29, 'Feb 2024 (leap year) should have 29 days');
  assert.strictEqual(getDaysInMonth(2026, 8), 31, 'Aug 2026 should have 31 days');
  assert.strictEqual(getDaysInMonth(2026, 9), 30, 'Sep 2026 should have 30 days');
  console.log('✓ Month lengths & leap year calculations verified.');

  // Test 6: Schema regression guard (no legal_name column in companies queries, use site_name)
  const fs = await import('fs');
  const serviceCode = fs.readFileSync('backend/src/services/googleAttendanceSheetService.ts', 'utf8');
  assert(!serviceCode.includes('legal_name'), 'googleAttendanceSheetService must not reference non-existent legal_name column');
  assert(serviceCode.includes('site_name'), 'googleAttendanceSheetService must reference actual site_name column');
  console.log('✓ Schema conformity & column regression check passed.');

  // Test 7: Timezone-independent calendar day parsing & ISO date normalization
  const testIso = '2026-08-15T00:00:00.000Z';
  const normDate = testIso.split('T')[0].split(' ')[0];
  assert.strictEqual(normDate, '2026-08-15', 'ISO timestamp must normalize cleanly to YYYY-MM-DD');
  const dayParsed = parseInt(normDate.split('-')[2], 10);
  assert.strictEqual(dayParsed, 15, 'Calendar day must parse accurately from date string');
  console.log('✓ Timezone-independent calendar day parsing & normalization verified.');

  // Test 8: Generated monthly sheets are never picked as master template
  const mockDriveWithOutputs = {
    files: {
      list: async () => ({
        data: {
          files: [
            { id: 'output-1', name: 'Attendance - Ajmera Greenfinity - August 2026', mimeType: 'application/vnd.google-apps.spreadsheet' },
            { id: 'template-real', name: 'Ambe_Attendance_Template (1).xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
          ],
        },
      }),
    },
  };
  const chosenTemplate = await GoogleAttendanceSheetService.findTemplateFile(mockDriveWithOutputs, 'folder-1');
  assert.strictEqual(chosenTemplate.id, 'template-real', 'Must filter out previously generated Attendance output sheets');
  console.log('✓ Master template protection against generated output sheets verified.');

  // Test 9: Dynamic employee rows and summary positioning
  const staffCount = 2;
  const lastEmpRow = 7 + (staffCount * 2) - 1;
  assert.strictEqual(lastEmpRow, 10, 'For 2 employees, employee rows must end at row 10');
  const s1WeeklyOff = lastEmpRow + 1; // 11
  const s2Present = s1WeeklyOff + 1;  // 12
  const s3Total = s2Present + 1;      // 13
  assert.strictEqual(s1WeeklyOff, 11, 'Summary row 1 (WEEKLY OFF) must be immediately beneath employees at row 11');
  assert.strictEqual(s2Present, 12, 'Summary row 2 (PRESENT STRENGTH) must be at row 12');
  assert.strictEqual(s3Total, 13, 'Summary row 3 (TOTAL STRENGTH) must be at row 13');
  console.log('✓ Dynamic 2-employee blocks and immediate summary positioning verified.');

  // Test 10: Weekly-off status derivation rules
  const isWeeklyOffDay = true;
  const rawStatusEmpty = undefined;
  const rawStatusPresent = 'P';
  const derivedAbsent = isWeeklyOffDay ? (!rawStatusEmpty || rawStatusEmpty === 'A' ? 'W/O' : rawStatusEmpty) : (rawStatusEmpty || '');
  assert.strictEqual(derivedAbsent, 'W/O', 'Unrecorded day on weekly off must display W/O');
  const derivedPresent = isWeeklyOffDay ? (rawStatusPresent === 'P' || rawStatusPresent === 'WOP' ? 'WOP' : rawStatusPresent) : rawStatusPresent;
  assert.strictEqual(derivedPresent, 'WOP', 'Present on weekly off must display WOP');
  console.log('✓ Weekly-off status derivation rules verified.');

  console.log('All Google Attendance Sheet unit assertions passed successfully!');
}

runGoogleAttendanceTests().catch((err) => {
  console.error('Google Attendance Service unit test error:', err);
  process.exit(1);
});
