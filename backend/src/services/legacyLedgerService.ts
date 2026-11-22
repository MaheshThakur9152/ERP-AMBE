import ExcelJS from 'exceljs';
import { pool, withTransaction } from '../db/pool';
import { LedgerError, PaymentInput } from './ledgerService';

/**
 * Legacy ledger: the client's old xlsx outstanding workbook, stored row-for-row and kept apart from
 * public.invoices. Per site, the month after its last legacy bill is the cut-off: the ledger shows the
 * xlsx before it and real ERP bills from it on. Unpaid legacy rows become the site's opening balance.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Billing month of an ERP invoice: month + 4-digit year named in billing_period, else invoice_date's month. */
export const BILL_MONTH = (a = 'i') => `COALESCE(
  make_date(
    (regexp_match(lower(${a}.billing_period), '(20[0-9]{2})'))[1]::int,
    array_position(ARRAY['${MONTHS.join("','")}'], (regexp_match(lower(${a}.billing_period), '(${MONTHS.join('|')})'))[1]),
    1),
  date_trunc('month', ${a}.invoice_date)::date)`;

/** Per site: legacy unpaid (after later ERP payments) and the cut-off month. */
export const LEGACY_SITE_CTE = `lg AS (
  SELECT r.site_id,
         SUM(GREATEST(r.xlsx_due - COALESCE(lp.settled, 0), 0)) AS due,
         (MAX(r.bill_month) FILTER (WHERE r.amount > 0 AND NOT r.is_proforma) + interval '1 month')::date AS cutoff
  FROM public.legacy_ledger_rows r
  LEFT JOIN (SELECT legacy_row_id, SUM(amount + tds_amount) AS settled FROM public.legacy_ledger_payments GROUP BY legacy_row_id) lp
    ON lp.legacy_row_id = r.id
  GROUP BY r.site_id
)`;

export interface LegacyRow {
  row_no: number;
  billing_period: string | null;
  invoice_no: string;
  invoice_period: string | null;
  nature: string | null;
  invoice_date: string | null;
  sub_total: number;
  gst: number;
  amount: number;
  status: string | null;
  mode: string | null;
  paid_date: string | null;
  paid_amt: number;
  remark: string | null;
  rem_to_pay: number;
  tds: number;
  tds_amt: number;
  is_proforma: boolean;
  bill_month: string | null;
  xlsx_due: number;
}

let ready = false;
export async function ensureLegacyTables(): Promise<void> {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.legacy_ledger_rows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      row_no int NOT NULL,
      billing_period text, invoice_no text NOT NULL, invoice_period text, nature text, invoice_date text,
      sub_total numeric NOT NULL DEFAULT 0, gst numeric NOT NULL DEFAULT 0, amount numeric NOT NULL DEFAULT 0,
      status text, mode text, paid_date text, paid_amt numeric NOT NULL DEFAULT 0, remark text,
      rem_to_pay numeric NOT NULL DEFAULT 0, tds numeric NOT NULL DEFAULT 0, tds_amt numeric NOT NULL DEFAULT 0,
      is_proforma boolean NOT NULL DEFAULT false,
      bill_month date,
      xlsx_due numeric NOT NULL DEFAULT 0,
      source_file text, source_tab text,
      imported_by uuid, imported_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_legacy_ledger_rows_site ON public.legacy_ledger_rows(site_id, row_no);
    CREATE TABLE IF NOT EXISTS public.legacy_ledger_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_row_id uuid NOT NULL REFERENCES public.legacy_ledger_rows(id) ON DELETE CASCADE,
      paid_date date NOT NULL, amount numeric NOT NULL DEFAULT 0, tds_amount numeric NOT NULL DEFAULT 0,
      mode text NOT NULL DEFAULT 'NEFT', ref_no text, remark text,
      created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  ready = true;
}

// ---------- xlsx parsing ----------

const num = (v: string): number => {
  const c = (v || '').replace(/[₹,\s]/g, '');
  if (!c || c.startsWith('#')) return 0;
  const n = parseFloat(c);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};
const txt = (v: string) => (v || '').replace(/\s+/g, ' ').trim() || null;

