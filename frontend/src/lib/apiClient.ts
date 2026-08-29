import { supabase } from './supabase';
import { toast } from '@/components/ui/toast';

export interface FetchRetryOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  skipErrorToast?: boolean;
  _is401Retry?: boolean;
}

/**
 * Resolves relative API paths against VITE_API_URL environment variable if present.
 */
export function getApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
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

// In-Memory Access Token Store (avoids XSS attack vectors of localStorage)
let inMemoryAccessToken: string | null = null;
let proactiveRefreshTimer: NodeJS.Timeout | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const AUTH_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const PROACTIVE_REFRESH_LEAD_MS = 2 * 60 * 1000; // 2 minutes lead time

/**
 * Sets or clears the in-memory access token and starts/resets the background refresh timer.
 */
export function setInMemoryToken(token: string | null, expiresInMs: number = AUTH_ACCESS_TOKEN_TTL_MS): void {
  inMemoryAccessToken = token;
  if (token) {
    scheduleProactiveRefresh(expiresInMs);
  } else {
    clearProactiveRefresh();
  }
}

export function getInMemoryToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Schedules a background proactive refresh ~2 minutes before token expiry.
 */
export function scheduleProactiveRefresh(expiresInMs: number = AUTH_ACCESS_TOKEN_TTL_MS): void {
  clearProactiveRefresh();
  const delay = Math.max(expiresInMs - PROACTIVE_REFRESH_LEAD_MS, 30 * 1000);

  proactiveRefreshTimer = setTimeout(async () => {
    console.debug('[apiClient] Proactively refreshing access token before expiry...');
    try {
      await silentRefreshToken();
    } catch (err) {
      console.warn('[apiClient] Proactive token refresh failed:', err);
    }
  }, delay);
}

export function clearProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

/**
 * Concurrency-safe single-flight silent refresh.
 * Calls /api/auth/refresh with credentials: 'include'.
 * Ensures EVERY caller across the entire application shares the EXACT SAME in-flight promise.
 */
export async function getOrRefreshToken(): Promise<string | null> {
  if (refreshPromise) {
    console.debug('[apiClient] Refresh already in-flight, joining existing promise...');
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshUrl = getApiUrl('/api/auth/refresh');
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        console.warn(`[apiClient] Silent refresh returned status ${res.status}`);
        setInMemoryToken(null);
        return null;
      }

      const data = await res.json();
      const newAccessToken = data.token || data.access_token || null;

      if (newAccessToken) {
        setInMemoryToken(newAccessToken);
        return newAccessToken;
      } else {
        setInMemoryToken(null);
        return null;
      }
    } catch (err) {
      console.error('[apiClient] Silent refresh network exception:', err);
      setInMemoryToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const silentRefreshToken = getOrRefreshToken;

// Throttle error toasts so multiple parallel failing requests don't spam toasts
let lastErrorToastTime = 0;
function showServerUnreachableToast() {
  const now = Date.now();
  if (now - lastErrorToastTime > 5000) {
    lastErrorToastTime = now;
    toast.error('Server unreachable, please try again shortly');
  }
}

/**
 * Custom fetch wrapper that:
 * 1. Attaches in-memory JWT Access Token in Authorization header.
 * 2. Injects credentials: 'include' for secure cookie transport.
 * 3. Proactively retries on 5xx network hiccups with exponential backoff.
 * 4. Intercepts 401s to perform an automatic silent refresh + replay of the original request.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const {
    retries = 2,
    backoffMs = 500,
    timeoutMs = 15000,
    skipErrorToast = false,
    _is401Retry = false,
    ...fetchOptions
  } = options;

  const fullUrl = getApiUrl(url);
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Always send cookies (refresh_token)
  fetchOptions.credentials = fetchOptions.credentials || 'include';

  // Attach Authorization header from in-memory token
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Authorization')) {
    let token = inMemoryAccessToken;
    if (!token) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      } catch {
        // Ignore fallback error
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
    const controller = new AbortController();
    const timerId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // Merge external signal if passed
    const activeSignal = fetchOptions.signal
      ? anySignal([fetchOptions.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        signal: activeSignal,
      });

      clearTimeout(timerId);

      // 🚨 401 Access Token Expiry Interceptor: Refresh & Retry original request once
      if (
        response.status === 401 &&
        !_is401Retry &&
        !url.includes('/api/auth/login') &&
        !url.includes('/api/auth/refresh')
      ) {
        console.warn(`[apiClient] 401 Unauthorized encountered on ${url}. Attempting silent token refresh...`);
        const refreshedToken = await silentRefreshToken();

        if (refreshedToken) {
          console.info(`[apiClient] Token refreshed successfully. Retrying original request to ${url}...`);
          const retryHeaders = new Headers(fetchOptions.headers || {});
          retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

          return fetchWithRetry(url, {
            ...options,
            headers: retryHeaders,
            _is401Retry: true,
          });
        } else {
          // Genuine session death (refresh token expired/revoked) -> notify UI while preserving form state
          console.warn('[apiClient] Token refresh failed. Dispatching auth:session-expired event...');
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
          return response;
        }
      }

      // Retry on 5xx server errors (e.g. transient gateway / service unavailable)
      if (!response.ok && response.status >= 500 && attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(2, attempt - 1);
        console.warn(
          `[apiClient] ${method} ${url} status ${response.status}. Retrying (${attempt}/${retries}) in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timerId);
      lastError = err;
      const isTimeout = err.name === 'AbortError';

      if (attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(2, attempt - 1);
        console.warn(
          `[apiClient] ${method} ${url} ${isTimeout ? 'timed out' : 'network error'} (${err.message}). Retrying (${attempt}/${retries}) in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        if (!skipErrorToast) {
          showServerUnreachableToast();
        }
        throw isTimeout
          ? new Error(`Request timed out after ${timeoutMs}ms (${method} ${url})`)
          : err;
      }
    }
  }

  if (!skipErrorToast) {
    showServerUnreachableToast();
  }
  throw lastError || new Error(`Request failed after ${retries} retries`);
}

/**
 * Combines multiple AbortSignals into one.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
