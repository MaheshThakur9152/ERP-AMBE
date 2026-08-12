import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoiceService';

export class InvoiceController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await InvoiceService.getAllInvoices();
      res.json({ success: true, data: invoices });
    } catch (err: any) {
      console.error('[InvoiceController.list] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch invoices' });
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await InvoiceService.createInvoice(req.body);
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      console.error('[InvoiceController.create] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create invoice' });
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await InvoiceService.deleteInvoice(id);
      res.status(200).json({ success: true, message: 'Invoice deleted successfully', id });
    } catch (err: any) {
      console.error('[InvoiceController.delete] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to delete invoice' });
    }
  }
}
