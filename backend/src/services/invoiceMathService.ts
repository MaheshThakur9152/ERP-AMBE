import { DEFAULT_MGMT_FEE_PERCENT } from '../config/constants';

export interface InvoiceChargeItem {
  name: string;
  amount: number;
}

export class InvoiceMathService {
  static computeManagementFee(subTotal: number, mgmtPercent: number = DEFAULT_MGMT_FEE_PERCENT): number {
    const rate = Math.max(0, Number(mgmtPercent || 0));
    return (Number(subTotal || 0) * rate) / 100;
  }

  static computeTaxes(taxableAmount: number, cgstRate = 9, sgstRate = 9) {
    const cgst = (taxableAmount * cgstRate) / 100;
    const sgst = (taxableAmount * sgstRate) / 100;
    return {
      cgst,
      sgst,
      totalTax: cgst + sgst,
    };
  }

  static buildAdditionalCharges(
    machineryCharges = 0,
    materialCharges = 0,
    existingCharges: InvoiceChargeItem[] = []
  ): InvoiceChargeItem[] {
    if (existingCharges && existingCharges.length > 0) {
      return existingCharges;
    }
    const charges: InvoiceChargeItem[] = [];
    if (machineryCharges > 0) {
      charges.push({ name: 'Machinery Charges', amount: machineryCharges });
    }
    if (materialCharges > 0) {
      charges.push({ name: 'Material Charges', amount: materialCharges });
    }
    return charges;
  }
}
