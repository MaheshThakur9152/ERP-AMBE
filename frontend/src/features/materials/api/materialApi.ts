import { fetchWithRetry } from '@/lib/apiClient';
import { Material, CreateMaterialInput, UpdateMaterialInput } from '../types';

const API_BASE = '/api';

export async function fetchMaterialsApi(): Promise<Material[]> {
  const res = await fetchWithRetry(`${API_BASE}/materials`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/materials] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to fetch materials from backend (Status: ${res.status}): ${errorText}`);
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

export async function createMaterialApi(payload: CreateMaterialInput): Promise<Material> {
  const res = await fetchWithRetry(`${API_BASE}/materials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[POST /api/materials] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to create material (Status: ${res.status}): ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function updateMaterialApi(id: string, payload: UpdateMaterialInput): Promise<Material> {
  const res = await fetchWithRetry(`${API_BASE}/materials/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PUT /api/materials/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to update material (Status: ${res.status}): ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function deleteMaterialApi(id: string): Promise<boolean> {
  const res = await fetchWithRetry(`${API_BASE}/materials/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/materials/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to delete material (Status: ${res.status}): ${errorText}`);
  }
  return true;
}
