import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoiceService';
import { OracleStorageService } from '../services/oracleStorageService';
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

  /**
   * Protected: Admin / SuperAdmin only
   * PATCH /api/invoices/:id/cancel
   * Sets status = 'Cancelled', cancelled_at = now(), optional cancelled_reason
   */
  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { cancelled_reason } = req.body;

      const cancelledInvoice = await InvoiceService.cancelInvoice(id, cancelled_reason, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Invoice cancelled successfully',
        data: cancelledInvoice,
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.cancel] Error:', error);
      next(error);
    }
  }

  /**
   * Protected: Admin / SuperAdmin only
   * PATCH /api/invoices/:id/approve
   * Approves a Proforma invoice
   */
  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const approvedInvoice = await InvoiceService.approveProforma(id, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Proforma invoice approved successfully',
        data: approvedInvoice,
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.approve] Error:', error);
      next(error);
    }
  }

  /**
   * Protected: Admin / SuperAdmin only
   * POST /api/invoices/:id/convert-to-tax-invoice
   * Converts an approved Proforma invoice to a Tax Invoice
   */
  static async convertToTaxInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const taxInvoice = await InvoiceService.convertToTaxInvoice(id, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Converted to Tax Invoice successfully',
        data: taxInvoice,
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.convertToTaxInvoice] Error:', error);
      next(error);
    }
  }

  /**
   * Dedicated viewing endpoint for invoice documents
   * GET /api/invoices/:id/document/:docType/view
   */
  static async viewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, docType } = req.params;
      const { storageKey, viewUrl, fileName } = await InvoiceService.getInvoiceDocumentLocation(id, docType || 'bill');

      if (storageKey) {
        const obj = await OracleStorageService.getObject(storageKey);
        const ext = path.extname(storageKey || fileName).toLowerCase();
        let contentType = obj.contentType || 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.webp') contentType = 'image/webp';

        let buffer: Buffer;
        if (obj.body && typeof obj.body.transformToByteArray === 'function') {
          const bytes = await obj.body.transformToByteArray();
          buffer = Buffer.from(bytes);
        } else if (Buffer.isBuffer(obj.body)) {
          buffer = obj.body;
        } else {
          buffer = Buffer.from(obj.body || '');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileName)}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.end(buffer);
        return;
      }

      if (viewUrl) {
        res.redirect(302, viewUrl);
        return;
      }

      res.status(404).json({ error: 'Document file location not found' });
    } catch (error: any) {
      console.error('[InvoiceController.viewDocument] Error:', error);
      next(error);
    }
  }

  /**
   * Mark document as certified
   * PATCH /api/invoices/:id/certify/:docType
   */
  static async certifyDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, docType } = req.params;
      const updated = await InvoiceService.certifyInvoiceDocument(id, docType, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Document certified successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.certifyDocument] Error:', error);
      next(error);
    }
  }

  /**
   * Delete uploaded document from invoice and storage
   * DELETE /api/invoices/:id/document/:docType
   */
  static async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, docType } = req.params;
      const updated = await InvoiceService.deleteInvoiceDocument(id, docType, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Document removed successfully',
        data: updated,
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.deleteDocument] Error:', error);
      next(error);
    }
  }

  /**
   * Log Legacy Historical Bill record with document upload
   * POST /api/invoices/legacy
   */
  static async createLegacy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Upload file (PDF/PNG/JPG) is required' });
        return;
      }

      const result = await InvoiceService.createLegacyInvoice(req.body, req.file, req.user);
      const response: ApiResponse = {
        success: true,
        message: 'Legacy bill logged successfully',
        data: result.invoice,
        view_url: result.view_url,
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('[InvoiceController.createLegacy] Error:', error);
      next(error);
    }
  }
}
