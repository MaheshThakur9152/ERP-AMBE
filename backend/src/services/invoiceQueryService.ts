import { z } from 'zod';
import crypto from 'crypto';
import { pool, withTransaction } from '../db/pool';
import { InvoiceRecord } from '../types/invoice';
import { CompanyService } from './companyService';
import { InvoiceMathService } from './invoiceMathService';
import { InvoiceSequenceService } from './invoiceSequenceService';
import { env } from '../config/env';
import { DEFAULT_MGMT_FEE_PERCENT } from '../config/constants';
import { AuthUser } from '../types/express';
import { enrichInvoicesWithViewUrls, enrichInvoiceWithViewUrls } from '../utils/documentViewHelper';
import { OracleStorageService } from './oracleStorageService';
import { CompressionService } from './compressionService';
import { buildInvoiceStorageKey } from '../utils/storageKeys';

const DateOrString = z.union([z.string(), z.date()]).optional().nullable();

const InvoiceRowSchema = z.object({
  id: z.string().optional().nullable(),
  invoice_no: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  invoice_date: DateOrString,
  date: DateOrString,
  billing_period: z.string().optional().nullable(),
  month_year: z.string().optional().nullable(),
  monthYear: z.string().optional().nullable(),
  grand_total: z.union([z.number(), z.string()]).optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  sub_total: z.union([z.number(), z.string()]).optional().nullable(),
  tax_total: z.union([z.number(), z.string()]).optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  company_id: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  site_id: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  companies: z.record(z.any()).optional().nullable(),
  sites: z.record(z.any()).optional().nullable(),
  payload: z.record(z.any()).optional().nullable(),
  line_items: z.array(z.any()).optional().nullable(),
  items_count: z.union([z.number(), z.string()]).optional().nullable(),
  itemsCount: z.union([z.number(), z.string()]).optional().nullable(),
  mgmt_percent: z.union([z.number(), z.string()]).optional().nullable(),
  mgmtPercent: z.union([z.number(), z.string()]).optional().nullable(),
  management_fee_percent: z.union([z.number(), z.string()]).optional().nullable(),
  machinery_charges: z.union([z.number(), z.string()]).optional().nullable(),
  machineryCharges: z.union([z.number(), z.string()]).optional().nullable(),
  material_charges: z.union([z.number(), z.string()]).optional().nullable(),
  materialCharges: z.union([z.number(), z.string()]).optional().nullable(),
  additional_charges: z.any().optional().nullable(),
  additionalCharges: z.any().optional().nullable(),
  is_material: z.boolean().optional().nullable(),
  is_locked: z.boolean().optional().nullable(),
  is_legacy: z.boolean().optional().nullable(),
  isLegacy: z.boolean().optional().nullable(),
  legacy_uploaded_by: z.string().optional().nullable(),
  legacy_notes: z.string().optional().nullable(),
  challan_no: z.string().optional().nullable(),
  challan_date: DateOrString,
  buyer_order_no: z.string().optional().nullable(),
  dispatch_doc_no: z.string().optional().nullable(),
  dispatched_through: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  terms_of_delivery: z.string().optional().nullable(),
  certified_doc_url: z.string().optional().nullable(),
  certifiedDocUrl: z.string().optional().nullable(),
  certified_attendance_url: z.string().optional().nullable(),
  certifiedAttendanceUrl: z.string().optional().nullable(),
  created_at: DateOrString,
  updated_at: DateOrString,
}).passthrough();

