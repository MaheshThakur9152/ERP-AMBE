import { Router } from 'express';
import multer from 'multer';
import { InvoiceController } from '../controllers/invoiceController';
import { uploadCompanyInvoiceDocument, uploadInvoiceDirect } from '../controllers/documentController';
import { requireAuth, requireAdmin, requireSuperAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

import { validateFileMagicBytes } from '../middlewares/fileValidator';
import { validateAndNormalizeInvoiceDirectUpload } from './documentRoutes';

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

const router = Router();

router.get('/', requireAuth, InvoiceController.list);
router.post('/', requireAuth, requireAdmin, InvoiceController.create);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('invoices'), InvoiceController.update);
router.patch('/:id', requireAuth, requireAdmin, checkLockBouncer('invoices'), InvoiceController.update);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('invoices'), InvoiceController.delete);
router.post(
  '/upload',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  validateAndNormalizeInvoiceDirectUpload,
  uploadInvoiceDirect
);

// Protected RBAC route: only SuperAdmin can lock/unlock invoices
router.patch('/:id/lock', requireAuth, requireSuperAdmin, InvoiceController.toggleLock);

export default router;
