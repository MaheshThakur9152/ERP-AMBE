import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
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

const InvoiceRowSchema = z.object({
  id: z.string().optional().nullable(),
  invoice_no: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  invoice_date: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
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
  challan_no: z.string().optional().nullable(),
  challan_date: z.string().optional().nullable(),
  buyer_order_no: z.string().optional().nullable(),
  dispatch_doc_no: z.string().optional().nullable(),
  dispatched_through: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  terms_of_delivery: z.string().optional().nullable(),
  certified_doc_url: z.string().optional().nullable(),
  certifiedDocUrl: z.string().optional().nullable(),
  certified_attendance_url: z.string().optional().nullable(),
  certifiedAttendanceUrl: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
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
  const date = row.invoice_date || row.date || payload?.meta?.invoiceDate || '';
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
    created_at: row.created_at ? String(row.created_at) : (row.createdAt ? String(row.createdAt) : undefined),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export class InvoiceQueryService {
  /**
   * Fetch all invoices from DB joining sites and companies tables
   */
  static async getAllInvoices(user?: AuthUser): Promise<InvoiceRecord[]> {
    try {
      let query = supabaseAdmin
        .from('invoices')
        .select('*, sites(*), companies(*)')
        .order('created_at', { ascending: false });

      if (user && user.role !== 'superadmin' && user.company_id) {
        query = query.eq('company_id', user.company_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('❌ Database error fetching invoices:', error.message);
        return [];
      }

      const mapped = (data || [])
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
  static async verifyInvoiceOwnership(invoiceId: string, user?: AuthUser): Promise<void> {
    if (!user || user.role === 'superadmin' || !user.company_id) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, company_id')
      .eq('id', invoiceId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Invoice not found');
    }

    if (data.company_id && data.company_id !== user.company_id) {
      throw new Error('FORBIDDEN_TENANT_ACCESS: You do not have permission to access records for this company');
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

    if (user && user.role !== 'superadmin' && user.company_id && companyId && companyId !== user.company_id) {
      const err: any = new Error('FORBIDDEN_TENANT_ACCESS: Cannot create invoices for another company entity');
      err.statusCode = 403;
      throw err;
    }

    const siteId =
      payload.site_id ||
      payload.siteId ||
      payload.payload?.site_id ||
      payload.payload?.party?.siteId;

    const now = new Date().toISOString();

    const insertRow: any = {
      company_id: companyId,
      site_id: siteId,
      invoice_no: payload.invoice_no || payload.invoiceNo || payload.meta?.invoiceNo || '',
      type: payload.type || payload.payload?.meta?.invoiceType || 'Tax Invoice',
      status: payload.status || 'Pending',
      invoice_date: payload.invoice_date || payload.date || payload.meta?.invoiceDate || now.split('T')[0],
      billing_period: payload.billing_period || payload.billingPeriod || payload.monthYear || payload.meta?.billingPeriod || '',
      line_items: payload.line_items || payload.items || payload.payload?.items || [],
      sub_total: payload.sub_total !== undefined ? Number(payload.sub_total) : (payload.subTotal !== undefined ? Number(payload.subTotal) : 0),
      tax_total: payload.tax_total !== undefined ? Number(payload.tax_total) : (payload.taxTotal !== undefined ? Number(payload.taxTotal) : 0),
      grand_total: payload.grand_total !== undefined ? Number(payload.grand_total) : (payload.amount !== undefined ? Number(payload.amount) : (payload.grandTotal !== undefined ? Number(payload.grandTotal) : 0)),
      management_fee_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      mgmt_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      machinery_charges: payload.machinery_charges ?? payload.machineryCharges ?? payload.payload?.machineryCharges ?? 0,
      material_charges: payload.material_charges ?? payload.materialCharges ?? payload.payload?.materialCharges ?? 0,
      additional_charges: payload.additional_charges || payload.additionalCharges || payload.payload?.additionalCharges || payload.payload?.additional_charges || [],
      challan_no: payload.challan_no || payload.challanNo || payload.meta?.challanNo || '',
      challan_date: payload.challan_date || payload.challanDate || payload.meta?.challanDate || '',
      buyer_order_no: payload.buyer_order_no || payload.buyerOrderNo || payload.meta?.buyerOrderNo || '',
      dispatch_doc_no: payload.dispatch_doc_no || payload.dispatchDocNo || payload.meta?.dispatchDocNo || '',
      dispatched_through: payload.dispatched_through || payload.dispatchedThrough || payload.meta?.dispatchedThrough || '',
      destination: payload.destination || payload.meta?.destination || '',
      terms_of_delivery: payload.terms_of_delivery || payload.termsOfDelivery || payload.meta?.termsOfDelivery || '',
      is_material: payload.is_material ?? payload.isMaterial ?? false,
      previous_version_id: payload.previous_version_id || payload.previousVersionId || null,
      certified_doc_url: payload.certified_doc_url || payload.certifiedDocUrl || null,
      certified_attendance_url: payload.certified_attendance_url || payload.certifiedAttendanceUrl || null,
      generated_pdf_url: payload.generated_pdf_url || payload.generatedPdfUrl || payload.pdf_url || payload.pdfUrl || null,
      created_at: now,
    };

    // Server-side NOT NULL validation before DB write
    this.validateRequiredColumns(insertRow);

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert([insertRow])
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error('❌ Supabase insert invoice error:', error);
      const dbErr: any = new Error(`Database insert failed: ${error.message}`);
      dbErr.statusCode = 500;
      dbErr.details = error.details || error.hint || error.message;
      dbErr.hint = error.hint;
      dbErr.code = error.code;
      throw dbErr;
    }

    if (data) {
      if (!data.companies && companyId) {
        const { data: comp } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).maybeSingle();
        if (comp) data.companies = comp;
      }
      if (!data.sites && siteId) {
        const { data: st } = await supabaseAdmin.from('sites').select('*').eq('id', siteId).maybeSingle();
        if (st) data.sites = st;
      }
    }

    if (companyId) {
      await InvoiceSequenceService.incrementSequence(companyId, insertRow.type);
    }

    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Delete invoice from DB with tenant ownership check
   */
  static async deleteInvoice(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifyInvoiceOwnership(id, user);

    const { error } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase delete invoice error:', error);
      const dbErr: any = new Error(`Database delete failed: ${error.message}`);
      dbErr.statusCode = 500;
      dbErr.details = error.details || error.hint || error.message;
      dbErr.hint = error.hint;
      dbErr.code = error.code;
      throw dbErr;
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

    const updateRow: any = {
      company_id: companyId,
      site_id: siteId,
      invoice_no: payload.invoice_no || payload.invoiceNo || payload.meta?.invoiceNo,
      type: payload.type || payload.payload?.meta?.invoiceType || (payload.payload?.terms?.[0]?.type),
      status: payload.status || 'Pending',
      invoice_date: payload.invoice_date || payload.date || payload.meta?.invoiceDate,
      billing_period: payload.billing_period || payload.billingPeriod || payload.monthYear || payload.meta?.billingPeriod,
      line_items: payload.line_items || payload.items || payload.payload?.items || (payload.payload?.terms?.[0]?.payload?.items),
      sub_total: payload.sub_total !== undefined ? Number(payload.sub_total) : (payload.subTotal !== undefined ? Number(payload.subTotal) : undefined),
      tax_total: payload.tax_total !== undefined ? Number(payload.tax_total) : (payload.taxTotal !== undefined ? Number(payload.taxTotal) : undefined),
      grand_total: payload.grand_total !== undefined ? Number(payload.grand_total) : (payload.amount !== undefined ? Number(payload.amount) : (payload.grandTotal !== undefined ? Number(payload.grandTotal) : undefined)),
      management_fee_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      mgmt_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      machinery_charges: payload.machinery_charges ?? payload.machineryCharges ?? payload.payload?.machineryCharges ?? 0,
      material_charges: payload.material_charges ?? payload.materialCharges ?? payload.payload?.materialCharges ?? 0,
      additional_charges: payload.additional_charges || payload.additionalCharges || payload.payload?.additionalCharges || payload.payload?.additional_charges || [],
      challan_no: payload.challan_no || payload.challanNo || payload.meta?.challanNo,
      challan_date: payload.challan_date || payload.challanDate || payload.meta?.challanDate,
      buyer_order_no: payload.buyer_order_no || payload.buyerOrderNo || payload.meta?.buyerOrderNo,
      dispatch_doc_no: payload.dispatch_doc_no || payload.dispatchDocNo || payload.meta?.dispatchDocNo,
      dispatched_through: payload.dispatched_through || payload.dispatchedThrough || payload.meta?.dispatchedThrough,
      destination: payload.destination || payload.meta?.destination,
      terms_of_delivery: payload.terms_of_delivery || payload.termsOfDelivery || payload.meta?.termsOfDelivery,
      is_material: payload.is_material ?? payload.isMaterial ?? false,
    };

    if (payload.generated_pdf_url !== undefined || payload.generatedPdfUrl !== undefined) {
      updateRow.generated_pdf_url = payload.generated_pdf_url || payload.generatedPdfUrl || null;
    }
    if (payload.certified_doc_url !== undefined || payload.certifiedDocUrl !== undefined) {
      updateRow.certified_doc_url = payload.certified_doc_url || payload.certifiedDocUrl || null;
    }
    if (payload.certified_attendance_url !== undefined || payload.certifiedAttendanceUrl !== undefined) {
      updateRow.certified_attendance_url = payload.certified_attendance_url || payload.certifiedAttendanceUrl || null;
    }
    if (payload.cancelled_at !== undefined || payload.cancelledAt !== undefined) {
      updateRow.cancelled_at = payload.cancelled_at || payload.cancelledAt || null;
    }
    if (payload.cancelled_reason !== undefined || payload.cancelledReason !== undefined) {
      updateRow.cancelled_reason = payload.cancelled_reason || payload.cancelledReason || null;
    }

    // Server-side NOT NULL validation before DB write
    this.validateRequiredColumns(updateRow);

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(updateRow)
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error('❌ Supabase update invoice error:', error);
      const dbErr: any = new Error(`Database update failed: ${error.message}`);
      dbErr.statusCode = 500;
      dbErr.details = error.details || error.hint || error.message;
      dbErr.hint = error.hint;
      dbErr.code = error.code;
      throw dbErr;
    }

    if (data) {
      if (!data.companies && companyId) {
        const { data: comp } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).maybeSingle();
        if (comp) data.companies = comp;
      }
      if (!data.sites && siteId) {
        const { data: st } = await supabaseAdmin.from('sites').select('*').eq('id', siteId).maybeSingle();
        if (st) data.sites = st;
      }
    }

    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Cancel an invoice setting status = 'Cancelled', cancelled_at = now(), optional cancelled_reason
   */
  static async cancelInvoice(id: string, cancelledReason?: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);
    const now = new Date().toISOString();

    const updatePayload: any = {
      status: 'Cancelled',
      cancelled_at: now,
      updated_at: now,
    };
    if (cancelledReason !== undefined && cancelledReason !== null) {
      updatePayload.cancelled_reason = cancelledReason;
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(updatePayload)
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error(`[invoice:cancel:error] invoice_id=${id} error:`, error.message);
      throw new Error(`Invoice cancellation failed: ${error.message}`);
    }

    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Update is_locked status for an invoice
   */
  static async updateLockStatus(id: string, isLocked: boolean): Promise<InvoiceRecord> {
    const now = new Date().toISOString();
    console.warn(`[invoice:lock:update] invoice_id=${id} setting is_locked=${isLocked}`);

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ is_locked: isLocked, updated_at: now })
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error(`[invoice:lock:update:error] invoice_id=${id} error:`, error.message);
      throw new Error(`Lock status update failed: ${error.message}`);
    }

    console.warn(`[invoice:lock:update:success] invoice_id=${id} db_is_locked=${data?.is_locked} updated_at=${data?.updated_at}`);
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Approve a Proforma Invoice
   * PATCH /api/invoices/:id/approve
   * Sets status = 'Approved', approved_at = now()
   */
  static async approveProforma(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !inv) {
      throw new Error(`Invoice not found: ${fetchErr?.message || id}`);
    }

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
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({
        status: 'Approved',
        approved_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error(`[invoice:approve:error] invoice_id=${id} error:`, error.message);
      throw new Error(`Invoice approval failed: ${error.message}`);
    }

    console.log(`[invoice:approve:success] invoice_id=${id} approved_at=${now}`);
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Convert an Approved Proforma to a Tax Invoice
   * POST /api/invoices/:id/convert-to-tax-invoice
   */
  static async convertToTaxInvoice(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const { data: proforma, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*, sites(*), companies(*)')
      .eq('id', id)
      .single();

    if (fetchErr || !proforma) {
      throw new Error(`Proforma invoice not found: ${fetchErr?.message || id}`);
    }

    if (proforma.status !== 'Approved') {
      throw new Error(`Only Approved Proforma invoices can be converted to Tax Invoice. Current status: ${proforma.status}`);
    }

    const companyId = proforma.company_id || proforma.companies?.id;
    if (!companyId) {
      throw new Error('Company ID is required to generate Tax Invoice sequence number');
    }

    // Fetch company to get tax_prefix and tax_sequence
    const { data: comp, error: compErr } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (compErr || !comp) {
      throw new Error(`Company not found: ${compErr?.message || companyId}`);
    }

    const taxPrefix = comp.tax_prefix || 'AS/26-27/';
    const taxSeq = comp.tax_sequence || 1;
    const nextTaxInvoiceNo = `${taxPrefix}${taxSeq}`;
    const now = new Date().toISOString();

    const insertRow: any = {
      company_id: companyId,
      site_id: proforma.site_id,
      invoice_no: nextTaxInvoiceNo,
      type: 'Tax Invoice',
      status: 'Pending',
      previous_version_id: proforma.id,
      invoice_date: now.split('T')[0],
      billing_period: proforma.billing_period || '',
      line_items: proforma.line_items || [],
      sub_total: proforma.sub_total || 0,
      tax_total: proforma.tax_total || 0,
      grand_total: proforma.grand_total || 0,
      management_fee_percent: proforma.management_fee_percent ?? proforma.mgmt_percent ?? DEFAULT_MGMT_FEE_PERCENT,
      mgmt_percent: proforma.management_fee_percent ?? proforma.mgmt_percent ?? DEFAULT_MGMT_FEE_PERCENT,
      machinery_charges: proforma.machinery_charges || 0,
      material_charges: proforma.material_charges || 0,
      additional_charges: proforma.additional_charges || [],
      challan_no: proforma.challan_no || '',
      challan_date: proforma.challan_date || '',
      buyer_order_no: proforma.buyer_order_no || '',
      dispatch_doc_no: proforma.dispatch_doc_no || '',
      dispatched_through: proforma.dispatched_through || '',
      destination: proforma.destination || '',
      terms_of_delivery: proforma.terms_of_delivery || '',
      is_material: proforma.is_material || false,
      created_at: now,
    };

    this.validateRequiredColumns(insertRow);

    const { data: newTaxInvoice, error: insertErr } = await supabaseAdmin
      .from('invoices')
      .insert([insertRow])
      .select('*, sites(*), companies(*)')
      .single();

    if (insertErr) {
      console.error(`[invoice:convert:error] proforma_id=${id} error:`, insertErr.message);
      throw new Error(`Failed to create Tax Invoice: ${insertErr.message}`);
    }

    // Increment company tax sequence
    await supabaseAdmin
      .from('companies')
      .update({ tax_sequence: taxSeq + 1 })
      .eq('id', companyId);

    console.log(`[invoice:convert:success] proforma_id=${id} created tax_invoice_id=${newTaxInvoice.id} invoice_no=${nextTaxInvoiceNo}`);
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(newTaxInvoice));
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

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ [updateField]: now, updated_at: now })
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error(`[invoice:certify:error] invoice_id=${id} docType=${docType} error:`, error.message);
      throw new Error(`Certification update failed: ${error.message}`);
    }

    console.log(`[invoice:certify:success] invoice_id=${id} docType=${docType} confirmed_at=${now}`);
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Delete an uploaded invoice document from storage and clear database references
   * DELETE /api/invoices/:id/document/:docType
   */
  static async deleteInvoiceDocument(id: string, docType: string, user?: AuthUser): Promise<InvoiceRecord> {
    await this.verifyInvoiceOwnership(id, user);

    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !inv) {
      throw new Error(`Invoice not found: ${fetchErr?.message || id}`);
    }

    const isAttendance = docType.toLowerCase().includes('attendance');
    const storageKey = isAttendance ? inv.certified_attendance_storage_key : inv.certified_doc_storage_key;

    if (storageKey) {
      await OracleStorageService.deleteFile(storageKey).catch((err) => {
        console.warn(`[invoice:deleteDoc:minio] Failed to delete file ${storageKey}:`, err);
      });
    }

    const updatePayload: any = isAttendance
      ? {
          certified_attendance_url: null,
          certified_attendance_storage_key: null,
          certified_attendance_confirmed_at: null,
          updated_at: new Date().toISOString(),
        }
      : {
          certified_doc_url: null,
          certified_doc_storage_key: null,
          certified_doc_confirmed_at: null,
          updated_at: new Date().toISOString(),
        };

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(updatePayload)
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error(`[invoice:deleteDoc:error] invoice_id=${id} docType=${docType} error:`, error.message);
      throw new Error(`Document deletion failed: ${error.message}`);
    }

    console.log(`[invoice:deleteDoc:success] invoice_id=${id} docType=${docType} deleted`);
    return await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(data));
  }

  /**
   * Fetch invoice document file info or stream directly
   * GET /api/invoices/:id/document/:docType/view
   */
  static async getInvoiceDocumentLocation(id: string, docType: string): Promise<{ storageKey?: string; viewUrl?: string; fileName: string }> {
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !inv) {
      throw new Error(`Invoice not found: ${fetchErr?.message || id}`);
    }

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
      const { data: comp } = await supabaseAdmin.from('companies').select('*').eq('id', body.entityId).maybeSingle();
      company = comp;
    }
    if (!company && body.entity) {
      const { data: comp } = await supabaseAdmin.from('companies').select('*').ilike('name', `%${body.entity.trim()}%`).maybeSingle();
      company = comp;
    }
    if (!company) {
      const { data: comp } = await supabaseAdmin.from('companies').select('*').limit(1).maybeSingle();
      company = comp;
    }

    if (!company) {
      throw new Error('Valid Company Entity is required');
    }

    // 2. Resolve Site
    let site: any = null;
    if (body.siteId) {
      const { data: st } = await supabaseAdmin.from('sites').select('*').eq('id', body.siteId).maybeSingle();
      site = st;
    }
    if (!site && body.siteName) {
      const { data: st } = await supabaseAdmin.from('sites').select('*').ilike('site_name', `%${body.siteName.trim()}%`).maybeSingle();
      site = st;
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
    const { data: existingInv } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_no')
      .eq('invoice_no', finalInvoiceNo)
      .maybeSingle();

    if (existingInv) {
      const err: any = new Error(`Invoice #${finalInvoiceNo} already exists in the database.`);
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

    const insertRow: any = {
      company_id: company.id,
      site_id: site?.id || null,
      invoice_no: finalInvoiceNo,
      type: invoiceType,
      status: 'Unpaid',
      is_legacy: true,
      legacy_uploaded_by: user?.id || null,
      legacy_notes: body.notes || '',
      invoice_date: lastDay,
      billing_period: `${monthStr} ${yNum}`,
      line_items: [
        {
          id: 'item-1',
          srNo: 1,
          description: 'Legacy Bill (Historical Record)',
          rate: numericAmount,
          amount: numericAmount,
        },
      ],
      sub_total: numericAmount,
      tax_total: 0,
      grand_total: numericAmount,
      certified_doc_url: null,
      certified_doc_storage_key: storageResult.storageKey,
      certified_doc_confirmed_at: nowIso,
      invoice_storage_provider: 'minio',
      is_locked: false,
      payload: {
        entity: company.name,
        meta: {
          invoiceNo: finalInvoiceNo,
          invoiceDate: lastDay,
          billingPeriod: `${monthStr} ${yNum}`,
          invoiceType,
          isLegacy: true,
        },
        party: {
          name: site?.client_name || site?.site_name || body.siteName || 'Legacy Client',
          siteName: site?.site_name || body.siteName || 'Legacy Site',
        },
        items: [
          {
            id: 'item-1',
            srNo: 1,
            description: 'Legacy Bill (Historical Record)',
            rate: numericAmount,
            amount: numericAmount,
          },
        ],
      },
      created_at: nowIso,
    };

    const { data: insertedInvoice, error: dbError } = await supabaseAdmin
      .from('invoices')
      .insert([insertRow])
      .select('*, sites(*), companies(*)')
      .single();

    if (dbError) {
      console.error('❌ DB insert failed for legacy invoice, rolling back MinIO upload:', dbError);
      await OracleStorageService.deleteFile(storageResult.storageKey).catch(() => {});
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    const enriched = await enrichInvoiceWithViewUrls(mapRowToInvoiceRecord(insertedInvoice));
    const signedViewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey, 3600);

    return {
      invoice: enriched,
      view_url: signedViewUrl,
    };
  }
}