export function mapRowToInvoiceRecord(rawRow: any): InvoiceRecord {
  const row = InvoiceRowSchema.parse(rawRow || {});
  const comp = row.companies || {};
  const site = row.sites || {};
  const payload = row.payload || null;

  const companyName = comp.legal_name || comp.name || payload?.company?.name || '';
  const clientName = site.client_name || site.clientName || payload?.party?.name || '';
  const siteName = site.site_name || site.siteName || payload?.party?.siteName || '';

  const invoiceNo = row.invoice_no || row.invoiceNo || payload?.meta?.invoiceNo || '';
  const rawDate = row.invoice_date || row.date || payload?.meta?.invoiceDate || '';
  const date = rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate || '');
  const monthYear = row.billing_period || row.month_year || row.monthYear || payload?.meta?.billingPeriod || '';
  const amount = Number(row.grand_total ?? row.amount ?? payload?.meta?.amount ?? 0);

  const defaultCompany = {
    name: companyName,
    addressLine1: comp.address_line1 || payload?.company?.addressLine1 || '',
    addressLine2: comp.address_line2 || payload?.company?.addressLine2 || `${comp.city || ''} ${comp.pincode || ''}`.trim(),
    contactNo: comp.phone || comp.contact_no || payload?.company?.contactNo || '',
    emailWebsite: comp.email || comp.email_website || payload?.company?.emailWebsite || '',
    cinNo: comp.cin || comp.cin_no || payload?.company?.cinNo || '',
    gstin: comp.gstin || payload?.company?.gstin || '',
  };

  const defaultParty = {
    name: clientName,
    siteName: siteName,
    address: site.address || payload?.party?.address || '',
    contactNo: site.contact_no || site.contactNo || payload?.party?.contactNo || '',
    email: site.email || payload?.party?.email || '',
    gstin: site.gstin || payload?.party?.gstin || '',
    workOrderRefNo: site.work_order_ref || payload?.party?.workOrderRefNo || '',
    workOrderPeriod: site.work_order_period || payload?.party?.workOrderPeriod || '',
  };

  const defaultBank = {
    bankName: comp.bank_name || payload?.bank?.bankName || '',
    accountNo: comp.bank_account_no || comp.account_no || payload?.bank?.accountNo || '',
    ifscCode: comp.bank_ifsc || comp.ifsc_code || payload?.bank?.ifscCode || '',
    branch: comp.bank_branch || comp.branch_name || payload?.bank?.branch || '',
  };

  const rawTerms = comp.terms_and_conditions || comp.default_terms || payload?.terms || '';
  const formattedTerms = Array.isArray(rawTerms) ? rawTerms.join(' | ') : String(rawTerms);

  const mgmtPercent = Number(
    payload?.mgmtPercent ??
    row.mgmt_percent ??
    row.mgmtPercent ??
    row.management_fee_percent ??
    site.management_fee_percent ??
    site.mgmt_percent ??
    DEFAULT_MGMT_FEE_PERCENT
  );

  const machineryCharges = Number(payload?.machineryCharges ?? row.machinery_charges ?? row.machineryCharges ?? 0);
  const materialCharges = Number(payload?.materialCharges ?? row.material_charges ?? row.materialCharges ?? 0);

  const additionalCharges = InvoiceMathService.buildAdditionalCharges(
    machineryCharges,
    materialCharges,
    payload?.additionalCharges || payload?.additional_charges || row.additional_charges || row.additionalCharges
  );

  const fullPayload = payload
    ? {
        ...payload,
        company: { ...defaultCompany, ...(payload.company || {}), name: payload.company?.name || companyName },
        party: {
          ...defaultParty,
          ...(payload.party || {}),
          name: payload.party?.name || clientName,
          siteName: payload.party?.siteName || siteName,
          contactNo: payload.party?.contactNo || defaultParty.contactNo,
          email: payload.party?.email || defaultParty.email,
        },
        mgmtPercent,
        machineryCharges,
        materialCharges,
        additionalCharges,
      }
    : {
        company: defaultCompany,
        meta: { invoiceNo, invoiceDate: date, billingPeriod: monthYear, invoiceType: row.type },
        party: defaultParty,
        bank: defaultBank,
        items: row.line_items || [],
        mgmtPercent,
        machineryCharges,
        materialCharges,
        additionalCharges,
        cgstPercent: 9,
        sgstPercent: 9,
        terms: formattedTerms,
      };

  return {
    id: row.id || '',
    invoiceNo,
    companyId: row.company_id || row.companyId || undefined,
    siteId: row.site_id || row.siteId || undefined,
    company_id: row.company_id || row.companyId || undefined,
    site_id: row.site_id || row.siteId || undefined,
    date,
    invoice_date: date,
    monthYear,
    billing_period: monthYear,
    clientName,
    siteName,
    amount,
    sub_total: Number(row.sub_total || 0),
    tax_total: Number(row.tax_total || 0),
    grand_total: amount,
    machinery_charges: machineryCharges,
    machineryCharges: machineryCharges,
    material_charges: materialCharges,
    materialCharges: materialCharges,
    additional_charges: additionalCharges,
    additionalCharges: additionalCharges,
    type: row.type || 'Tax Invoice',
    status: row.status || 'Pending',
    itemsCount: Number(row.items_count || row.itemsCount || (row.line_items ? row.line_items.length : 0)),
    line_items: row.line_items || [],
    challan_no: row.challan_no || row.payload?.meta?.challanNo || row.payload?.challanNo || '',
    challan_date: row.challan_date || row.payload?.meta?.challanDate || row.payload?.challanDate || '',
    buyer_order_no: row.buyer_order_no || row.payload?.meta?.buyerOrderNo || row.payload?.buyerOrderNo || '',
    dispatch_doc_no: row.dispatch_doc_no || row.payload?.meta?.dispatchDocNo || row.payload?.dispatchDocNo || '',
    dispatched_through: row.dispatched_through || row.payload?.meta?.dispatchedThrough || row.payload?.dispatchedThrough || '',
    destination: row.destination || row.payload?.meta?.destination || row.payload?.destination || '',
    terms_of_delivery: row.terms_of_delivery || row.payload?.meta?.termsOfDelivery || row.payload?.termsOfDelivery || '',
    sites: row.sites || undefined,
    companies: row.companies || undefined,
    is_material: row.is_material || row.payload?.isMaterial || false,
    is_locked: row.is_locked ?? false,
    isLocked: row.is_locked ?? false,
    is_legacy: Boolean(row.is_legacy || row.isLegacy),
    isLegacy: Boolean(row.is_legacy || row.isLegacy),
    legacy_uploaded_by: row.legacy_uploaded_by || null,
    legacy_notes: row.legacy_notes || '',
    storage_provider: (row.storage_provider || row.storageProvider) ? String(row.storage_provider || row.storageProvider) : null,
    storage_key: (row.storage_key || row.storageKey) ? String(row.storage_key || row.storageKey) : null,
    invoice_storage_provider: (row.invoice_storage_provider || row.invoiceStorageProvider) ? String(row.invoice_storage_provider || row.invoiceStorageProvider) : null,
    certified_doc_storage_key: (row.certified_doc_storage_key || row.certifiedDocStorageKey) ? String(row.certified_doc_storage_key || row.certifiedDocStorageKey) : null,
    generated_pdf_storage_key: (row.generated_pdf_storage_key || row.generatedPdfStorageKey) ? String(row.generated_pdf_storage_key || row.generatedPdfStorageKey) : null,
    certified_attendance_storage_key: (row.certified_attendance_storage_key || row.certifiedAttendanceStorageKey) ? String(row.certified_attendance_storage_key || row.certifiedAttendanceStorageKey) : null,
    view_url: (row.view_url || row.viewUrl || row.certified_doc_url || row.certifiedDocUrl || row.generated_pdf_url || row.generatedPdfUrl || row.certified_attendance_url || row.certifiedAttendanceUrl) ? String(row.view_url || row.viewUrl || row.certified_doc_url || row.certifiedDocUrl || row.generated_pdf_url || row.generatedPdfUrl || row.certified_attendance_url || row.certifiedAttendanceUrl) : null,
    certified_doc_url: (row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl) ? String(row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl) : null,
    certifiedDocUrl: (row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl) ? String(row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl) : null,
    certified_attendance_url: (row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl) ? String(row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl) : null,
    certifiedAttendanceUrl: (row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl) ? String(row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl) : null,
    generated_pdf_url: (row.generated_pdf_url || row.generatedPdfUrl || row.payload?.generated_pdf_url || row.payload?.generatedPdfUrl) ? String(row.generated_pdf_url || row.generatedPdfUrl || row.payload?.generated_pdf_url || row.payload?.generatedPdfUrl) : null,
    generatedPdfUrl: (row.generated_pdf_url || row.generatedPdfUrl || row.payload?.generated_pdf_url || row.payload?.generatedPdfUrl) ? String(row.generated_pdf_url || row.generatedPdfUrl || row.payload?.generated_pdf_url || row.payload?.generatedPdfUrl) : null,
    cancelled_at: (row.cancelled_at || row.cancelledAt) ? String(row.cancelled_at || row.cancelledAt) : null,
    cancelledAt: (row.cancelled_at || row.cancelledAt) ? String(row.cancelled_at || row.cancelledAt) : null,
    cancelled_reason: (row.cancelled_reason || row.cancelledReason) ? String(row.cancelled_reason || row.cancelledReason) : null,
    cancelledReason: (row.cancelled_reason || row.cancelledReason) ? String(row.cancelled_reason || row.cancelledReason) : null,
    approved_at: (row.approved_at || row.approvedAt) ? String(row.approved_at || row.approvedAt) : null,
    approvedAt: (row.approved_at || row.approvedAt) ? String(row.approved_at || row.approvedAt) : null,
    certified_doc_confirmed_at: (row.certified_doc_confirmed_at || row.certifiedDocConfirmedAt) ? String(row.certified_doc_confirmed_at || row.certifiedDocConfirmedAt) : null,
    certifiedDocConfirmedAt: (row.certified_doc_confirmed_at || row.certifiedDocConfirmedAt) ? String(row.certified_doc_confirmed_at || row.certifiedDocConfirmedAt) : null,
    certified_attendance_confirmed_at: (row.certified_attendance_confirmed_at || row.certifiedAttendanceConfirmedAt) ? String(row.certified_attendance_confirmed_at || row.certifiedAttendanceConfirmedAt) : null,
    certifiedAttendanceConfirmedAt: (row.certified_attendance_confirmed_at || row.certifiedAttendanceConfirmedAt) ? String(row.certified_attendance_confirmed_at || row.certifiedAttendanceConfirmedAt) : null,
    previous_version_id: row.previous_version_id || row.previousVersionId || row.payload?.previous_version_id || null,
    payload: fullPayload,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at ? String(row.created_at) : (row.createdAt ? String(row.createdAt) : undefined)),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ? String(row.updated_at) : undefined),
  };
}

