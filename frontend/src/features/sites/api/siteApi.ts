import { Site, SiteFormData, SiteDocument } from '../types';
import { fetchWithRetry } from '@/lib/apiClient';

const API_BASE = '/api/sites';

export async function fetchSitesApi(): Promise<Site[]> {
  const res = await fetchWithRetry(API_BASE, { method: 'GET', retries: 2, backoffMs: 500 });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/sites] API Error ${res.status}:`, errorText);
    throw new Error(`GET /api/sites failed with status ${res.status}: ${errorText}`);
  }
  const json = await res.json();
  if (json.data && Array.isArray(json.data)) {
    return json.data;
  }
  if (Array.isArray(json)) {
    return json;
  }
  return [];
}

export async function createSiteApi(payload: SiteFormData): Promise<Site> {
  console.group('%c[API: CREATE SITE]', 'color: #00ffff; font-weight: bold; background: #222; padding: 2px 6px; border-radius: 4px;');
  console.log('📤 PAYLOAD SENDING TO DB:', {
    additionalCharges: (payload as any).defaultAdditionalCharges || (payload as any).default_additional_charges,
    fullPayload: payload,
  });
  try {
    const res = await fetchWithRetry(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 1,
      backoffMs: 500,
    });
    if (!res.ok && res.status !== 201) {
      const errorText = await res.text();
      console.error(`[POST /api/sites] API Error ${res.status}:`, errorText);
      throw new Error(`POST /api/sites failed with status ${res.status}: ${errorText}`);
    }
    const json = await res.json();
    const result = json.data || json;
    console.log('✅ DATABASE RESPONSE:', result);
    return result;
  } finally {
    console.groupEnd();
  }
}

export async function updateSiteApi(id: string, payload: Partial<SiteFormData>): Promise<Site> {
  console.group('%c[API: UPDATE SITE]', 'color: #00ffff; font-weight: bold; background: #222; padding: 2px 6px; border-radius: 4px;');
  console.log('📤 PAYLOAD SENDING TO DB:', {
    siteId: id,
    additionalCharges: (payload as any).defaultAdditionalCharges || (payload as any).default_additional_charges,
    fullPayload: payload,
  });
  try {
    const res = await fetchWithRetry(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 1,
      backoffMs: 500,
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[PUT /api/sites/${id}] API Error ${res.status}:`, errorText);
      throw new Error(`PUT /api/sites/${id} failed with status ${res.status}: ${errorText}`);
    }
    const json = await res.json();
    const result = json.data || json;
    console.log('✅ DATABASE RESPONSE:', result);
    return result;
  } finally {
    console.groupEnd();
  }
}

export async function deleteSiteApi(id: string): Promise<{ status: number }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}`, {
    method: 'DELETE',
    retries: 1,
    backoffMs: 500,
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/sites/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`DELETE /api/sites/${id} failed with status ${res.status}: ${errorText}`);
  }
  return { status: res.status };
}

export async function fetchSiteDocumentsApi(siteId: string): Promise<SiteDocument[]> {
  const res = await fetchWithRetry(`${API_BASE}/${siteId}/documents`, {
    method: 'GET',
    retries: 2,
    backoffMs: 500,
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/sites/${siteId}/documents] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to fetch site documents: ${errorText}`);
  }
  const json = await res.json();
  if (json.data && Array.isArray(json.data)) {
    return json.data;
  }
  if (Array.isArray(json)) {
    return json;
  }
  return [];
}

export async function uploadSiteDocumentApi(
  siteId: string,
  file: File,
  documentType: string,
  documentLabel?: string
): Promise<{ success: boolean; file_name: string; gcp_file_url: string; document: SiteDocument }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  if (documentLabel) {
    formData.append('document_label', documentLabel);
  }

  const res = await fetchWithRetry(`${API_BASE}/${siteId}/documents`, {
    method: 'POST',
    body: formData,
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok && res.status !== 201) {
    const errorText = await res.text();
    console.error(`[POST /api/sites/${siteId}/documents] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to upload site document: ${errorText}`);
  }

  const json = await res.json();
  return json;
}

export async function fetchAllDocumentsApi(params?: {
  site_id?: string;
  document_type?: string;
  search?: string;
}): Promise<SiteDocument[]> {
  const query = new URLSearchParams();
  if (params?.site_id) query.append('site_id', params.site_id);
  if (params?.document_type && params.document_type !== 'All') query.append('document_type', params.document_type);
  if (params?.search) query.append('search', params.search);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetchWithRetry(`/api/documents${queryString}`, {
    method: 'GET',
    retries: 2,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/documents] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to fetch documents: ${errorText}`);
  }

  const json = await res.json();
  if (json.data && Array.isArray(json.data)) {
    return json.data;
  }
  if (Array.isArray(json)) {
    return json;
  }
  return [];
}

export async function deleteDocumentApi(id: string): Promise<{ success: boolean }> {
  const res = await fetchWithRetry(`/api/documents/${id}`, {
    method: 'DELETE',
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/documents/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to delete document: ${errorText}`);
  }

  return { success: true };
}
