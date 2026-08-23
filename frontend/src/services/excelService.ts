import JSZip from 'jszip';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { getApiUrl } from '@/lib/apiClient';

export const excelService = {
  exportInvoice: async (invoiceData: InvoiceData): Promise<void> => {
    try {
      const response = await fetch(getApiUrl('/api/excel/export-invoice'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = `Invoice_${(invoiceData.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_')}.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn('Backend excelService unavailable, falling back to client CSV download', err);
    }

    // Client-side fallback download
    excelService.downloadClientCsv(invoiceData);
  },

  downloadClientCsv: (data: InvoiceData): void => {
    let csv = `Company,${data.company?.name || ''}\n`;
    csv += `Invoice No,${data.meta?.invoiceNo || ''}\n`;
    csv += `Invoice Date,${data.meta?.invoiceDate || ''}\n`;
    csv += `Billing Period,${data.meta?.billingPeriod || ''}\n`;
    csv += `Party Name,${data.party?.name || ''}\n`;
    csv += `Site Name,${data.party?.siteName || ''}\n\n`;
    csv += `Sr,Description of Services,HSN Code,Rate (INR),Working Days,Persons,Amount (INR)\n`;

    if (Array.isArray(data.items)) {
      data.items.forEach((item) => {
        const safeDesc = (item.description || '').replace(/"/g, '""');
        csv += `"${item.srNo}","${safeDesc}","${item.hsnCode || ''}",${item.rate || 0},${item.workingDays || 0},${item.persons || 0},${item.amount || 0}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `Invoice_${(data.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_')}.csv`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportBulkZip: async (invoices: InvoiceData[]): Promise<void> => {
    const zip = new JSZip();
    const folder = zip.folder('Invoices');

    invoices.forEach((data) => {
      let csv = `Company,${data.company?.name || ''}\n`;
      csv += `Invoice No,${data.meta?.invoiceNo || ''}\n`;
      csv += `Invoice Date,${data.meta?.invoiceDate || ''}\n`;
      csv += `Billing Period,${data.meta?.billingPeriod || ''}\n`;
      csv += `Party Name,${data.party?.name || ''}\n`;
      csv += `Site Name,${data.party?.siteName || ''}\n\n`;
      csv += `Sr,Description of Services,HSN Code,Rate (INR),Working Days,Persons,Amount (INR)\n`;

      if (Array.isArray(data.items)) {
        data.items.forEach((item) => {
          const safeDesc = (item.description || '').replace(/"/g, '""');
          csv += `"${item.srNo}","${safeDesc}","${item.hsnCode || ''}",${item.rate || 0},${item.workingDays || 0},${item.persons || 0},${item.amount || 0}\n`;
        });
      }

      const filename = `Invoice_${(data.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_')}.csv`;
      folder?.file(filename, csv);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoices_Bulk_Export_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
