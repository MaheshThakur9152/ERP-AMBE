import { Site, SiteFormData } from '../types';
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
