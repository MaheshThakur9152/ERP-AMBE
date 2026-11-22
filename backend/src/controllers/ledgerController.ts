import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LedgerService, LedgerError } from '../services/ledgerService';
import { LegacyLedgerService } from '../services/legacyLedgerService';
import { addSiteSheet, addSummarySheet, newWorkbook } from '../services/ledgerExport';
import ExcelJS from 'exceljs';

const paymentSchema = z.object({
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().min(0),
  tds_amount: z.coerce.number().min(0).default(0),
  mode: z.enum(['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other']).default('NEFT'),
  ref_no: z.string().max(100).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
}).refine((p) => p.amount + p.tds_amount > 0, { message: 'Paid amount or TDS must be greater than 0' });

// Validation and domain errors are client mistakes: 4xx, not the generic 500 from errorHandler.
const fail = (err: unknown, res: Response, next: NextFunction): void => {
  if (err instanceof z.ZodError) res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', details: err.issues });
  else if (err instanceof LedgerError) res.status(err.status).json({ error: err.message });
  else next(err);
};

const dateParam = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

async function sendWorkbook(res: Response, wb: ExcelJS.Workbook, fileName: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^\w.-]+/g, '_')}"`);
  await wb.xlsx.write(res);
  res.end();
}

export class LedgerController {
  /** GET /api/ledger/summary */
  static async summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await LedgerService.summary());
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** GET /api/ledger/sites/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD */
  static async siteLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await LedgerService.site(req.params.siteId, dateParam(req.query.from), dateParam(req.query.to)));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** GET /api/ledger/export - ALL sheet + one sheet per site with activity. */
  static async exportAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await LedgerService.summary();
      const active = summary.filter((s) => s.bills > 0 || s.opening !== 0);
      const wb = newWorkbook();
      addSummarySheet(wb, [...active].sort((a, b) => b.outstanding - a.outstanding));
      for (const s of active) {
        const { site, rows } = await LedgerService.site(s.site_id, null, null);
        addSiteSheet(wb, site, rows);
      }
      await sendWorkbook(res, wb, `ALL_OUTSTANDING_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** GET /api/ledger/sites/:siteId/export?from&to */
  static async exportSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const from = dateParam(req.query.from);
      const to = dateParam(req.query.to);
      const { site, rows } = await LedgerService.site(req.params.siteId, from, to);
      const wb = newWorkbook();
      addSiteSheet(wb, site, rows, from || to ? `Bills dated ${from || 'start'} to ${to || 'today'}` : undefined);
      await sendWorkbook(res, wb, `Ledger_${site.client_name}_${site.site_name}.xlsx`);
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** PUT /api/ledger/sites/:siteId/opening */
  static async setOpening(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = z.object({ amount: z.coerce.number(), note: z.string().max(500).optional().nullable() }).parse(req.body);
      await LedgerService.setOpening(req.params.siteId, b.amount, b.note ?? null);
      res.json({ ok: true });
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** POST /api/ledger/invoices/:invoiceId/payments */
  static async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = paymentSchema.parse(req.body);
      res.status(201).json(await LedgerService.savePayment(req.params.invoiceId, null, b, req.user?.id ?? null));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** PATCH /api/ledger/payments/:id */
  static async updatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = paymentSchema.parse(req.body);
      res.json(await LedgerService.savePayment(null, req.params.id, b, req.user?.id ?? null));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** DELETE /api/ledger/payments/:id */
  static async deletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await LedgerService.deletePayment(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** POST /api/ledger/legacy/preview (multipart file) - tabs found and the site each one matches. */
  static async legacyPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new LedgerError(400, 'Upload the legacy ledger .xlsx file');
      res.json(await LegacyLedgerService.preview(req.file.buffer));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** POST /api/ledger/legacy/import (multipart file + mapping JSON {tab: siteId}) */
  static async legacyImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new LedgerError(400, 'Upload the legacy ledger .xlsx file');
      const mapping = z.record(z.string(), z.string()).parse(JSON.parse(String(req.body.mapping || '{}')));
      res.json(await LegacyLedgerService.import(req.file.buffer, mapping, req.file.originalname, (req as any).user?.id || null));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** GET /api/ledger/sites/:siteId/legacy */
  static async legacyRows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await LegacyLedgerService.rowsForSite(req.params.siteId));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** POST /api/ledger/legacy/rows/:rowId/payments - money received after cut-off for an old xlsx bill. */
  static async legacyAddPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const p = paymentSchema.parse(req.body);
      res.status(201).json(await LegacyLedgerService.addPayment(req.params.rowId, p, (req as any).user?.id || null));
    } catch (err) {
      fail(err, res, next);
    }
  }

  /** DELETE /api/ledger/legacy/payments/:id */
  static async legacyDeletePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await LegacyLedgerService.deletePayment(req.params.id);
      res.status(204).end();
    } catch (err) {
      fail(err, res, next);
    }
  }
}
