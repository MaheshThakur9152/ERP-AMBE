import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/apiClient';
import { UserProfile, UserRole } from '../types';

const AUTH_API_BASE = '/api/auth';

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  error?: string;
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(getApiUrl(`${AUTH_API_BASE}/login`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data;
}

export async function logoutApi(): Promise<void> {
  await fetch(getApiUrl(`${AUTH_API_BASE}/logout`), {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchMeApi(): Promise<LoginResponse['user'] | null> {
  try {
    const res = await fetch(getApiUrl(`${AUTH_API_BASE}/me`), {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
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
  const res = await fetch(getApiUrl(`/api/invoices/${id}/lock`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ is_locked: isLocked }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to ${isLocked ? 'lock' : 'unlock'} invoice`);
  }
  return json;
}
