import path from 'path';

/**
 * Sanitize an S3/MinIO key segment:
 * Replaces spaces with hyphens, removes characters not in [a-zA-Z0-9-_], collapses duplicate hyphens.
 */
export function sanitizeKeySegment(segment?: string, fallback: string = 'general'): string {
  if (!segment) return fallback;
  const sanitized = segment
    .trim()
    .replace(/[\s/\\:]+/g, '-')
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
}

/**
 * Sanitize a file name while keeping its extension intact.
 */
export function sanitizeFileNameForKey(fileName?: string): string {
  if (!fileName) return 'document.pdf';
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const cleanBase = sanitizeKeySegment(base, 'doc');
  const cleanExt = ext ? ext.toLowerCase().replace(/[^a-z0-9.]/g, '') : '.pdf';
  return `${cleanBase}${cleanExt}`;
}

export interface EmployeeStorageKeyOptions {
  siteName?: string;
  designation?: string;
  employeeName?: string;
  fileName?: string;
  timestamp?: number;
}

export interface SiteStorageKeyOptions {
  siteName?: string;
  fileName?: string;
  timestamp?: number;
}

export interface InvoiceStorageKeyOptions {
  entity?: string;
  year?: string | number;
  month?: string;
  fileName?: string;
  timestamp?: number;
}

/**
 * Employee docs key convention:
 * `employees/{siteName}/{designation}/{employeeName}/{timestamp}-{fileName}`
 */
export function buildEmployeeStorageKey(options: EmployeeStorageKeyOptions): string {
  const site = sanitizeKeySegment(options.siteName, 'unassigned');
  const desig = sanitizeKeySegment(options.designation, 'staff');
  const emp = sanitizeKeySegment(options.employeeName, 'employee');
  const ts = options.timestamp ?? Date.now();
  const file = sanitizeFileNameForKey(options.fileName);

  return `employees/${site}/${desig}/${emp}/${ts}-${file}`;
}

/**
 * Site docs key convention:
 * `sites/{siteName}/{timestamp}-{fileName}`
 */
export function buildSiteStorageKey(options: SiteStorageKeyOptions): string {
  const site = sanitizeKeySegment(options.siteName, 'general-site');
  const ts = options.timestamp ?? Date.now();
  const file = sanitizeFileNameForKey(options.fileName);

  return `sites/${site}/${ts}-${file}`;
}

/**
 * Invoice docs key convention:
 * `invoices/{entity}/{year}/{month}/{timestamp}-{fileName}`
 */
export function buildInvoiceStorageKey(options: InvoiceStorageKeyOptions): string {
  const entity = sanitizeKeySegment(options.entity, 'Ambe');
  const year = sanitizeKeySegment(String(options.year || new Date().getFullYear()), '2026');
  const month = sanitizeKeySegment(options.month, 'Jan');
  const ts = options.timestamp ?? Date.now();
  const file = sanitizeFileNameForKey(options.fileName);

  return `invoices/${entity}/${year}/${month}/${ts}-${file}`;
}
