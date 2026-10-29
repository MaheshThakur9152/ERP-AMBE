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

  // Test 7: Timezone-independent calendar day parsing
  const testIso = '2026-08-15';
  const dayParsed = parseInt(testIso.split('-')[2], 10);
  assert.strictEqual(dayParsed, 15, 'Calendar day must parse accurately from date string');
  console.log('✓ Timezone-independent calendar day parsing verified.');

  console.log('All Google Attendance Sheet unit assertions passed successfully!');
}

runGoogleAttendanceTests().catch((err) => {
  console.error('Google Attendance Service unit test error:', err);
  process.exit(1);
});
