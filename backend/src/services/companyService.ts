import { z } from 'zod';
import { pool } from '../db/pool';
import { CompanyProfile } from '../types/company';

const DateOrString = z.union([z.string(), z.date()]).optional();

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
    created_at: DateOrString,
    updated_at: DateOrString,
  })
  .passthrough();

export function extractAddressParts(
  rawAddressLine2?: string,
  rawCity?: string,
  rawState?: string,
  rawPincode?: string
): { address_line2: string; city: string; state: string; pincode: string } {
  let city = (rawCity || '').trim();
  let state = (rawState || '').trim();
  let pincode = (rawPincode || '').trim();
  let address_line2 = (rawAddressLine2 || '').trim();

  if (city && state && pincode) {
    return { address_line2, city, state, pincode };
  }

  // Parse from concatenated address_line2 if present
  if (address_line2) {
    // 1. Extract 6-digit Indian Pincode
    if (!pincode) {
      const pinMatch = address_line2.match(/\b(\d{6})\b/);
      if (pinMatch) {
        pincode = pinMatch[1];
        address_line2 = address_line2.replace(/[-–—,\s]*\b\d{6}\b/, '').trim();
      }
    }

    // 2. Split remainder by commas or hyphens
    const parts = address_line2.split(/[,–—]+/).map((p) => p.trim()).filter(Boolean);

    if (!state && parts.length >= 2) {
      state = parts.pop() || '';
    } else if (!state && parts.length === 1 && !city) {
      state = 'Maharashtra';
    }

    if (!city && parts.length >= 1) {
      city = parts.pop() || '';
    }

    address_line2 = parts.join(', ').trim();
  }

  if (!city) city = 'Mumbai';
  if (!state) state = 'Maharashtra';
  if (!pincode) pincode = '400067';

  return { address_line2, city, state, pincode };
}

