import path from 'path';
import crypto from 'crypto';

/**
 * Format string as Title-Cased with hyphens, stripping special chars.
 * E.g. "uan card" -> "UAN-Card", "Neeraj Pantry" -> "Neeraj-Pantry", "tax_invoice" -> "Tax-Invoice"
 */
export function toTitleHyphenCase(segment?: string, fallback: string = 'General'): string {
  if (!segment || !segment.trim()) return fallback;

  const words = segment
    .trim()
    .split(/[\s_\-/\\]+/)
    .filter(Boolean)
    .map((w) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '');
      if (!clean) return '';
      // Keep acronyms uppercase (e.g. UAN, NOC, PAN, ESIC, GST), otherwise TitleCase
      if (/^[A-Z0-9]{2,}$/.test(clean)) return clean;
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .filter(Boolean);

  return words.length > 0 ? words.join('-') : fallback;
}

/**
 * Extract clean lowercase extension with dot.
 */
export function extractExtension(originalName?: string, defaultExt: string = '.pdf'): string {
  if (!originalName) return defaultExt;
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext || defaultExt;
}

/**
 * Generate 8-character random UUID suffix.
 */
export function getShortUuid(): string {
  return crypto.randomUUID().substring(0, 8);
}

export interface EmployeeStorageKeyOptions {
  siteName?: string;
  designation?: string;
  employeeName?: string;
  documentType?: string;
  fileName?: string;
  originalName?: string;
  shortUuid?: string;
}

export interface SiteStorageKeyOptions {
  siteName?: string;
  documentType?: string;
  fileName?: string;
  originalName?: string;
  shortUuid?: string;
}

export interface InvoiceStorageKeyOptions {
  entity?: string;
  year?: string | number;
  month?: string;
  documentType?: string;
  fileName?: string;
  originalName?: string;
  shortUuid?: string;
}

/**
 * Employee docs key convention:
 * `employees/{siteName}/{designation}/{employeeName}/{DocumentType}-{shortUuid}.{ext}`
 * Example: `employees/Minerva/Pantry/Neeraj-Pantry/UAN-Card-a3f9c21d.png`
 */
export function buildEmployeeStorageKey(options: EmployeeStorageKeyOptions): string {
  const site = toTitleHyphenCase(options.siteName, 'Unassigned');
  const desig = toTitleHyphenCase(options.designation, 'Staff');
  const emp = toTitleHyphenCase(options.employeeName, 'Employee');
  const docType = toTitleHyphenCase(options.documentType || options.fileName, 'Document');
  const ext = extractExtension(options.originalName || options.fileName, '.pdf');
  const shortId = options.shortUuid || getShortUuid();

  return `employees/${site}/${desig}/${emp}/${docType}-${shortId}${ext}`;
}

/**
 * Site docs key convention:
 * `sites/{siteName}/{DocumentType}-{shortUuid}.{ext}`
 * Example: `sites/Minerva/Work-Order-a3f9c21d.pdf`
 */
export function buildSiteStorageKey(options: SiteStorageKeyOptions): string {
  const site = toTitleHyphenCase(options.siteName, 'General-Site');
  const docType = toTitleHyphenCase(options.documentType || options.fileName, 'Document');
  const ext = extractExtension(options.originalName || options.fileName, '.pdf');
  const shortId = options.shortUuid || getShortUuid();

  return `sites/${site}/${docType}-${shortId}${ext}`;
}

/**
 * Invoice docs key convention:
 * `invoices/{entity}/{year}/{month}/{DocumentType}-{shortUuid}.{ext}`
 * Example: `invoices/Ambe/2026/Jan/Tax-Invoice-a3f9c21d.pdf`
 */
export function buildInvoiceStorageKey(options: InvoiceStorageKeyOptions): string {
  const entity = toTitleHyphenCase(options.entity, 'Ambe');
  const year = String(options.year || new Date().getFullYear()).replace(/[^a-zA-Z0-9]/g, '') || '2026';
  const month = toTitleHyphenCase(options.month, 'Jan');
  const docType = toTitleHyphenCase(options.documentType || options.fileName, 'Invoice');
  const ext = extractExtension(options.originalName || options.fileName, '.pdf');
  const shortId = options.shortUuid || getShortUuid();

  return `invoices/${entity}/${year}/${month}/${docType}-${shortId}${ext}`;
}
