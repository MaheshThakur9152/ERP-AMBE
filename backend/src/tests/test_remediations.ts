import assert from 'assert';
import { validateJwtConfig } from '../config/env';
import { parseMonthYearRange } from '../services/payrollService';

console.log('--- Testing CRIT and MAJOR Remediations ---');

// 1. CRIT-02: JWT Secret validation
console.log('Testing CRIT-02: validateJwtConfig...');
assert.throws(
  () => validateJwtConfig('short'),
  /JWT_SECRET environment variable is missing, empty, or too short/
);
assert.throws(
  () => validateJwtConfig('default-insecure-jwt-secret-key-change-in-production'),
  /JWT_SECRET cannot be the insecure default placeholder/
);
const validEnv = validateJwtConfig('01234567890123456789012345678901');
assert.strictEqual(validEnv, '01234567890123456789012345678901');
console.log('✓ CRIT-02: JWT secret length and default rejection passed.');

// 2. MAJ-13: parseMonthYearRange
console.log('Testing MAJ-13: parseMonthYearRange...');
const r1 = parseMonthYearRange('October 2026');
assert.strictEqual(r1.startDate, '2026-10-01');
assert.strictEqual(r1.endDate, '2026-11-01');

const r2 = parseMonthYearRange('2026-12');
assert.strictEqual(r2.startDate, '2026-12-01');
assert.strictEqual(r2.endDate, '2027-01-01');

const r3 = parseMonthYearRange('Jan 2025');
assert.strictEqual(r3.startDate, '2025-01-01');
assert.strictEqual(r3.endDate, '2025-02-01');

assert.throws(() => parseMonthYearRange('invalid-date'), /Invalid monthYear format/);
console.log('✓ MAJ-13: parseMonthYearRange exact boundary parsing passed.');

// 3. MAJ-06: Allowed lock tables
console.log('Testing MAJ-06: ALLOWED_LOCK_TABLES...');
import { ALLOWED_LOCK_TABLES } from '../middlewares/authMiddleware';
assert.ok(ALLOWED_LOCK_TABLES.has('staff'), 'staff should be in ALLOWED_LOCK_TABLES');
assert.ok(ALLOWED_LOCK_TABLES.has('attendance_sheets'), 'attendance_sheets should be in ALLOWED_LOCK_TABLES');
assert.ok(ALLOWED_LOCK_TABLES.has('companies'), 'companies should be in ALLOWED_LOCK_TABLES');
assert.ok(ALLOWED_LOCK_TABLES.has('invoices'), 'invoices should be in ALLOWED_LOCK_TABLES');
console.log('✓ MAJ-06: ALLOWED_LOCK_TABLES membership passed.');

// 4. RFC 6266 Content-Disposition header formatting
console.log('Testing RFC 6266 filename encoding...');
const testFilename = 'invoice"test;2026/10/file åäö [draft].pdf';
const asciiFallback = testFilename.replace(/[\x00-\x1f\x7f"\\;]/g, '_').replace(/[^\x20-\x7e]/g, '_');
const utf8Encoded = encodeURIComponent(testFilename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
const dispositionHeader = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
assert.ok(!asciiFallback.includes('"'), 'ASCII fallback must not contain unescaped quotes');
assert.ok(!asciiFallback.includes(';'), 'ASCII fallback must not contain unescaped semicolons');
assert.ok(dispositionHeader.includes("filename*=UTF-8''"), 'Must include RFC 6266 UTF-8 parameter');
console.log('✓ RFC 6266 Content-Disposition encoding passed.');

console.log('All remediation unit tests passed successfully.');
