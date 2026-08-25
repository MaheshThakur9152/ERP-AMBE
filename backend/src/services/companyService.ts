import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { CompanyProfile } from '../types/company';

const CompanyRowSchema = z
  .object({
    id: z.string().optional(),
    entity_code: z.string().optional(),
    code: z.string().optional(),
    name: z.string().optional(),
    legal_name: z.string().optional(),
    tagline: z.string().optional(),
    gstin: z.string().optional().default(''),
    pan: z.string().optional(),
    cin_no: z.string().optional(),
    cin: z.string().optional(),
    email_website: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    contact_no: z.string().optional(),
    website: z.string().optional(),
    address_line1: z.string().optional().default(''),
    address_line2: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().default(''),
    pincode: z.string().optional().default(''),
    state_code: z.string().optional(),
    bank_name: z.string().optional().default(''),
    account_no: z.string().optional(),
    bank_account_no: z.string().optional(),
    ifsc_code: z.string().optional(),
    bank_ifsc: z.string().optional(),
    branch_name: z.string().optional(),
    bank_branch: z.string().optional(),
    default_terms: z.any().optional(),
    terms_and_conditions: z.any().optional(),
    tax_prefix: z.string().optional().default('AS/26-27/'),
    tax_sequence: z.number().optional().default(1),
    proforma_prefix: z.string().optional().default('AS/P/26-27/'),
    proforma_sequence: z.number().optional().default(1),
    logo_url: z.string().optional(),
    stamp_url: z.string().optional(),
    signature_url: z.string().optional(),
    is_active: z.boolean().optional().default(true),
    is_locked: z.boolean().optional().default(false),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

function mapRowToCompanyProfile(rawRow: any): CompanyProfile {
  const row = CompanyRowSchema.parse(rawRow || {});
  const terms = row.terms_and_conditions || row.default_terms || [];
  const normalizedTerms = Array.isArray(terms) ? terms : [String(terms)];

  return {
    id: row.id,
    code: row.entity_code || row.code || '',
    name: row.name || row.legal_name || '',
    legal_name: row.legal_name || row.name || '',
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    phone: row.phone || row.contact_no || '',
    email: row.email || row.email_website || '',
    gstin: row.gstin,
    cin: row.cin || row.cin_no || '',
    bank_name: row.bank_name,
    bank_account_no: row.bank_account_no || row.account_no || '',
    bank_ifsc: row.bank_ifsc || row.ifsc_code || '',
    bank_branch: row.bank_branch || row.branch_name || '',
    terms_and_conditions: normalizedTerms,
    tax_prefix: row.tax_prefix,
    tax_sequence: row.tax_sequence,
    proforma_prefix: row.proforma_prefix,
    proforma_sequence: row.proforma_sequence,
    is_active: row.is_active,
    is_locked: Boolean(row.is_locked),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatAddressLine2(
  addressLine2?: string,
  city?: string,
  state?: string,
  pincode?: string
): string {
  return [addressLine2, city, state, pincode].filter(Boolean).join(', ');
}

export class CompanyService {
  /**
   * Fetch all companies from DB strictly using SELECT * FROM companies ORDER BY name ASC
   */
  static async getAllCompanies(): Promise<CompanyProfile[]> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Database error fetching companies:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return (data || []).map(mapRowToCompanyProfile);
  }

  /**
   * Fetch company by ID strictly using eq('id', id)
   */
  static async getCompanyById(id: string): Promise<CompanyProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data ? mapRowToCompanyProfile(data) : null;
  }

  /**
   * Fetch company by Entity Code or Code
   */
  static async getCompanyByCode(code: string): Promise<CompanyProfile | null> {
    const formattedCode = code.toUpperCase().trim();
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .or(`entity_code.eq.${formattedCode},code.eq.${formattedCode}`)
      .single();

    if (error) return null;
    return data ? mapRowToCompanyProfile(data) : null;
  }

  /**
   * Create a new company profile with strict PostgreSQL schema mapping
   */
  static async createCompany(payload: any): Promise<CompanyProfile> {
    const rawCode = payload.code || payload.entity_code || 'COMP';
    const formattedCode = rawCode.toUpperCase().trim();
    const now = new Date().toISOString();

    const insertRow = {
      entity_code: formattedCode,
      name: payload.name || payload.legal_name,
      address_line1: payload.address_line1,
      address_line2: formatAddressLine2(payload.address_line2, payload.city, payload.state, payload.pincode),
      contact_no: payload.phone || payload.contact_no || '',
      email_website: payload.email || payload.email_website || '',
      cin_no: payload.cin || payload.cin_no || '',
      gstin: payload.gstin || '',
      bank_name: payload.bank_name || '',
      account_no: payload.bank_account_no || payload.account_no || '',
      ifsc_code: payload.bank_ifsc || payload.ifsc_code || '',
      branch_name: payload.bank_branch || payload.branch_name || '',
      default_terms: payload.terms_and_conditions || payload.default_terms || [],
      tax_prefix: payload.tax_prefix || 'AS/26-27/',
      tax_sequence: payload.tax_sequence ?? 1,
      proforma_prefix: payload.proforma_prefix || 'AS/P/26-27/',
      proforma_sequence: payload.proforma_sequence ?? 1,
      created_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert([insertRow])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase insert company error:', error.message);
      throw new Error(`Database insert failed: ${error.message}`);
    }
    return mapRowToCompanyProfile(data);
  }

  /**
   * Update an existing company profile with strict PostgreSQL schema mapping
   */
  static async updateCompany(id: string, payload: any): Promise<CompanyProfile> {
    const updateData: any = {};
    if (payload.code || payload.entity_code) {
      updateData.entity_code = (payload.entity_code || payload.code).toUpperCase().trim();
    }
    if (payload.name || payload.legal_name) {
      updateData.name = payload.name || payload.legal_name;
    }
    if (payload.address_line1 !== undefined) {
      updateData.address_line1 = payload.address_line1;
    }
    if (
      payload.address_line2 !== undefined ||
      payload.city !== undefined ||
      payload.state !== undefined ||
      payload.pincode !== undefined
    ) {
      const formattedAddress = formatAddressLine2(
        payload.address_line2,
        payload.city,
        payload.state,
        payload.pincode
      );
      if (formattedAddress) {
        updateData.address_line2 = formattedAddress;
      }
    }
    if (payload.phone !== undefined || payload.contact_no !== undefined) {
      updateData.contact_no = payload.phone || payload.contact_no || '';
    }
    if (payload.email !== undefined || payload.email_website !== undefined) {
      updateData.email_website = payload.email || payload.email_website || '';
    }
    if (payload.cin !== undefined || payload.cin_no !== undefined) {
      updateData.cin_no = payload.cin || payload.cin_no || '';
    }
    if (payload.gstin !== undefined) {
      updateData.gstin = payload.gstin;
    }
    if (payload.bank_name !== undefined) {
      updateData.bank_name = payload.bank_name;
    }
    if (payload.bank_account_no !== undefined || payload.account_no !== undefined) {
      updateData.account_no = payload.bank_account_no || payload.account_no || '';
    }
    if (payload.bank_ifsc !== undefined || payload.ifsc_code !== undefined) {
      updateData.ifsc_code = payload.bank_ifsc || payload.ifsc_code || '';
    }
    if (payload.bank_branch !== undefined || payload.branch_name !== undefined) {
      updateData.branch_name = payload.bank_branch || payload.branch_name || '';
    }
    if (payload.terms_and_conditions !== undefined || payload.default_terms !== undefined) {
      updateData.default_terms = payload.terms_and_conditions || payload.default_terms || [];
    }
    if (payload.tax_prefix !== undefined) {
      updateData.tax_prefix = payload.tax_prefix;
    }
    if (payload.tax_sequence !== undefined) {
      updateData.tax_sequence = payload.tax_sequence;
    }
    if (payload.proforma_prefix !== undefined) {
      updateData.proforma_prefix = payload.proforma_prefix;
    }
    if (payload.proforma_sequence !== undefined) {
      updateData.proforma_sequence = payload.proforma_sequence;
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase update company error:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }
    return mapRowToCompanyProfile(data);
  }

  /**
   * Soft delete / Toggle active state
   */
  static async toggleActiveState(id: string, is_active: boolean): Promise<CompanyProfile> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase toggleActiveState error:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }
    return mapRowToCompanyProfile(data);
  }

  /**
   * Auto-increment sequence on invoice save
   */
  static async incrementSequence(companyIdOrCode: string, invoiceType: string): Promise<void> {
    const isProforma = invoiceType === 'Proforma Invoice';
    const isById = Boolean(companyIdOrCode && companyIdOrCode.length > 10);

    const company = isById
      ? await this.getCompanyById(companyIdOrCode)
      : await this.getCompanyByCode(companyIdOrCode);

    if (company && company.id) {
      if (isProforma) {
        const nextSeq = (company.proforma_sequence || 1) + 1;
        await supabaseAdmin.from('companies').update({ proforma_sequence: nextSeq }).eq('id', company.id);
      } else {
        const nextSeq = (company.tax_sequence || 1) + 1;
        await supabaseAdmin.from('companies').update({ tax_sequence: nextSeq }).eq('id', company.id);
      }
    }
  }
}
