import { Response } from 'express';

function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val).trim();
  const escaped = str.replace(/"/g, '""');
  if (/^[=\+\-@\t\r]/.test(escaped)) {
    return `"\t${escaped}"`;
  }
  return `"${escaped}"`;
}

function sanitizeNumber(val: any): number {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export class ExcelService {
  public static generateInvoiceCsv(data: any, res: Response) {
    let csv = `Company,${sanitizeCsvCell(data.company?.name)}\n`;
    csv += `Invoice No,${sanitizeCsvCell(data.meta?.invoiceNo)}\n`;
    csv += `Invoice Date,${sanitizeCsvCell(data.meta?.invoiceDate)}\n`;
    csv += `Billing Period,${sanitizeCsvCell(data.meta?.billingPeriod)}\n`;
    csv += `Party Name,${sanitizeCsvCell(data.party?.name)}\n\n`;
    csv += `Sr,Description of Services,HSN Code,Rate,Working Days,Persons,Amount\n`;

    if (Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        const srNo = sanitizeCsvCell(item.srNo);
        const safeDesc = sanitizeCsvCell(item.description);
        const hsnCode = sanitizeCsvCell(item.hsnCode);
        const rate = sanitizeNumber(item.rate);
        const workingDays = sanitizeNumber(item.workingDays);
        const persons = sanitizeNumber(item.persons);
        const amount = sanitizeNumber(item.amount);
        csv += `${srNo},${safeDesc},${hsnCode},${rate},${workingDays},${persons},${amount}\n`;
      });
    }

    const rawInvoiceNo = String(data.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_');
    const filename = `Invoice_${rawInvoiceNo}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  }
}
