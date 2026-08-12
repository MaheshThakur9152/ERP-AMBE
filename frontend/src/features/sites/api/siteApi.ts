import { Site, SiteFormData } from '../types';

const API_BASE = '/api/sites';

export async function fetchSitesApi(): Promise<Site[]> {
  const res = await fetch(API_BASE);
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
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 201) {
    const errorText = await res.text();
    console.error(`[POST /api/sites] API Error ${res.status}:`, errorText);
    throw new Error(`POST /api/sites failed with status ${res.status}: ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function updateSiteApi(id: string, payload: Partial<SiteFormData>): Promise<Site> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PUT /api/sites/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`PUT /api/sites/${id} failed with status ${res.status}: ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function deleteSiteApi(id: string): Promise<{ status: number }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/sites/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`DELETE /api/sites/${id} failed with status ${res.status}: ${errorText}`);
  }
  return { status: res.status };
}
