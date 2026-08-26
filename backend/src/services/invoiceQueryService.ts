import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { InvoiceRecord } from '../types/invoice';
import { CompanyService } from './companyService';
import { InvoiceMathService } from './invoiceMathService';
import { InvoiceSequenceService } from './invoiceSequenceService';
import { env } from '../config/env';
import { DEFAULT_MGMT_FEE_PERCENT } from '../config/constants';
import { AuthUser } from '../types/express';

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

      return (data || [])
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

    return mapRowToInvoiceRecord(data);
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

    return mapRowToInvoiceRecord(data);
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

    return mapRowToInvoiceRecord(data);
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
    return mapRowToInvoiceRecord(data);
  }
}
