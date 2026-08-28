import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
}

/**
 * Custom fetch for Supabase with a 15-second abort timeout to prevent stalled TCP sockets.
 */
const customFetchWithTimeout: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`🚨 [timeout] operation=SupabaseQuery after=15000ms url=${typeof input === 'string' ? input.split('?')[0] : 'URL'}`);
    controller.abort();
  }, 15000);

  const mergedSignal = init?.signal || controller.signal;
  return fetch(input, { ...init, signal: mergedSignal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetchWithTimeout,
    },
  }
);
