import { CompanyService } from './companyService';

export class InvoiceSequenceService {
  /**
   * Increments and updates sequence numbers for the target company and invoice type
   */
  static async incrementSequence(companyId: string, invoiceType: string): Promise<void> {
    return CompanyService.incrementSequence(companyId, invoiceType);
  }
}
