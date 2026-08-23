import { supabaseAdmin } from '../config/supabase';
import { InvoiceRecord } from '../types/invoice';
import { CompanyService } from './companyService';

function mapRowToInvoiceRecord(row: any): InvoiceRecord {
  const comp = row.companies;
  const site = row.sites;

  const companyName =
    comp?.legal_name ||
    comp?.name ||
    row.company_name ||
    row.companyName ||
    row.payload?.company?.name ||
    '';

  const clientName =
    site?.client_name ||
    site?.clientName ||
    row.client_name ||
    row.clientName ||
    row.payload?.party?.name ||
    '';

  const siteName =
    site?.site_name ||
    site?.siteName ||
    row.site_name ||
    row.siteName ||
    row.payload?.party?.siteName ||
    '';

  const invoiceNo = row.invoice_no || row.invoiceNo || row.payload?.meta?.invoiceNo || '';
  const date = row.invoice_date || row.date || row.payload?.meta?.invoiceDate || '';
  const monthYear = row.billing_period || row.month_year || row.monthYear || row.payload?.meta?.billingPeriod || '';
  const amount = Number(row.grand_total || row.amount || row.payload?.meta?.amount || 0);

  const defaultCompany = {
    name: companyName,
    addressLine1: comp?.address_line1 || row.payload?.company?.addressLine1 || '',
    addressLine2: comp?.address_line2 || row.payload?.company?.addressLine2 || `${comp?.city || ''} ${comp?.pincode || ''}`.trim(),
    contactNo: comp?.phone || comp?.contact_no || row.payload?.company?.contactNo || '',
    emailWebsite: comp?.email || comp?.email_website || row.payload?.company?.emailWebsite || '',
    cinNo: comp?.cin || comp?.cin_no || row.payload?.company?.cinNo || '',
    gstin: comp?.gstin || row.payload?.company?.gstin || '',
  };

  const defaultParty = {
    name: clientName,
    siteName: siteName,
    address: site?.address || row.payload?.party?.address || '',
    contactNo: site?.contact_no || site?.contactNo || row.payload?.party?.contactNo || '',
    email: site?.email || row.payload?.party?.email || '',
    gstin: site?.gstin || row.payload?.party?.gstin || '',
    workOrderRefNo: site?.work_order_ref || row.payload?.party?.workOrderRefNo || '',
    workOrderPeriod: site?.work_order_period || row.payload?.party?.workOrderPeriod || '',
  };

  const defaultBank = {
    bankName: comp?.bank_name || row.payload?.bank?.bankName || '',
    accountNo: comp?.bank_account_no || comp?.account_no || row.payload?.bank?.accountNo || '',
    ifscCode: comp?.bank_ifsc || comp?.ifsc_code || row.payload?.bank?.ifscCode || '',
    branch: comp?.bank_branch || comp?.branch_name || row.payload?.bank?.branch || '',
  };

  const termsText = comp?.terms_and_conditions || comp?.default_terms;
  const formattedTerms = Array.isArray(termsText)
    ? termsText.join(' | ')
    : String(termsText || row.payload?.terms || '');

  const fullPayload = row.payload
    ? {
        ...row.payload,
        company: {
          ...defaultCompany,
          ...(row.payload.company || {}),
          name: row.payload.company?.name || companyName,
        },
        party: {
          ...defaultParty,
          ...(row.payload.party || {}),
          name: row.payload.party?.name || clientName,
          siteName: row.payload.party?.siteName || siteName,
          contactNo: row.payload.party?.contactNo || defaultParty.contactNo,
          email: row.payload.party?.email || defaultParty.email,
        },
        mgmtPercent: Number(row.payload.mgmtPercent ?? row.mgmt_percent ?? row.mgmtPercent ?? row.management_fee_percent ?? site?.management_fee_percent ?? site?.mgmt_percent ?? 5),
        machineryCharges: Number(row.payload.machineryCharges ?? row.machinery_charges ?? row.machineryCharges ?? 0),
        materialCharges: Number(row.payload.materialCharges ?? row.material_charges ?? row.materialCharges ?? 0),
        additionalCharges: row.payload.additionalCharges || row.payload.additional_charges || row.additional_charges || row.additionalCharges || [
          { name: 'Machinery Charges', amount: Number(row.payload.machineryCharges ?? row.machinery_charges ?? 0) },
          { name: 'Material Charges', amount: Number(row.payload.materialCharges ?? row.material_charges ?? 0) },
        ],
      }
    : {
        company: defaultCompany,
        meta: { invoiceNo, invoiceDate: date, billingPeriod: monthYear, invoiceType: row.type },
        party: defaultParty,
        bank: defaultBank,
        items: row.line_items || [],
        mgmtPercent: Number(row.mgmt_percent ?? row.mgmtPercent ?? row.management_fee_percent ?? site?.management_fee_percent ?? site?.mgmt_percent ?? 5),
        machineryCharges: Number(row.machinery_charges ?? row.machineryCharges ?? 0),
        materialCharges: Number(row.material_charges ?? row.materialCharges ?? 0),
        additionalCharges: row.additional_charges || row.additionalCharges || [
          { name: 'Machinery Charges', amount: Number(row.machinery_charges ?? row.machineryCharges ?? 0) },
          { name: 'Material Charges', amount: Number(row.material_charges ?? row.materialCharges ?? 0) },
        ],
        cgstPercent: 9,
        sgstPercent: 9,
        terms: formattedTerms,
      };

  return {
    id: row.id,
    invoiceNo,
    companyId: row.company_id || row.companyId,
    siteId: row.site_id || row.siteId,
    company_id: row.company_id || row.companyId,
    site_id: row.site_id || row.siteId,
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
    machinery_charges: Number(row.machinery_charges ?? row.machineryCharges ?? row.payload?.machineryCharges ?? 0),
    machineryCharges: Number(row.machinery_charges ?? row.machineryCharges ?? row.payload?.machineryCharges ?? 0),
    material_charges: Number(row.material_charges ?? row.materialCharges ?? row.payload?.materialCharges ?? 0),
    materialCharges: Number(row.material_charges ?? row.materialCharges ?? row.payload?.materialCharges ?? 0),
    additional_charges: row.additional_charges || row.additionalCharges || row.payload?.additionalCharges || [],
    additionalCharges: row.additional_charges || row.additionalCharges || row.payload?.additionalCharges || [],
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
    sites: row.sites,
    companies: row.companies,
    is_material: row.is_material || row.payload?.isMaterial || false,
    certified_doc_url: row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl || null,
    certifiedDocUrl: row.certified_doc_url || row.certifiedDocUrl || row.payload?.certified_doc_url || row.payload?.certifiedDocUrl || null,
    certified_attendance_url: row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl || null,
    certifiedAttendanceUrl: row.certified_attendance_url || row.certifiedAttendanceUrl || row.payload?.certified_attendance_url || row.payload?.certifiedAttendanceUrl || null,
    previous_version_id: row.previous_version_id || row.previousVersionId || row.payload?.previous_version_id || null,
    payload: fullPayload,
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at,
  };
}

