import { supabaseAdmin } from '../config/supabase';
import { CompanyProfile, CreateCompanyDTO, UpdateCompanyDTO } from '../types/company';

export class CompanyService {
  /**
   * Fetch all active company profiles
   */
  static async getAllCompanies(): Promise<CompanyProfile[]> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch companies: ${error.message}`);
    return data || [];
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

    if (error) throw new Error(`Company not found: ${error.message}`);
    return data;
  }

  /**
   * Fetch company by code (e.g. 'AMBE', 'ASF')
   */
  static async getCompanyByCode(code: string): Promise<CompanyProfile | null> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new company profile
   */
  static async createCompany(payload: CreateCompanyDTO): Promise<CompanyProfile> {
    const formattedCode = payload.code.toUpperCase().trim();
    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert([{ ...payload, code: formattedCode }])
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create company: ${error.message}`);
    return data;
  }

  /**
   * Update an existing company profile
   */
  static async updateCompany(id: string, payload: UpdateCompanyDTO): Promise<CompanyProfile> {
    const updateData = { ...payload };
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase().trim();
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update company: ${error.message}`);
    return data;
  }

  /**
   * Soft delete / Toggle active state
   */
  static async toggleActiveState(id: string, is_active: boolean): Promise<CompanyProfile> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ is_active })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update status: ${error.message}`);
    return data;
  }
}
