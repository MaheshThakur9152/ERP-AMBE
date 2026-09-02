export interface InvoiceLineItem {
  id: string;
  srNo: number;
  description: string;
  location?: string;
  hsnCode: string;
  rate: number;
  workingDays?: number;
  persons?: number;
  quantity?: number;
  unit?: string;
  gstRate?: number;
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
  stateNameCode?: string;
  udyamNo?: string;
}

export interface ClientPartyInfo {
  name: string;
  address: string;
  gstin: string;
  siteName: string;
  workOrderRefNo: string;
  workOrderPeriod: string;
  contactNo?: string;
  email?: string;
}

export interface DeliveryDetails {
  challanNo?: string;
  challanDate?: string;
  buyerOrderNo?: string;
  dated?: string;
  dispatchDocNo?: string;
  deliveryNotedDate?: string;
  dispatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  referenceNoDate?: string;
  otherReferences?: string;
}

export interface InvoiceMetadata {
  invoiceNo: string;
  invoiceDate: string;
  billingPeriod: string;
  invoiceType?: 'Tax Invoice' | 'Proforma Invoice' | string;
  challanNo?: string;
  challanDate?: string;
  buyerOrderNo?: string;
  dispatchDocNo?: string;
  dispatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
}

export interface BankDetails {
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
}

export interface AdditionalChargeItem {
  name: string;
  amount: number;
}

export interface InvoiceCalculations {
  subTotal: number;
  mgmtChargesPercent: number;
  mgmtChargesAmount: number;
  additionalCharges: AdditionalChargeItem[];
  totalAdditionalCharges: number;
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
  mgmtPercent?: number;
  additionalCharges?: AdditionalChargeItem[];
  /** @deprecated - kept for legacy invoice rendering */
  machineryCharges?: number;
  /** @deprecated - kept for legacy invoice rendering */
  materialCharges?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  terms?: string;
  type?: 'Tax Invoice' | 'Proforma Invoice' | string;
  isMaterial?: boolean;
  delivery?: DeliveryDetails;
  taxGroups?: Array<{
    gstRate: number;
    taxableAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    taxAmount: number;
  }>;
}
