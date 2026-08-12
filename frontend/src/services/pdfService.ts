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
import {
  computeMaterialCalculations,
} from '@/features/invoices/utils/materialCalculator';

export function formatCleanCompanyAddress(rawAddr1: string = '', rawAddr2: string = ''): { line1: string; line2: string } {
  const rawCombined = `${rawAddr1 || ''}, ${rawAddr2 || ''}`;
  const parts = rawCombined.split(/,|\n/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
  
  const cleanParts: string[] = [];
  
  for (const part of parts) {
    const pLower = part.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!pLower) continue;

    let isDuplicate = false;
    for (let i = 0; i < cleanParts.length; i++) {
      const existingLower = cleanParts[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (existingLower === pLower || existingLower.includes(pLower) || pLower.includes(existingLower)) {
        isDuplicate = true;
        if (part.length > cleanParts[i].length) {
          cleanParts[i] = part;
        }
        break;
      }
    }
    if (!isDuplicate) {
      cleanParts.push(part);
    }
  }

  if (cleanParts.length === 0) return { line1: '', line2: '' };
  if (cleanParts.length <= 3) {
    return { line1: cleanParts.join(', '), line2: '' };
  }
  const mid = Math.ceil(cleanParts.length / 2);
  return {
    line1: cleanParts.slice(0, mid).join(', '),
    line2: cleanParts.slice(mid).join(', '),
  };
}

// ─── Shared helper to render off-screen and capture to PDF blob ───────────────
async function renderHtmlToPdfBlob(html: string): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 6;
    const printableWidth = pdfWidth - margin * 2;
    const printableHeight = (canvas.height * printableWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, Math.min(printableHeight, pdfHeight - margin * 2));
    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

export const pdfService = {
  // Silent headless PDF blob generator in memory (No window.print())
  generatePdfBlob: async (
    invoiceData: InvoiceData,
    colorMode: 'color' | 'bw' = 'color'
  ): Promise<Blob> => {
    // ── MATERIAL GOODS INVOICE BRANCH ──────────────────────────────────────────
    if (invoiceData.isMaterial) {
      return pdfService.generateMaterialPdfBlob(invoiceData, colorMode);
    }

    // ── MANPOWER INVOICE BRANCH (original) ─────────────────────────────────────
    const calc = computeInvoiceCalculations(
      invoiceData.items || [],
      invoiceData.mgmtPercent ?? 5,
      invoiceData.cgstPercent ?? 9,
      invoiceData.sgstPercent ?? 9,
      invoiceData.machineryCharges || 0,
      invoiceData.materialCharges || 0
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
        <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${(item.workingDays || 0) > 0 ? item.workingDays : 0}</td>
        <td style="border-right: 1px solid #000; padding: 4px 6px; text-align: center;">${(item.persons || 0) > 0 ? item.persons : 0}</td>
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

    const cleanAddr = formatCleanCompanyAddress(invoiceData.company.addressLine1, invoiceData.company.addressLine2);

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
              ${cleanAddr.line1 ? `<p style="margin: 2px 0;">${cleanAddr.line1}</p>` : ''}
              ${cleanAddr.line2 ? `<p style="margin: 2px 0;">${cleanAddr.line2}</p>` : ''}
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
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Management charges @ ${calc.mgmtChargesPercent}%</span>
                  <span>${formatCurrency(calc.mgmtChargesAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Machinery Charges</span>
                  <span>${formatCurrency(Number(invoiceData.machineryCharges || 0))}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000;">
                  <span>Material Charges</span>
                  <span>${formatCurrency(Number(invoiceData.materialCharges || 0))}</span>
                </div>
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

    return renderHtmlToPdfBlob(container.innerHTML);
  },


  // ─── Material Goods Invoice PDF Generator ─────────────────────────────────────
  generateMaterialPdfBlob: async (
    invoiceData: InvoiceData,
    colorMode: 'color' | 'bw' = 'color'
  ): Promise<Blob> => {
    const isBw = colorMode === 'bw';
    const sellerColor = isBw ? '#000000' : '#b91c1c';

    const items = invoiceData.items || [];
    const materialItems = items.map((item, idx) => ({
      srNo: idx + 1,
      description: item.description || '',
      hsnCode: item.hsnCode || '',
      gstRate: item.gstRate ?? 18,
      rate: item.rate ?? 0,
      quantity: item.quantity ?? 1,
      unit: item.unit || 'Nos',
      amount: item.amount ?? 0,
    }));

    const calc = computeMaterialCalculations(
      materialItems.map((mi) => ({
        id: String(mi.srNo),
        srNo: mi.srNo,
        description: mi.description,
        hsnCode: mi.hsnCode,
        gstRate: mi.gstRate,
        rate: mi.rate,
        quantity: mi.quantity,
        unit: mi.unit,
        amount: mi.amount,
      }))
    );

    const delivery = invoiceData.delivery || {};
    const challanNo = delivery.challanNo || invoiceData.meta?.challanNo || '';
    const challanDate = delivery.challanDate || invoiceData.meta?.challanDate || '';
    const buyerOrderNo = delivery.buyerOrderNo || invoiceData.meta?.buyerOrderNo || '';
    const dispatchDocNo = delivery.dispatchDocNo || invoiceData.meta?.dispatchDocNo || '';
    const dispatchedThrough = delivery.dispatchedThrough || invoiceData.meta?.dispatchedThrough || '';
    const destination = delivery.destination || invoiceData.meta?.destination || '';
    const termsOfDelivery = delivery.termsOfDelivery || invoiceData.meta?.termsOfDelivery || '';
    const otherReferences = delivery.otherReferences || '';
    const deliveryNotedDate = delivery.deliveryNotedDate || '';

    const docTitle = invoiceData.type === 'Proforma Invoice' || invoiceData.meta?.invoiceType === 'Proforma Invoice'
      ? 'PROFORMA INVOICE' : 'TAX INVOICE';

    const MIN_ROWS = 10;
    const emptyRowsCount = Math.max(0, MIN_ROWS - materialItems.length);

    let materialRowsHtml = '';
    materialItems.forEach((item) => {
      materialRowsHtml += `
        <tr style="border-bottom: 1px solid #000;">
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.srNo}</td>
          <td style="border: 1px solid #000; padding: 2px 4px;">${item.description}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.hsnCode}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.gstRate}%</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">${item.rate}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.quantity}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.unit}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">${formatCurrency(item.amount)}</td>
        </tr>`;
    });

    // Single filler row for seamless vertical lines without horizontal interruption
    const fillerStyle = `border-left: 1px solid #000; border-right: 1px solid #000; border-top: none; border-bottom: none; padding: 2px 4px;`;
    materialRowsHtml += `<tr style="height: 140px; border-bottom: 1px solid #000;">
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
      <td style="${fillerStyle}"></td>
    </tr>`;

    // Total Goods (A)
    materialRowsHtml += `<tr style="border-bottom: 1px solid #000;">
      <td colspan="7" style="border: 1px solid #000; padding: 2px 4px; text-align: right;">Total Good's Amount (A)</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold;">${formatCurrency(calc.goodsSubTotal)}</td>
    </tr>`;

    // Dynamic GST tax rows — CGST & SGST with exact Colspan Math alignment
    calc.taxGroups.forEach((tg) => {
      materialRowsHtml += `
        <tr style="border-bottom: 1px solid #000;">
          <td colspan="5" style="border: 1px solid #000; padding: 2px 4px; text-align: right; padding-right: 8px;">CGST ${tg.cgstRate}%</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold;">${tg.cgstRate}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold;">%</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold;">${formatCurrency(tg.cgstAmount)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000;">
          <td colspan="5" style="border: 1px solid #000; padding: 2px 4px; text-align: right; padding-right: 8px;">SGST ${tg.sgstRate}%</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold;">${tg.sgstRate}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold;">%</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold;">${formatCurrency(tg.sgstAmount)}</td>
        </tr>`;
    });

    // Total GST (B) + Grand Total
    materialRowsHtml += `
      <tr style="border-bottom: 1px solid #000;">
        <td colspan="7" style="border: 1px solid #000; padding: 2px 4px; text-align: right;">Total GST Amount of Good's (B)</td>
        <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold;">${formatCurrency(calc.taxTotal)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #000;">
        <td colspan="7" style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; font-size: 11px;">TOTAL AMOUNT(A+B)</td>
        <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold; font-size: 11px;">${calc.grandTotal.toLocaleString('en-IN')}</td>
      </tr>`;

    const cleanAddr = formatCleanCompanyAddress(invoiceData.company.addressLine1, invoiceData.company.addressLine2);

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #000; font-size: 10px; background: #fff;">
        <div style="text-align: center; font-size: 13px; margin-bottom: 16px; text-transform: uppercase;">${docTitle}</div>
        <div style="border: 1px solid #000; width: 100%;">
          <!-- Top Section -->
          <div style="display: flex; border-bottom: 1px solid #000;">
            <!-- Left: Seller + Buyer -->
            <div style="flex: 0 0 45%; border-right: 1px solid #000;">
              <div style="padding: 8px 10px; border-bottom: 1px solid #000;">
                <h1 style="color: ${sellerColor}; margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">${invoiceData.company.name || 'BHAGWATI ENTERPRISES'}</h1>
                ${cleanAddr.line1 ? `<p style="margin: 2px 0;">${cleanAddr.line1}</p>` : ''}
                ${cleanAddr.line2 ? `<p style="margin: 2px 0;">${cleanAddr.line2}</p>` : ''}
                <p style="margin: 2px 0;">GSTIN : ${invoiceData.company.gstin || ''}</p>
                <p style="margin: 2px 0;">Contact No: ${invoiceData.company.contactNo}</p>
                <p style="margin: 2px 0;">Email : ${invoiceData.company.emailWebsite}</p>
              </div>
              <div style="padding: 8px 10px;">
                <p style="margin: 0 0 4px 0; font-size: 9px; font-weight: 600; text-transform: uppercase; color: #555;">Buyer (Bill to)</p>
                <p style="margin: 2px 0; font-weight: bold; font-size: 11px;">${invoiceData.party.name}</p>
                <p style="margin: 2px 0; white-space: pre-line;">${invoiceData.party.address || invoiceData.party.siteName || ''}</p>
                <p style="margin: 2px 0;">GSTIN : ${invoiceData.party.gstin || ''}</p>
              </div>
            </div>
            <!-- Right: Metadata grid -->
            <div style="flex: 0 0 55%;">
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000; width: 50%;">Invoice No.: <strong>${invoiceData.meta.invoiceNo}</strong></td>
                  <td style="padding: 4px 6px;">Dated : <strong>${invoiceData.meta.invoiceDate}</strong></td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Challan No :</td>
                  <td style="padding: 4px 6px; font-weight: bold;">${challanNo}</td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Challan Date :</td>
                  <td style="padding: 4px 6px; font-weight: bold;">${challanDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Reference No &amp; Date</td>
                  <td style="padding: 4px 6px;">${otherReferences || 'Other References'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Buyer's Order No.</td>
                  <td style="padding: 4px 6px;">${buyerOrderNo || ''}</td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Dispatch Doc No.</td>
                  <td style="padding: 4px 6px;">${deliveryNotedDate || 'Delivery Noted Date'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #000;">
                  <td style="padding: 4px 6px; border-right: 1px solid #000;">Dispatched through</td>
                  <td style="padding: 4px 6px;"><strong>Destination : ${destination}</strong></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 4px 6px;">Terms of Delivery${termsOfDelivery ? ': ' + termsOfDelivery : ''}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Line Items Table -->
          <div style="border-bottom: 1px solid #000;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr style="border-bottom: 1px solid #000;">
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: center; font-weight: normal; width: 5%;">Sr No</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; font-weight: normal; width: 38%;">Description of Goods</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: center; font-weight: normal; width: 9%;">HSN/SAC</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: center; font-weight: normal; width: 9%;">GST Rate</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: right; font-weight: normal; width: 10%;">Rate</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: center; font-weight: normal; width: 9%;">Quantity</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: center; font-weight: normal; width: 8%;">per</th>
                  <th style="border: 1px solid #000; padding: 4px 5px; text-align: right; font-weight: normal; width: 12%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${materialRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Amount in Words -->
          <div style="border-bottom: 1px solid #000; padding: 5px 10px; display: flex; gap: 8px;">
            <span style="font-weight: 600; white-space: nowrap;">Total Invoice Amount in words (INR) :</span>
            <span style="font-weight: bold;">${calc.amountInWords}</span>
          </div>

          <!-- Footer: Bank Details | Signatory -->
          <div style="display: flex; border-bottom: 1px solid #000;">
            <div style="flex: 0 0 60%; border-right: 1px solid #000; padding: 8px 10px; font-size: 9.5px;">
              <p style="margin: 0 0 4px 0; font-weight: bold;">Company's Bank Details:</p>
              <p style="margin: 2px 0;">Bank Name: ${invoiceData.bank.bankName}</p>
              <p style="margin: 2px 0;">Acc No. : ${invoiceData.bank.accountNo}</p>
              <p style="margin: 2px 0;">Branch &amp; IFSC Code : ${invoiceData.bank.branch} &amp; ${invoiceData.bank.ifscCode}</p>
            </div>
            <div style="flex: 0 0 40%; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between;">
              <p style="margin: 0; text-align: right; font-size: 10px;">For ${invoiceData.company.name || 'BHAGWATI ENTERPRISES'}</p>
              <p style="margin: 40px 0 0 0; text-align: right; font-size: 10px; border-top: 1px solid #ccc; padding-top: 4px;">Authorized Signatory</p>
            </div>
          </div>

          <!-- Udyam Registration Row -->
          <div style="padding: 6px; font-size: 11px; font-weight: bold;">
            Udyam Reg. No : ${(invoiceData.company as any)?.udyamNo || 'UDYAM-MH-18-0108068'}
          </div>
        </div>
      </div>`;

    return renderHtmlToPdfBlob(html);
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

  // Headless Landscape Attendance Sheet PDF Download (39-Column Excel Layout)
  exportAttendancePdf: async (data: {
    month: number | string;
    year: number;
    siteName?: string;
    employees: any[];
    attendanceByEmployee?: Map<string, Map<string, any>>;
  }): Promise<void> => {
    const daysCount = 31;
    const monthName =
      typeof data.month === 'string'
        ? data.month
        : new Date(2000, Number(data.month) - 1, 1).toLocaleString('default', { month: 'long' });
    const siteSanitized = (data.siteName || 'ALL_SITES').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `Attendance_${monthName}_${data.year}_${siteSanitized}.pdf`;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.background = '#ffffff';
    container.style.padding = '10px';
    container.style.fontFamily = 'Arial, sans-serif';

    const dayIndices = Array.from({ length: daysCount }, (_, i) => i + 1);
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    let dayNumbersHeaderHtml = '';
    let dayNamesHeaderHtml = '';

    dayIndices.forEach((d) => {
      const dateObj = new Date(Number(data.year), Number(data.month) - 1, d);
      const dayName = dayNames[dateObj.getDay()] || 'MON';

      dayNumbersHeaderHtml += `<th style="border: 1px solid #000; padding: 2px; font-size: 7px; text-align: center; width: 20px;">${d}</th>`;
      dayNamesHeaderHtml += `<th style="border: 1px solid #000; height: 35px; font-size: 6px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">${dayName}</th>`;
    });

    // Compute Daily Column Strengths across all employees
    const dailyWO = dayIndices.map((d) =>
      (data.employees || []).reduce((acc, emp) => {
        const dateStr = `${data.year}-${Number(data.month).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const record = data.attendanceByEmployee?.get(emp.id)?.get(dateStr);
        const st = (record?.status || '').toUpperCase().trim();
        return acc + (st === 'W/O' || st === 'WO' ? 1 : 0);
      }, 0)
    );

    const dailyPresent = dayIndices.map((d) =>
      (data.employees || []).reduce((acc, emp) => {
        const dateStr = `${data.year}-${Number(data.month).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const record = data.attendanceByEmployee?.get(emp.id)?.get(dateStr);
        const st = (record?.status || '').toUpperCase().trim();
        return acc + (st === 'P' ? 1 : st === 'HD' ? 0.5 : 0);
      }, 0)
    );

    const dailyTotal = dayIndices.map((d, i) => dailyWO[i] + dailyPresent[i]);

    let empRowsHtml = '';
    (data.employees || []).forEach((emp: any, idx: number) => {
      let regCellsHtml = '';
      let otCellsHtml = '';
      let presentDays = 0;
      let weeklyOffDays = 0;
      let hdDays = 0;

      dayIndices.forEach((d) => {
        const dateStr = `${data.year}-${Number(data.month).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const record = data.attendanceByEmployee?.get(emp.id)?.get(dateStr);
        const status = record?.status || '';

        if (status === 'P') presentDays += 1;
        else if (status === 'HD') { presentDays += 0.5; hdDays += 1; }
        else if (status === 'W/O' || status === 'WO') weeklyOffDays += 1;

        regCellsHtml += `<td style="border: 1px solid #000; padding: 2px; font-size: 7px; text-align: center; font-weight: bold;">${status}</td>`;
        otCellsHtml += `<td style="border: 1px solid #000; padding: 2px; font-size: 6px; text-align: center;"></td>`;
      });

      const totalDays = presentDays + weeklyOffDays;

      // Split 2-row employee structure
      empRowsHtml += `
        <tr>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; font-weight: bold;">${idx + 1}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center;">${emp.biometricCode || ''}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px 4px; font-size: 8px; font-weight: bold; text-align: left;">${emp.name || emp.employeeName || ''}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; text-transform: uppercase;">${emp.weeklyOff || 'SUN'}</td>
          ${regCellsHtml}
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; font-weight: bold;">${presentDays}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; font-weight: bold;">${weeklyOffDays}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; font-weight: bold;">${hdDays}</td>
          <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-size: 7.5px; text-align: center; font-weight: bold;">${totalDays}</td>
        </tr>
        <tr>
          ${otCellsHtml}
        </tr>
      `;
    });

    let woCellsHtml = '';
    let presentCellsHtml = '';
    let totalCellsHtml = '';

    dayIndices.forEach((_, i) => {
      woCellsHtml += `<td style="border: 1px solid #000; padding: 2px; font-size: 7px; text-align: center; font-weight: bold;">${dailyWO[i]}</td>`;
      presentCellsHtml += `<td style="border: 1px solid #000; padding: 2px; font-size: 7px; text-align: center; font-weight: bold;">${dailyPresent[i]}</td>`;
      totalCellsHtml += `<td style="border: 1px solid #000; padding: 2px; font-size: 7px; text-align: center; font-weight: bold;">${dailyTotal[i]}</td>`;
    });

    container.innerHTML = `
      <div style="width: 100%; font-family: Arial, sans-serif; font-size: 7px; color: #000;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
          <thead>
            <tr><td colspan="39" style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px; padding: 4px;">AMBE SERVICE FACILITY PVT. LTD.</td></tr>
            <tr><td colspan="39" style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 11px; padding: 2px;">SITE - ${(data.siteName || 'ALL SITES').toUpperCase()}</td></tr>
            <tr><td colspan="39" style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 9px; padding: 2px;">ATTENDANCE FOR THE MONTH OF ${String(monthName).toUpperCase()} ${data.year}</td></tr>
            <tr>
              <th rowspan="2" style="border: 1px solid #000; width: 16px; text-align: center;">SR</th>
              <th rowspan="2" style="border: 1px solid #000; width: 35px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">Biometric Code</th>
              <th rowspan="2" style="border: 1px solid #000; width: 120px; text-align: left; padding: 2px;">Employee Name</th>
              <th rowspan="2" style="border: 1px solid #000; width: 30px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">Weekly Off</th>
              ${dayNumbersHeaderHtml}
              <th rowspan="2" style="border: 1px solid #000; width: 30px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">TOTAL PRESENT DAYS</th>
              <th rowspan="2" style="border: 1px solid #000; width: 30px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">WEEKLY OFF</th>
              <th rowspan="2" style="border: 1px solid #000; width: 25px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">HD</th>
              <th rowspan="2" style="border: 1px solid #000; width: 30px; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);">TOTAL DAYS</th>
            </tr>
            <tr>
              ${dayNamesHeaderHtml}
            </tr>
          </thead>
          <tbody>
            ${empRowsHtml}
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #000; text-align: right; padding-right: 4px;">WEEKLY OFF</td>
              ${woCellsHtml}
              <td colspan="4" style="border: 1px solid #000; text-align: center;">${dailyWO.reduce((a, b) => a + b, 0)}</td>
            </tr>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #000; text-align: right; padding-right: 4px;">PRESENT STRENGTH</td>
              ${presentCellsHtml}
              <td colspan="4" style="border: 1px solid #000; text-align: center;">${dailyPresent.reduce((a, b) => a + b, 0)}</td>
            </tr>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #000; text-align: right; padding-right: 4px;">TOTAL STRENGTH</td>
              ${totalCellsHtml}
              <td colspan="4" style="border: 1px solid #000; text-align: center;">${dailyTotal.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </tbody>
        </table>
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
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 5;
      const printableWidth = pdfWidth - margin * 2;
      const printableHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, Math.min(printableHeight, pdfHeight - margin * 2));
      const pdfBlob = pdf.output('blob');
      saveAs(pdfBlob, fileName);
    } finally {
      document.body.removeChild(container);
    }
  },
};
