import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { InvoiceData } from '@/features/invoices/types/invoice';
import {
  computeInvoiceCalculations,
  formatCurrency,
  formatInteger,
} from '@/features/invoices/utils/invoiceCalculator';

export const pdfService = {
  // Silent headless PDF blob generator in memory (No window.print())
  generatePdfBlob: async (
    invoiceData: InvoiceData,
    colorMode: 'color' | 'bw' = 'color'
  ): Promise<Blob> => {
    // Off-screen headless rendering of exact InvoiceTemplate HTML
    const calc = computeInvoiceCalculations(
      invoiceData.items || [],
      invoiceData.mgmtPercent || 5,
      invoiceData.cgstPercent || 9,
      invoiceData.sgstPercent || 9
    );

    const isBw = colorMode === 'bw';
    const headerColor = isBw ? '#000000' : '#FF0000';

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#ffffff';

    const MIN_ROWS = 8;
    const MIN_EMPTY_ROWS = 2;
    const items = invoiceData.items || [];
    const emptyRowsCount = Math.max(MIN_EMPTY_ROWS, MIN_ROWS - items.length);

    let rowsHtml = '';
    items.forEach((item, index) => {
      const isOvertime = item.description.toLowerCase().includes('overtime');
      const nextIsOvertime = Boolean(
        items[index + 1]?.description.toLowerCase().includes('overtime')
      );

      rowsHtml += `<tr style="border-bottom: 1px solid #000;">
        <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${index + 1}</td>
        <td style="border-right: 1px solid #000; padding: 4px 6px;">${item.description}</td>`;

      if (!isOvertime && nextIsOvertime) {
        rowsHtml += `
          <td rowspan="2" style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle;">
            ${item.hsnCode || '9985'}
          </td>
          <td rowspan="2" style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: middle;">
            ${item.rate > 0 ? formatInteger(item.rate) : ''}
          </td>`;
      } else if (!isOvertime) {
        rowsHtml += `
          <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${item.hsnCode || '9985'}</td>
          <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">
            ${item.rate > 0 ? formatInteger(item.rate) : ''}
          </td>`;
      }

      rowsHtml += `
        <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${item.workingDays > 0 ? item.workingDays : 0}</td>
        <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${item.persons > 0 ? item.persons : 0}</td>
        <td style="padding: 4px 6px; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>`;
    });

    for (let i = 0; i < emptyRowsCount; i++) {
      rowsHtml += `<tr style="height: 28px;">
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="border-right: 1px solid #000; padding: 0;"></td>
        <td style="padding: 0;"></td>
      </tr>`;
    }

    const docTitle =
      invoiceData.type === 'Proforma Invoice' || invoiceData.meta?.invoiceType === 'Proforma Invoice'
        ? 'PROFORMA INVOICE'
        : 'TAX INVOICE';

    container.innerHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #000; font-size: 11px; background: #fff;">
        <div style="text-align: center; font-size: 14px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${docTitle}</div>
        <div style="border: 1px solid #000; width: 100%;">
          <div style="border-bottom: 1px solid #000; padding: 8px 10px;">
            <h1 style="color: ${headerColor}; margin: 0; font-size: 16px; font-weight: bold; line-height: 1.2;">
              ${invoiceData.company.name}
            </h1>
          </div>
          <div style="display: flex; border-bottom: 1px solid #000;">
            <div style="flex: 1.2; padding: 8px 10px;">
              <p style="margin: 2px 0;">${invoiceData.company.addressLine1}</p>
              <p style="margin: 2px 0;">${invoiceData.company.addressLine2}</p>
              <p style="margin: 2px 0;">Contact No: ${invoiceData.company.contactNo}</p>
              <p style="margin: 2px 0;">Email : ${invoiceData.company.emailWebsite}</p>
              ${invoiceData.company.cinNo?.trim() ? `<p style="margin: 2px 0;">CIN NO. : ${invoiceData.company.cinNo}</p>` : ''}
              ${invoiceData.company.gstin?.trim() ? `<p style="margin: 2px 0;">GSTIN : ${invoiceData.company.gstin}</p>` : ''}
            </div>
            <div style="flex: 1; padding: 8px 10px; border-left: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <p style="margin: 2px 0;">Invoice No : ${invoiceData.meta.invoiceNo}</p>
                <p style="margin: 2px 0;">Date: ${invoiceData.meta.invoiceDate}</p>
              </div>
              <p style="margin: 15px 0 2px 0;">Billing Period: ${invoiceData.meta.billingPeriod}</p>
            </div>
          </div>
          <div style="display: flex; border-bottom: 1px solid #000;">
            <div style="flex: 1.2; padding: 8px 10px; border-right: 1px solid #000;">
              <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 10px; text-transform: uppercase;">NAME &amp; ADD OF PARTY:</p>
              <p style="margin: 2px 0; font-weight: bold; font-size: 12px;">${invoiceData.party.name}</p>
              ${invoiceData.party.siteName?.trim() ? `<p style="margin: 2px 0;">SITE NAME: ${invoiceData.party.siteName}</p>` : ''}
              <p style="margin: 2px 0; white-space: pre-line;">${invoiceData.party.address}</p>
              ${invoiceData.party.gstin?.trim() ? `<p style="margin: 2px 0;">GSTIN : ${invoiceData.party.gstin}</p>` : ''}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column;">
              <div style="padding: 8px 10px; border-bottom: 1px solid #000; flex: 1;">
                <p style="margin: 0 0 2px 0;">Work Order Ref No. :</p>
                <p style="margin: 0;">${invoiceData.party.workOrderRefNo || ''}</p>
              </div>
              <div style="padding: 8px 10px; flex: 1;">
                <p style="margin: 0 0 2px 0;">Work Order Period :</p>
                <p style="margin: 0;">${invoiceData.party.workOrderPeriod || ''}</p>
              </div>
            </div>
          </div>
          <div style="padding: 6px 10px; font-size: 10px; border-bottom: 1px solid #000;">
            We thank you very much for valuable interest shown in our organzaion. We would like to submit our bill for providing our services.
          </div>
          <div style="border-bottom: 1px solid #000;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
              <thead>
                <tr style="border-bottom: 1px solid #000;">
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 6%;">Sr No</th>
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 34%;">Description of Services</th>
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 10%;">HSN Code</th>
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 12%;">Rate</th>
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 10%;">Working Days</th>
                  <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: normal; width: 8%;">Persons</th>
                  <th style="padding: 4px 6px; text-align: center; font-weight: normal; width: 20%;">Amount (RS)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div style="display: flex;">
            <div style="flex: 1.4; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="padding: 8px 10px;">
                <p style="font-weight: bold; margin: 0 0 4px 0; font-size: 10.5px;">Bank Details</p>
                <p style="margin: 2px 0;">Bank Name : ${invoiceData.bank.bankName}</p>
                <p style="margin: 2px 0;">Acc no : ${invoiceData.bank.accountNo}</p>
                <p style="margin: 2px 0; font-size: 10px;">IFSC Code: ${invoiceData.bank.ifscCode} &nbsp;&nbsp; Branch: ${invoiceData.bank.branch}</p>
              </div>
              <div style="padding: 8px 10px; border-top: 1px solid #000;">
                <span style="font-size: 10.5px; display: block;">Amount Chargeble in words(INR) :</span>
                <p style="font-weight: bold; margin: 2px 0; font-size: 11px;">${calc.amountInWords}</p>
              </div>
              <div style="padding: 8px 10px; border-top: 1px solid #000; font-size: 10px;">
                <span style="font-weight: bold;">Terms &amp; condition :</span>
                <p style="margin: 2px 0;">${invoiceData.terms}</p>
              </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="font-size: 11px;">
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Sub Total</span>
                  <span>${formatCurrency(calc.subTotal)}</span>
                </div>
                ${
                  calc.mgmtChargesPercent > 0
                    ? `<div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                        <span>Management charges @ ${calc.mgmtChargesPercent}%</span>
                        <span>${formatCurrency(calc.mgmtChargesAmount)}</span>
                      </div>`
                    : ''
                }
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Total</span>
                  <span>${formatCurrency(calc.totalBeforeTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Add CGST @ ${calc.cgstPercent}%</span>
                  <span>${formatCurrency(calc.cgstAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Add SGST @ ${calc.sgstPercent}%</span>
                  <span>${formatCurrency(calc.sgstAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Total</span>
                  <span>${formatCurrency(calc.totalWithTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000; font-size: 10px;">
                  <span>Round off (+-)</span>
                  <span>${calc.roundOff >= 0 ? calc.roundOff.toFixed(2) : calc.roundOff.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 8px; font-weight: normal; border-top: 1px solid #000;">
                  <span>Total Amount</span>
                  <span>${formatCurrency(calc.grandTotal)}</span>
                </div>
              </div>
              <div style="padding: 15px 8px 8px 8px; text-align: right; font-size: 10px;">
                <p style="margin: 0 0 25px 0;">For ${invoiceData.company.name}</p>
                <p style="margin: 0;">Authorized signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 6;
      const printableWidth = pdfWidth - margin * 2;
      const printableHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(
        imgData,
        'JPEG',
        margin,
        margin,
        printableWidth,
        Math.min(printableHeight, pdfHeight - margin * 2)
      );

      return pdf.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  },

  // Single Background Download via file-saver (NO window.print())
  exportInvoicePdf: async (
    invoiceData: InvoiceData,
    colorMode: 'color' | 'bw' = 'color'
  ): Promise<void> => {
    const filename = `Invoice_${(invoiceData.meta?.invoiceNo || 'export').replace(/[\/\\]/g, '_')}.pdf`;
    const pdfBlob = await pdfService.generatePdfBlob(invoiceData, colorMode);
    saveAs(pdfBlob, filename);
  },

  // Bulk ZIP Download via JSZip + file-saver (NO window.print())
  exportBulkPdfZip: async (invoices: InvoiceData[]): Promise<void> => {
    const zip = new JSZip();

    for (let idx = 0; idx < invoices.length; idx++) {
      const data = invoices[idx];
      const blob = await pdfService.generatePdfBlob(data);
      const filename = `Invoice_${(data.meta?.invoiceNo || `ASF_${idx + 1}`).replace(/[\/\\]/g, '_')}.pdf`;
      zip.file(filename, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipFilename = `Invoices_Bulk_Export_${new Date().toISOString().slice(0, 10)}.zip`;
    saveAs(zipBlob, zipFilename);
  },
};
