import fs from 'fs';
import path from 'path';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

const cleanNum = (v: any): number => {
  if (!v || typeof v !== 'string') return 0;
  const c = v.replace(/[₹,\s]/g, '').trim();
  if (c.startsWith('#') || c === '-' || c.toUpperCase() === 'LOSS') return 0;
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};

const parseDate = (d: any): string | null => {
  if (!d || typeof d !== 'string') return null;
  const s = d.trim().replace(/\s+/g, ' ');
  if (!s || s.startsWith('#') || s === '-' || s.includes('?')) return null;

  const m1 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m1) {
    let [, p1, p2, yr] = m1;
    let day = parseInt(p1, 10);
    let month = parseInt(p2, 10);
    if (month > 12 && day <= 12) {
      const tmp = day; day = month; month = tmp;
    }
    return `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // "24 November 2025", "11- Dec -2025", "05 February 2026". Parsed by hand: new Date().toISOString()
  // shifts local midnight in IST back one day.
  const m2 = s.match(/^(\d{1,2})[\s\-\/]*([A-Za-z]{3,})[\s\-\/,]*(\d{4})$/);
  if (m2) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m2[2].slice(0, 3).toLowerCase());
    if (mon >= 0) return `${m2[3]}-${String(mon + 1).padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }

  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const esc = (s: string | null): string => {
  if (s === null || s === undefined) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
};

// Verified Site UUIDs from public.sites
const SITE_MAP: Record<string, { id: string; name: string }> = {
  'ajmera-hk.csv': { id: '6bc84687-a527-4154-b1b8-34dc530553cd', name: 'Ajmera (HK)' },
  'ajmera-key.csv': { id: '36a03f01-fcb9-4f85-a226-a84964405aaf', name: 'Ajmera KEYMAN' },
  'ceejay-15th floor.csv': { id: 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', name: 'Ceejay Residency 15th floor' },
  'ceejay-residency.csv': { id: '46449d39-dccb-4c8e-aa0d-790141572cb0', name: 'Sheela ceejay' },
  'lkcpl-chs.csv': { id: '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', name: 'Minerva 9th' },
  'min-58th.csv': { id: '25335366-f738-4a77-8b58-bc6c5681c135', name: 'Minerva 58th Ho' },
  'min-sales.csv': { id: '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', name: 'Minerva Sales' },
  'minchs big site.csv': { id: '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', name: 'Minerva Big site' },
  'greenfinity.csv': { id: '244f478c-46a9-4363-ab56-a158b58024d6', name: 'AJmera Greenfinity' }
};

export function generateSQL(outputFile: string) {
  const sql: string[] = [
    '--',
    '-- LEGACY LEDGER IMPORT (Generated from D:\\ERP-AMBE\\leger-lagcy)',
    '--',
    'BEGIN;',
    ''
  ];

  const LEGACY_DIR = 'D:/ERP-AMBE/leger-lagcy';
  const csvFiles = fs.readdirSync(LEGACY_DIR).filter(f => f.endsWith('.csv'));
  if (fs.existsSync('D:/ERP-AMBE/greenfinity.csv')) {
    csvFiles.push('../greenfinity.csv');
  }

  let totalInvoices = 0;
  let totalPayments = 0;

  for (const relFile of csvFiles) {
    const filename = path.basename(relFile);
    const siteConfig = SITE_MAP[filename];
    if (!siteConfig) {
      console.warn(`[WARN] No site mapping for ${filename}`);
      continue;
    }

    const filePath = relFile.startsWith('..') ? 'D:/ERP-AMBE/greenfinity.csv' : path.join(LEGACY_DIR, relFile);
    const rows = parseCSV(fs.readFileSync(filePath, 'utf-8'));

    sql.push(`-- ============================================================================`);
    sql.push(`-- SITE: ${siteConfig.name} (${siteConfig.id}) FROM ${filename}`);
    sql.push(`-- ============================================================================`);

    // Opening balance
    for (const r of rows) {
      const line = r.join(' ');
      if (/previous year pending/i.test(line)) {
        const amt = r.map(cleanNum).find(n => n > 0) || 0;
        if (amt > 0) {
          sql.push(
            `INSERT INTO public.ledger_opening_balances (site_id, amount, note, updated_at)`,
            `VALUES ('${siteConfig.id}', ${amt}, 'Legacy Ledger Import', now())`,
            `ON CONFLICT (site_id) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, updated_at = now();`,
            ''
          );
        }
        break;
      }
    }

    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some(c => /invoice no/i.test(c))) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) continue;

    const header = rows[headerIndex].map(c => c.trim().replace(/\n/g, ' '));
    const getCol = (re: RegExp) => header.findIndex(h => re.test(h));

    const cInvNo = getCol(/invoice\s*no/i);
    const cPeriod = getCol(/billing\s*period/i);
    const cInvPeriod = getCol(/invoice\s*period/i);
    const cNature = getCol(/nature/i);
    const cDate = getCol(/invoice\s*date/i);
    const cSubTotal = getCol(/sub\s*total/i);
    const cGst = getCol(/gst/i);
    const cAmount = getCol(/amount/i);
    const cStatus = getCol(/paid\s*\/\s*unpaid/i);
    const cMode = getCol(/mode/i);
    const cPaidDate = getCol(/paid\s*date/i);
    const cPaidAmt = getCol(/paid\s*amt/i);
    const cRemark = getCol(/remark/i);
    const cRemToPay = getCol(/rem\s*to\s*pay/i); // not /rem/: that hits "Remark" first
    const cTds = getCol(/^tds$/i) !== -1 ? getCol(/^tds$/i) : getCol(/tds/i);
    const cTdsAmt = getCol(/tds\s*amt/i);
    // One CSV payment can settle several bills (e.g. 466197 on Jan's row = Jan 209015 + Feb 257182);
    // the excess carries to the following rows that have no status of their own.
    let carry = { amt: 0, date: null as string | null, mode: 'NEFT' };

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const invNo = (row[cInvNo] || '').trim();
      if (!invNo || !invNo.toUpperCase().startsWith('ASF')) continue;
      // Superseded bill: the next row reissues it ("Above changed to 15 Inv no").
      if ((rows[i + 1] || []).some(c => /changed to/i.test(c))) continue;

      const nature = (cNature !== -1 ? row[cNature] : '').trim();
      const isMaterial = /^ASF(\/P)?\/M\//i.test(invNo) || /goods|material/i.test(nature);
      const isProforma = /\/P\//i.test(invNo) || /PI/i.test(nature) || (row[cInvNo - 1] && /PI/i.test(row[cInvNo - 1]));
      const subTotal = cSubTotal !== -1 ? cleanNum(row[cSubTotal]) : 0;
      const taxTotal = cGst !== -1 ? cleanNum(row[cGst]) : 0;
      let grandTotal = cAmount !== -1 ? cleanNum(row[cAmount]) : 0;
      const invDate = cDate !== -1 ? parseDate(row[cDate]) : null;
      let period = cPeriod !== -1 ? (row[cPeriod] || '').trim() || null : null;
      // Reissued rows hold a note ("Above changed to 15 Inv no") in the period column; use the invoice period instead.
      if (period && /changed to/i.test(period) && cInvPeriod !== -1) period = (row[cInvPeriod] || '').trim() || period;

      const statusCol = (cStatus !== -1 ? row[cStatus] : '').trim();
      // No amount but another row bills the same period: replaced bill (Ajmera HK ASF/25-26/053, 054 by 006).
      // No amount and nothing replaces it (Minerva 58th ASF/25-26/065): amount = sub total + GST.
      const normPeriod = (r: string[]) => (cInvPeriod !== -1 ? (r[cInvPeriod] || '') : '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (grandTotal === 0) {
        const replaced = normPeriod(row) !== '' && rows.some((o, j) => j !== i && normPeriod(o) === normPeriod(row) && cleanNum(o[cAmount]) > 0);
        if (replaced || subTotal === 0) continue;
        grandTotal = Math.round((subTotal + taxTotal) * 100) / 100;
      }
      const paidAmtCol = cPaidAmt !== -1 ? cleanNum(row[cPaidAmt]) : 0;
      const remToPay = cRemToPay !== -1 ? cleanNum(row[cRemToPay]) : 0;
      const tds = cTds !== -1 ? cleanNum(row[cTds]) : 0;
      const netReceivable = (cTdsAmt !== -1 ? cleanNum(row[cTdsAmt]) : 0) || Math.round((grandTotal - tds) * 100) / 100;
      const mode = cMode !== -1 && ['NEFT', 'RTGS', 'Cheque', 'Cash', 'UPI'].includes(row[cMode]?.trim()) ? row[cMode].trim() : 'NEFT';
      const paidDate = cPaidDate !== -1 ? parseDate(row[cPaidDate]) : null;
      const remark = cRemark !== -1 ? (row[cRemark] || '').trim() || null : null;

      let finalPaid = 0;
      let finalTds = 0;
      const isPaid = /paid/i.test(statusCol) && !/unpaid/i.test(statusCol);

      if (isPaid) {
        if (/not\s*full/i.test(statusCol) || /partial/i.test(statusCol)) {
          finalPaid = remToPay > 0 ? Math.max(0, netReceivable - remToPay) : Math.min(paidAmtCol, netReceivable);
          finalTds = tds;
        } else {
          finalPaid = netReceivable;
          finalTds = tds;
          carry = paidAmtCol > netReceivable + 1
            ? { amt: Math.round((paidAmtCol - netReceivable) * 100) / 100, date: paidDate, mode }
            : { amt: 0, date: null, mode };
        }
      }

      let carried = false;
      if (!isPaid && !statusCol && carry.amt > 0 && carry.amt >= netReceivable - 1) {
        finalPaid = netReceivable;
        finalTds = tds;
        carried = true;
        carry = { ...carry, amt: Math.round((carry.amt - netReceivable) * 100) / 100 };
      }

      totalInvoices++;
      const invVar = `v_inv_${totalInvoices}`;

      sql.push(`-- Invoice: ${invNo} (${isMaterial ? 'MATERIAL' : 'SERVICE'})`);
      sql.push(`DO $$`);
      sql.push(`DECLARE`);
      sql.push(`  v_id uuid;`);
      sql.push(`BEGIN`);
      sql.push(`  -- 1. Check if invoice already exists in platform for this site`);
      sql.push(`  SELECT id INTO v_id FROM public.invoices`);
      sql.push(`  WHERE site_id = '${siteConfig.id}' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM(${esc(invNo)}))`);
      sql.push(`  LIMIT 1;`);
      sql.push(``);
      sql.push(`  IF v_id IS NULL THEN`);
      sql.push(`    INSERT INTO public.invoices (`);
      sql.push(`      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,`);
      sql.push(`      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at`);
      sql.push(`    ) VALUES (`);
      sql.push(`      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '${siteConfig.id}', ${esc(invNo)}, ${esc(isProforma ? 'Proforma Invoice' : 'Tax Invoice')},`);
      sql.push(`      'Generated', ${esc(invDate)}, ${esc(period)}, ${isMaterial}, true, 'Legacy CSV import', ${subTotal}, ${taxTotal}, ${grandTotal}, now()`);
      sql.push(`    ) RETURNING id INTO v_id;`);
      sql.push(`  ELSE`);
      sql.push(`    -- Re-run: refresh dates on rows this import created; never touch real platform bills`);
      sql.push(`    UPDATE public.invoices SET invoice_date = ${esc(invDate)}, billing_period = ${esc(period)}`);
      sql.push(`    WHERE id = v_id AND legacy_notes = 'Legacy CSV import';`);
      sql.push(`  END IF;`);

      if (finalPaid + finalTds > 0) {
        totalPayments++;
        const pDate = (carried ? carry.date : paidDate) || invDate || new Date().toISOString().slice(0, 10);
        sql.push(`  -- Payment: Paid=₹${finalPaid}, TDS=₹${finalTds}. Only on legacy rows; payments typed in the ERP (created_by set) are kept.`);
        sql.push(`  IF EXISTS (SELECT 1 FROM public.invoices WHERE id = v_id AND legacy_notes = 'Legacy CSV import') THEN`);
        sql.push(`    DELETE FROM public.invoice_payments WHERE invoice_id = v_id AND created_by IS NULL;`);
        sql.push(`    INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)`);
        sql.push(`    SELECT v_id, ${esc(pDate)}, ${finalPaid}, ${finalTds}, ${esc(carried ? carry.mode : mode)}, ${esc(carried ? 'Paid with previous bill' : remark)}, now()`);
        sql.push(`    WHERE NOT EXISTS (SELECT 1 FROM public.invoice_payments WHERE invoice_id = v_id);`);
        sql.push(`  END IF;`);
      }

      sql.push(`END $$;`);
      sql.push(``);
    }
  }

  sql.push('COMMIT;');
  sql.push('');
  fs.writeFileSync(outputFile, sql.join('\n'), 'utf-8');
  console.log(`Successfully generated ${outputFile}: ${totalInvoices} invoices, ${totalPayments} payments across all sites.`);
}

const out = path.resolve('D:/ERP-AMBE/scripts/legacy_ledger_import.sql');
generateSQL(out);

