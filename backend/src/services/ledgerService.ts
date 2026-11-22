import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';

// Bills that count toward outstanding: not cancelled, not proforma.
export const ACTIVE_BILL = `i.cancelled_at IS NULL AND COALESCE(i.status, '') <> 'Cancelled' AND i.type NOT ILIKE '%proforma%'`;

// Legacy CSV rows duplicated by a real bill (same site, same number ignoring case/spaces/punctuation)
// are hidden so the ledger never counts a bill twice.
const normNo = (col: string) => `regexp_replace(upper(${col}), '[^A-Z0-9]', '', 'g')`;
export const NOT_SHADOWED = `NOT (i.legacy_notes = 'Legacy CSV import' AND EXISTS (
  SELECT 1 FROM public.invoices o
  WHERE o.site_id = i.site_id AND o.id <> i.id
    AND ${normNo('o.invoice_no')} = ${normNo('i.invoice_no')}
    AND (o.legacy_notes IS DISTINCT FROM 'Legacy CSV import' OR o.created_at < i.created_at)))`;

// Clients round off; a balance within ₹1 counts as settled.
export const SETTLE_TOLERANCE = 1;

export class LedgerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface LedgerPayment {
  id: string;
  paid_date: string;
  amount: number;
  tds_amount: number;
  mode: string;
  ref_no: string | null;
  remark: string | null;
}

export interface LedgerRow {
  id: string;
  invoice_no: string;
  type: string;
  status: string;
  invoice_date: string | null;
  billing_period: string | null;
  is_material: boolean;
  is_legacy: boolean;
  legacy_notes: string | null;
  cancelled_reason: string | null;
  sub_total: number;
  tax_total: number;
  grand_total: number;
  has_bill: boolean;
  has_generated: boolean;
  excluded: boolean;
  closed: boolean;
  payments: LedgerPayment[];
}

export interface SiteInfo {
  id: string;
  client_name: string;
  site_name: string;
  code_name: string | null;
  work_order_ref: string | null;
  work_order_period: string | null;
  opening: number;
  opening_note: string | null;
}

export interface PaymentInput {
  paid_date: string;
  amount: number;
  tds_amount: number;
  mode: string;
  ref_no?: string | null;
  remark?: string | null;
}

export const isProforma = (r: Pick<LedgerRow, 'type'>) => /proforma/i.test(r.type);

export function rowTotals(r: LedgerRow) {
  const paid = r.payments.reduce((s, p) => s + p.amount, 0);
  const tds = r.payments.reduce((s, p) => s + p.tds_amount, 0);
  const balance = Math.round((r.grand_total - paid - tds) * 100) / 100;
  const status = r.excluded ? 'Cancelled' : balance <= SETTLE_TOLERANCE ? 'Paid' : paid + tds > 0 ? 'Partial' : 'Unpaid';
  return { paid, tds, balance: r.excluded || balance <= SETTLE_TOLERANCE ? 0 : balance, status };
}

export function siteTotals(site: SiteInfo, rows: LedgerRow[]) {
  const bills = rows.filter((r) => !isProforma(r) && !r.excluded);
  const t = bills.map(rowTotals);
  const unpaid = t.reduce((s, x) => s + x.balance, 0);
  const proforma = rows.filter((r) => isProforma(r) && !r.closed).reduce((s, r) => s + r.grand_total, 0);
  return {
    billed: bills.reduce((s, r) => s + r.grand_total, 0),
    received: t.reduce((s, x) => s + x.paid, 0),
    tds: t.reduce((s, x) => s + x.tds, 0),
    unpaid,
    proforma,
    outstanding: site.opening + unpaid,
    total: site.opening + unpaid + proforma,
  };
}

