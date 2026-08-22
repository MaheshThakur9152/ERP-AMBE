import { supabase } from '@/lib/supabase';
import { CompanyProfile, CreateCompanyInput, UpdateCompanyInput } from '../types';

const API_BASE = '/api';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
  };
}

export async function fetchCompanies(): Promise<CompanyProfile[]> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/companies] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to fetch companies from backend (Status: ${res.status}): ${errorText}`);
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

export async function fetchCompanyById(id: string): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies/${id}`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/companies/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to fetch company profile ${id} (Status: ${res.status})`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function createCompany(payload: CreateCompanyInput): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[POST /api/companies] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to create company (Status: ${res.status}): ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}

export async function updateCompany(id: string, payload: UpdateCompanyInput): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies/${id}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PUT /api/companies/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to update company (Status: ${res.status}): ${errorText}`);
  }
  const json = await res.json();
  return json.data || json;
}
