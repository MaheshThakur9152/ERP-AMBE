import ExcelJS from 'exceljs';
import { LedgerRow, SiteInfo, isProforma, rowTotals, siteTotals } from './ledgerService';

// Indian digit grouping (12,34,567.00); Excel has no built-in lakh format.
const INR = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
const DATE = 'dd-mmm-yyyy';

const C = {
  brand: 'FF0F766E',
  brandLight: 'FFE6F4F2',
  head: 'FF1E293B',
  border: 'FFCBD5E1',
  zebra: 'FFF8FAFC',
  opening: 'FFFFF8E1',
  total: 'FFF1F5F9',
  red: 'FFB91C1C',
  status: {
    Paid: ['FFDCFCE7', 'FF166534'],
    Partial: ['FFFEF3C7', 'FF92400E'],
    Unpaid: ['FFFEE2E2', 'FF991B1B'],
    Cancelled: ['FFF1F5F9', 'FF64748B'],
  } as Record<string, [string, string]>,
};

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: C.border } };
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

// Blank instead of 0.00 keeps the sheet readable; Excel sums treat blanks as 0.
const z = (n: number | null | undefined) => (n ? n : null);
const toDate = (d: string | null | undefined) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00Z') : null);

/** Excel sheet names: ≤31 chars, no []:*?/\ , unique within the workbook. On a clash, try the WO ref, then a counter. */
function sheetName(wb: ExcelJS.Workbook, raw: string, disambiguator?: string | null): string {
  const clean = (s: string) => s.replace(/[[\]:*?/\\']/g, ' ').replace(/\s+/g, ' ').trim();
  const base = clean(raw).slice(0, 31).trim() || 'Sheet';
  if (!wb.getWorksheet(base)) return base;
  if (disambiguator) {
    const tag = clean(disambiguator).slice(-12).trim();
    const alt = `${clean(raw).slice(0, 30 - tag.length).trim()} ${tag}`;
    if (!wb.getWorksheet(alt)) return alt;
  }
  let name = base;
  for (let n = 2; wb.getWorksheet(name); n++) name = `${base.slice(0, 28)} ${n}`;
  return name;
}

function titleBlock(ws: ExcelJS.Worksheet, lastCol: number, title: string, lines: string[]) {
  ws.mergeCells(1, 1, 1, lastCol);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  t.fill = fill(C.brand);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;
  lines.forEach((line, i) => {
    const r = i + 2;
    ws.mergeCells(r, 1, r, lastCol);
    const c = ws.getCell(r, 1);
    c.value = line;
    c.font = { size: 10, bold: i === 0, color: { argb: 'FF334155' } };
    c.fill = fill(C.brandLight);
    c.alignment = { indent: 1 };
  });
}

function headerRow(ws: ExcelJS.Worksheet, rowNo: number, labels: string[]) {
  const row = ws.getRow(rowNo);
  labels.forEach((l, i) => {
    const c = row.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(C.head);
    c.border = box;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 30;
}

function styleBody(row: ExcelJS.Row, cols: number, money: number[], dates: number[], zebra: boolean) {
  for (let i = 1; i <= cols; i++) {
    const c = row.getCell(i);
    c.border = box;
    c.font = { size: 10, ...(c.font || {}) };
    c.alignment = { vertical: 'middle', ...(c.alignment || {}) };
    if (zebra && !c.fill) c.fill = fill(C.zebra);
    if (money.includes(i)) c.numFmt = INR;
    if (dates.includes(i)) {
      c.numFmt = DATE;
      c.alignment = { ...c.alignment, horizontal: 'center' };
    }
  }
}

function finishSheet(ws: ExcelJS.Worksheet, headerAt: number, cols: number) {
  ws.views = [{ state: 'frozen', ySplit: headerAt, showGridLines: false }];
  ws.autoFilter = { from: { row: headerAt, column: 1 }, to: { row: headerAt, column: cols } };
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerAt}:${headerAt}` };
}

const SITE_COLS = [
  ['Sr', 5], ['Billing Period', 22], ['Invoice No', 20], ['Nature', 9], ['Invoice Date', 13],
  ['Sub Total', 14], ['GST', 12], ['Amount', 14], ['Paid / Unpaid', 11], ['Mode', 9],
  ['Paid Date', 13], ['Paid Amt', 14], ['TDS Amt', 11], ['Rem to Pay', 14], ['Remark', 34],
] as const;
const SITE_MONEY = [6, 7, 8, 12, 13, 14];
const SITE_DATES = [5, 11];

export function addSiteSheet(wb: ExcelJS.Workbook, site: SiteInfo, rows: LedgerRow[], range?: string) {
  // "Lokhandwala Kataria Construction Pvt. Ltd." -> "LKCPL", matching the manual workbook's tab names.
  const initials = site.client_name.split(/[^A-Za-z]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 6);
  const base = `${initials}-${site.site_name}`;
  const ws = wb.addWorksheet(sheetName(wb, base, site.work_order_ref), {
    properties: { tabColor: { argb: C.brand } },
  });
  const n = SITE_COLS.length;
  SITE_COLS.forEach(([, w], i) => (ws.getColumn(i + 1).width = w));

  titleBlock(ws, n, 'AMBE SERVICE — Outstanding Ledger', [
    `Client Name : ${site.client_name}   |   Site : ${site.site_name}`,
    `Work Order Ref No. : ${site.work_order_ref || '—'}   |   Work Order Period : ${site.work_order_period || '—'}`,
    `Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}${range ? `   |   ${range}` : ''}`,
  ]);
  const headAt = 6;
  headerRow(ws, headAt, SITE_COLS.map(([l]) => l));

  const opening = ws.addRow(['', 'Previous Year pending', '', '', '', '', '', site.opening]);
  styleBody(opening, n, SITE_MONEY, SITE_DATES, false);
  for (let i = 1; i <= n; i++) opening.getCell(i).fill = fill(C.opening);
  opening.font = { bold: true, size: 10 };

  const bills = rows.filter((r) => !isProforma(r));
  bills.forEach((r, idx) => {
    const t = rowTotals(r);
    const [first, ...more] = r.payments;
    const remark = [r.cancelled_reason, r.legacy_notes, ...r.payments.map((p) => [p.ref_no, p.remark].filter(Boolean).join(' '))]
      .filter(Boolean)
      .join('; ');
    const row = ws.addRow([
      idx + 1, r.billing_period || '', r.invoice_no.trim(), r.is_material ? 'Goods' : 'Hk', toDate(r.invoice_date),
      r.sub_total, z(r.tax_total), r.grand_total, t.status, first?.mode || '', toDate(first?.paid_date),
      z(first?.amount), z(first?.tds_amount), z(t.balance), remark,
    ]);
    styleBody(row, n, SITE_MONEY, SITE_DATES, idx % 2 === 1);
    const [bg, fg] = C.status[t.status];
    const st = row.getCell(9);
    st.fill = fill(bg);
    st.font = { bold: true, size: 10, color: { argb: fg } };
    st.alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).font = { bold: true, size: 10 };
    if (t.balance) row.getCell(14).font = { bold: true, size: 10, color: { argb: C.red } };
    row.getCell(15).alignment = { wrapText: true, vertical: 'middle' };
    if (r.excluded) for (let i = 2; i <= 8; i++) row.getCell(i).font = { size: 10, strike: true, color: { argb: 'FF94A3B8' } };

    // Extra instalments sit on their own lines under the bill, like the manual sheet.
    for (const p of more) {
      const pr = ws.addRow(['', '', '', '', '', null, null, null, '', p.mode, toDate(p.paid_date), p.amount, z(p.tds_amount), null, [p.ref_no, p.remark].filter(Boolean).join(' ')]);
      styleBody(pr, n, SITE_MONEY, SITE_DATES, idx % 2 === 1);
      pr.font = { size: 9, italic: true, color: { argb: 'FF475569' } };
    }
  });

  const tot = siteTotals(site, rows);
  const totalRow = ws.addRow(['', 'TOTAL', '', '', '', null, null, tot.billed, '', '', '', tot.received, tot.tds, tot.unpaid, '']);
  styleBody(totalRow, n, SITE_MONEY, SITE_DATES, false);
  for (let i = 1; i <= n; i++) {
    totalRow.getCell(i).fill = fill(C.total);
    totalRow.getCell(i).font = { bold: true, size: 10 };
    totalRow.getCell(i).border = { ...box, top: { style: 'medium', color: { argb: C.head } } };
  }

  // Proforma + summary blocks, side by side like the manual sheet.
  ws.addRow([]);
  const blockStart = (ws.lastRow?.number || 0) + 1;
  const proformas = rows.filter(isProforma);
  const label = (r: number, c: number, v: string) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(C.head);
    cell.border = box;
  };
  label(blockStart, 2, 'Proforma No');
  label(blockStart, 3, 'Period');
  label(blockStart, 4, 'Amt');
  ws.mergeCells(blockStart, 4, blockStart, 5);
  proformas.forEach((p, i) => {
    const r = blockStart + 1 + i;
    ws.getCell(r, 2).value = p.invoice_no.trim();
    ws.getCell(r, 3).value = p.billing_period || '';
    ws.mergeCells(r, 4, r, 5);
    const amt = ws.getCell(r, 4);
    amt.value = p.grand_total;
    amt.numFmt = INR;
    for (const c of [2, 3, 4]) {
      const cell = ws.getCell(r, c);
      cell.border = box;
      cell.font = { size: 10, strike: p.closed, color: { argb: p.closed ? 'FF94A3B8' : 'FF0F172A' } };
      cell.alignment = { wrapText: true, vertical: 'middle' };
    }
  });
  if (!proformas.length) {
    ws.getCell(blockStart + 1, 2).value = 'No proforma invoices';
    ws.getCell(blockStart + 1, 2).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } };
  }

  const summary: [string, number, boolean][] = [
    ['Previous Year pending', site.opening, false],
    ['Unpaid', tot.unpaid, false],
    ['Proforma', tot.proforma, false],
    ['Total', tot.total, true],
  ];
  summary.forEach(([k, v, strong], i) => {
    const r = blockStart + i;
    ws.mergeCells(r, 11, r, 13);
    const kc = ws.getCell(r, 11);
    kc.value = k;
    const vc = ws.getCell(r, 14);
    vc.value = v;
    vc.numFmt = INR;
    for (const c of [kc, vc]) {
      c.border = box;
      c.font = { size: strong ? 11 : 10, bold: strong, color: { argb: k === 'Unpaid' ? C.red : 'FF0F172A' } };
      if (strong) c.fill = fill(C.brandLight);
    }
  });

  finishSheet(ws, headAt, n);
  return ws;
}

const SUM_COLS = [
  ['Client', 42], ['Site', 36], ['Work Order Ref', 24], ['Bills', 7], ['Unpaid Bills', 9],
  ['Opening', 13], ['Billed', 15], ['Received', 15], ['TDS', 12],
  ['0-30 days', 13], ['31-60 days', 13], ['61-90 days', 13], ['90+ days', 13],
  ['Outstanding', 15], ['Oldest Due (days)', 10], ['Last Payment', 13],
] as const;

export function addSummarySheet(wb: ExcelJS.Workbook, rows: any[]) {
  const ws = wb.addWorksheet('ALL', { properties: { tabColor: { argb: C.head } } });
  const n = SUM_COLS.length;
  SUM_COLS.forEach(([, w], i) => (ws.getColumn(i + 1).width = w));
  const total = rows.reduce((s, r) => s + r.outstanding, 0);
  titleBlock(ws, n, 'AMBE SERVICE — All Outstanding', [
    `Total Outstanding : ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}   |   Sites : ${rows.length}`,
    `Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
  ]);
  const headAt = 5;
  headerRow(ws, headAt, SUM_COLS.map(([l]) => l));
  const money = [6, 7, 8, 9, 10, 11, 12, 13, 14];

  rows.forEach((r, i) => {
    const row = ws.addRow([
      r.client_name, r.site_name, r.work_order_ref || '', r.bills, r.unpaid_bills,
      z(r.opening), r.billed, z(r.received), z(r.tds),
      z(r.age_0_30), z(r.age_31_60), z(r.age_61_90), z(r.age_90_plus),
      r.outstanding, r.oldest_days ?? null, toDate(r.last_paid),
    ]);
    styleBody(row, n, money, [16], i % 2 === 1);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(14).font = { bold: true, size: 10, color: { argb: r.outstanding > 1 ? C.red : 'FF166534' } };
    if (r.age_90_plus > 0) row.getCell(13).font = { bold: true, size: 10, color: { argb: C.red } };
  });

  const first = headAt + 1;
  const last = headAt + rows.length;
  const tr = ws.addRow(['TOTAL', '', '', null, null]);
  for (let c = 4; c <= 14; c++) {
    const col = ws.getColumn(c).letter;
    tr.getCell(c).value = rows.length ? { formula: `SUBTOTAL(9,${col}${first}:${col}${last})` } : 0;
  }
  styleBody(tr, n, money, [16], false);
  for (let i = 1; i <= n; i++) {
    tr.getCell(i).fill = fill(C.total);
    tr.getCell(i).font = { bold: true, size: 10 };
    tr.getCell(i).border = { ...box, top: { style: 'medium', color: { argb: C.head } } };
  }

  finishSheet(ws, headAt, n);
  return ws;
}

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ambe Service ERP';
  wb.created = new Date();
  return wb;
}
