import { supabase } from '@/lib/supabase';
import { fetchWithRetry, setInMemoryToken } from '@/lib/apiClient';
import { UserProfile, UserRole } from '../types';

const AUTH_API_BASE = '/api/auth';

export interface LoginResponse {
  success: boolean;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  error?: string;
}

export interface MeResponse {
  user: LoginResponse['user'];
  token?: string;
  access_token?: string;
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetchWithRetry(`${AUTH_API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  const token = data.token || data.access_token;
  if (token) {
    setInMemoryToken(token);
    if (data.refresh_token) {
      await supabase.auth
        .setSession({
          access_token: token,
          refresh_token: data.refresh_token,
        })
        .catch(() => {});
    }
  }

  return data;
}

export async function logoutApi(): Promise<void> {
  setInMemoryToken(null);
  await fetchWithRetry(`${AUTH_API_BASE}/logout`, {
    method: 'POST',
  }).catch(() => {});
}

export async function fetchMeApi(): Promise<MeResponse | null> {
  try {
    const res = await fetchWithRetry(`${AUTH_API_BASE}/me`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const token = json.token || json.access_token;
    if (token) {
      setInMemoryToken(token);
    }
    return json.user ? { user: json.user, token } : null;
  } catch (err) {
    return null;
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error loading user profile:', error.message);
    return null;
  }
  return data;
}

export async function lockInvoiceApi(id: string, isLocked: boolean): Promise<any> {
  return setEntityLockApi('invoices', id, isLocked);
}

export type LockableEntityType = 'invoices' | 'companies' | 'sites' | 'attendance' | 'staff' | 'payroll';

export async function setEntityLockApi(
  entityType: LockableEntityType,
  id: string,
  locked: boolean
): Promise<any> {
  const pathMap: Record<LockableEntityType, string> = {
    invoices: 'invoices',
    companies: 'companies',
    sites: 'sites',
    attendance: 'attendance',
    staff: 'attendance/staff',
    payroll: 'excel/payroll',
  };

  const path = pathMap[entityType] || entityType;

  // 1. Try dedicated entity lock route
  try {
    const res = await fetchWithRetry(`/api/${path}/${id}/lock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_locked: locked, locked }),
    });

    if (res.ok) {
      return res.json();
    }
  } catch (err) {
    // Fall back to unified admin lock-item endpoint
  }

  // 2. Fallback to unified SuperAdmin lock-item endpoint
  const adminTableMap: Record<LockableEntityType, string> = {
    invoices: 'invoices',
    companies: 'companies',
    sites: 'sites',
    attendance: 'attendance_sheets',
    staff: 'staff',
    payroll: 'payroll_records',
  };

  const adminRes = await fetchWithRetry(`/api/admin/lock-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entityType: adminTableMap[entityType] || entityType,
      id,
      is_locked: locked,
    }),
  });

  const json = await adminRes.json();
  if (!adminRes.ok) {
    throw new Error(json.error || `Failed to ${locked ? 'lock' : 'unlock'} ${entityType}`);
  }
  return json;
}



