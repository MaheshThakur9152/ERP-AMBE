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
  line_items?: any[];
  challan_no?: string;
  challan_date?: string;
  buyer_order_no?: string;
  dispatch_doc_no?: string;
  dispatched_through?: string;
  destination?: string;
  terms_of_delivery?: string;
  is_material?: boolean;
  sites?: {

    client_name?: string;
    site_name?: string;
  };
  companies?: {
    name?: string;
    legal_name?: string;
  };
  payload?: any;
  certified_doc_url?: string | null;
  certifiedDocUrl?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CreateInvoiceDTO = Partial<InvoiceRecord> & any;
