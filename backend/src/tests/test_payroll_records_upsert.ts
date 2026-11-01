/**
 * Payroll record upsert: date normalization + DB round-trip.
 * All DB writes run inside a transaction that is ALWAYS rolled back — nothing persists.
 * Run: npx ts-node src/tests/test_payroll_records_upsert.ts
 */
import assert from 'assert';
import { pool } from '../db/pool';
import { normalizeOptionalDate, upsertPayrollRecords, PayrollController } from '../controllers/payrollController';

function expect400(fn: () => unknown, field: string) {
  assert.throws(fn, (e: any) => e.statusCode === 400 && e.message.includes(field));
}

async function callController(body: any) {
  const res: any = { code: 0, body: null };
  res.status = (c: number) => { res.code = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  await PayrollController.upsertRecords({ body } as any, res);
  return res;
}

async function run() {
  // --- Unit: normalizeOptionalDate ---
  assert.strictEqual(normalizeOptionalDate('adv_date', '2026-09-15'), '2026-09-15');
  assert.strictEqual(normalizeOptionalDate('adv_date', ' 2026-09-15 '), '2026-09-15');
  assert.strictEqual(normalizeOptionalDate('adv_date', '2026-09-15T00:00:00.000Z'), '2026-09-15');
  assert.strictEqual(normalizeOptionalDate('adv_date', ''), null);
  assert.strictEqual(normalizeOptionalDate('adv_date', '   '), null);
  assert.strictEqual(normalizeOptionalDate('adv_date', null), null);
  assert.strictEqual(normalizeOptionalDate('adv_date', undefined), undefined);
  expect400(() => normalizeOptionalDate('adv_date', '15/09/2026'), 'adv_date');
  expect400(() => normalizeOptionalDate('adv_date', '2026-02-30'), 'adv_date');
  expect400(() => normalizeOptionalDate('adv_date', 'September 2026'), 'adv_date');
  expect400(() => normalizeOptionalDate('adv_date', 20260915), 'adv_date');
  console.log('PASS unit normalizeOptionalDate');

  // --- Controller: invalid input → 400 with field name, before any DB write ---
  let r = await callController([{ staff_id: '00000000-0000-0000-0000-000000000000', month_year: 'X', adv_date: '31-12-2026' }]);
  assert.strictEqual(r.code, 400);
  assert.match(r.body.error, /adv_date/);
  r = await callController([null]);
  assert.strictEqual(r.code, 400);
  r = await callController([]);
  assert.strictEqual(r.code, 400);
  console.log('PASS controller 400 responses');

  // --- DB round-trip (rolled back) ---
  const staff = (await pool.query('SELECT id FROM public.staff LIMIT 1')).rows[0];
  if (!staff) { console.log('SKIP DB tests: no staff rows'); return; }
  const MONTH = 'ZZTEST-ROLLBACK 1900'; // sentinel month, never real
  const base = { staff_id: staff.id, month_year: MONTH, site_id: null, employee_name: 'TEST', pd: 26, wo: 4, total_net_salary: 4110, net_salary: 4110, remark: '' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const count = async () => Number((await client.query('SELECT count(*) FROM public.payroll_records WHERE staff_id=$1 AND month_year=$2', [staff.id, MONTH])).rows[0].count);
    const readBack = async () => (await client.query("SELECT to_char(adv_date,'YYYY-MM-DD') AS adv_date, total_net_salary, remark, pd FROM public.payroll_records WHERE staff_id=$1 AND month_year=$2", [staff.id, MONTH])).rows[0];

    // 1. all dates populated
    await upsertPayrollRecords(client, [{ ...base, adv_date: '2026-09-15' }]);
    let row = await readBack();
    assert.strictEqual(row.adv_date, '2026-09-15');
    assert.strictEqual(Number(row.total_net_salary), 4110);
    assert.strictEqual(row.remark, ''); // unrelated '' string NOT nulled
    console.log('PASS 1 valid date saved');

    // 2. empty string → NULL (the production failure)
    await upsertPayrollRecords(client, [{ ...base, adv_date: '' }]);
    row = await readBack();
    assert.strictEqual(row.adv_date, null);
    console.log('PASS 2 empty-string date → NULL');

    // 3. explicit null
    await upsertPayrollRecords(client, [{ ...base, adv_date: '2026-09-01' }]);
    await upsertPayrollRecords(client, [{ ...base, adv_date: null }]);
    assert.strictEqual((await readBack()).adv_date, null);
    console.log('PASS 3 explicit null → NULL');

    // undefined leaves existing value untouched (no unintended overwrite)
    await upsertPayrollRecords(client, [{ ...base, adv_date: '2026-09-02' }]);
    await upsertPayrollRecords(client, [{ ...base, pd: 25 }]);
    row = await readBack();
    assert.strictEqual(row.adv_date, '2026-09-02');
    assert.strictEqual(Number(row.pd), 25);
    console.log('PASS undefined date preserves existing');

    // 4. no required DATE columns exist on payroll_records; required keys staff_id/month_year → record skipped (existing contract)
    const skipped = await upsertPayrollRecords(client, [{ ...base, staff_id: undefined, adv_date: '' }]);
    assert.strictEqual(skipped.length, 0);
    console.log('PASS 4 missing required keys skipped, no write');

    // 5. invalid format rejected before SQL
    await assert.rejects(upsertPayrollRecords(client, [{ ...base, adv_date: '2026/13/01' }]), (e: any) => e.statusCode === 400);
    console.log('PASS 5 invalid date → 400');

    // 6 + 8. update + repeated identical saves → single row
    for (let i = 0; i < 3; i++) await upsertPayrollRecords(client, [{ ...base, total_net_salary: 5000, adv_date: '' }]);
    assert.strictEqual(await count(), 1);
    assert.strictEqual(Number((await readBack()).total_net_salary), 5000);
    console.log('PASS 6/8 update in place, no duplicates');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

run()
  .then(() => { console.log('ALL PAYROLL UPSERT TESTS PASSED'); })
  .catch((e) => { console.error('FAIL', e); process.exitCode = 1; })
  .finally(() => pool.end());
