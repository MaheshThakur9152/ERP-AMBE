import { z } from 'zod';
import { pool } from '../db/pool';
import { Site } from '../types/site';
import { CompanyService } from './companyService';
import { DEFAULT_MGMT_FEE_PERCENT } from '../config/constants';
import { OracleStorageService } from './oracleStorageService';
import { buildSiteStorageKey } from '../utils/storageKeys';
import { enrichDocumentsWithViewUrl, enrichDocumentWithViewUrl } from '../utils/documentViewHelper';
import { CompressionService } from './compressionService';
import { buildFileName } from '../utils/fileUtils';
import { AuthUser } from '../types/express';

const DateOrString = z.union([z.string(), z.date()]).nullish();

const SiteRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string().nullish(),
    companyId: z.string().nullish(),
    site_name: z.string().nullish(),
    siteName: z.string().nullish(),
    code_name: z.string().nullish(),
    codeName: z.string().nullish(),
    client_name: z.string().nullish(),
    clientName: z.string().nullish(),
    gstin: z.string().nullish().default(''),
    work_order_ref: z.string().nullish(),
    work_order_ref_no: z.string().nullish(),
    workOrderRefNo: z.string().nullish(),
    work_order_period: z.string().nullish(),
    workOrderPeriod: z.string().nullish(),
    address: z.string().nullish().default(''),
    contact_no: z.string().nullish(),
    contactNo: z.string().nullish(),
    email: z.string().nullish().default(''),
    status: z.string().nullish().default('Active'),
    management_fee_percent: z.union([z.number(), z.string()]).nullish(),
    mgmt_percent: z.union([z.number(), z.string()]).nullish(),
    mgmtPercent: z.union([z.number(), z.string()]).nullish(),
    default_machinery_charges: z.union([z.number(), z.string()]).nullish(),
    defaultMachineryCharges: z.union([z.number(), z.string()]).nullish(),
    default_material_charges: z.union([z.number(), z.string()]).nullish(),
    defaultMaterialCharges: z.union([z.number(), z.string()]).nullish(),
    default_additional_charges: z.array(z.any()).nullish(),
    defaultAdditionalCharges: z.array(z.any()).nullish(),
    additional_charges: z.array(z.any()).nullish(),
    rate_cards: z.array(z.any()).nullish(),
    rateCards: z.array(z.any()).nullish(),
    created_at: DateOrString,
    createdAt: DateOrString,
    updated_at: DateOrString,
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
    is_locked: Boolean(row.is_locked),
    isLocked: Boolean(row.is_locked),
    createdAt: (row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt || (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at))) ?? undefined,
    updatedAt: (row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at) ?? undefined,
  };
}

export class SiteService {
  /**
   * Validates tenant ownership of a target site before mutation
   */
  static async verifySiteOwnership(siteId: string, user?: AuthUser): Promise<void> {
    const res = await pool.query('SELECT id, company_id FROM public.sites WHERE id = $1 LIMIT 1', [siteId]);
    if (!res.rows || res.rows.length === 0) {
      const err: any = new Error('Site not found');
      err.statusCode = 404;
      throw err;
    }
    const site = res.rows[0];
    const userCompanyId = user?.company_id || user?.companyId;
    if (user && user.role !== 'superadmin' && userCompanyId && site.company_id && userCompanyId !== site.company_id) {
      const authErr: any = new Error('Access denied: Unauthorized company access');
      authErr.statusCode = 403;
      throw authErr;
    }
  }

  /**
   * Fetch all sites from DB with company scoping for non-superadmins
   */
  static async getAllSites(user?: AuthUser): Promise<Site[]> {
    const userCompanyId = user?.company_id || user?.companyId;
    if (user && user.role !== 'superadmin' && userCompanyId) {
      const res = await pool.query('SELECT * FROM public.sites WHERE company_id = $1 ORDER BY created_at DESC', [userCompanyId]);
      return (res.rows || []).map(mapRowToSite);
    }
    const res = await pool.query('SELECT * FROM public.sites ORDER BY created_at DESC');
    return (res.rows || []).map(mapRowToSite);
  }

