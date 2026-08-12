import { supabaseAdmin } from '../config/supabase';
import { CompanyProfile } from '../types/company';

function mapRowToCompanyProfile(row: any): CompanyProfile {
  return {
    id: row.id,
    code: row.entity_code || row.code || '',
    name: row.name || '',
    legal_name: row.name || row.legal_name || '',
    address_line1: row.address_line1 || '',
    address_line2: row.address_line2 || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    phone: row.contact_no || row.phone || '',
    email: row.email_website || row.email || '',
    gstin: row.gstin || '',
    cin: row.cin_no || row.cin || '',
    bank_name: row.bank_name || '',
    bank_account_no: row.account_no || row.bank_account_no || '',
    bank_ifsc: row.ifsc_code || row.bank_ifsc || '',
    bank_branch: row.branch_name || row.bank_branch || '',
    terms_and_conditions: row.default_terms || row.terms_and_conditions || [],
    tax_prefix: row.tax_prefix || 'AS/26-27/',
    tax_sequence: row.tax_sequence ?? 1,
    proforma_prefix: row.proforma_prefix || 'AS/P/26-27/',
    proforma_sequence: row.proforma_sequence ?? 1,
    is_active: row.is_active !== undefined ? row.is_active : true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class CompanyService {
  /**
   * Fetch all companies from DB strictly using SELECT * FROM companies ORDER BY created_at DESC
   */
  static async getAllCompanies(): Promise<CompanyProfile[]> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error fetching companies:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return (data || []).map(mapRowToCompanyProfile);
  }

  /**
   * Fetch company profile by ID
   */
  static async getCompanyById(id: string): Promise<CompanyProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Database error fetching company by ID:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return data ? mapRowToCompanyProfile(data) : null;
  }

  /**
   * Fetch company by code (e.g. 'AMBE', 'ASF')
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
      address_line2: [payload.address_line2, payload.city, payload.state, payload.pincode].filter(Boolean).join(', '),
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
      const address2Parts = [
        payload.address_line2,
        payload.city,
        payload.state,
        payload.pincode,
      ].filter(Boolean);
      if (address2Parts.length > 0) {
        updateData.address_line2 = address2Parts.join(', ');
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
