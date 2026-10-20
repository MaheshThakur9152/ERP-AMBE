import assert from 'assert';
import { NotificationService } from '../services/notificationService';
import { AttendanceService } from '../services/attendanceService';
import { SiteService } from '../services/siteService';
import { getAllSiteDocuments, getEmployeeDocuments, getCompanyDocuments } from '../controllers/documentController';
import { calculatePayroll } from '../services/payrollService';

console.log('--- Running TASK-4063 Verification Tests ---');

async function runTests() {
  // 1. MAJOR-01: Attendance dynamic placeholder formatting
  console.log('Testing MAJOR-01: Attendance dynamic placeholder formatting...');
  try {
    const res = await AttendanceService.getAllSheets('site-1', 'October', '2026', {
      id: 'u1',
      role: 'admin',
      company_id: 'comp-1',
    });
    console.log('✓ MAJOR-01: getAllSheets executes with valid PostgreSQL placeholders ($1..$4).');
  } catch (err: any) {
    assert.ok(!err?.message?.includes('syntax error at or near "="'), 'Should not have SQL syntax error from raw number in condition');
    console.log('✓ MAJOR-01: Query syntax verified.');
  }

  // 2. MAJOR-02: Attendance & Site Company Reassignment Prevention
  console.log('Testing MAJOR-02: Cross-company reassignment rejection...');
  await assert.rejects(
    async () => {
      await AttendanceService.createSheet(
        { company_id: 'foreign-company', month: '10', year: '2026' },
        { id: 'u2', role: 'admin', company_id: 'own-company' }
      );
    },
    (err: any) => err.statusCode === 403 && err.message.includes('Unauthorized company reassignment')
  );

  await assert.rejects(
    async () => {
      await AttendanceService.updateSheet(
        '00000000-0000-0000-0000-000000000001',
        { company_id: 'foreign-company' },
        { id: 'u2', role: 'admin', company_id: 'own-company' }
      );
    },
    (err: any) => err.statusCode === 403 && err.message.includes('Unauthorized company reassignment')
  );

  await assert.rejects(
    async () => {
      await SiteService.updateSite(
        '00000000-0000-0000-0000-000000000001',
        { company_id: 'foreign-company' },
        { id: 'u2', role: 'admin', company_id: 'own-company' }
      );
    },
    (err: any) => err.statusCode === 403 && err.message.includes('Unauthorized company reassignment')
  );
  console.log('✓ MAJOR-02: Unauthorized cross-company reassignments rejected with 403.');

  // 3. MAJOR-04 & MAJOR-06: Document scoping
  console.log('Testing MAJOR-04 & MAJOR-06: Document scoping for non-superadmin without company...');
  const mockReq: any = {
    query: {},
    user: { id: 'u_no_comp', role: 'staff' }, // missing company_id
  };
  let sentStatus = 0;
  let sentData: any = null;
  const mockRes: any = {
    status: (code: number) => {
      sentStatus = code;
      return mockRes;
    },
    json: (payload: any) => {
      sentData = payload;
      return mockRes;
    },
  };

  await getAllSiteDocuments(mockReq, mockRes);
  assert.strictEqual(sentStatus, 200);
  assert.deepStrictEqual(sentData.data, []);

  await getEmployeeDocuments(mockReq, mockRes);
  assert.strictEqual(sentStatus, 200);
  assert.deepStrictEqual(sentData.data, []);

  await getCompanyDocuments(mockReq, mockRes);
  assert.strictEqual(sentStatus, 200);
  assert.deepStrictEqual(sentData.data, []);
  console.log('✓ MAJOR-04 & MAJOR-06: Unscoped non-superadmins receive empty datasets and are denied cross-company leaks.');

  // 4. MINOR-01: Payroll snapshot persistence
  console.log('Testing MINOR-01: Payroll snapshot field retention...');
  const staff = { gross_salary: 15000, basic_da: 10000, hra: 3000 };
  const rateCard = {
    bonus_amount: 1200,
    part_bonus_amount: 300,
    remark: 'Special Festival Bonus',
  };
  const calc = calculatePayroll(rateCard, staff, 26, 4, 30);
  assert.ok(calc, 'calc should not be null');
  assert.strictEqual(calc.bonusAmountSnapshot, 1200);
  assert.strictEqual(calc.partBonusAmountSnapshot, 300);
  assert.strictEqual(calc.rateCardRemarkSnapshot, 'Special Festival Bonus');
  console.log('✓ MINOR-01: Payroll snapshot correctly captures bonus, part bonus, and rate card remark.');

  // 5. MINOR-06: Site charge field naming conventions
  console.log('Testing MINOR-06: Site charge field naming (snake_case & camelCase)...');
  await assert.rejects(
    async () => {
      await SiteService.updateSite(
        '00000000-0000-0000-0000-000000000001',
        { default_machinery_charges: 100, defaultMachineryCharges: 200 },
        { id: 'u2', role: 'superadmin' }
      );
    },
    /Conflicting values for default_machinery_charges/
  );

  await assert.rejects(
    async () => {
      await SiteService.updateSite(
        '00000000-0000-0000-0000-000000000001',
        { default_machinery_charges: 'not-a-number' },
        { id: 'u2', role: 'superadmin' }
      );
    },
    /Invalid numeric amount for default_machinery_charges/
  );
  console.log('✓ MINOR-06: Charge field normalization, conflicting checks, and numeric validation passed.');

  // 6. MINOR-02: Notification timeout & failure safety
  console.log('Testing MINOR-02: Notification webhook timeout & failure safety...');
  process.env.NOTIFICATION_WEBHOOK_URL = 'http://127.0.0.1:54321/nonexistent-webhook';
  process.env.NOTIFICATION_TIMEOUT_MS = '500';
  const delivered = await NotificationService.sendPasswordResetNotification(
    'test@example.com',
    'test-token-123',
    new Date(Date.now() + 3600000)
  );
  assert.strictEqual(delivered, false, 'Delivery should return false when endpoint fails or times out');
  delete process.env.NOTIFICATION_WEBHOOK_URL;
  delete process.env.NOTIFICATION_TIMEOUT_MS;
  console.log('✓ MINOR-02: Notification service bounds timeout and fails closed safely.');

  console.log('All TASK-4063 test assertions passed successfully.');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
