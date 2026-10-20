import { fetchWithRetry, setInMemoryToken, getApiUrl, getOrRefreshSession } from '@/lib/apiClient';
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

/**
 * Logs in with credentials, extracts short-lived access token into memory,
 * and leaves long-lived refresh token in httpOnly SameSite=Strict cookie.
 */
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
  }

  return data;
}

/**
 * Performs silent access token refresh using the single-flight shared getOrRefreshSession promise.
 */
export async function refreshTokenApi(): Promise<LoginResponse | null> {
  try {
    const session = await getOrRefreshSession();
    if (!session?.token || !session?.user) {
      return null;
    }

    return {
      success: true,
      token: session.token,
      access_token: session.token,
      user: session.user,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Logs out by invalidating server-side refresh token and clearing cookie.
 */
export async function logoutApi(): Promise<void> {
  setInMemoryToken(null);
  await fetchWithRetry(`${AUTH_API_BASE}/logout`, {
    method: 'POST',
  }).catch(() => {});
}

/**
 * Fetches currently authenticated user info.
 */
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

export async function fetchUserProfile(_userId?: string): Promise<UserProfile | null> {
  const me = await fetchMeApi();
  if (me?.user) {
    return {
      id: me.user.id,
      email: me.user.email,
      full_name: me.user.email.split('@')[0],
      role: me.user.role,
      phone: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return null;
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
  const adminTableMap: Record<LockableEntityType, string> = {
    invoices: 'invoices',
    companies: 'companies',
    sites: 'sites',
    attendance: 'attendance_sheets',
    staff: 'staff',
    payroll: 'payroll_records',
  };

  const table = adminTableMap[entityType] || entityType;

  console.warn(`[setEntityLockApi] entityType=${entityType} table=${table} id=${id} locked=${locked}`);

  const adminRes = await fetchWithRetry('/api/admin/lock-item', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entityType: table,
      id,
      is_locked: locked,
    }),
  });

  const json = await adminRes.json().catch(() => ({}));
  if (!adminRes.ok) {
    throw new Error(json.error || `Failed to ${locked ? 'lock' : 'unlock'} ${entityType}`);
  }
  return json;
}

export async function inviteUserApi(email: string, role: string = 'admin', company_id?: string) {
  const res = await fetchWithRetry(`${AUTH_API_BASE}/invite-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, company_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send invitation');
  return data;
}

export async function setInitialPasswordApi(token: string, password: string): Promise<LoginResponse> {
  const res = await fetchWithRetry(`${AUTH_API_BASE}/set-initial-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to set password');
  if (data.token || data.access_token) {
    setInMemoryToken(data.token || data.access_token);
  }
  return data;
}

export async function forgotPasswordApi(email: string) {
  const res = await fetchWithRetry(`${AUTH_API_BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to request reset');
  return data;
}

export async function resetPasswordApi(token: string, password: string): Promise<LoginResponse> {
  const res = await fetchWithRetry(`${AUTH_API_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  if (data.token || data.access_token) {
    setInMemoryToken(data.token || data.access_token);
  }
  return data;
}
