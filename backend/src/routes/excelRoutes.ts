import { Router } from 'express';
import { ExcelService } from '../services/excelService';

const router = Router();

router.post('/export-invoice', (req, res) => {
  try {
    const invoiceData = req.body;
    return ExcelService.generateInvoiceCsv(invoiceData, res);
  } catch (error) {
    console.error('Error exporting excel:', error);
    return res.status(500).json({ error: 'Failed to export excel' });
  }
});

export default router;
