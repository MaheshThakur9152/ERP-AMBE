import { Router } from 'express';
import multer from 'multer';
import { InvoiceController } from '../controllers/invoiceController';
import { uploadCompanyInvoiceDocument } from '../controllers/documentController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const router = Router();

router.get('/', InvoiceController.list);
router.post('/', InvoiceController.create);
router.delete('/:id', InvoiceController.delete);
router.post('/upload', upload.single('file'), uploadCompanyInvoiceDocument);

export default router;
