import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { Site } from '../types/site';
import { CompanyService } from './companyService';
import { DEFAULT_MGMT_FEE_PERCENT } from '../config/constants';

const SiteRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string().optional(),
    companyId: z.string().optional(),
    site_name: z.string().optional(),
    siteName: z.string().optional(),
    code_name: z.string().optional(),
    codeName: z.string().optional(),
    client_name: z.string().optional(),
    clientName: z.string().optional(),
    gstin: z.string().optional().default(''),
    work_order_ref: z.string().optional(),
    work_order_ref_no: z.string().optional(),
    workOrderRefNo: z.string().optional(),
    work_order_period: z.string().optional(),
    workOrderPeriod: z.string().optional(),
    address: z.string().optional().default(''),
    contact_no: z.string().optional(),
    contactNo: z.string().optional(),
    email: z.string().optional().default(''),
    status: z.string().optional().default('Active'),
    management_fee_percent: z.union([z.number(), z.string()]).optional(),
    mgmt_percent: z.union([z.number(), z.string()]).optional(),
    mgmtPercent: z.union([z.number(), z.string()]).optional(),
    default_machinery_charges: z.union([z.number(), z.string()]).optional(),
    defaultMachineryCharges: z.union([z.number(), z.string()]).optional(),
    default_material_charges: z.union([z.number(), z.string()]).optional(),
    defaultMaterialCharges: z.union([z.number(), z.string()]).optional(),
    default_additional_charges: z.array(z.any()).optional(),
    defaultAdditionalCharges: z.array(z.any()).optional(),
    additional_charges: z.array(z.any()).optional(),
    rate_cards: z.array(z.any()).optional(),
    rateCards: z.array(z.any()).optional(),
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

function mapRowToSite(rawRow: any): Site {
  const row = SiteRowSchema.parse(rawRow || {});
  const machinery = Number(row.default_machinery_charges ?? row.defaultMachineryCharges ?? 0);
  const material = Number(row.default_material_charges ?? row.defaultMaterialCharges ?? 0);
  const fallbackAdditional = [
    ...(machinery > 0 ? [{ name: 'Machinery Charges', amount: machinery }] : []),
    ...(material > 0 ? [{ name: 'Material Charges', amount: material }] : []),
  ];

  const additional =
    row.additional_charges ||
    row.default_additional_charges ||
    row.defaultAdditionalCharges ||
    fallbackAdditional;

  const mgmtFee = Number(
    row.management_fee_percent ?? row.mgmt_percent ?? row.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT
  );

  return {
    id: row.id,
    companyId: row.companyId || row.company_id || '',
    company_id: row.company_id || row.companyId || '',
    siteName: row.siteName || row.site_name || '',
    codeName: row.codeName || row.code_name || '',
    code_name: row.code_name || row.codeName || '',
    clientName: row.clientName || row.client_name || '',
    gstin: row.gstin || '',
    workOrderRefNo: row.workOrderRefNo || row.work_order_ref_no || row.work_order_ref || '',
    workOrderPeriod: row.workOrderPeriod || row.work_order_period || '',
    address: row.address || '',
    contactNo: row.contactNo || row.contact_no || '',
    email: row.email || '',
    status: (row.status as 'Active' | 'Inactive') || 'Active',
    mgmtPercent: mgmtFee,
    management_fee_percent: mgmtFee,
    defaultMachineryCharges: machinery,
    default_machinery_charges: machinery,
    defaultMaterialCharges: material,
    default_material_charges: material,
    defaultAdditionalCharges: additional,
    default_additional_charges: additional,
    rateCards: row.rateCards || row.rate_cards || [],
    createdAt: row.createdAt || row.created_at,
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at,
  };
}

import { AuthUser } from '../types/express';

