import { InvoiceRecord } from '../types';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { fetchWithRetry } from '@/lib/apiClient';

const API_BASE = '/api/invoices';

export interface CreateInvoicePayload extends Partial<InvoiceRecord> {
  payload?: any;
}

export async function fetchInvoicesApi(): Promise<InvoiceRecord[]> {
  const res = await fetchWithRetry(API_BASE, { method: 'GET', retries: 2, backoffMs: 500 });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[GET /api/invoices] API Error ${res.status}:`, errorText);
    throw new Error(`GET /api/invoices failed with status ${res.status}`);
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

export async function createInvoiceApi(payload: CreateInvoicePayload): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok && res.status !== 201) {
    const errorText = await res.text();
    console.error(`[POST /api/invoices] API Error ${res.status}:`, errorText);
    throw new Error(`POST /api/invoices failed with status ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function updateInvoiceApi(id: string, payload: CreateInvoicePayload): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PUT /api/invoices/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`PUT /api/invoices/${id} failed with status ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function deleteInvoiceApi(id: string): Promise<{ status: number }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}`, {
    method: 'DELETE',
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/invoices/${id}] API Error ${res.status}:`, errorText);
    throw new Error(`DELETE /api/invoices/${id} failed with status ${res.status}: ${errorText}`);
  }

  return { status: res.status };
}
