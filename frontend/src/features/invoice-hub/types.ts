export interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  companyId?: string;
  siteId?: string;
  company_id?: string;
  site_id?: string;
  date: string;
  invoice_date?: string;
  monthYear: string;
  billing_period?: string;
  clientName: string;
  siteName: string;
  amount: number;
  sub_total?: number;
  tax_total?: number;
  grand_total?: number;
  type: 'Tax Invoice' | 'Proforma Invoice' | string;
  status: 'Paid' | 'Pending' | 'Draft' | 'Overdue' | string;
  itemsCount: number;
  sites?: {
    client_name?: string;
    site_name?: string;
  };
  companies?: {
    name?: string;
    legal_name?: string;
  };
  payload?: any;
}
