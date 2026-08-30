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
  console.log('🟢 STEP 2 - Outgoing request body:', JSON.stringify(payload));
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
  const result = json.data || json;
  console.log('🔴 STEP 5 - API response additional_charges:', result?.additional_charges || result?.additionalCharges);
  return {
    status: res.status,
    data: result,
  };
}

export async function updateInvoiceApi(id: string, payload: CreateInvoicePayload): Promise<{ status: number; data: InvoiceRecord }> {
  console.log('🟢 STEP 2 - Outgoing request body:', JSON.stringify(payload));
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
  const result = json.data || json;
  console.log('🔴 STEP 5 - API response additional_charges:', result?.additional_charges || result?.additionalCharges);
  return {
    status: res.status,
    data: result,
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

export async function cancelInvoiceApi(
  id: string,
  cancelled_reason?: string
): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancelled_reason }),
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PATCH /api/invoices/${id}/cancel] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to cancel invoice: ${errorText}`);
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function approveInvoiceApi(id: string): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/approve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PATCH /api/invoices/${id}/approve] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to approve invoice: ${errorText}`);
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function convertToTaxInvoiceApi(id: string): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/convert-to-tax-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[POST /api/invoices/${id}/convert-to-tax-invoice] API Error ${res.status}:`, errorText);
    throw new Error(`Failed to convert to Tax Invoice: ${errorText}`);
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

function parseApiErrorMessage(status: number, rawText: string, defaultMsg: string): string {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.error) return parsed.error;
    if (parsed.message) return parsed.message;
  } catch (_) {}
  return rawText ? `${defaultMsg} (${status}): ${rawText}` : `${defaultMsg} (${status})`;
}

export async function certifyInvoiceDocApi(id: string, docType: 'bill' | 'attendance'): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/certify/${docType}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PATCH /api/invoices/${id}/certify/${docType}] API Error ${res.status}:`, errorText);
    throw new Error(parseApiErrorMessage(res.status, errorText, 'Failed to certify document'));
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function deleteInvoiceDocApi(id: string, docType: 'bill' | 'attendance'): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/document/${docType}`, {
    method: 'DELETE',
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[DELETE /api/invoices/${id}/document/${docType}] API Error ${res.status}:`, errorText);
    throw new Error(parseApiErrorMessage(res.status, errorText, 'Failed to delete document'));
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}

export async function toggleInvoiceLockApi(id: string, is_locked: boolean): Promise<{ status: number; data: InvoiceRecord }> {
  const res = await fetchWithRetry(`${API_BASE}/${id}/lock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_locked }),
    retries: 1,
    backoffMs: 500,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PATCH /api/invoices/${id}/lock] API Error ${res.status}:`, errorText);
    throw new Error(parseApiErrorMessage(res.status, errorText, 'Failed to update lock status'));
  }

  const json = await res.json();
  return {
    status: res.status,
    data: json.data || json,
  };
}
