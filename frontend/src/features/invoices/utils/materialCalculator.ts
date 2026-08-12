import { numberToIndianWords } from './numberToWords';

export interface MaterialLineItem {
  id?: string;
  srNo?: number;
  description: string;
  hsnCode?: string;
  gstRate: number;
  rate: number;
  quantity: number;
  unit: string;
  amount: number;
}

export interface TaxGroupSummary {
  gstRate: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  taxAmount: number;
}

export interface MaterialCalculations {
  goodsSubTotal: number; // Amount (A)
  taxGroups: TaxGroupSummary[];
  totalCgst: number;
  totalSgst: number;
  taxTotal: number; // Total GST Amount of Good's (B)
  grossTotal: number; // AMOUNT (A+B)
  roundOff: number; // Round off (+-)
  grandTotal: number; // TOTAL AMOUNT
  amountInWords: string;
}

/**
 * Calculates line item amount = rate * quantity
 */
export function calculateMaterialItemAmount(rate: number, quantity: number): number {
  if (!rate || !quantity || quantity <= 0) return 0;
  return Math.round(rate * quantity * 100) / 100;
}

/**
 * Specialized utility for material billing math
 */
export function computeMaterialCalculations(items: MaterialLineItem[]): MaterialCalculations {
  // 1. Calculate Total Good's Amount (A)
  let goodsSubTotal = 0;

  // Group items by GST rate for exact tax calculations
  const taxGroupMap: { [gstRate: number]: number } = {};

  items.forEach((item) => {
    const itemAmount = calculateMaterialItemAmount(item.rate, item.quantity);
    goodsSubTotal += itemAmount;

    const rateKey = item.gstRate || 0;
    if (!taxGroupMap[rateKey]) {
      taxGroupMap[rateKey] = 0;
    }
    taxGroupMap[rateKey] += itemAmount;
  });

  goodsSubTotal = Math.round(goodsSubTotal * 100) / 100;

  // 2. Loop through tax groups to calculate CGST & SGST (e.g. 18% split into 9% CGST & 9% SGST)
  const taxGroups: TaxGroupSummary[] = [];
  let totalCgst = 0;
  let totalSgst = 0;

  Object.keys(taxGroupMap).forEach((gstRateStr) => {
    const gstRate = Number(gstRateStr);
    const taxableAmount = Math.round(taxGroupMap[gstRate] * 100) / 100;

    if (gstRate > 0) {
      const halfRate = gstRate / 2;
      const cgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
      const sgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
      const taxAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;

      totalCgst += cgstAmount;
      totalSgst += sgstAmount;

      taxGroups.push({
        gstRate,
        taxableAmount,
        cgstRate: halfRate,
        cgstAmount,
        sgstRate: halfRate,
        sgstAmount,
        taxAmount,
      });
    }
  });

  totalCgst = Math.round(totalCgst * 100) / 100;
  totalSgst = Math.round(totalSgst * 100) / 100;
  const taxTotal = Math.round((totalCgst + totalSgst) * 100) / 100;

  // 3. Gross total = Goods (A) + Tax (B)
  const grossTotal = Math.round((goodsSubTotal + taxTotal) * 100) / 100;

  // 4. Round off calculation
  const grandTotal = Math.round(grossTotal);
  const roundOff = Math.round((grandTotal - grossTotal) * 100) / 100;

  // 5. Amount in words
  const amountInWords = numberToIndianWords(grandTotal);

  return {
    goodsSubTotal,
    taxGroups,
    totalCgst,
    totalSgst,
    taxTotal,
    grossTotal,
    roundOff,
    grandTotal,
    amountInWords,
  };
}
