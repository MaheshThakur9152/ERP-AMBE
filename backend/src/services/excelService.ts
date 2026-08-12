import { Response } from 'express';

export class ExcelService {
  public static generateInvoiceCsv(data: any, res: Response) {
    let csv = `Company,${data.company?.name || ''}\n`;
    csv += `Invoice No,${data.meta?.invoiceNo || ''}\n`;
    csv += `Invoice Date,${data.meta?.invoiceDate || ''}\n`;
    csv += `Billing Period,${data.meta?.billingPeriod || ''}\n`;
    csv += `Party Name,${data.party?.name || ''}\n\n`;
    csv += `Sr,Description of Services,HSN Code,Rate,Working Days,Persons,Amount\n`;

    if (Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        const safeDesc = (item.description || '').replace(/"/g, '""');
        csv += `"${item.srNo}","${safeDesc}","${item.hsnCode || ''}",${item.rate || 0},${item.workingDays || 0},${item.persons || 0},${item.amount || 0}\n`;
      });
    }

    const filename = `Invoice_${(data.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  }
}