function mapRowToCompanyProfile(rawRow: any): CompanyProfile {
  const row = CompanyRowSchema.parse(rawRow || {});
  const terms = row.terms_and_conditions || row.default_terms || [];
  const normalizedTerms = Array.isArray(terms) ? terms : [String(terms)];
  const addr = extractAddressParts(row.address_line2, row.city, row.state, row.pincode);

  return {
    id: row.id,
    code: row.entity_code || row.code || '',
    name: row.name || row.legal_name || '',
    legal_name: row.legal_name || row.name || '',
    address_line1: row.address_line1,
    address_line2: addr.address_line2,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
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
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || undefined),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || undefined),
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
  /**
   * Resynchronize company sequence counters with actual invoice records in DB
   */
  static async syncCompanySequences(): Promise<void> {
    try {
      await pool.query(`
        UPDATE public.companies c
        SET tax_sequence = GREATEST(
          COALESCE(c.tax_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.tax_prefix IS NOT NULL AND c.tax_prefix != '' AND i.invoice_no LIKE c.tax_prefix || '%'))
              AND i.type = 'Tax Invoice'
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        ),
        proforma_sequence = GREATEST(
          COALESCE(c.proforma_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.proforma_prefix IS NOT NULL AND c.proforma_prefix != '' AND i.invoice_no LIKE c.proforma_prefix || '%'))
              AND (i.type = 'Proforma Invoice' OR i.type = 'Proforma')
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        );
      `);
      console.log('✅ Company sequence counters synchronized with invoices');
    } catch (err: any) {
      console.warn('⚠️ syncCompanySequences warning:', err.message);
    }
  }

  static async getAllCompanies(): Promise<CompanyProfile[]> {
    const res = await pool.query(`
      SELECT 
        c.*,
        GREATEST(
          COALESCE(c.tax_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.tax_prefix IS NOT NULL AND c.tax_prefix != '' AND i.invoice_no LIKE c.tax_prefix || '%'))
              AND i.type = 'Tax Invoice'
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        ) AS tax_sequence,
        GREATEST(
          COALESCE(c.proforma_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.proforma_prefix IS NOT NULL AND c.proforma_prefix != '' AND i.invoice_no LIKE c.proforma_prefix || '%'))
              AND (i.type = 'Proforma Invoice' OR i.type = 'Proforma')
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        ) AS proforma_sequence
      FROM public.companies c
      ORDER BY c.name ASC
    `);
    return (res.rows || []).map(mapRowToCompanyProfile);
  }

  /**
   * Fetch company by ID strictly using eq('id', id)
   */
  static async getCompanyById(id: string): Promise<CompanyProfile | null> {
    const res = await pool.query(`
      SELECT 
        c.*,
        GREATEST(
          COALESCE(c.tax_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.tax_prefix IS NOT NULL AND c.tax_prefix != '' AND i.invoice_no LIKE c.tax_prefix || '%'))
              AND i.type = 'Tax Invoice'
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        ) AS tax_sequence,
        GREATEST(
          COALESCE(c.proforma_sequence, 0),
          COALESCE((
            SELECT MAX(SUBSTRING(i.invoice_no FROM '([0-9]+)$')::integer)
            FROM public.invoices i
            WHERE (i.company_id = c.id OR (c.proforma_prefix IS NOT NULL AND c.proforma_prefix != '' AND i.invoice_no LIKE c.proforma_prefix || '%'))
              AND (i.type = 'Proforma Invoice' OR i.type = 'Proforma')
              AND i.invoice_no ~ '([0-9]+)$'
          ), 0)
        ) AS proforma_sequence
      FROM public.companies c
      WHERE c.id = $1
      LIMIT 1
    `, [id]);
    return res.rows?.[0] ? mapRowToCompanyProfile(res.rows[0]) : null;
  }

  /**
   * Fetch company by Entity Code or Code
   */
  static async getCompanyByCode(code: string): Promise<CompanyProfile | null> {
    const formattedCode = code.toUpperCase().trim();
    const res = await pool.query(
      'SELECT * FROM public.companies WHERE UPPER(entity_code) = $1 OR UPPER(code) = $1 LIMIT 1',
      [formattedCode]
    );
    return res.rows?.[0] ? mapRowToCompanyProfile(res.rows[0]) : null;
  }

  /**
   * Create a new company profile with strict PostgreSQL schema mapping
   */
  static async createCompany(payload: any): Promise<CompanyProfile> {
    const now = new Date().toISOString();

    const insertRow: any = {
      entity_code: (payload.entity_code || payload.code || '').toUpperCase().trim(),
      name: payload.name || payload.legal_name,
      address_line1: payload.address_line1 || '',
      address_line2: formatAddressLine2(
        payload.address_line2,
        payload.city,
        payload.state,
        payload.pincode
      ),
      contact_no: payload.contact_no || payload.phone || '',
      email_website: payload.email_website || payload.email || '',
      cin_no: payload.cin_no || payload.cin || '',
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
      updated_at: now,
    };

    const insertQuery = `
      INSERT INTO public.companies (
        entity_code, name, address_line1, address_line2,
        contact_no, email_website, cin_no, gstin,
        bank_name, account_no, ifsc_code, branch_name,
        default_terms, tax_prefix, tax_sequence,
        proforma_prefix, proforma_sequence, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19
      ) RETURNING *;
    `;

    const values = [
      insertRow.entity_code,
      insertRow.name,
      insertRow.address_line1,
      insertRow.address_line2,
      insertRow.contact_no,
      insertRow.email_website,
      insertRow.cin_no,
      insertRow.gstin,
      insertRow.bank_name,
      insertRow.account_no,
      insertRow.ifsc_code,
      insertRow.branch_name,
      JSON.stringify(insertRow.default_terms),
      insertRow.tax_prefix,
      insertRow.tax_sequence,
      insertRow.proforma_prefix,
      insertRow.proforma_sequence,
      insertRow.created_at,
      insertRow.updated_at,
    ];

    const res = await pool.query(insertQuery, values);
    return mapRowToCompanyProfile(res.rows[0]);
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

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updateData)) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(key === 'default_terms' && Array.isArray(val) ? JSON.stringify(val) : val);
    }

    if (setClauses.length === 0) {
      const existing = await this.getCompanyById(id);
      if (!existing) throw new Error('Company not found');
      return existing;
    }

    setClauses.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    values.push(id);
    const query = `UPDATE public.companies SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *;`;
    const res = await pool.query(query, values);
    if (!res.rows?.[0]) throw new Error('Company not found');
    return mapRowToCompanyProfile(res.rows[0]);
  }

  /**
   * Soft delete / Toggle active state
   */
  static async toggleActiveState(id: string, is_active: boolean): Promise<CompanyProfile> {
    const res = await pool.query(
      'UPDATE public.companies SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *;',
      [is_active, id]
    );
    if (!res.rows?.[0]) throw new Error('Company not found');
    return mapRowToCompanyProfile(res.rows[0]);
  }

  /**
   * Atomic sequence increment on invoice save (SEC-004 fix)
   * Executes atomic SQL UPDATE ... RETURNING to eliminate race conditions under concurrent saves.
   */
  static async incrementSequence(
    companyIdOrCode: string,
    invoiceType: string
  ): Promise<{ sequence: number; prefix: string }> {
    const isProforma = invoiceType === 'Proforma Invoice';
    const column = isProforma ? 'proforma_sequence' : 'tax_sequence';
    const prefixColumn = isProforma ? 'proforma_prefix' : 'tax_prefix';

    const query = `
      UPDATE public.companies
      SET ${column} = COALESCE(${column}, 0) + 1
      WHERE id::text = $1 OR UPPER(entity_code) = UPPER($1)
      RETURNING ${column} AS sequence, ${prefixColumn} AS prefix, id
    `;
    const result = await pool.query(query, [companyIdOrCode.trim()]);
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return { sequence: Number(row.sequence), prefix: row.prefix };
    }

    throw new Error(`Company not found for sequence increment: ${companyIdOrCode}`);
  }
}
