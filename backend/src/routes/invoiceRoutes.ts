import { Router } from 'express';
import { InvoiceController } from '../controllers/invoiceController';

const router = Router();

router.get('/', InvoiceController.list);
router.post('/', InvoiceController.create);
router.delete('/:id', InvoiceController.delete);

export default router;
