import { Request, Response, NextFunction } from 'express';
import { ExcelService } from '../services/excelService';

export class ExcelController {
  static exportInvoice(req: Request, res: Response, next: NextFunction): void {
    try {
      const invoiceData = req.body;
      ExcelService.generateInvoiceCsv(invoiceData, res);
    } catch (error: any) {
      console.error('Error exporting excel:', error);
      next(error);
    }
  }
}
