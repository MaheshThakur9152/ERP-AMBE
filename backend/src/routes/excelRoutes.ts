import { Router } from 'express';
import { ExcelController } from '../controllers/excelController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/export-invoice', requireAuth, ExcelController.exportInvoice);

export default router;
