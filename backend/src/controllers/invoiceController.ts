import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoiceService';

export class InvoiceController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await InvoiceService.getAllInvoices();
      res.status(200).json({ success: true, data: invoices || [] });
    } catch (error: any) {
      console.error("GET /api/invoices Error:", error);
      res.status(200).json({ success: true, data: [] });
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await InvoiceService.createInvoice(req.body);
      res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      console.error('[InvoiceController.create] Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to create invoice' });
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await InvoiceService.updateInvoice(id, req.body);
      res.status(200).json({ success: true, data: record });
    } catch (error: any) {
      console.error('[InvoiceController.update] Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to update invoice' });
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await InvoiceService.deleteInvoice(id);
      res.status(200).json({ success: true, message: 'Invoice deleted successfully', id });
    } catch (error: any) {
      console.error('[InvoiceController.delete] Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to delete invoice' });
    }
  }

  /**
   * Protected: SuperAdmin only
   * PATCH /api/invoices/:id/lock
   * Toggles or sets the is_locked status of a specific invoice.
   */
  static async toggleLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_locked } = req.body;

      const updatedInvoice = await InvoiceService.updateLockStatus(id, is_locked ?? true);
      res.status(200).json({
        success: true,
        message: `Invoice ${is_locked ? 'locked' : 'unlocked'} successfully`,
        data: updatedInvoice,
      });
    } catch (error: any) {
      console.error('[InvoiceController.toggleLock] Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to update invoice lock status' });
    }
  }
}
