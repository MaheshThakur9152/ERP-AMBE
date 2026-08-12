export interface InvoiceLineItem {
  id: string;
  srNo: number;
  description: string;
  hsnCode: string;
  rate: number;
  workingDays: number;
  persons: number;
  amount: number;
}

export interface HeaderCompanyInfo {
  name: string;
  addressLine1: string;
  addressLine2: string;
  contactNo: string;
  emailWebsite: string;
  cinNo: string;
  gstin: string;
}

export interface ClientPartyInfo {
  name: string;
  address: string;
  gstin: string;
  siteName: string;
  workOrderRefNo: string;
  workOrderPeriod: string;
}

export interface InvoiceMetadata {
  invoiceNo: string;
  invoiceDate: string;
  billingPeriod: string;
  invoiceType?: 'Tax Invoice' | 'Proforma Invoice' | string;
}

export interface BankDetails {
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
}

export interface InvoiceCalculations {
  subTotal: number;
  mgmtChargesPercent: number;
  mgmtChargesAmount: number;
  totalBeforeTax: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  totalWithTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

export interface InvoiceData {
  company: HeaderCompanyInfo;
  party: ClientPartyInfo;
  meta: InvoiceMetadata;
  bank: BankDetails;
  items: InvoiceLineItem[];
  mgmtPercent: number;
  cgstPercent: number;
  sgstPercent: number;
  terms: string;
  type?: 'Tax Invoice' | 'Proforma Invoice' | string;
}