export class InvoiceService {
  /**
   * Fetch all invoices from DB joining sites and companies tables
   */
  static async getAllInvoices(): Promise<InvoiceRecord[]> {
    try {
      let { data, error } = await supabaseAdmin
        .from('invoices')
        .select('*, sites(*), companies(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('⚠️ Initial Supabase query failed, retrying after 300ms warmup delay:', error.message);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const retryRes = await supabaseAdmin
          .from('invoices')
          .select('*, sites(*), companies(*)')
          .order('created_at', { ascending: false });

        if (!retryRes.error && retryRes.data) {
          data = retryRes.data;
          error = null;
        } else {
          const fallbackRes = await supabaseAdmin
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false });

          if (fallbackRes.error) {
            console.error('❌ Database error fetching invoices:', fallbackRes.error.message);
            return [];
          }
          data = fallbackRes.data;
        }
      }

      return (data || []).map((row: any) => {
        try {
          return mapRowToInvoiceRecord(row);
        } catch (e) {
          console.error('Error mapping row to InvoiceRecord:', e);
          return null;
        }
      }).filter(Boolean) as InvoiceRecord[];
    } catch (err: any) {
      console.error('getAllInvoices Error:', err);
      return [];
    }
  }

  /**
   * Create invoice in DB strictly using PostgreSQL columns & auto UUID
   */
  static async createInvoice(payload: any): Promise<InvoiceRecord> {
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

    const now = new Date().toISOString();

    const insertRow: any = {
      company_id: companyId,
      site_id: siteId,
      invoice_no: payload.invoice_no || payload.invoiceNo || payload.meta?.invoiceNo || '',
      type: payload.type || 'Tax Invoice',
      status: payload.status || 'Pending',
      invoice_date: payload.invoice_date || payload.date || payload.meta?.invoiceDate || now.split('T')[0],
      billing_period: payload.billing_period || payload.monthYear || payload.meta?.billingPeriod || '',
      line_items: payload.line_items || payload.items || payload.payload?.items || [],
      sub_total: payload.sub_total || payload.subTotal || 0,
      tax_total: payload.tax_total || payload.taxTotal || 0,
      grand_total: payload.grand_total || payload.amount || 0,
      management_fee_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? 5,
      mgmt_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? payload.payload?.mgmtPercent ?? 5,
      machinery_charges: payload.machinery_charges ?? payload.machineryCharges ?? payload.payload?.machineryCharges ?? 0,
      material_charges: payload.material_charges ?? payload.materialCharges ?? payload.payload?.materialCharges ?? 0,
      challan_no: payload.challan_no || payload.challanNo || payload.meta?.challanNo || '',
      challan_date: payload.challan_date || payload.challanDate || payload.meta?.challanDate || '',
      buyer_order_no: payload.buyer_order_no || payload.buyerOrderNo || payload.meta?.buyerOrderNo || '',
      dispatch_doc_no: payload.dispatch_doc_no || payload.dispatchDocNo || payload.meta?.dispatchDocNo || '',
      dispatched_through: payload.dispatched_through || payload.dispatchedThrough || payload.meta?.dispatchedThrough || '',
      destination: payload.destination || payload.meta?.destination || '',
      terms_of_delivery: payload.terms_of_delivery || payload.termsOfDelivery || payload.meta?.termsOfDelivery || '',
      is_material: payload.is_material || payload.isMaterial || false,
      previous_version_id: payload.previous_version_id || payload.previousVersionId || null,
      certified_doc_url: payload.certified_doc_url || payload.certifiedDocUrl || null,
      certified_attendance_url: payload.certified_attendance_url || payload.certifiedAttendanceUrl || null,
      payload: payload.payload || payload.invoice_data || payload,
      created_at: now,
    };

    if (payload.payload) {
      insertRow.payload = payload.payload;
    }

    let { data, error } = await supabaseAdmin
      .from('invoices')
      .insert([insertRow])
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.warn('⚠️ Supabase insert with payload/join failed, retrying without payload column:', error.message);
      const insertRowClean = { ...insertRow };
      delete insertRowClean.payload;

      const fallbackInsert = await supabaseAdmin
        .from('invoices')
        .insert([insertRowClean])
        .select('*')
        .single();

      if (fallbackInsert.error) {
        console.error('❌ Supabase insert invoice error:', fallbackInsert.error.message);
        throw new Error(`Database insert failed: ${fallbackInsert.error.message}`);
      }
      data = fallbackInsert.data;
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
      await CompanyService.incrementSequence(companyId, insertRow.type);
    }

    return mapRowToInvoiceRecord(data);
  }

  /**
   * Delete invoice from DB
   */
  static async deleteInvoice(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase delete invoice error:', error.message);
      throw new Error(`Database delete failed: ${error.message}`);
    }

    return true;
  }

  /**
   * Update is_locked status for an invoice
   */
  static async updateLockStatus(id: string, isLocked: boolean): Promise<InvoiceRecord> {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ is_locked: isLocked })
      .eq('id', id)
      .select('*, sites(*), companies(*)')
      .single();

    if (error) {
      console.error('❌ Supabase update lock status error:', error.message);
      throw new Error(`Lock status update failed: ${error.message}`);
    }

    return mapRowToInvoiceRecord(data);
  }
}
