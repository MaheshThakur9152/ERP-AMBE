export interface FetchRetryOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
}

/**
 * Resolves relative API paths against VITE_API_URL environment variable if present.
 */
export function getApiUrl(path: string): string {
  const rawEnv = import.meta.env.VITE_API_URL;
  const envUrl = (rawEnv && rawEnv.trim()) ? rawEnv.trim().replace(/\/+$/, '') : 'http://localhost:5000';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (envUrl.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${envUrl}${cleanPath.substring(4)}`;
  }
  if (envUrl.endsWith('/api') && cleanPath === '/api') {
    return envUrl;
  }
  return `${envUrl}${cleanPath}`;
}

/**
 * Custom fetch wrapper that automatically retries failed GET/5xx requests with exponential backoff.
 * Prevents transient 500 errors on initial backend/DB startup race conditions.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const { retries = 2, backoffMs = 500, ...fetchOptions } = options;
  const fullUrl = getApiUrl(url);
  const method = (fetchOptions.method || 'GET').toUpperCase();

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
