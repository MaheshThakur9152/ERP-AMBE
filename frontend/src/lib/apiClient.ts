import { supabase } from './supabase';
import { toast } from '@/components/ui/toast';

export interface FetchRetryOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  skipErrorToast?: boolean;
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

let inMemoryAccessToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getInMemoryToken(): string | null {
  return inMemoryAccessToken;
}

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
 * Custom fetch wrapper that automatically retries failed GET/5xx requests with exponential backoff.
 * Limits retries to 2 attempts max and enforces a strict request timeout.
 * Surfaces a user-friendly toast when the backend is unreachable.
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
    ...fetchOptions
  } = options;

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
