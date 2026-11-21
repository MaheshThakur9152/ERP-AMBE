import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

// Bills that count toward outstanding: not cancelled, not proforma.
const ACTIVE_BILL = `i.cancelled_at IS NULL AND COALESCE(i.status, '') <> 'Cancelled' AND i.type NOT ILIKE '%proforma%'`;

const paymentSchema = z.object({
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().min(0),
  tds_amount: z.coerce.number().min(0).default(0),
  mode: z.enum(['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other']).default('NEFT'),
  ref_no: z.string().max(100).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
});

// Validation errors are client mistakes: 400, not the generic 500 from errorHandler.
const fail = (err: unknown, res: Response, next: NextFunction): void => {
  if (err instanceof z.ZodError) res.status(400).json({ error: 'Invalid input', details: err.issues });
  else next(err);
};

const dateParam = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

export class LedgerController {
  /** GET /api/ledger/summary - outstanding per site (the "ALL" sheet). */
  static async summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rows } = await pool.query(`
        WITH p AS (
          SELECT invoice_id, SUM(amount) AS paid, SUM(tds_amount) AS tds
          FROM public.invoice_payments GROUP BY invoice_id
        )
        SELECT s.id AS site_id, s.client_name, s.site_name, s.work_order_ref,
               COUNT(i.id)::int AS bills,
               COALESCE(SUM(i.grand_total), 0)::float AS billed,
               COALESCE(SUM(p.paid), 0)::float AS received,
               COALESCE(SUM(p.tds), 0)::float AS tds,
               COALESCE(MAX(ob.amount), 0)::float AS opening
        FROM public.sites s
        LEFT JOIN public.invoices i ON i.site_id = s.id AND ${ACTIVE_BILL}
        LEFT JOIN p ON p.invoice_id = i.id
        LEFT JOIN public.ledger_opening_balances ob ON ob.site_id = s.id
        GROUP BY s.id
        ORDER BY s.client_name, s.site_name
      `);
      res.json(rows.map((r) => ({ ...r, outstanding: r.opening + r.billed - r.received - r.tds })));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/ledger/sites/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD */
  static async siteLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId } = req.params;
      const siteRes = await pool.query(
        `SELECT s.id, s.client_name, s.site_name, s.work_order_ref, s.work_order_period,
                COALESCE(ob.amount, 0)::float AS opening, ob.note AS opening_note
         FROM public.sites s
         LEFT JOIN public.ledger_opening_balances ob ON ob.site_id = s.id
         WHERE s.id = $1`,
        [siteId]
      );
      if (!siteRes.rows.length) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }

      const { rows } = await pool.query(
        `SELECT i.id, i.invoice_no, i.type, i.status, i.invoice_date, i.billing_period,
                i.is_material, i.is_legacy, i.legacy_notes, i.cancelled_at, i.cancelled_reason,
                i.sub_total::float, i.tax_total::float, i.grand_total::float,
                (i.certified_doc_storage_key IS NOT NULL OR i.certified_doc_url IS NOT NULL) AS has_bill,
                (i.generated_pdf_storage_key IS NOT NULL OR i.generated_pdf_url IS NOT NULL) AS has_generated,
                NOT (${ACTIVE_BILL}) AS excluded,
                (i.cancelled_at IS NOT NULL OR i.status IN ('Cancelled', 'Converted', 'Revised')) AS closed,
                COALESCE(json_agg(json_build_object(
                  'id', p.id, 'paid_date', p.paid_date, 'amount', p.amount::float,
                  'tds_amount', p.tds_amount::float, 'mode', p.mode, 'ref_no', p.ref_no, 'remark', p.remark
                ) ORDER BY p.paid_date) FILTER (WHERE p.id IS NOT NULL), '[]') AS payments
         FROM public.invoices i
         LEFT JOIN public.invoice_payments p ON p.invoice_id = i.id
         WHERE i.site_id = $1
           AND ($2::date IS NULL OR i.invoice_date >= $2::date)
           AND ($3::date IS NULL OR i.invoice_date <= $3::date)
         GROUP BY i.id
         ORDER BY i.invoice_date NULLS LAST, i.invoice_no`,
        [siteId, dateParam(req.query.from), dateParam(req.query.to)]
      );

      res.json({ site: siteRes.rows[0], rows });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/ledger/sites/:siteId/opening */
  static async setOpening(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = z.object({ amount: z.coerce.number(), note: z.string().max(500).optional().nullable() }).parse(req.body);
      await pool.query(
        `INSERT INTO public.ledger_opening_balances (site_id, amount, note, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (site_id) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, updated_at = now()`,
        [req.params.siteId, body.amount, body.note ?? null]
      );
      res.json({ ok: true });
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** POST /api/ledger/invoices/:invoiceId/payments */
  static async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = paymentSchema.parse(req.body);
      const { rows } = await pool.query(
        `INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, ref_no, remark, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [req.params.invoiceId, b.paid_date, b.amount, b.tds_amount, b.mode, b.ref_no ?? null, b.remark ?? null, (req as any).user?.id ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** PATCH /api/ledger/payments/:id */
  static async updatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = paymentSchema.parse(req.body);
      const { rowCount } = await pool.query(
        `UPDATE public.invoice_payments
         SET paid_date = $2, amount = $3, tds_amount = $4, mode = $5, ref_no = $6, remark = $7, updated_at = now()
         WHERE id = $1`,
        [req.params.id, b.paid_date, b.amount, b.tds_amount, b.mode, b.ref_no ?? null, b.remark ?? null]
      );
      if (!rowCount) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** DELETE /api/ledger/payments/:id */
  static async deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await pool.query('DELETE FROM public.invoice_payments WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
}
