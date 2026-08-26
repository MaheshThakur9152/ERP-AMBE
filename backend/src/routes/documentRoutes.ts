import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  uploadDocument,
  uploadCompanyInvoiceDocument,
  uploadInvoiceDirect,
  getAllSiteDocuments,
  uploadSiteDocumentGlobal,
  deleteSiteDocument,
} from '../controllers/documentController';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middlewares/authMiddleware';
import { validateFileMagicBytes } from '../middlewares/fileValidator';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  },
});

const DocumentUploadSchema = z
  .object({
    staff_id: z.string().optional(),
    staffId: z.string().optional(),
    employee_name: z.string().optional(),
    employeeName: z.string().optional(),
    doc_type: z.string().optional(),
    docType: z.string().optional(),
    document_type: z.string().optional(),
    site_name: z.string().optional(),
    siteName: z.string().optional(),
    designation: z.string().optional(),
  })
  .transform((data) => ({
    staff_id: data.staff_id || data.staffId || '',
    employee_name: data.employee_name || data.employeeName || '',
    doc_type: data.doc_type || data.docType || data.document_type || 'Document',
    site_name: data.site_name || data.siteName || '',
    designation: data.designation || '',
  }));

const CompanyDocUploadSchema = z
  .object({
    entity: z.string().optional().default('Ambe'),
    doc_type: z.string().optional(),
    docType: z.string().optional(),
    document_type: z.string().optional(),
    month: z.string().optional().default('Jan'),
    year: z.string().optional().default('2026'),
    site_name: z.string().optional(),
    siteName: z.string().optional(),
    generatedName: z.string().optional(),
    file_name: z.string().optional(),
  })
  .transform((data) => ({
    entity: data.entity || 'Ambe',
    doc_type: data.doc_type || data.docType || data.document_type || 'Tax Invoice',
    month: data.month || 'Jan',
    year: data.year || '2026',
    site_name: data.site_name || data.siteName || '',
    generatedName: data.generatedName || data.file_name || '',
  }));

const InvoiceDirectUploadSchema = z
  .object({
    file_name: z.string().optional(),
    fileName: z.string().optional(),
    invoice_id: z.string().optional(),
    invoiceId: z.string().optional(),
    id: z.string().optional(),
  })
  .transform((data) => ({
    file_name: data.file_name || data.fileName || '',
    invoice_id: data.invoice_id || data.invoiceId || data.id || '',
  }));

const validateAndNormalizeDocumentUpload = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = DocumentUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.format() });
    return;
  }
  req.body = parsed.data;
  next();
};

const validateAndNormalizeCompanyDocUpload = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = CompanyDocUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.format() });
    return;
  }
  req.body = parsed.data;
  next();
};

export const validateAndNormalizeInvoiceDirectUpload = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = InvoiceDirectUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.format() });
    return;
  }
  req.body = parsed.data;
  next();
};

const router = Router();

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  validateFileMagicBytes,
  validateAndNormalizeDocumentUpload,
  uploadDocument
);

router.post(
  '/company-invoice',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  validateAndNormalizeCompanyDocUpload,
  uploadCompanyInvoiceDocument
);

router.post(
  '/invoice-direct',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  validateAndNormalizeInvoiceDirectUpload,
  uploadInvoiceDirect
);

// Site documents global management routes
router.get('/', requireAuth, getAllSiteDocuments);
router.post(
  '/upload-site',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  uploadSiteDocumentGlobal
);
router.post(
  '/site-document',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  uploadSiteDocumentGlobal
);
router.delete('/:id', requireAuth, requireSuperAdmin, deleteSiteDocument);

export default router;