  /**
   * Fetch site by ID
   */
  static async getSiteById(id: string, user?: AuthUser): Promise<Site | null> {
    await this.verifySiteOwnership(id, user);
    const res = await pool.query('SELECT * FROM public.sites WHERE id = $1 LIMIT 1', [id]);
    if (!res.rows || res.rows.length === 0) return null;
    return mapRowToSite(res.rows[0]);
  }

  /**
   * Create site in DB with strict schema mapping and company_id FK
   */
  static async createSite(payload: any, user?: AuthUser): Promise<Site> {
    let companyId = payload.company_id || payload.companyId;
    if (user && user.role !== 'superadmin' && user.company_id) {
      companyId = user.company_id;
    } else if (!companyId) {
      const companies = await CompanyService.getAllCompanies();
      if (companies.length > 0) {
        companyId = companies[0].id;
      }
    }

    const insertSql = `
      INSERT INTO public.sites (
        company_id, client_name, site_name, code_name, address, gstin,
        work_order_ref, work_order_period, contact_no, email, management_fee_percent,
        default_machinery_charges, default_material_charges, additional_charges, rate_cards, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, NOW(), NOW()
      )
      RETURNING *;
    `;

    const res = await pool.query(insertSql, [
      companyId || null,
      payload.client_name || payload.clientName || 'Client',
      payload.site_name || payload.siteName || '',
      payload.code_name || payload.codeName || '',
      payload.address || '',
      payload.gstin || '',
      payload.work_order_ref || payload.workOrderRefNo || '',
      payload.work_order_period || payload.workOrderPeriod || '',
      payload.contact_no || payload.contactNo || '',
      payload.email || '',
      payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? DEFAULT_MGMT_FEE_PERCENT,
      Number(payload.default_machinery_charges ?? payload.defaultMachineryCharges ?? 0),
      Number(payload.default_material_charges ?? payload.defaultMaterialCharges ?? 0),
      JSON.stringify(payload.additional_charges || payload.default_additional_charges || payload.defaultAdditionalCharges || payload.additionalCharges || []),
      JSON.stringify(payload.rate_cards || payload.rateCards || []),
    ]);

    return mapRowToSite(res.rows[0]);
  }

