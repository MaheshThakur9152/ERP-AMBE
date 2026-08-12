import { supabaseAdmin } from '../config/supabase';
import { Site } from '../types/site';
import { CompanyService } from './companyService';

function mapRowToSite(row: any): Site {
  return {
    id: row.id,
    company_id: row.company_id || row.companyId || '',
    companyId: row.company_id || row.companyId || '',
    siteName: row.site_name || row.siteName || '',
    clientName: row.client_name || row.clientName || '',
    gstin: row.gstin || '',
    workOrderRefNo: row.work_order_ref || row.work_order_ref_no || row.workOrderRefNo || '',
    workOrderPeriod: row.work_order_period || row.workOrderPeriod || '',
    address: row.address || '',
    contactNo: row.contact_no || row.contactNo || '',
    email: row.email || '',
    status: row.status || 'Active',
    rateCards: row.rate_cards || row.rateCards || [],
    createdAt: row.created_at || row.createdAt,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class SiteService {
  /**
   * Fetch all sites from DB strictly using SELECT * FROM sites ORDER BY created_at DESC
   */
  static async getAllSites(): Promise<Site[]> {
    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error fetching sites:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return (data || []).map(mapRowToSite);
  }

  /**
   * Fetch site by ID
   */
  static async getSiteById(id: string): Promise<Site | null> {
    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Database error fetching site by ID:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return data ? mapRowToSite(data) : null;
  }

  /**
   * Create site in DB with strict schema mapping and company_id FK
   */
  static async createSite(payload: any): Promise<Site> {
    const now = new Date().toISOString();

    // Enforce company_id foreign key constraint
    let companyId = payload.company_id || payload.companyId;
    if (!companyId) {
      const companies = await CompanyService.getAllCompanies();
      if (companies.length > 0) {
        companyId = companies[0].id;
      }
    }

    const insertRow = {
      company_id: companyId,
      client_name: payload.client_name || payload.clientName,
      site_name: payload.site_name || payload.siteName || '',
      address: payload.address,
      gstin: payload.gstin || '',
      work_order_ref: payload.work_order_ref || payload.workOrderRefNo || '',
      work_order_period: payload.work_order_period || payload.workOrderPeriod || '',
      rate_cards: payload.rate_cards || payload.rateCards || [],
      created_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('sites')
      .insert([insertRow])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase insert site error:', error.message);
      throw new Error(`Database insert failed: ${error.message}`);
    }
    return mapRowToSite(data);
  }

  /**
   * Update site in DB with strict schema mapping
   */
  static async updateSite(id: string, payload: any): Promise<Site> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (payload.company_id || payload.companyId) {
      updateData.company_id = payload.company_id || payload.companyId;
    }
    if (payload.siteName !== undefined || payload.site_name !== undefined) {
      updateData.site_name = payload.siteName || payload.site_name || '';
    }
    if (payload.clientName !== undefined || payload.client_name !== undefined) {
      updateData.client_name = payload.clientName || payload.client_name || '';
    }
    if (payload.gstin !== undefined) updateData.gstin = payload.gstin;
    if (payload.workOrderRefNo !== undefined || payload.work_order_ref !== undefined) {
      updateData.work_order_ref = payload.workOrderRefNo || payload.work_order_ref || '';
    }
    if (payload.workOrderPeriod !== undefined || payload.work_order_period !== undefined) {
      updateData.work_order_period = payload.workOrderPeriod || payload.work_order_period || '';
    }
    if (payload.address !== undefined) updateData.address = payload.address;
    if (payload.contactNo !== undefined || payload.contact_no !== undefined) {
      updateData.contact_no = payload.contactNo || payload.contact_no || '';
    }
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.rateCards || payload.rate_cards) {
      updateData.rate_cards = payload.rateCards || payload.rate_cards;
    }

    const { data, error } = await supabaseAdmin
      .from('sites')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase update site error:', error.message);
      throw new Error(`Database update failed: ${error.message}`);
    }
    return mapRowToSite(data);
  }

  /**
   * Delete site from DB
   */
  static async deleteSite(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('sites')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase delete site error:', error.message);
      throw new Error(`Database delete failed: ${error.message}`);
    }
    return true;
  }
}