function cellText(cell: ExcelJS.Cell): string {
  let v: any = cell.value;
  if (v && typeof v === 'object' && 'result' in v) v = v.result;
  if (v instanceof Date) {
    // xlsx dates are stored as UTC midnight; print the calendar day as written
    return `${String(v.getUTCDate()).padStart(2, '0')}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${v.getUTCFullYear()}`;
  }
  if (v && typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
  if (v && typeof v === 'object' && 'text' in v) return String(v.text);
  if (v && typeof v === 'object' && 'error' in v) return '';
  return v === null || v === undefined ? '' : String(v);
}

/** First "Mon … 20YY" in the text, else the month of a dd-mm-yyyy / "dd Month yyyy" date. */
function monthOf(...texts: (string | null)[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const l = t.toLowerCase();
    const m = l.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[^0-9]{0,4}(20\d{2})/);
    if (m) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-01`;
    const d = l.match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
    if (d) {
      let mo = parseInt(d[2], 10);
      if (mo > 12) mo = parseInt(d[1], 10);
      if (mo >= 1 && mo <= 12) return `${d[3]}-${String(mo).padStart(2, '0')}-01`;
    }
  }
  return null;
}

export function parseSheet(ws: ExcelJS.Worksheet): LegacyRow[] {
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => (cells[c - 1] = cellText(cell)));
    grid[r - 1] = cells;
  });
  const h = grid.findIndex((r) => (r || []).some((c) => /invoice\s*no/i.test(c || '')));
  if (h === -1) return [];
  const header = grid[h].map((c) => (c || '').replace(/\s+/g, ' ').trim());
  const col = (re: RegExp) => header.findIndex((c) => re.test(c));
  const C = {
    billing: col(/billing\s*period/i), inv: col(/invoice\s*no/i), period: col(/invoice\s*period/i),
    nature: col(/nature/i), date: col(/invoice\s*date/i), sub: col(/sub\s*total/i), gst: col(/gst/i),
    amount: col(/^amount/i), status: col(/paid\s*\/\s*unpaid/i), mode: col(/mode/i), paidDate: col(/paid\s*date/i),
    paidAmt: col(/paid\s*amt/i), remark: col(/remark/i), rem: col(/rem\s*to\s*pay/i),
    tds: col(/^tds$/i), tdsAmt: col(/tds\s*amt/i),
  };
  const g = (r: string[], i: number) => (i === -1 ? '' : r[i] || '');

  const out: LegacyRow[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const invoice_no = txt(g(r, C.inv));
    if (!invoice_no) continue; // totals, notes, scratch sums below the table
    const status = txt(g(r, C.status));
    const amount = num(g(r, C.amount));
    const rem = num(g(r, C.rem));
    const is_proforma = /\/P\//i.test(invoice_no) || /^PI$/i.test(txt(r[0] || '') || '');
    // The xlsx's own rule: Unpaid owes the amount, "paid - not fully" owes Rem to Pay, Paid owes nothing.
    const xlsx_due = is_proforma ? 0
      : /unpaid/i.test(status || '') ? amount
      : /not\s*full|partial/i.test(status || '') ? rem
      : 0;
    out.push({
      row_no: i + 1,
      billing_period: txt(g(r, C.billing)),
      invoice_no,
      invoice_period: txt(g(r, C.period)),
      nature: txt(g(r, C.nature)),
      invoice_date: txt(g(r, C.date)),
      sub_total: num(g(r, C.sub)),
      gst: num(g(r, C.gst)),
      amount,
      status,
      mode: txt(g(r, C.mode)),
      paid_date: txt(g(r, C.paidDate)),
      paid_amt: num(g(r, C.paidAmt)),
      remark: txt(g(r, C.remark)),
      rem_to_pay: rem,
      tds: num(g(r, C.tds)),
      tds_amt: num(g(r, C.tdsAmt)),
      is_proforma,
      bill_month: monthOf(txt(g(r, C.period)), txt(g(r, C.billing)), txt(g(r, C.date))),
      xlsx_due,
    });
  }
  return out;
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const LegacyLedgerService = {
  /** One entry per tab with a ledger table, with the site it matches by code name (or site name). */
  async preview(buffer: Buffer) {
    await ensureLegacyTables();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sites = (await pool.query(
      `SELECT id, client_name, site_name, NULLIF(TRIM(code_name), '') AS code_name FROM public.sites ORDER BY code_name NULLS LAST, site_name`
    )).rows;
    const existing = new Map<string, number>(
      (await pool.query('SELECT site_id, COUNT(*)::int AS n FROM public.legacy_ledger_rows GROUP BY site_id')).rows.map((r: any) => [r.site_id, r.n])
    );
    const tabs = wb.worksheets.map((ws) => {
      const rows = parseSheet(ws);
      const key = norm(ws.name);
      const match = key
        ? sites.find((s: any) => s.code_name && norm(s.code_name) === key) ||
          sites.find((s: any) => s.code_name && (norm(s.code_name).includes(key) || key.includes(norm(s.code_name)))) ||
          sites.find((s: any) => norm(s.site_name) === key)
        : null;
      const months = rows.filter((r) => r.amount > 0 && !r.is_proforma && r.bill_month).map((r) => r.bill_month!).sort();
      return {
        tab: ws.name,
        rows: rows.length,
        billed: rows.filter((r) => !r.is_proforma).reduce((s, r) => s + r.amount, 0),
        due: rows.reduce((s, r) => s + r.xlsx_due, 0),
        lastMonth: months[months.length - 1] || null,
        siteId: match?.id || null,
        existingRows: match ? existing.get(match.id) || 0 : 0,
      };
    }).filter((t) => t.rows > 0);
    return { tabs, sites };
  },

  /** Replaces the legacy rows of every mapped site with that tab's rows. Later ERP payments on rows are dropped too. */
  async import(buffer: Buffer, mapping: Record<string, string>, fileName: string, userId: string | null) {
    await ensureLegacyTables();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const siteIds = Object.values(mapping).filter(Boolean);
    if (new Set(siteIds).size !== siteIds.length) throw new LedgerError(400, 'Two tabs are mapped to the same site');

    return withTransaction(async (c) => {
      let total = 0;
      for (const ws of wb.worksheets) {
        const siteId = mapping[ws.name];
        if (!siteId) continue;
        const rows = parseSheet(ws);
        await c.query('DELETE FROM public.legacy_ledger_rows WHERE site_id = $1', [siteId]);
        for (const r of rows) {
          await c.query(
            `INSERT INTO public.legacy_ledger_rows (site_id, row_no, billing_period, invoice_no, invoice_period, nature, invoice_date,
               sub_total, gst, amount, status, mode, paid_date, paid_amt, remark, rem_to_pay, tds, tds_amt, is_proforma,
               bill_month, xlsx_due, source_file, source_tab, imported_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
            [siteId, r.row_no, r.billing_period, r.invoice_no, r.invoice_period, r.nature, r.invoice_date,
              r.sub_total, r.gst, r.amount, r.status, r.mode, r.paid_date, r.paid_amt, r.remark, r.rem_to_pay, r.tds, r.tds_amt,
              r.is_proforma, r.bill_month, r.xlsx_due, fileName, ws.name, userId]
          );
        }
        total += rows.length;
      }
      return { sites: siteIds.length, rows: total };
    });
  },

  async rowsForSite(siteId: string) {
    await ensureLegacyTables();
    const { rows } = await pool.query(
      `SELECT r.*, r.sub_total::float, r.gst::float, r.amount::float, r.paid_amt::float, r.rem_to_pay::float,
              r.tds::float, r.tds_amt::float, r.xlsx_due::float, r.bill_month::text,
              COALESCE(json_agg(json_build_object('id', p.id, 'paid_date', p.paid_date::text, 'amount', p.amount::float,
                'tds_amount', p.tds_amount::float, 'mode', p.mode, 'ref_no', p.ref_no, 'remark', p.remark)
                ORDER BY p.paid_date) FILTER (WHERE p.id IS NOT NULL), '[]') AS payments
       FROM public.legacy_ledger_rows r
       LEFT JOIN public.legacy_ledger_payments p ON p.legacy_row_id = r.id
       WHERE r.site_id = $1
       GROUP BY r.id
       ORDER BY r.row_no`,
      [siteId]
    );
    return rows.map((r: any) => {
      const settled = r.payments.reduce((s: number, p: any) => s + p.amount + p.tds_amount, 0);
      return { ...r, due: Math.max(0, Math.round((r.xlsx_due - settled) * 100) / 100) };
    });
  },

  async addPayment(rowId: string, p: PaymentInput, userId: string | null) {
    await ensureLegacyTables();
    const cur = await pool.query(
      `SELECT r.invoice_no, r.xlsx_due::float - COALESCE((SELECT SUM(amount + tds_amount) FROM public.legacy_ledger_payments WHERE legacy_row_id = r.id), 0)::float AS remaining
       FROM public.legacy_ledger_rows r WHERE r.id = $1`,
      [rowId]
    );
    if (!cur.rowCount) throw new LedgerError(404, 'Legacy row not found');
    const { invoice_no, remaining } = cur.rows[0];
    if (p.amount + p.tds_amount > remaining + 1) {
      throw new LedgerError(400, `Paid + TDS exceeds the ₹${remaining.toFixed(2)} still due on ${invoice_no}`);
    }
    const ins = await pool.query(
      `INSERT INTO public.legacy_ledger_payments (legacy_row_id, paid_date, amount, tds_amount, mode, ref_no, remark, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [rowId, p.paid_date, p.amount, p.tds_amount, p.mode, p.ref_no ?? null, p.remark ?? null, userId]
    );
    return ins.rows[0];
  },

  async deletePayment(id: string) {
    const { rowCount } = await pool.query('DELETE FROM public.legacy_ledger_payments WHERE id = $1', [id]);
    if (!rowCount) throw new LedgerError(404, 'Payment not found');
  },
};
