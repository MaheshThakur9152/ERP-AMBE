import path from 'path';

/**
 * Sanitize string segment:
 * Replace spaces with underscores, strip characters outside [a-zA-Z0-9-_()]
 */
export function sanitizeSegment(input?: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9\-_()]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Format date as YYYYMMDD
 */
export function formatYYYYMMDD(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export interface BuildSiteDocFileNameOptions {
  type: 'site_doc';
  entityCode: string;
  siteCodeName: string;
  documentType: string;
  ext?: string;
  originalName?: string;
  date?: Date | string | number;
}

export interface BuildInvoiceFileNameOptions {
  type: 'invoice';
  invoiceNo: string;
  category?: 'Generated' | 'Certified' | string;
  ext?: string;
  originalName?: string;
}

export type BuildFileNameOptions = BuildSiteDocFileNameOptions | BuildInvoiceFileNameOptions;

/**
 * Helper to extract and sanitize extension
 */
function resolveCleanExtension(ext?: string, originalName?: string, defaultExt = 'pdf'): string {
  let rawExt = ext || (originalName ? path.extname(originalName) : defaultExt);
  rawExt = rawExt.replace(/^\./, '');
  return sanitizeSegment(rawExt) || defaultExt;
}

/**
 * Build site document filename pattern:
 * {entity_code}_{site_code_name}_{document_type}_{YYYYMMDD}.{ext}
 */
export function buildSiteDocFileName(
  entityCode: string,
  siteCodeName: string,
  documentType: string,
  ext?: string,
  originalName?: string,
  date?: Date | string | number
): string {
  const cleanEntity = sanitizeSegment(entityCode) || 'ENTITY';
  const cleanSite = sanitizeSegment(siteCodeName) || 'SITE';
  const cleanDocType = sanitizeSegment(documentType) || 'DOCUMENT';
  const yyyymmdd = formatYYYYMMDD(date);
  const cleanExt = resolveCleanExtension(ext, originalName, 'pdf');

  return `${cleanEntity}_${cleanSite}_${cleanDocType}_${yyyymmdd}.${cleanExt}`;
}

/**
 * Build invoice filename pattern:
 * {invoice_no with / replaced by -}_{Generated|Certified}.{ext}
 */
export function buildInvoiceFileName(
  invoiceNo: string,
  category: 'Generated' | 'Certified' | string = 'Generated',
  ext?: string,
  originalName?: string
): string {
  const replacedSlash = (invoiceNo || 'INV').replace(/\//g, '-');
  const cleanInvoiceNo = sanitizeSegment(replacedSlash) || 'INV';
  const cleanCategory = sanitizeSegment(category) || 'Generated';
  const cleanExt = resolveCleanExtension(ext, originalName, 'pdf');

  return `${cleanInvoiceNo}_${cleanCategory}.${cleanExt}`;
}

/**
 * Shared buildFileName util
 */
export function buildFileName(options: BuildFileNameOptions): string {
  if (options.type === 'site_doc') {
    return buildSiteDocFileName(
      options.entityCode,
      options.siteCodeName,
      options.documentType,
      options.ext,
      options.originalName,
      options.date
    );
  }

  return buildInvoiceFileName(
    options.invoiceNo,
    options.category,
    options.ext,
    options.originalName
  );
}
