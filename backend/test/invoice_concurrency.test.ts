import { InvoiceQueryService } from '../src/services/invoiceQueryService';
import { pool } from '../src/db/pool';
import crypto from 'crypto';

async function runTests() {
  console.log('--- STARTING INVOICE CONCURRENCY & INTEGRITY TEST SUITE (GATE-09) ---');
  let failures = 0;

  // Fetch real test companies
  const compRes = await pool.query('SELECT id, name, tax_prefix, proforma_prefix FROM public.companies ORDER BY name;');
  if (!compRes.rows || compRes.rows.length < 2) {
    throw new Error('Test requires at least 2 companies in database');
  }
  const compA = compRes.rows[0];
  const compB = compRes.rows[1];

  // Fetch test site
  const siteRes = await pool.query('SELECT id, company_id FROM public.sites LIMIT 1;');
  const testSiteId = siteRes.rows?.[0]?.id || null;

  // TEST 1: Cross-company unauthorized access rejection
  console.log('TEST 1: Cross-company authorization guard...');
  try {
    const unauthorizedUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'user@compb.com',
      role: 'admin',
      company_id: compB.id,
    };
    await InvoiceQueryService.createInvoice({
      company_id: compA.id,
      site_id: testSiteId,
      type: 'Tax Invoice',
      line_items: [{ description: 'Test', quantity: 1, unit_rate: 100 }],
    }, unauthorizedUser as any);
    console.error('FAIL: Unauthorized user was able to create invoice for company A');
    failures++;
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes('Unauthorized company')) {
      console.log('PASS: Unauthorized cross-company creation correctly rejected with 403');
    } else {
      console.error('FAIL: Unexpected error for cross-company test:', err);
      failures++;
    }
  }

  // TEST 2: Idempotency Key - identical payload replay
  console.log('TEST 2: Idempotent replay for identical key + payload...');
  const sharedKey = crypto.randomUUID();
  const testPayload = {
    company_id: compA.id,
    site_id: testSiteId,
    type: 'Tax Invoice',
    billing_period: 'Oct 2026',
    idempotency_key: sharedKey,
    line_items: [{ description: 'Security Guard', quantity: 2, unit_rate: 15000 }],
  };

  try {
    const inv1 = await InvoiceQueryService.createInvoice(testPayload);
    const inv2 = await InvoiceQueryService.createInvoice(testPayload);

    if (inv1.id === inv2.id && inv1.invoiceNo === inv2.invoiceNo) {
      console.log(`PASS: Idempotent replay successful: single invoice ${inv1.invoiceNo} (${inv1.id}) returned`);
    } else {
      console.error(`FAIL: Idempotency failed: returned different invoices (${inv1.id} vs ${inv2.id})`);
      failures++;
    }
  } catch (err) {
    console.error('FAIL: Error in idempotency replay test:', err);
    failures++;
  }

  // TEST 3: Idempotency Key Collision with differing payload -> 409 Conflict
  console.log('TEST 3: Key reuse with conflicting payload rejection (HTTP 409)...');
  try {
    const conflictingPayload = {
      ...testPayload,
      line_items: [{ description: 'Different Service', quantity: 10, unit_rate: 99999 }],
    };
    await InvoiceQueryService.createInvoice(conflictingPayload);
    console.error('FAIL: Conflicting payload was accepted under existing idempotency key');
    failures++;
  } catch (err: any) {
    if (err.statusCode === 409 || err.message.includes('Idempotency key collision')) {
      console.log('PASS: Conflicting payload correctly rejected with HTTP 409');
    } else {
      console.error('FAIL: Unexpected error for conflict test:', err);
      failures++;
    }
  }

  // TEST 4: Concurrent Invoice Creation - Zero sequence collision
  console.log('TEST 4: Concurrent invoice creations (Tax & Proforma across 2 companies)...');
  try {
    const concurrentRequests = [
      InvoiceQueryService.createInvoice({
        company_id: compA.id,
        site_id: testSiteId,
        type: 'Tax Invoice',
        billing_period: 'Oct 2026',
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Guard A1', quantity: 1, unit_rate: 5000 }],
      }),
      InvoiceQueryService.createInvoice({
        company_id: compA.id,
        site_id: testSiteId,
        type: 'Tax Invoice',
        billing_period: 'Oct 2026',
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Guard A2', quantity: 1, unit_rate: 6000 }],
      }),
      InvoiceQueryService.createInvoice({
        company_id: compA.id,
        site_id: testSiteId,
        type: 'Proforma Invoice',
        billing_period: 'Oct 2026',
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Proforma A1', quantity: 1, unit_rate: 7000 }],
      }),
      InvoiceQueryService.createInvoice({
        company_id: compB.id,
        site_id: testSiteId,
        type: 'Tax Invoice',
        billing_period: 'Oct 2026',
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Guard B1', quantity: 1, unit_rate: 8000 }],
      }),
      InvoiceQueryService.createInvoice({
        company_id: compB.id,
        site_id: testSiteId,
        type: 'Proforma Invoice',
        billing_period: 'Oct 2026',
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Proforma B1', quantity: 1, unit_rate: 9000 }],
      }),
    ];

    const results = await Promise.all(concurrentRequests);
    const invoiceNos = results.map((r: any) => `${r.companyId || r.company_id}:${r.type}:${r.invoiceNo || r.invoice_no}`);
    const uniqueNos = new Set(invoiceNos);

    if (invoiceNos.length === uniqueNos.size) {
      console.log(`PASS: All ${results.length} concurrent invoices created with unique numbers:`, invoiceNos);
    } else {
      console.error('FAIL: Collision detected in concurrent invoice generation:', invoiceNos);
      failures++;
    }
  } catch (err) {
    console.error('FAIL: Concurrent invoice creation failed:', err);
    failures++;
  }

  // TEST 5: Atomic rollback on failure
  console.log('TEST 5: Rollback verification on synthetic insertion failure...');
  try {
    const seqBefore = await pool.query('SELECT tax_sequence FROM public.companies WHERE id = $1;', [compA.id]);
    const numBefore = seqBefore.rows[0].tax_sequence;

    let threwError = false;
    try {
      await InvoiceQueryService.createInvoice({
        company_id: compA.id,
        site_id: testSiteId,
        type: 'Tax Invoice',
        invoice_date: 'synthetic-fail-date', // Triggers PostgreSQL DATE syntax error during INSERT
        idempotency_key: crypto.randomUUID(),
        line_items: [{ description: 'Test Item', quantity: 1, unit_rate: 100 }],
      });
    } catch (err: any) {
      threwError = true;
    }

    if (!threwError) {
      console.error('FAIL: Expected createInvoice to throw error but it succeeded');
      failures++;
    }

    const seqAfter = await pool.query('SELECT tax_sequence FROM public.companies WHERE id = $1;', [compA.id]);
    const numAfter = seqAfter.rows[0].tax_sequence;

    if (numBefore === numAfter) {
      console.log(`PASS: Sequence counter remained intact (${numBefore} === ${numAfter}) after rollback`);
    } else {
      console.error(`FAIL: Sequence leaked during failed transaction: was ${numBefore}, now ${numAfter}`);
      failures++;
    }
  } catch (err) {
    console.error('FAIL: Rollback test error:', err);
    failures++;
  }

  // Final summary
  console.log(`\n--- GATE-09 TEST RUN COMPLETED. FAILURES: ${failures} ---`);
  await pool.end();

  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
