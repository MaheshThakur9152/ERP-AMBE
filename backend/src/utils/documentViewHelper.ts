import { OracleStorageService } from '../services/oracleStorageService';

/**
 * Resolves a single document's view URL.
 * If storage_provider === 'minio' (or invoice_storage_provider === 'minio'), generates a signed read URL from MinIO.
 * Otherwise, falls back to the existing gcp_file_url or invoice url column.
 */
export async function getDocumentViewUrl(doc: any): Promise<string> {
  if (!doc) return '';

  const provider = doc.storage_provider || doc.invoice_storage_provider || doc.provider;
  const storageKey = doc.storage_key || doc.certified_doc_storage_key || doc.generated_pdf_storage_key || doc.certified_attendance_storage_key;

  if (provider === 'minio' && storageKey) {
    const signedUrl = await OracleStorageService.getSignedReadUrl(storageKey);
    if (signedUrl) {
      return signedUrl;
    }
  }

  return (
    doc.view_url ||
    doc.gcp_file_url ||
    doc.certified_doc_url ||
    doc.generated_pdf_url ||
    doc.certified_attendance_url ||
    doc.drive_web_view_link ||
    ''
  );
}

/**
 * Attaches a computed `view_url` field to a document object.
 */
export async function enrichDocumentWithViewUrl<T extends Record<string, any>>(doc: T): Promise<T & { view_url: string }> {
  if (!doc) return doc as any;
  const view_url = await getDocumentViewUrl(doc);
  return {
    ...doc,
    view_url,
  };
}

/**
 * Attaches computed `view_url` fields to an array of document objects in parallel.
 */
export async function enrichDocumentsWithViewUrl<T extends Record<string, any>>(docs: T[]): Promise<(T & { view_url: string })[]> {
  if (!Array.isArray(docs)) return [];
  return Promise.all(docs.map((doc) => enrichDocumentWithViewUrl(doc)));
}

/**
 * Attaches computed view URLs to an invoice record (certified_doc_url, generated_pdf_url, certified_attendance_url).
 */
export async function enrichInvoiceWithViewUrls(inv: any): Promise<any> {
  if (!inv) return inv;

  const isMinio =
    inv.invoice_storage_provider === 'minio' ||
    inv.storage_provider === 'minio' ||
    inv.storageProvider === 'minio';

  let certified_doc_url = inv.certified_doc_url || inv.certifiedDocUrl || null;
  let generated_pdf_url = inv.generated_pdf_url || inv.generatedPdfUrl || null;
  let certified_attendance_url = inv.certified_attendance_url || inv.certifiedAttendanceUrl || null;

  if (isMinio) {
    if (inv.certified_doc_storage_key) {
      const signed = await OracleStorageService.getSignedReadUrl(inv.certified_doc_storage_key);
      if (signed) certified_doc_url = signed;
    }
    if (inv.generated_pdf_storage_key) {
      const signed = await OracleStorageService.getSignedReadUrl(inv.generated_pdf_storage_key);
      if (signed) generated_pdf_url = signed;
    }
    if (inv.certified_attendance_storage_key) {
      const signed = await OracleStorageService.getSignedReadUrl(inv.certified_attendance_storage_key);
      if (signed) certified_attendance_url = signed;
    }
  }

  const primaryViewUrl = certified_doc_url || generated_pdf_url || certified_attendance_url || '';

  return {
    ...inv,
    view_url: primaryViewUrl,
    certified_doc_view_url: certified_doc_url,
    generated_pdf_view_url: generated_pdf_url,
    certified_attendance_view_url: certified_attendance_url,
    // Keep raw/computed accessible interchangeably
    certified_doc_url,
    certifiedDocUrl: certified_doc_url,
    generated_pdf_url,
    generatedPdfUrl: generated_pdf_url,
    certified_attendance_url,
    certifiedAttendanceUrl: certified_attendance_url,
  };
}

/**
 * Attaches computed view URLs to an array of invoice records.
 */
export async function enrichInvoicesWithViewUrls(invoices: any[]): Promise<any[]> {
  if (!Array.isArray(invoices)) return [];
  return Promise.all(invoices.map((inv) => enrichInvoiceWithViewUrls(inv)));
}