export class SiteService {
  /**
   * Validates tenant ownership of a target site before mutation
   */
  static async verifySiteOwnership(siteId: string, user?: AuthUser): Promise<void> {
    if (!user || user.role === 'superadmin' || !user.company_id) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('id, company_id')
      .eq('id', siteId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Site not found');
    }

    if (data.company_id && data.company_id !== user.company_id) {
      throw new Error('FORBIDDEN_TENANT_ACCESS: You do not have permission to access records for this company');
    }
  }

  /**
   * Fetch all sites from DB strictly using SELECT * FROM sites ORDER BY created_at DESC
   */
  static async getAllSites(user?: AuthUser): Promise<Site[]> {
    let query = supabaseAdmin
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (user && user.role !== 'superadmin' && user.company_id) {
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Database error fetching sites:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
    return (data || []).map(mapRowToSite);
  }

  /**
   * Fetch site by ID
   */
  static async getSiteById(id: string, user?: AuthUser): Promise<Site | null> {
    await this.verifySiteOwnership(id, user);

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
  static async createSite(payload: any, user?: AuthUser): Promise<Site> {
    const now = new Date().toISOString();

    // Enforce company_id foreign key constraint
    let companyId = payload.company_id || payload.companyId;
    if (user && user.role !== 'superadmin' && user.company_id) {
      companyId = user.company_id;
    } else if (!companyId) {
      const companies = await CompanyService.getAllCompanies();
      if (companies.length > 0) {
        companyId = companies[0].id;
      }
    }

    const insertRow = {
      company_id: companyId,
      client_name: payload.client_name || payload.clientName,
      site_name: payload.site_name || payload.siteName || '',
      code_name: payload.code_name || payload.codeName || '',
      address: payload.address,
      gstin: payload.gstin || '',
      work_order_ref: payload.work_order_ref || payload.workOrderRefNo || '',
      work_order_period: payload.work_order_period || payload.workOrderPeriod || '',
      contact_no: payload.contact_no || payload.contactNo || '',
      email: payload.email || '',
      management_fee_percent: payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      default_machinery_charges: Number(payload.default_machinery_charges ?? payload.defaultMachineryCharges ?? 0),
      default_material_charges: Number(payload.default_material_charges ?? payload.defaultMaterialCharges ?? 0),
      additional_charges: payload.additional_charges || payload.default_additional_charges || payload.defaultAdditionalCharges || payload.additionalCharges || [],
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
  static async updateSite(id: string, payload: any, user?: AuthUser): Promise<Site> {
    await this.verifySiteOwnership(id, user);

    const updateData: any = { updated_at: new Date().toISOString() };
    if (payload.company_id || payload.companyId) {
      updateData.company_id = payload.company_id || payload.companyId;
    }
    if (payload.siteName !== undefined || payload.site_name !== undefined) {
      updateData.site_name = payload.siteName || payload.site_name || '';
    }
    if (payload.codeName !== undefined || payload.code_name !== undefined) {
      updateData.code_name = payload.codeName || payload.code_name || '';
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
    if (payload.management_fee_percent !== undefined || payload.mgmt_percent !== undefined || payload.mgmtPercent !== undefined) {
      updateData.management_fee_percent = payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent;
    }
    if (payload.default_machinery_charges !== undefined || payload.defaultMachineryCharges !== undefined) {
      updateData.default_machinery_charges = Number(payload.default_machinery_charges ?? payload.defaultMachineryCharges ?? 0);
    }
    if (payload.default_material_charges !== undefined || payload.defaultMaterialCharges !== undefined) {
      updateData.default_material_charges = Number(payload.default_material_charges ?? payload.defaultMaterialCharges ?? 0);
    }
    if (payload.additional_charges !== undefined || payload.default_additional_charges !== undefined || payload.defaultAdditionalCharges !== undefined || payload.additionalCharges !== undefined) {
      updateData.additional_charges = payload.additional_charges || payload.default_additional_charges || payload.defaultAdditionalCharges || payload.additionalCharges || [];
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
  static async deleteSite(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifySiteOwnership(id, user);

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
