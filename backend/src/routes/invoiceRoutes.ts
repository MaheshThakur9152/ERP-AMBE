import { Router } from 'express';
import multer from 'multer';
import { InvoiceController } from '../controllers/invoiceController';
import { uploadCompanyInvoiceDocument, uploadInvoiceDirect } from '../controllers/documentController';
import { requireAuth, requireSuperAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const router = Router();

router.get('/', InvoiceController.list);
router.post('/', InvoiceController.create);
router.delete('/:id', requireAuth, checkLockBouncer('invoices'), InvoiceController.delete);
router.post('/upload', upload.single('file'), uploadInvoiceDirect);

// Protected RBAC route: only SuperAdmin can lock/unlock invoices
router.patch('/:id/lock', requireAuth, requireSuperAdmin, InvoiceController.toggleLock);

export default router;
