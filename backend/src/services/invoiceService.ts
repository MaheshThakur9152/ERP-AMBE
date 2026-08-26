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
}
