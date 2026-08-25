import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoiceService';
import { ApiResponse } from '../types/api';

export class InvoiceController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await InvoiceService.getAllInvoices(req.user);
      const response: ApiResponse = { success: true, data: invoices || [] };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('GET /api/invoices Error:', error);
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await InvoiceService.createInvoice(req.body, req.user);
      const response: ApiResponse = { success: true, data: record };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.create] Error:', error);
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await InvoiceService.updateInvoice(id, req.body, req.user);
      const response: ApiResponse = { success: true, data: record };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.update] Error:', error);
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await InvoiceService.deleteInvoice(id, req.user);
      const response: ApiResponse = { success: true, message: 'Invoice deleted successfully', id };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.delete] Error:', error);
      next(error);
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
      const response: ApiResponse = {
        success: true,
        message: `Invoice ${is_locked ? 'locked' : 'unlocked'} successfully`,
        data: updatedInvoice,
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.toggleLock] Error:', error);
      next(error);
    }
  }
}
