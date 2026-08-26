import { supabase } from './supabase';

export interface FetchRetryOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
}

/**
 * Resolves relative API paths against VITE_API_URL environment variable if present.
 */
export function getApiUrl(path: string): string {
  const rawEnv = import.meta.env.VITE_API_URL;
  const defaultUrl = import.meta.env.PROD ? 'https://api.ambeservice.com/api' : 'http://localhost:5000';
  const envUrl = (rawEnv && rawEnv.trim()) ? rawEnv.trim().replace(/\/+$/, '') : defaultUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (envUrl.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${envUrl}${cleanPath.substring(4)}`;
  }
  if (envUrl.endsWith('/api') && cleanPath === '/api') {
    return envUrl;
  }
  return `${envUrl}${cleanPath}`;
}

let inMemoryAccessToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getInMemoryToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Custom fetch wrapper that automatically retries failed GET/5xx requests with exponential backoff.
 * Automatically attaches credentials: 'include' and Authorization Bearer header if session exists.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const { retries = 2, backoffMs = 500, ...fetchOptions } = options;
  const fullUrl = getApiUrl(url);
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Ensure cross-origin cookies (access_token, refresh_token) are included by default
  fetchOptions.credentials = fetchOptions.credentials || 'include';

  // Attach Authorization header if available and not already set
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Authorization')) {
    let token = inMemoryAccessToken;
    if (!token) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      } catch {
        // Ignore session fetch failures
      }
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  fetchOptions.headers = headers;

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    try {
      const response = await fetch(fullUrl, fetchOptions);

      // Retry on 5xx server errors (e.g. transient 500 startup race condition)
      if (!response.ok && response.status >= 500 && attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(2, attempt - 1);
        console.warn(`[apiClient] ${method} ${url} status ${response.status}. Retrying (${attempt}/${retries}) in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(2, attempt - 1);
        console.warn(`[apiClient] ${method} ${url} network error (${err.message}). Retrying (${attempt}/${retries}) in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }

  throw lastError || new Error(`Request failed after ${retries} retries`);
}

