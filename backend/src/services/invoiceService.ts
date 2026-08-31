import { InvoiceQueryService } from './invoiceQueryService';
import { InvoiceMathService } from './invoiceMathService';
import { InvoiceSequenceService } from './invoiceSequenceService';
import { InvoiceRecord } from '../types/invoice';
import { AuthUser } from '../types/express';

export { InvoiceQueryService, InvoiceMathService, InvoiceSequenceService };

export class InvoiceService {
  static getAllInvoices(user?: AuthUser): Promise<InvoiceRecord[]> {
    return InvoiceQueryService.getAllInvoices(user);
  }

  static createInvoice(payload: any, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.createInvoice(payload, user);
  }

  static updateInvoice(id: string, payload: any, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.updateInvoice(id, payload, user);
  }

  static deleteInvoice(id: string, user?: AuthUser): Promise<boolean> {
    return InvoiceQueryService.deleteInvoice(id, user);
  }

  static updateLockStatus(id: string, isLocked: boolean): Promise<InvoiceRecord> {
    return InvoiceQueryService.updateLockStatus(id, isLocked);
  }

  static cancelInvoice(id: string, cancelledReason?: string, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.cancelInvoice(id, cancelledReason, user);
  }

  static approveProforma(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.approveProforma(id, user);
  }

  static convertToTaxInvoice(id: string, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.convertToTaxInvoice(id, user);
  }

  static certifyInvoiceDocument(id: string, docType: string, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.certifyInvoiceDocument(id, docType, user);
  }

  static deleteInvoiceDocument(id: string, docType: string, user?: AuthUser): Promise<InvoiceRecord> {
    return InvoiceQueryService.deleteInvoiceDocument(id, docType, user);
  }

  static getInvoiceDocumentLocation(id: string, docType: string): Promise<{ storageKey?: string; viewUrl?: string; fileName: string }> {
    return InvoiceQueryService.getInvoiceDocumentLocation(id, docType);
  }

  static createLegacyInvoice(body: any, file: Express.Multer.File, user?: AuthUser): Promise<{ invoice: InvoiceRecord; view_url: string }> {
    return InvoiceQueryService.createLegacyInvoice(body, file, user);
  }
}
