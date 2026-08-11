import { supabase } from '@/lib/supabase';
import { CompanyProfile, CreateCompanyInput, UpdateCompanyInput } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  };
}

export async function fetchCompanies(): Promise<CompanyProfile[]> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch companies');
  return json.data;
}

export async function fetchCompanyById(id: string): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies/${id}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch company details');
  return json.data;
}

export async function createCompany(payload: CreateCompanyInput): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create company profile');
  return json.data;
}

export async function updateCompany(id: string, payload: UpdateCompanyInput): Promise<CompanyProfile> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE}/companies/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update company profile');
  return json.data;
}
