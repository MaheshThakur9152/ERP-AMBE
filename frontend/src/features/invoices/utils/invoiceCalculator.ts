import { InvoiceLineItem, InvoiceCalculations, AdditionalChargeItem } from '../types/invoice';
import { numberToIndianWords } from './numberToWords';

/**
 * Calculates a single line item amount.
 * Formula matching sample invoice: (rate / daysInMonth) * workingDays
 * Default daysInMonth = 31 (e.g. July)
 */
export function calculateLineItemAmount(
  rate: number,
  workingDays: number,
  daysInMonth: number = 31
): number {
  if (!rate || !workingDays || daysInMonth <= 0) return 0;
  const amount = (rate / daysInMonth) * workingDays;
  return Math.round(amount * 100) / 100;
}

/**
 * Computes complete invoice calculations from line items & tax percentages
 */
export function computeInvoiceCalculations(
  items: InvoiceLineItem[],
  mgmtPercent: number = 5,
  cgstPercent: number = 9,
  sgstPercent: number = 9,
  additionalChargesInput: AdditionalChargeItem[] | number = [],
  legacyMaterialCharges: number = 0
): InvoiceCalculations {
  // 1. Sub total from items
  const subTotalRaw = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const subTotal = Math.round(subTotalRaw * 100) / 100;

  // 2. Management charges
  const mgmtChargesAmountRaw = (subTotal * mgmtPercent) / 100;
  const mgmtChargesAmount = Math.round(mgmtChargesAmountRaw * 100) / 100;

  // 3. Additional charges resolution
  let additionalCharges: AdditionalChargeItem[] = [];
  if (Array.isArray(additionalChargesInput)) {
    additionalCharges = additionalChargesInput.filter((ch) => (ch?.name || '').trim() !== '');
  } else {
    // Backward compatibility for legacy positional number args
    if (additionalChargesInput) {
      additionalCharges.push({ name: 'Machinery Charges', amount: Number(additionalChargesInput) });
    }
    if (legacyMaterialCharges) {
      additionalCharges.push({ name: 'Material Charges', amount: Number(legacyMaterialCharges) });
    }
  }

  const totalAdditionalChargesRaw = additionalCharges.reduce(
    (sum, ch) => sum + (Number(ch.amount) || 0),
    0
  );
  const totalAdditionalCharges = Math.round(totalAdditionalChargesRaw * 100) / 100;

  // 4. Total before tax
  const totalBeforeTax = Math.round((subTotal + mgmtChargesAmount + totalAdditionalCharges) * 100) / 100;

  // 5. CGST & SGST
  const cgstAmountRaw = (totalBeforeTax * cgstPercent) / 100;
  const cgstAmount = Math.round(cgstAmountRaw * 100) / 100;

  const sgstAmountRaw = (totalBeforeTax * sgstPercent) / 100;
  const sgstAmount = Math.round(sgstAmountRaw * 100) / 100;

  // 6. Total with tax
  const totalWithTaxRaw = totalBeforeTax + cgstAmount + sgstAmount;
  const totalWithTax = Math.round(totalWithTaxRaw * 100) / 100;

  // 7. Round off calculation
  const grandTotalRounded = Math.round(totalWithTax);
  const roundOff = Math.round((grandTotalRounded - totalWithTax) * 100) / 100;
  const grandTotal = grandTotalRounded;

  // 8. Amount in words
  const amountInWords = numberToIndianWords(grandTotal);

  return {
    subTotal,
    mgmtChargesPercent: mgmtPercent,
    mgmtChargesAmount,
    additionalCharges,
    totalAdditionalCharges,
    totalBeforeTax,
    cgstPercent,
    cgstAmount,
    sgstPercent,
    sgstAmount,
    totalWithTax,
    roundOff,
    grandTotal,
    amountInWords,
  };
}

export function formatCurrency(num: number): string {
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatInteger(num: number): string {
  if (isNaN(num) || !num) return '';
  return Math.round(num).toLocaleString('en-IN');
}