export const LedgerService = {
  /** One row per site with aging buckets on unpaid balances (the "ALL" sheet). */
  async summary() {
    const { rows } = await pool.query(`
      WITH p AS (
        SELECT invoice_id, SUM(amount) AS paid, SUM(tds_amount) AS tds, MAX(paid_date) AS last_paid
        FROM public.invoice_payments GROUP BY invoice_id
      ),
      b AS (
        SELECT i.site_id, i.grand_total, COALESCE(p.paid, 0) AS paid, COALESCE(p.tds, 0) AS tds, p.last_paid,
               GREATEST(i.grand_total - COALESCE(p.paid, 0) - COALESCE(p.tds, 0), 0) AS due,
               COALESCE(CURRENT_DATE - i.invoice_date, 0) AS age
        FROM public.invoices i
        LEFT JOIN p ON p.invoice_id = i.id
        WHERE ${ACTIVE_BILL} AND ${NOT_SHADOWED}
      )
      SELECT s.id AS site_id, s.client_name, s.site_name, NULLIF(TRIM(s.code_name), '') AS code_name, s.work_order_ref,
             COUNT(b.site_id)::int AS bills,
             COUNT(b.site_id) FILTER (WHERE b.due > ${SETTLE_TOLERANCE})::int AS unpaid_bills,
             COALESCE(SUM(b.grand_total), 0)::float AS billed,
             COALESCE(SUM(b.paid), 0)::float AS received,
             COALESCE(SUM(b.tds), 0)::float AS tds,
             COALESCE(SUM(b.due) FILTER (WHERE b.due > ${SETTLE_TOLERANCE}), 0)::float AS due,
             COALESCE(SUM(b.due) FILTER (WHERE b.due > ${SETTLE_TOLERANCE} AND b.age <= 30), 0)::float AS age_0_30,
             COALESCE(SUM(b.due) FILTER (WHERE b.due > ${SETTLE_TOLERANCE} AND b.age BETWEEN 31 AND 60), 0)::float AS age_31_60,
             COALESCE(SUM(b.due) FILTER (WHERE b.due > ${SETTLE_TOLERANCE} AND b.age BETWEEN 61 AND 90), 0)::float AS age_61_90,
             COALESCE(SUM(b.due) FILTER (WHERE b.due > ${SETTLE_TOLERANCE} AND b.age > 90), 0)::float AS age_90_plus,
             MAX(b.age) FILTER (WHERE b.due > ${SETTLE_TOLERANCE})::int AS oldest_days,
             MAX(b.last_paid)::text AS last_paid,
             COALESCE(ob.amount, 0)::float AS opening
      FROM public.sites s
      LEFT JOIN b ON b.site_id = s.id
      LEFT JOIN public.ledger_opening_balances ob ON ob.site_id = s.id
      GROUP BY s.id, ob.amount
      ORDER BY COALESCE(NULLIF(TRIM(s.code_name), ''), s.client_name), s.site_name
    `);
    return rows.map((r) => ({ ...r, outstanding: r.opening + r.due }));
  },

  async site(siteId: string, from: string | null, to: string | null): Promise<{ site: SiteInfo; rows: LedgerRow[] }> {
    const siteRes = await pool.query(
      `SELECT s.id, s.client_name, s.site_name, NULLIF(TRIM(s.code_name), '') AS code_name, s.work_order_ref, s.work_order_period,
              COALESCE(ob.amount, 0)::float AS opening, ob.note AS opening_note
       FROM public.sites s
       LEFT JOIN public.ledger_opening_balances ob ON ob.site_id = s.id
       WHERE s.id = $1`,
      [siteId]
    );
    if (!siteRes.rows.length) throw new LedgerError(404, 'Site not found');

    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_no, i.type, i.status, i.invoice_date::text AS invoice_date, i.billing_period,
              i.is_material, i.is_legacy, i.legacy_notes, i.cancelled_reason,
              i.sub_total::float, i.tax_total::float, i.grand_total::float,
              (i.certified_doc_storage_key IS NOT NULL OR i.certified_doc_url IS NOT NULL) AS has_bill,
              (i.generated_pdf_storage_key IS NOT NULL OR i.generated_pdf_url IS NOT NULL) AS has_generated,
              NOT (${ACTIVE_BILL}) AS excluded,
              (i.cancelled_at IS NOT NULL OR i.status IN ('Cancelled', 'Converted', 'Revised')) AS closed,
              COALESCE(json_agg(json_build_object(
                'id', p.id, 'paid_date', p.paid_date::text, 'amount', p.amount::float,
                'tds_amount', p.tds_amount::float, 'mode', p.mode, 'ref_no', p.ref_no, 'remark', p.remark
              ) ORDER BY p.paid_date) FILTER (WHERE p.id IS NOT NULL), '[]') AS payments
       FROM public.invoices i
       LEFT JOIN public.invoice_payments p ON p.invoice_id = i.id
       WHERE i.site_id = $1
         AND ${NOT_SHADOWED}
         AND ($2::date IS NULL OR i.invoice_date >= $2::date)
         AND ($3::date IS NULL OR i.invoice_date <= $3::date)
       GROUP BY i.id
       ORDER BY i.invoice_date NULLS LAST, i.invoice_no`,
      [siteId, from, to]
    );
    return { site: siteRes.rows[0], rows };
  },

  async setOpening(siteId: string, amount: number, note: string | null) {
    const { rowCount } = await pool.query('SELECT 1 FROM public.sites WHERE id = $1', [siteId]);
    if (!rowCount) throw new LedgerError(404, 'Site not found');
    await pool.query(
      `INSERT INTO public.ledger_opening_balances (site_id, amount, note, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (site_id) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, updated_at = now()`,
      [siteId, amount, note]
    );
  },

  /** Insert (paymentId null) or update a payment; rejects payments that overshoot the bill. */
  async savePayment(invoiceId: string | null, paymentId: string | null, p: PaymentInput, userId: string | null) {
    return withTransaction(async (c: PoolClient) => {
      if (paymentId) {
        const cur = await c.query('SELECT invoice_id FROM public.invoice_payments WHERE id = $1', [paymentId]);
        if (!cur.rowCount) throw new LedgerError(404, 'Payment not found');
        invoiceId = cur.rows[0].invoice_id;
      }

      // Row lock serialises concurrent payments on the same bill so the overshoot check holds.
      const inv = await c.query(
        `SELECT i.invoice_no, i.grand_total::float, (${ACTIVE_BILL}) AS active
         FROM public.invoices i WHERE i.id = $1 FOR UPDATE`,
        [invoiceId]
      );
      if (!inv.rowCount) throw new LedgerError(404, 'Invoice not found');
      const { invoice_no, grand_total, active } = inv.rows[0];
      if (!active) throw new LedgerError(400, `Invoice ${invoice_no} is cancelled or proforma; payments cannot be recorded`);

      const prior = await c.query(
        `SELECT COALESCE(SUM(amount + tds_amount), 0)::float AS settled
         FROM public.invoice_payments WHERE invoice_id = $1 AND id IS DISTINCT FROM $2`,
        [invoiceId, paymentId]
      );
      const remaining = grand_total - prior.rows[0].settled;
      if (p.amount + p.tds_amount > remaining + SETTLE_TOLERANCE) {
        throw new LedgerError(
          400,
          `Paid + TDS (₹${(p.amount + p.tds_amount).toFixed(2)}) exceeds remaining ₹${remaining.toFixed(2)} on ${invoice_no}`
        );
      }

      if (paymentId) {
        await c.query(
          `UPDATE public.invoice_payments
           SET paid_date = $2, amount = $3, tds_amount = $4, mode = $5, ref_no = $6, remark = $7, updated_at = now()
           WHERE id = $1`,
          [paymentId, p.paid_date, p.amount, p.tds_amount, p.mode, p.ref_no ?? null, p.remark ?? null]
        );
        return { id: paymentId };
      }
      const ins = await c.query(
        `INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, ref_no, remark, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [invoiceId, p.paid_date, p.amount, p.tds_amount, p.mode, p.ref_no ?? null, p.remark ?? null, userId]
      );
      return ins.rows[0] as { id: string };
    });
  },

  async deletePayment(paymentId: string) {
    const { rowCount } = await pool.query('DELETE FROM public.invoice_payments WHERE id = $1', [paymentId]);
    if (!rowCount) throw new LedgerError(404, 'Payment not found');
  },
};