  /**
   * Update site in DB with strict schema mapping
   */
  static async updateSite(id: string, payload: any, user?: AuthUser): Promise<Site> {
    await this.verifySiteOwnership(id, user);

    const updateSql = `
      UPDATE public.sites SET
        company_id = COALESCE($1, company_id),
        site_name = COALESCE($2, site_name),
        code_name = COALESCE($3, code_name),
        client_name = COALESCE($4, client_name),
        gstin = COALESCE($5, gstin),
        work_order_ref = COALESCE($6, work_order_ref),
        work_order_period = COALESCE($7, work_order_period),
        management_fee_percent = COALESCE($8, management_fee_percent),
        default_machinery_charges = COALESCE($9, default_machinery_charges),
        default_material_charges = COALESCE($10, default_material_charges),
        additional_charges = COALESCE($11, additional_charges),
        address = COALESCE($12, address),
        contact_no = COALESCE($13, contact_no),
        email = COALESCE($14, email),
        status = COALESCE($15, status),
        rate_cards = COALESCE($16, rate_cards),
        updated_at = NOW()
      WHERE id = $17
      RETURNING *;
    `;

    const res = await pool.query(updateSql, [
      payload.company_id || payload.companyId || null,
      payload.siteName || payload.site_name || null,
      payload.codeName || payload.code_name || null,
      payload.clientName || payload.client_name || null,
      payload.gstin !== undefined ? payload.gstin : null,
      payload.workOrderRefNo || payload.work_order_ref || null,
      payload.workOrderPeriod || payload.work_order_period || null,
      payload.management_fee_percent ?? payload.mgmt_percent ?? payload.mgmtPercent ?? null,
      payload.default_machinery_charges !== undefined ? Number(payload.default_machinery_charges ?? payload.defaultMachineryCharges ?? 0) : null,
      payload.default_material_charges !== undefined ? Number(payload.default_material_charges ?? payload.defaultMaterialCharges ?? 0) : null,
      (payload.additional_charges || payload.default_additional_charges || payload.defaultAdditionalCharges || payload.additionalCharges) ? JSON.stringify(payload.additional_charges || payload.default_additional_charges || payload.defaultAdditionalCharges || payload.additionalCharges) : null,
      payload.address !== undefined ? payload.address : null,
      payload.contactNo || payload.contact_no || null,
      payload.email !== undefined ? payload.email : null,
      payload.status !== undefined ? payload.status : null,
      (payload.rateCards || payload.rate_cards) ? JSON.stringify(payload.rateCards || payload.rate_cards) : null,
      id,
    ]);

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Site not found for update: ${id}`);
    }

    return mapRowToSite(res.rows[0]);
  }

  /**
   * Delete site from DB
   */
  static async deleteSite(id: string, user?: AuthUser): Promise<boolean> {
    await this.verifySiteOwnership(id, user);

    const res = await pool.query('DELETE FROM public.sites WHERE id = $1', [id]);
    if ((res.rowCount ?? 0) === 0) {
      throw new Error('Site not found');
    }
    return true;
  }

  /**
   * Fetch all documents for a site ordered by uploaded_at DESC
   */
  static async getSiteDocuments(siteId: string, user?: AuthUser): Promise<any[]> {
    await this.verifySiteOwnership(siteId, user);

    const res = await pool.query(
      'SELECT * FROM public.site_documents WHERE site_id = $1 ORDER BY uploaded_at DESC;',
      [siteId]
    );

    return enrichDocumentsWithViewUrl(res.rows || []);
  }

  /**
   * Upload, compress, and store a site document in Oracle/MinIO Storage
   */
  static async uploadSiteDocument(
    siteId: string,
    file: Express.Multer.File,
    documentType: string,
    documentLabel?: string,
    user?: AuthUser
  ): Promise<any> {
    await this.verifySiteOwnership(siteId, user);

    const site = await this.getSiteById(siteId, user);
    if (!site) {
      throw new Error(`Site not found: ${siteId}`);
    }

    // 1. Run file compression unchanged before storage call
    const compressed = await CompressionService.compressFile(file.buffer, file.mimetype);

    // 2. Build consistent file name
    const fileName = buildFileName({
      type: 'site_doc',
      entityCode: 'AMBE',
      siteCodeName: site.codeName || site.siteName,
      documentType: documentType || 'Document',
      originalName: file.originalname,
    });

    // 3. Build storage key: sites/{siteName}/{documentType}/{fileName}-{shortUuid}.{ext}
    const storageKey = buildSiteStorageKey({
      siteName: site.siteName,
      documentType: documentType || 'Document',
      originalName: fileName,
    });

    let uploadedStorageKey: string | null = null;
    try {
      // 4. Upload to MinIO / Oracle Object Storage
      const storageResult = await OracleStorageService.uploadFile(
        compressed.buffer,
        storageKey,
        compressed.mimeType
      );
      uploadedStorageKey = storageResult.storageKey;

      // 5. Generate signed read URL for immediate client preview
      const viewUrl = await OracleStorageService.getSignedReadUrl(storageResult.storageKey);

      // 6. Insert metadata into public.site_documents
      const insertSql = `
        INSERT INTO public.site_documents (
          site_id, document_type, document_label, file_name, storage_provider, storage_key, gcp_file_url, uploaded_at, created_at
        ) VALUES (
          $1, $2, $3, $4, 'minio', $5, NULL, NOW(), NOW()
        )
        RETURNING *;
      `;

      const insertRes = await pool.query(insertSql, [
        siteId,
        documentType || 'Document',
        documentLabel || null,
        fileName,
        storageResult.storageKey,
      ]);

      const insertedRow = insertRes.rows[0];
      const enrichedRow = await enrichDocumentWithViewUrl(insertedRow);

      return {
        success: true,
        data: enrichedRow,
        view_url: viewUrl,
        storage_key: storageResult.storageKey,
        storage_provider: 'minio',
      };
    } catch (uploadError: any) {
      if (uploadedStorageKey) {
        await OracleStorageService.deleteFile(uploadedStorageKey).catch(() => {});
      }
      throw uploadError;
    }
  }
}