export class InvoiceQueryService {
  /**
   * Fetch a single invoice by ID joining sites and companies tables
   */
  static async getInvoiceById(id: string): Promise<InvoiceRecord> {
    const sql = `
      SELECT 
        i.*,
        row_to_json(s.*) AS sites,
        row_to_json(c.*) AS companies
      FROM public.invoices i
      LEFT JOIN public.sites s ON s.id = i.site_id
      LEFT JOIN public.companies c ON c.id = i.company_id
      WHERE i.id = $1;
    `;
    const res = await pool.query(sql, [id]);
    if (!res.rows || res.rows.length === 0) {
      const err: any = new Error(`Invoice not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(res.rows[0]));
  }

  /**
   * Fetch all invoices from DB joining sites and companies tables
   */
  static async getAllInvoices(user?: AuthUser): Promise<InvoiceRecord[]> {
    try {
      const userCompanyId = user?.company_id || user?.companyId;
      let sql = `
        SELECT 
          i.*,
          row_to_json(s.*) AS sites,
          row_to_json(c.*) AS companies
        FROM public.invoices i
        LEFT JOIN public.sites s ON s.id = i.site_id
        LEFT JOIN public.companies c ON c.id = i.company_id
      `;
      const params: any[] = [];
      if (user && user.role !== 'superadmin' && userCompanyId) {
        params.push(userCompanyId);
        sql += ` WHERE i.company_id = $${params.length}`;
      }
      sql += ` ORDER BY i.created_at DESC;`;
      const res = await pool.query(sql, params);
      const mapped = (res.rows || [])
        .map((row: any) => {
          try {
            return mapRowToInvoiceRecord(row);
          } catch (e: any) {
            const issueSummary = e instanceof z.ZodError
              ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
              : (e?.message || String(e));
            console.warn(`Invoice row validation failed [id=${row?.id || 'unknown'}]: ${issueSummary}`);
            return null;
          }
        })
        .filter(Boolean) as InvoiceRecord[];

      return await enrichInvoicesWithViewUrls(mapped);
    } catch (err: any) {
      console.error('getAllInvoices Error:', err);
      return [];
    }
  }

  /**
   * Validates tenant ownership of a target invoice before mutation
   */
  static async verifyInvoiceOwnership(invoiceId: string, _user?: AuthUser): Promise<void> {
    const res = await pool.query('SELECT id, company_id FROM public.invoices WHERE id = $1', [invoiceId]);
    if (!res.rows || res.rows.length === 0) {
      const err: any = new Error('Invoice not found');
      err.statusCode = 404;
      throw err;
    }
    const inv = res.rows[0];
    if (_user && _user.role !== 'superadmin' && _user.company_id && _user.company_id !== inv.company_id) {
      const authErr: any = new Error('Access denied: Unauthorized company access');
      authErr.statusCode = 403;
      throw authErr;
    }
  }

  /**
   * Validate required NOT NULL columns before DB insert or update
   */
  static validateRequiredColumns(row: Record<string, any>): void {
    const missing: string[] = [];
    if (!row.invoice_no || typeof row.invoice_no !== 'string' || !row.invoice_no.trim()) {
      missing.push('invoice_no');
    }
    if (!row.type || typeof row.type !== 'string' || !row.type.trim()) {
      missing.push('type');
    }
    if (!row.invoice_date || typeof row.invoice_date !== 'string' || !row.invoice_date.trim()) {
      missing.push('invoice_date');
    }
    if (!row.billing_period || typeof row.billing_period !== 'string' || !row.billing_period.trim()) {
      missing.push('billing_period');
    }
    if (!row.line_items || !Array.isArray(row.line_items)) {
      missing.push('line_items');
    }
    if (row.sub_total === undefined || row.sub_total === null || isNaN(Number(row.sub_total))) {
      missing.push('sub_total');
    }
    if (row.tax_total === undefined || row.tax_total === null || isNaN(Number(row.tax_total))) {
      missing.push('tax_total');
    }
    if (row.grand_total === undefined || row.grand_total === null || isNaN(Number(row.grand_total))) {
      missing.push('grand_total');
    }

    if (missing.length > 0) {
      const err: any = new Error(`Missing or invalid required NOT NULL field(s): ${missing.join(', ')}`);
      err.statusCode = 400;
      err.missingFields = missing;
      throw err;
    }
  }

  /**
   * Create invoice in DB strictly using PostgreSQL columns & auto UUID
   */
  static async createInvoice(payload: any, user?: AuthUser): Promise<InvoiceRecord> {
    const companyId =
      payload.company_id ||
      payload.companyId ||
      payload.payload?.company_id ||
      payload.payload?.company?.id;

    const siteId =
      payload.site_id ||
      payload.siteId ||
      payload.payload?.site_id ||
      payload.payload?.party?.siteId;

    if (!companyId) {
      const err: any = new Error('Missing required field: company_id');
      err.statusCode = 400;
      throw err;
    }

    // 1. Authorization enforcement: caller-supplied company_id must match authenticated user unless superadmin
    if (user && user.role !== 'superadmin' && user.company_id && user.company_id !== companyId) {
      const authErr: any = new Error('Access denied: Unauthorized company access');
      authErr.statusCode = 403;
      throw authErr;
    }

    const idempotencyKey = payload.idempotency_key || payload.idempotencyKey || null;
    if (idempotencyKey) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idempotencyKey)) {
        const idErr: any = new Error('Invalid idempotency_key: must be a valid UUID');
        idErr.statusCode = 400;
        throw idErr;
      }
    }

    const type = payload.type || payload.payload?.meta?.invoiceType || 'Tax Invoice';
    const invoiceDate = payload.invoice_date || payload.date || payload.meta?.invoiceDate || new Date().toISOString().split('T')[0];
    const billingPeriod = payload.billing_period || payload.billingPeriod || payload.monthYear || payload.meta?.billingPeriod || '';
    const rawLineItems = payload.line_items || payload.items || payload.payload?.items || [];

    // Compute canonical request hash from validated business inputs
    const canonicalPayload = {
      companyId,
      siteId,
      type,
      invoiceDate,
      billingPeriod,
      lineItems: rawLineItems.map((item: any) => ({
        desc: item.description || item.roleName || '',
        qty: Number(item.quantity ?? item.persons ?? 1),
        rate: Number(item.unit_rate ?? item.rate ?? item.monthlyRate ?? 0),
        days: Number(item.working_days ?? item.workingDays ?? 30),
      })),
      mgmtPercent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      machineryCharges: Number(payload.machinery_charges ?? payload.machineryCharges ?? 0),
      materialCharges: Number(payload.material_charges ?? payload.materialCharges ?? 0),
    };
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');

    return await withTransaction(async (client) => {
      // 2. Lock company sequence row to serialize sequence allocation for this company
      const compRes = await client.query(
        `SELECT id, name, entity_code, tax_prefix, tax_sequence, proforma_prefix, proforma_sequence
         FROM public.companies
         WHERE id = $1
         FOR UPDATE;`,
        [companyId]
      );

      if (!compRes.rows || compRes.rows.length === 0) {
        const cErr: any = new Error(`Company not found: ${companyId}`);
        cErr.statusCode = 404;
        throw cErr;
      }
      const company = compRes.rows[0];

      // 3. Check idempotency within transaction
      if (idempotencyKey) {
        const idemRes = await client.query(
          `SELECT id, invoice_no, idempotency_request_hash
           FROM public.invoices
           WHERE company_id = $1 AND idempotency_key = $2
           LIMIT 1;`,
          [companyId, idempotencyKey]
        );

        if (idemRes.rows && idemRes.rows.length > 0) {
          const existing = idemRes.rows[0];
          if (existing.idempotency_request_hash === requestHash) {
            // Idempotent retry: return existing invoice
            const fullInv = await client.query(
              `SELECT i.*, row_to_json(s.*) AS sites, row_to_json(c.*) AS companies
               FROM public.invoices i
               LEFT JOIN public.sites s ON s.id = i.site_id
               LEFT JOIN public.companies c ON c.id = i.company_id
               WHERE i.id = $1;`,
              [existing.id]
            );
            return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(fullInv.rows[0]));
          } else {
            // Key reused with conflicting payload
            const conflictErr: any = new Error(`Idempotency key collision: key ${idempotencyKey} already used with different payload`);
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
        }
      }

      // 4. Resolve tax jurisdiction (state & GSTIN) from company (supplier) and site/client (recipient) master data
      let isInterstate = false;
      let supplierState = '';
      if (companyId) {
        const compGstinRes = await client.query('SELECT gstin FROM public.companies WHERE id = $1 LIMIT 1;', [companyId]);
        const compGstin = (compGstinRes.rows?.[0]?.gstin || '').trim();
        if (/^\d{2}/.test(compGstin)) {
          supplierState = compGstin.substring(0, 2);
        }
      }

      if (siteId) {
        const siteRes = await client.query(
          `SELECT s.id, s.gstin, c.gstin as client_gstin
           FROM public.sites s
           LEFT JOIN public.clients c ON c.id = s.client_id
           WHERE s.id = $1;`,
          [siteId]
        );
        if (siteRes.rows?.[0]) {
          const siteRow = siteRes.rows[0];
          const recipientGstin = (siteRow.client_gstin || siteRow.gstin || '').trim();
          if (/^\d{2}/.test(recipientGstin)) {
            const recipientState = recipientGstin.substring(0, 2);
            if (supplierState && recipientState !== supplierState) {
              isInterstate = true;
            } else if (!supplierState && recipientState !== '27') {
              isInterstate = true;
            }
          }
        }
      }

      const cgstRate = isInterstate ? 0.00 : 9.00;
      const sgstRate = isInterstate ? 0.00 : 9.00;
      const igstRate = isInterstate ? 18.00 : 0.00;

      // 5. Line items calculation using integer-paisa rounding
      let calculatedSubTotal = 0;
      let calculatedTaxTotal = 0;
      const normalizedItems: any[] = [];

      for (const item of rawLineItems) {
        const qty = Number(item.quantity ?? item.persons ?? 1);
        const rate = Number(item.unit_rate ?? item.rate ?? item.monthlyRate ?? 0);
        const days = Number(item.working_days ?? item.workingDays ?? 0);
        
        let lineAmount = 0;
        if (item.amount !== undefined && item.amount !== null && !isNaN(Number(item.amount))) {
          lineAmount = Math.round(Number(item.amount) * 100) / 100;
        } else if (days > 0 && rate > 0) {
          lineAmount = Math.round(((rate / 31) * days) * 100) / 100;
        } else {
          lineAmount = 0;
        }
        const lineAmountPaisa = Math.round(lineAmount * 100);

        const cgstAmtPaisa = cgstRate > 0 ? Math.round((lineAmountPaisa * cgstRate) / 100) : 0;
        const sgstAmtPaisa = sgstRate > 0 ? Math.round((lineAmountPaisa * sgstRate) / 100) : 0;
        const igstAmtPaisa = igstRate > 0 ? Math.round((lineAmountPaisa * igstRate) / 100) : 0;

        calculatedSubTotal += lineAmount;
        calculatedTaxTotal += (cgstAmtPaisa + sgstAmtPaisa + igstAmtPaisa) / 100;

        normalizedItems.push({
          description: item.description || item.roleName || 'Service Item',
          location: item.location || '',
          hsn_code: item.hsn_code || item.hsnCode || '9985',
          quantity: qty,
          working_days: days,
          unit_rate: rate,
          amount: lineAmount,
          cgst_rate: cgstRate,
          sgst_rate: sgstRate,
          igst_rate: igstRate,
          cgst_amount: cgstAmtPaisa / 100,
          sgst_amount: sgstAmtPaisa / 100,
          igst_amount: igstAmtPaisa / 100,
        });
      }

      const mgmtPercent = Number(payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT);
      const mgmtFee = Math.round(((calculatedSubTotal * mgmtPercent) / 100) * 100) / 100;
      const machineryCharges = Number(payload.machinery_charges ?? payload.machineryCharges ?? 0);
      const materialCharges = Number(payload.material_charges ?? payload.materialCharges ?? 0);

      // Taxable additional charges under Section 15 CGST Act: management fee, machinery, material
      const additionalTaxablePaisa = Math.round((mgmtFee + machineryCharges + materialCharges) * 100);
      const additionalTaxPaisa = Math.round((additionalTaxablePaisa * (cgstRate + sgstRate + igstRate)) / 100);
      const fallbackTaxTotal = (Math.round(calculatedTaxTotal * 100) + additionalTaxPaisa) / 100;
      const fallbackSubTotal = Math.round(calculatedSubTotal * 100) / 100;
      const fallbackGrandTotal = Math.floor(calculatedSubTotal + (additionalTaxablePaisa / 100) + fallbackTaxTotal);

      const finalSubTotal = payload.sub_total !== undefined && !isNaN(Number(payload.sub_total))
        ? Number(payload.sub_total)
        : fallbackSubTotal;
      const finalTaxTotal = payload.tax_total !== undefined && !isNaN(Number(payload.tax_total))
        ? Number(payload.tax_total)
        : fallbackTaxTotal;
      const finalGrandTotal = payload.grand_total !== undefined && !isNaN(Number(payload.grand_total))
        ? Number(payload.grand_total)
        : fallbackGrandTotal;

      // 6. Sequence allocation
      const isRevision = Boolean(
        payload.previous_version_id ||
        payload.previousVersionId ||
        /-(?:R|REV)\d+/i.test(payload.invoice_no || '')
      );

      let invoiceNo = (payload.invoice_no || payload.invoiceNo || '').trim();
      const isProforma = type === 'Proforma Invoice';

      if (!invoiceNo) {
        if (isProforma) {
          const maxRes = await client.query(
            `SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer) AS max_num
             FROM public.invoices i
             WHERE (i.company_id = $1 OR (
               $2 != '' AND i.invoice_no LIKE $2 || '%'
             ))
             AND (i.type = 'Proforma Invoice' OR i.type = 'Proforma')
             AND i.invoice_no ~ '([0-9]+)$'`,
            [companyId, company.proforma_prefix || '']
          );
          const currentMax = Number(maxRes.rows[0]?.max_num) || 0;
          const nextSeq = Math.max(Number(company.proforma_sequence) || 0, currentMax) + 1;
          const prefix = company.proforma_prefix || 'AS/P/26-27/';
          invoiceNo = `${prefix}${String(nextSeq).padStart(3, '0')}`;
          await client.query(
            `UPDATE public.companies SET proforma_sequence = $1 WHERE id = $2;`,
            [nextSeq, companyId]
          );
        } else {
          const maxRes = await client.query(
            `SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer) AS max_num
             FROM public.invoices i
             WHERE (i.company_id = $1 OR (
               $2 != '' AND i.invoice_no LIKE $2 || '%'
             ))
             AND i.type = 'Tax Invoice'
             AND i.invoice_no ~ '([0-9]+)$'`,
            [companyId, company.tax_prefix || '']
          );
          const currentMax = Number(maxRes.rows[0]?.max_num) || 0;
          const nextSeq = Math.max(Number(company.tax_sequence) || 0, currentMax) + 1;
          const prefix = company.tax_prefix || 'AS/26-27/';
          invoiceNo = `${prefix}${String(nextSeq).padStart(3, '0')}`;
          await client.query(
            `UPDATE public.companies SET tax_sequence = $1 WHERE id = $2;`,
            [nextSeq, companyId]
          );
        }
      } else if (!isRevision) {
        // Specific invoice number requested by user (e.g. recreating previously deleted bill)
        const checkRes = await client.query(
          `SELECT id, status FROM public.invoices WHERE company_id = $1 AND type = $2 AND invoice_no = $3 LIMIT 1;`,
          [companyId, type, invoiceNo]
        );
        if (checkRes.rows && checkRes.rows.length > 0) {
          const ex = checkRes.rows[0];
          const err: any = new Error(
            ex.status === 'Cancelled'
              ? `Invoice #${invoiceNo} is cancelled and cannot be reused.`
              : `Invoice #${invoiceNo} already exists in the database.`
          );
          err.statusCode = 409;
          throw err;
        }

        const match = invoiceNo.match(/([0-9]+)$/);
        if (match) {
          const seqNum = parseInt(match[1], 10);
          if (isProforma) {
            await client.query(
              `UPDATE public.companies SET proforma_sequence = GREATEST(COALESCE(proforma_sequence, 0), $1) WHERE id = $2;`,
              [seqNum, companyId]
            );
          } else {
            await client.query(
              `UPDATE public.companies SET tax_sequence = GREATEST(COALESCE(tax_sequence, 0), $1) WHERE id = $2;`,
              [seqNum, companyId]
            );
          }
        }
      }

      const insertInvoiceSql = `
        INSERT INTO public.invoices (
          company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
          line_items, sub_total, tax_total, grand_total, management_fee_percent, mgmt_percent,
          machinery_charges, material_charges, additional_charges, challan_no, challan_date,
          buyer_order_no, dispatch_doc_no, dispatched_through, destination, terms_of_delivery,
          is_material, previous_version_id, certified_doc_url, certified_attendance_url,
          generated_pdf_url, idempotency_key, idempotency_request_hash, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30, NOW(), NOW()
        )
        RETURNING id;
      `;

      const insertValues = [
        companyId,
        siteId || null,
        invoiceNo,
        type,
        payload.status || 'Pending',
        invoiceDate,
        billingPeriod,
        JSON.stringify(rawLineItems),
        finalSubTotal,
        finalTaxTotal,
        finalGrandTotal,
        mgmtPercent,
        mgmtPercent,
        machineryCharges,
        materialCharges,
        JSON.stringify(payload.additional_charges || payload.additionalCharges || []),
        payload.challan_no || payload.challanNo || null,
        payload.challan_date || payload.challanDate || null,
        payload.buyer_order_no || payload.buyerOrderNo || null,
        payload.dispatch_doc_no || payload.dispatchDocNo || null,
        payload.dispatched_through || payload.dispatchedThrough || null,
        payload.destination || null,
        payload.terms_of_delivery || payload.termsOfDelivery || null,
        Boolean(payload.is_material ?? payload.isMaterial ?? false),
        payload.previous_version_id || payload.previousVersionId || null,
        payload.certified_doc_url || payload.certifiedDocUrl || null,
        payload.certified_attendance_url || payload.certifiedAttendanceUrl || null,
        payload.generated_pdf_url || payload.generatedPdfUrl || null,
        idempotencyKey,
        requestHash,
      ];

      const invRes = await client.query(insertInvoiceSql, insertValues);
      const newInvoiceId = invRes.rows[0].id;

      // 7. Insert normalized invoice items into public.invoice_items
      for (const item of normalizedItems) {
        await client.query(
          `INSERT INTO public.invoice_items (
            invoice_id, description, location, hsn_code, quantity, working_days,
            unit_rate, amount, cgst_rate, sgst_rate, igst_rate,
            cgst_amount, sgst_amount, igst_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
          [
            newInvoiceId,
            item.description,
            item.location,
            item.hsn_code,
            item.quantity,
            item.working_days,
            item.unit_rate,
            item.amount,
            item.cgst_rate,
            item.sgst_rate,
            item.igst_rate,
            item.cgst_amount,
            item.sgst_amount,
            item.igst_amount,
          ]
        );
      }

      // Fetch full created record with joins
      const fullRes = await client.query(
        `SELECT i.*, row_to_json(s.*) AS sites, row_to_json(c.*) AS companies
         FROM public.invoices i
         LEFT JOIN public.sites s ON s.id = i.site_id
         LEFT JOIN public.companies c ON c.id = i.company_id
         WHERE i.id = $1;`,
        [newInvoiceId]
      );

      return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(fullRes.rows[0]));
    });
  }

  /**
   * Delete invoice from DB with tenant ownership check
   */
  static async deleteInvoice(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifyInvoiceOwnership(id, user);

    const checkRes = await pool.query(
      `SELECT company_id, type, invoice_no, certified_doc_storage_key, certified_attendance_storage_key, generated_pdf_storage_key
       FROM public.invoices WHERE id = $1`,
      [id]
    );
    if (!checkRes.rows || checkRes.rows.length === 0) {
      const dbErr: any = new Error('Database delete failed: Invoice not found');
      dbErr.statusCode = 404;
      throw dbErr;
    }
    const inv = checkRes.rows[0];

    const res = await pool.query('DELETE FROM public.invoices WHERE id = $1', [id]);
    if ((res.rowCount ?? 0) === 0) {
      const dbErr: any = new Error('Database delete failed: Invoice not found');
      dbErr.statusCode = 404;
      throw dbErr;
    }

    // Clean up associated storage files if any
    const keys = [inv.certified_doc_storage_key, inv.certified_attendance_storage_key, inv.generated_pdf_storage_key].filter(Boolean);
    for (const key of keys) {
      await OracleStorageService.deleteFile(key).catch(() => {});
    }

    // Resynchronize company sequence counter so sequence numbers can be reused
    if (inv.company_id) {
      const isProforma = inv.type === 'Proforma Invoice' || inv.type === 'Proforma';
      if (isProforma) {
        await pool.query(
          `UPDATE public.companies c
           SET proforma_sequence = COALESCE(
             (SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
              FROM public.invoices i
              WHERE (i.company_id = c.id OR (c.proforma_prefix IS NOT NULL AND c.proforma_prefix != '' AND i.invoice_no LIKE c.proforma_prefix || '%'))
                AND (i.type = 'Proforma Invoice' OR i.type = 'Proforma')
                AND i.invoice_no ~ '([0-9]+)$'),
             0
           )
           WHERE c.id = $1;`,
          [inv.company_id]
        );
      } else {
        await pool.query(
          `UPDATE public.companies c
           SET tax_sequence = COALESCE(
             (SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
              FROM public.invoices i
              WHERE (i.company_id = c.id OR (c.tax_prefix IS NOT NULL AND c.tax_prefix != '' AND i.invoice_no LIKE c.tax_prefix || '%'))
                AND i.type = 'Tax Invoice'
                AND i.invoice_no ~ '([0-9]+)$'),
             0
           )
           WHERE c.id = $1;`,
          [inv.company_id]
        );
      }
    }

    return true;
  }

  /**
   * Update existing invoice in DB by ID with tenant ownership check
   */
  static async updateInvoice(id: string, payload: any, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const companyId =
      payload.company_id ||
      payload.companyId ||
      payload.payload?.company_id ||
      payload.payload?.company?.id;

    const siteId =
      payload.site_id ||
      payload.siteId ||
      payload.payload?.site_id ||
      payload.payload?.party?.siteId;

    const invoiceNo = payload.invoice_no !== undefined || payload.invoiceNo !== undefined ? (payload.invoice_no || payload.invoiceNo || null) : null;
    const type = payload.type !== undefined ? payload.type : (payload.payload?.meta?.invoiceType || null);
    const status = payload.status !== undefined ? payload.status : null;
    const invoiceDate = payload.invoice_date !== undefined || payload.date !== undefined ? (payload.invoice_date || payload.date || null) : null;
    const billingPeriod = payload.billing_period !== undefined || payload.billingPeriod !== undefined ? (payload.billing_period || payload.billingPeriod || null) : null;
    const lineItems = payload.line_items !== undefined || payload.items !== undefined ? (payload.line_items || payload.items || null) : null;
    const subTotal = payload.sub_total !== undefined ? Number(payload.sub_total) : (payload.subTotal !== undefined ? Number(payload.subTotal) : null);
    const taxTotal = payload.tax_total !== undefined ? Number(payload.tax_total) : (payload.taxTotal !== undefined ? Number(payload.taxTotal) : null);
    const grandTotal = payload.grand_total !== undefined ? Number(payload.grand_total) : (payload.amount !== undefined ? Number(payload.amount) : (payload.grandTotal !== undefined ? Number(payload.grandTotal) : null));
    
    const hasMgmt = payload.management_fee_percent !== undefined || payload.mgmt_percent !== undefined || payload.mgmtPercent !== undefined;
    const mgmtPercent = hasMgmt ? Number(payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent) : null;

    const hasMachinery = payload.machinery_charges !== undefined || payload.machineryCharges !== undefined;
    const machineryCharges = hasMachinery ? Number(payload.machinery_charges ?? payload.machineryCharges) : null;

    const hasMaterial = payload.material_charges !== undefined || payload.materialCharges !== undefined;
    const materialCharges = hasMaterial ? Number(payload.material_charges ?? payload.materialCharges) : null;

    const hasAdditional = payload.additional_charges !== undefined || payload.additionalCharges !== undefined;
    const additionalCharges = hasAdditional ? JSON.stringify(payload.additional_charges || payload.additionalCharges || []) : null;

    const challanNo = payload.challan_no !== undefined || payload.challanNo !== undefined ? (payload.challan_no || payload.challanNo || null) : null;
    const challanDate = payload.challan_date !== undefined || payload.challanDate !== undefined ? (payload.challan_date || payload.challanDate || null) : null;
    const buyerOrderNo = payload.buyer_order_no !== undefined || payload.buyerOrderNo !== undefined ? (payload.buyer_order_no || payload.buyerOrderNo || null) : null;
    const dispatchDocNo = payload.dispatch_doc_no !== undefined || payload.dispatchDocNo !== undefined ? (payload.dispatch_doc_no || payload.dispatchDocNo || null) : null;
    const dispatchedThrough = payload.dispatched_through !== undefined || payload.dispatchedThrough !== undefined ? (payload.dispatched_through || payload.dispatchedThrough || null) : null;
    const destination = payload.destination !== undefined ? (payload.destination || null) : null;
    const termsOfDelivery = payload.terms_of_delivery !== undefined || payload.termsOfDelivery !== undefined ? (payload.terms_of_delivery || payload.termsOfDelivery || null) : null;

    const hasIsMaterial = payload.is_material !== undefined || payload.isMaterial !== undefined;
    const isMaterial = hasIsMaterial ? Boolean(payload.is_material ?? payload.isMaterial) : null;

    const updateSql = `
      UPDATE public.invoices SET
        company_id = COALESCE($1, company_id),
        site_id = COALESCE($2, site_id),
        invoice_no = COALESCE($3, invoice_no),
        type = COALESCE($4, type),
        status = COALESCE($5, status),
        invoice_date = COALESCE($6, invoice_date),
        billing_period = COALESCE($7, billing_period),
        line_items = COALESCE($8, line_items),
        sub_total = COALESCE($9, sub_total),
        tax_total = COALESCE($10, tax_total),
        grand_total = COALESCE($11, grand_total),
        management_fee_percent = COALESCE($12, management_fee_percent),
        mgmt_percent = COALESCE($13, mgmt_percent),
        machinery_charges = COALESCE($14, machinery_charges),
        material_charges = COALESCE($15, material_charges),
        additional_charges = COALESCE($16, additional_charges),
        challan_no = COALESCE($17, challan_no),
        challan_date = COALESCE($18, challan_date),
        buyer_order_no = COALESCE($19, buyer_order_no),
        dispatch_doc_no = COALESCE($20, dispatch_doc_no),
        dispatched_through = COALESCE($21, dispatched_through),
        destination = COALESCE($22, destination),
        terms_of_delivery = COALESCE($23, terms_of_delivery),
        is_material = COALESCE($24, is_material),
        generated_pdf_url = COALESCE($25, generated_pdf_url),
        certified_doc_url = COALESCE($26, certified_doc_url),
        certified_attendance_url = COALESCE($27, certified_attendance_url),
        updated_at = NOW()
      WHERE id = $28
      RETURNING id;
    `;

    const res = await pool.query(updateSql, [
      companyId || null,
      siteId || null,
      invoiceNo || null,
      type || null,
      status || null,
      invoiceDate || null,
      billingPeriod || null,
      lineItems ? JSON.stringify(lineItems) : null,
      subTotal,
      taxTotal,
      grandTotal,
      mgmtPercent,
      mgmtPercent,
      machineryCharges,
      materialCharges,
      additionalCharges,
      challanNo,
      challanDate,
      buyerOrderNo,
      dispatchDocNo,
      dispatchedThrough,
      destination,
      termsOfDelivery,
      isMaterial,
      payload.generated_pdf_url || payload.generatedPdfUrl || null,
      payload.certified_doc_url || payload.certifiedDocUrl || null,
      payload.certified_attendance_url || payload.certifiedAttendanceUrl || null,
      id,
    ]);

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Invoice not found for update: ${id}`);
    }

    return await this.getInvoiceById(id);
  }

  /**
   * Cancel an invoice setting status = 'Cancelled', cancelled_at = now(), optional cancelled_reason
   */
  static async cancelInvoice(id: string, cancelledReason?: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);
    const now = new Date().toISOString();

    const res = await pool.query(
      `UPDATE public.invoices
       SET status = 'Cancelled', cancelled_at = $1, cancelled_reason = COALESCE($2, cancelled_reason), updated_at = $1
       WHERE id = $3
       RETURNING id;`,
      [now, cancelledReason || null, id]
    );

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }

    return await this.getInvoiceById(id);
  }

  /**
   * Update is_locked status for an invoice
   */
  static async updateLockStatus(id: string, isLocked: boolean): Promise<InvoiceRecord> {
    const now = new Date().toISOString();
    console.warn(`[invoice:lock:update] invoice_id=${id} setting is_locked=${isLocked}`);

    const res = await pool.query(
      `UPDATE public.invoices
       SET is_locked = $1, updated_at = $2
       WHERE id = $3
       RETURNING id;`,
      [isLocked, now, id]
    );

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }

    return await this.getInvoiceById(id);
  }

  /**
   * Approve a Proforma Invoice
   * PATCH /api/invoices/:id/approve
   * Sets status = 'Approved', approved_at = now()
   */
  static async approveProforma(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const checkRes = await pool.query('SELECT type, status FROM public.invoices WHERE id = $1', [id]);
    if (!checkRes.rows || checkRes.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }
    const inv = checkRes.rows[0];

    const isProforma =
      inv.type === 'Proforma Invoice' ||
      inv.type === 'Proforma' ||
      String(inv.type || '').toLowerCase().includes('proforma');

    if (!isProforma) {
      throw new Error(`Only Proforma invoices can be approved. Current type: ${inv.type}`);
    }

    if (inv.status !== 'Pending') {
      throw new Error(`Only Pending invoices can be approved. Current status: ${inv.status}`);
    }

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE public.invoices
       SET status = 'Approved', approved_at = $1, updated_at = $1
       WHERE id = $2;`,
      [now, id]
    );

    console.log(`[invoice:approve:success] invoice_id=${id} approved_at=${now}`);
    return await this.getInvoiceById(id);
  }

  /**
   * Convert an Approved Proforma to a Tax Invoice
   * POST /api/invoices/:id/convert-to-tax-invoice
   */
  static async convertToTaxInvoice(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    return await withTransaction(async (client) => {
      // 1. Fetch and lock proforma invoice
      const proformaRes = await client.query(
        `SELECT * FROM public.invoices WHERE id = $1 FOR UPDATE;`,
        [id]
      );
      if (!proformaRes.rows || proformaRes.rows.length === 0) {
        throw new Error(`Proforma invoice not found: ${id}`);
      }
      const proforma = proformaRes.rows[0];

      if (proforma.type !== 'Proforma Invoice' && proforma.type !== 'Proforma') {
        throw new Error(`Only Proforma invoices can be converted to Tax Invoice. Current type: ${proforma.type}`);
      }

      if (proforma.status !== 'Approved') {
        throw new Error(`Only Approved Proforma invoices can be converted to Tax Invoice. Current status: ${proforma.status}`);
      }

      // Concurrency guard: Verify that a Tax Invoice has not already been created for this proforma
      const existingTaxRes = await client.query(
        `SELECT id, invoice_no FROM public.invoices WHERE previous_version_id = $1 LIMIT 1;`,
        [proforma.id]
      );
      if (existingTaxRes.rows && existingTaxRes.rows.length > 0) {
        throw new Error(`A Tax Invoice (${existingTaxRes.rows[0].invoice_no}) has already been generated from this Proforma invoice`);
      }

      // Mark the proforma invoice as Converted
      await client.query(
        `UPDATE public.invoices SET status = 'Converted', updated_at = NOW() WHERE id = $1;`,
        [proforma.id]
      );

      const companyId = proforma.company_id;
      if (!companyId) {
        throw new Error('Company ID is required to generate Tax Invoice sequence number');
      }

      // 2. Lock company sequence row
      const compRes = await client.query(
        `SELECT id, tax_prefix, tax_sequence FROM public.companies WHERE id = $1 FOR UPDATE;`,
        [companyId]
      );
      if (!compRes.rows || compRes.rows.length === 0) {
        throw new Error(`Company not found: ${companyId}`);
      }
      const company = compRes.rows[0];

      const maxTaxRes = await client.query(
        `SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer) AS max_num
         FROM public.invoices i
         WHERE (i.company_id = $1 OR (
           $2 != '' AND i.invoice_no LIKE $2 || '%'
         ))
         AND i.type = 'Tax Invoice'
         AND i.invoice_no ~ '([0-9]+)$'`,
        [companyId, company.tax_prefix || '']
      );
      const currentMaxTax = Number(maxTaxRes.rows[0]?.max_num) || 0;
      const nextSeq = Math.max(Number(company.tax_sequence) || 0, currentMaxTax) + 1;
      const taxPrefix = company.tax_prefix || 'AS/26-27/';
      const nextTaxInvoiceNo = `${taxPrefix}${String(nextSeq).padStart(3, '0')}`;

      // Update sequence in company
      await client.query(
        `UPDATE public.companies SET tax_sequence = $1 WHERE id = $2;`,
        [nextSeq, companyId]
      );

      // Insert Tax Invoice header
      const insertSql = `
        INSERT INTO public.invoices (
          company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
          line_items, sub_total, tax_total, grand_total, management_fee_percent, mgmt_percent,
          machinery_charges, material_charges, additional_charges, challan_no, challan_date,
          buyer_order_no, dispatch_doc_no, dispatched_through, destination, terms_of_delivery,
          is_material, previous_version_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'Tax Invoice', 'Pending', CURRENT_DATE, $4,
          $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, NOW(), NOW()
        )
        RETURNING id;
      `;

      const insertValues = [
        companyId,
        proforma.site_id,
        nextTaxInvoiceNo,
        proforma.billing_period,
        JSON.stringify(proforma.line_items || []),
        proforma.sub_total,
        proforma.tax_total,
        proforma.grand_total,
        proforma.management_fee_percent,
        proforma.mgmt_percent,
        proforma.machinery_charges,
        proforma.material_charges,
        JSON.stringify(proforma.additional_charges || []),
        proforma.challan_no,
        proforma.challan_date,
        proforma.buyer_order_no,
        proforma.dispatch_doc_no,
        proforma.dispatched_through,
        proforma.destination,
        proforma.terms_of_delivery,
        proforma.is_material,
        proforma.id,
      ];

      const newInvRes = await client.query(insertSql, insertValues);
      const newTaxInvoiceId = newInvRes.rows[0].id;

      // Copy line items if present in public.invoice_items
      await client.query(
        `INSERT INTO public.invoice_items (
          invoice_id, description, location, hsn_code, quantity, working_days,
          unit_rate, amount, cgst_rate, sgst_rate, igst_rate,
          cgst_amount, sgst_amount, igst_amount
        )
        SELECT 
          $1, description, location, hsn_code, quantity, working_days,
          unit_rate, amount, cgst_rate, sgst_rate, igst_rate,
          cgst_amount, sgst_amount, igst_amount
        FROM public.invoice_items
        WHERE invoice_id = $2;`,
        [newTaxInvoiceId, proforma.id]
      );

      const fullRes = await client.query(
        `SELECT i.*, row_to_json(s.*) AS sites, row_to_json(c.*) AS companies
         FROM public.invoices i
         LEFT JOIN public.sites s ON s.id = i.site_id
         LEFT JOIN public.companies c ON c.id = i.company_id
         WHERE i.id = $1;`,
        [newTaxInvoiceId]
      );

      console.log(`[invoice:convert:success] proforma_id=${id} created tax_invoice_id=${newTaxInvoiceId} invoice_no=${nextTaxInvoiceNo}`);
      return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(fullRes.rows[0]));
    });
  }

  /**
   * Mark an uploaded invoice document as certified
   * PATCH /api/invoices/:id/certify/:docType
   */
  static async certifyInvoiceDocument(id: string, docType: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const isAttendance = docType.toLowerCase().includes('attendance');
    const updateField = isAttendance ? 'certified_attendance_confirmed_at' : 'certified_doc_confirmed_at';
    const now = new Date().toISOString();

    const res = await pool.query(
      `UPDATE public.invoices SET ${updateField} = $1, updated_at = $1 WHERE id = $2 RETURNING id;`,
      [now, id]
    );

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }

    console.log(`[invoice:certify:success] invoice_id=${id} docType=${docType} confirmed_at=${now}`);
    return await this.getInvoiceById(id);
  }

  /**
   * Delete an uploaded invoice document from storage and clear database references
   * DELETE /api/invoices/:id/document/:docType
   */
  static async deleteInvoiceDocument(id: string, docType: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const checkRes = await pool.query('SELECT * FROM public.invoices WHERE id = $1', [id]);
    if (!checkRes.rows || checkRes.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }
    const inv = checkRes.rows[0];

    const isAttendance = docType.toLowerCase().includes('attendance');
    const storageKey = isAttendance ? inv.certified_attendance_storage_key : inv.certified_doc_storage_key;

    if (storageKey) {
      await OracleStorageService.deleteFile(storageKey).catch((err) => {
        console.warn(`[invoice:deleteDoc:minio] Failed to delete file ${storageKey}:`, err);
      });
    }

    const now = new Date().toISOString();
    if (isAttendance) {
      await pool.query(
        `UPDATE public.invoices
         SET certified_attendance_url = NULL, certified_attendance_storage_key = NULL, certified_attendance_confirmed_at = NULL, updated_at = $1
         WHERE id = $2;`,
        [now, id]
      );
    } else {
      await pool.query(
        `UPDATE public.invoices
         SET certified_doc_url = NULL, certified_doc_storage_key = NULL, certified_doc_confirmed_at = NULL, updated_at = $1
         WHERE id = $2;`,
        [now, id]
      );
    }

    console.log(`[invoice:deleteDoc:success] invoice_id=${id} docType=${docType} deleted`);
    return await this.getInvoiceById(id);
  }

  /**
   * Fetch invoice document file info or stream directly
   * GET /api/invoices/:id/document/:docType/view
   */
  static async getInvoiceDocumentLocation(id: string, docType: string): Promise<{ storageKey?: string; viewUrl?: string; fileName: string }> {
    const checkRes = await pool.query('SELECT * FROM public.invoices WHERE id = $1', [id]);
    if (!checkRes.rows || checkRes.rows.length === 0) {
      throw new Error(`Invoice not found: ${id}`);
    }
    const inv = checkRes.rows[0];

    const lower = docType.toLowerCase();
    let storageKey: string | null = null;
    let fallbackUrl: string | null = null;
    let fileName = `${inv.invoice_no || 'invoice'}.pdf`;

    if (lower === 'attendance' || lower.includes('attendance')) {
      storageKey = inv.certified_attendance_storage_key;
      fallbackUrl = inv.certified_attendance_url;
      fileName = `${inv.invoice_no || 'invoice'}_Attendance.pdf`;
    } else if (lower === 'generated' || lower.includes('generated')) {
      storageKey = inv.generated_pdf_storage_key;
      fallbackUrl = inv.generated_pdf_url;
      fileName = `${inv.invoice_no || 'invoice'}_Generated.pdf`;
    } else {
      // Default to bill / certified doc
      storageKey = inv.certified_doc_storage_key;
      fallbackUrl = inv.certified_doc_url;
      fileName = `${inv.invoice_no || 'invoice'}_Certified_Bill.pdf`;
    }

    let viewUrl = fallbackUrl || undefined;
    if (storageKey) {
      viewUrl = await OracleStorageService.getSignedReadUrl(storageKey, 3600);
    }

    return {
      storageKey: storageKey || undefined,
      viewUrl,
      fileName,
    };
  }

  /**
   * Create Legacy Historical Bill record with Oracle/MinIO storage upload and atomic rollback
   * POST /api/invoices/legacy
   */
  static async createLegacyInvoice(
    body: {
      invoiceType?: string;
      entityId?: string;
      entity?: string;
      siteId?: string;
      siteName?: string;
      month?: string;
      year?: string | number;
      amount?: number | string;
      billNumber?: string;
      invoice_no?: string;
      notes?: string;
    },
    file: Express.Multer.File,
    user?: AuthUser
  ): Promise<{ invoice: InvoiceRecord; view_url: string }> {
    if (!file) {
      throw new Error('Upload file (PDF/PNG/JPG) is required');
    }

    const monthStr = (body.month || 'January').trim();
    const yearStr = String(body.year || new Date().getFullYear()).trim();
    const yNum = Number(yearStr) || new Date().getFullYear();
    const invoiceType = body.invoiceType === 'Proforma Invoice' ? 'Proforma Invoice' : 'Tax Invoice';

    const monthMap: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sep: 8, sept: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11,
    };

    const mIndex = monthMap[monthStr.toLowerCase()] ?? 0;
    // Calculate last calendar day of the given month/year
    const lastDay = new Date(Date.UTC(yNum, mIndex + 1, 0)).toISOString().split('T')[0];

    // 1. Resolve Company Entity
    let company: any = null;
    if (body.entityId) {
      const compRes = await pool.query('SELECT * FROM public.companies WHERE id = $1', [body.entityId]);
      company = compRes.rows[0];
    }
    if (!company && body.entity) {
      const compRes = await pool.query('SELECT * FROM public.companies WHERE name ILIKE $1 LIMIT 1', [`%${body.entity.trim()}%`]);
      company = compRes.rows[0];
    }
    if (!company) {
      const compRes = await pool.query('SELECT * FROM public.companies LIMIT 1');
      company = compRes.rows[0];
    }

    if (!company) {
      throw new Error('Valid Company Entity is required');
    }

    // 2. Resolve Site
    let site: any = null;
    if (body.siteId) {
      const siteRes = await pool.query('SELECT * FROM public.sites WHERE id = $1', [body.siteId]);
      site = siteRes.rows[0];
    }
    if (!site && body.siteName) {
      const siteRes = await pool.query('SELECT * FROM public.sites WHERE site_name ILIKE $1 LIMIT 1', [`%${body.siteName.trim()}%`]);
      site = siteRes.rows[0];
    }

    // 3. Invoice Number Validation & Prefix Enforcement
    const isProforma = invoiceType === 'Proforma Invoice';
    const expectedPrefix = isProforma
      ? (company.proforma_prefix || 'AS/P/26-27/')
      : (company.tax_prefix || 'AS/26-27/');

    const rawBill = (body.billNumber || body.invoice_no || '').trim();
    if (!rawBill) {
      throw new Error('Bill Number is required');
    }

    const finalInvoiceNo = rawBill.startsWith(expectedPrefix)
      ? rawBill
      : `${expectedPrefix}${rawBill}`;

    // Duplicate Check: Return 409 Conflict if already exists
    const checkInv = await pool.query('SELECT id, invoice_no, status FROM public.invoices WHERE invoice_no = $1', [finalInvoiceNo]);
    if (checkInv.rows.length > 0) {
      const ex = checkInv.rows[0];
      const err: any = new Error(
        ex.status === 'Cancelled'
          ? `Invoice #${finalInvoiceNo} is cancelled and cannot be reused.`
          : `Invoice #${finalInvoiceNo} already exists in the database.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. File Compression & Key Generation
    let uploadBuffer = file.buffer;
    let uploadMimeType = file.mimetype;

    if (file.mimetype.startsWith('image/')) {
      const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);
      uploadBuffer = compressed.buffer;
      uploadMimeType = compressed.mimeType;
    }

    const storageKey = buildInvoiceStorageKey({
      entity: company.name || 'Ambe',
      year: String(yNum),
      month: monthStr,
      documentType: `Legacy-${invoiceType === 'Proforma Invoice' ? 'Proforma' : 'Tax-Invoice'}`,
      originalName: file.originalname,
    });

    // 5. Upload to MinIO / Oracle Object Storage
    const storageResult = await OracleStorageService.uploadFile(uploadBuffer, storageKey, uploadMimeType);

    // 6. Insert record into invoices table with atomic rollback on failure
    const numericAmount = Number(body.amount) || 0;
    const nowIso = new Date().toISOString();

    const insertSql = `
      INSERT INTO public.invoices (
        company_id, site_id, invoice_no, type, status, is_legacy, legacy_uploaded_by, legacy_notes,
        invoice_date, billing_period, line_items, sub_total, tax_total, grand_total,
        certified_doc_url, certified_doc_storage_key, certified_doc_confirmed_at,
        invoice_storage_provider, is_locked, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $20
      )
      RETURNING id;
    `;

    let insertedId: string;
    try {
      const res = await pool.query(insertSql, [
        company.id,
        site?.id || null,
        finalInvoiceNo,
        invoiceType,
        'Unpaid',
        true,
        user?.id || null,
        body.notes || '',
        lastDay,
        `${monthStr} ${yNum}`,
        JSON.stringify([
          {
            id: 'item-1',
            srNo: 1,
            description: 'Legacy Bill (Historical Record)',
            rate: numericAmount,
            amount: numericAmount,
          },
        ]),
        numericAmount,
        0,
        numericAmount,
        null,
        storageResult.storageKey,
        nowIso,
        'minio',
        false,
        nowIso,
      ]);
      insertedId = res.rows[0].id;
      const match = finalInvoiceNo.match(/([0-9]+)$/);
      if (match) {
        const seqNum = parseInt(match[1], 10);
        if (invoiceType === 'Proforma Invoice') {
          await pool.query(
            `UPDATE public.companies SET proforma_sequence = GREATEST(COALESCE(proforma_sequence, 0), $1) WHERE id = $2;`,
            [seqNum, company.id]
          );
        } else {
          await pool.query(
            `UPDATE public.companies SET tax_sequence = GREATEST(COALESCE(tax_sequence, 0), $1) WHERE id = $2;`,
            [seqNum, company.id]
          );
        }
      }
    } catch (dbError: any) {
      console.error('❌ DB insert failed for legacy invoice, rolling back MinIO upload:', dbError);
      await OracleStorageService.deleteFile(storageResult.storageKey).catch(() => {});
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    const enriched = await this.getInvoiceById(insertedId);
    const signedViewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey, 3600);

    return {
      invoice: enriched,
      view_url: signedViewUrl,
    };
  }

  /**
   * Update an existing legacy historical bill record with optional document replacement
   */
  static async updateLegacyInvoice(
    id: string,
    body: any,
    file?: Express.Multer.File,
    user?: AuthUser
  ): Promise<{ invoice: InvoiceRecord; view_url?: string }> {
    await this.verifyInvoiceOwnership(id, user);

    const monthStr = (body.month || 'June').trim();
    const yNum = parseInt(body.year, 10) || new Date().getFullYear();
    const invoiceType = body.invoiceType === 'Proforma Invoice' ? 'Proforma Invoice' : 'Tax Invoice';

    const monthMap: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const mIndex = monthMap[monthStr.toLowerCase()] ?? 0;
    const lastDay = new Date(Date.UTC(yNum, mIndex + 1, 0)).toISOString().split('T')[0];

    // Resolve Company
    let company: any = null;
    if (body.entityId) {
      const compRes = await pool.query('SELECT * FROM public.companies WHERE id = $1', [body.entityId]);
      company = compRes.rows[0];
    }
    if (!company && body.entity) {
      const compRes = await pool.query('SELECT * FROM public.companies WHERE name ILIKE $1 LIMIT 1', [`%${body.entity.trim()}%`]);
      company = compRes.rows[0];
    }
    if (!company) {
      const compRes = await pool.query('SELECT * FROM public.companies LIMIT 1');
      company = compRes.rows[0];
    }

    // Resolve Site
    let site: any = null;
    if (body.siteId) {
      const siteRes = await pool.query('SELECT * FROM public.sites WHERE id = $1', [body.siteId]);
      site = siteRes.rows[0];
    }
    if (!site && body.siteName) {
      const siteRes = await pool.query('SELECT * FROM public.sites WHERE site_name ILIKE $1 LIMIT 1', [`%${body.siteName.trim()}%`]);
      site = siteRes.rows[0];
    }

    // Prefix enforcement
    const isProforma = invoiceType === 'Proforma Invoice';
    const expectedPrefix = isProforma
      ? (company?.proforma_prefix || 'AS/P/26-27/')
      : (company?.tax_prefix || 'AS/26-27/');

    const rawBill = (body.billNumber || body.invoice_no || '').trim();
    const finalInvoiceNo = rawBill.startsWith(expectedPrefix) ? rawBill : `${expectedPrefix}${rawBill}`;

    const numericAmount = Number(body.amount) || 0;

    let storageKey: string | null = null;
    let signedViewUrl: string | undefined = undefined;

    if (file) {
      let uploadBuffer = file.buffer;
      let uploadMimeType = file.mimetype;

      if (file.mimetype.startsWith('image/')) {
        const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);
        uploadBuffer = compressed.buffer;
        uploadMimeType = compressed.mimeType;
      }

      storageKey = buildInvoiceStorageKey({
        entity: company?.name || 'Ambe',
        year: String(yNum),
        month: monthStr,
        documentType: `Legacy-${invoiceType === 'Proforma Invoice' ? 'Proforma' : 'Tax-Invoice'}`,
        originalName: file.originalname,
      });

      const storageResult = await OracleStorageService.uploadFile(uploadBuffer, storageKey, uploadMimeType);
      storageKey = storageResult.storageKey;
      signedViewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey, 3600);
    }

    const updateSql = `
      UPDATE public.invoices SET
        company_id = COALESCE($1, company_id),
        site_id = COALESCE($2, site_id),
        invoice_no = COALESCE($3, invoice_no),
        type = COALESCE($4, type),
        invoice_date = COALESCE($5, invoice_date),
        billing_period = COALESCE($6, billing_period),
        sub_total = COALESCE($7, sub_total),
        tax_total = 0,
        grand_total = COALESCE($7, grand_total),
        line_items = $8,
        legacy_notes = COALESCE($9, legacy_notes),
        certified_doc_storage_key = COALESCE($10, certified_doc_storage_key),
        certified_doc_confirmed_at = CASE WHEN $10 IS NOT NULL THEN NOW() ELSE certified_doc_confirmed_at END,
        invoice_storage_provider = CASE WHEN $10 IS NOT NULL THEN 'minio' ELSE invoice_storage_provider END,
        updated_at = NOW()
      WHERE id = $11
      RETURNING id;
    `;

    const res = await pool.query(updateSql, [
      company?.id || null,
      site?.id || null,
      finalInvoiceNo,
      invoiceType,
      lastDay,
      `${monthStr} ${yNum}`,
      numericAmount,
      JSON.stringify([
        {
          id: 'item-1',
          srNo: 1,
          description: 'Legacy Bill (Historical Record)',
          rate: numericAmount,
          amount: numericAmount,
        },
      ]),
      body.notes !== undefined ? body.notes : null,
      storageKey,
      id,
    ]);

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Invoice not found for update: ${id}`);
    }

    const enriched = await this.getInvoiceById(id);
    return {
      invoice: enriched,
      view_url: signedViewUrl || enriched.certified_doc_view_url || enriched.view_url || undefined,
    };
  }
}
