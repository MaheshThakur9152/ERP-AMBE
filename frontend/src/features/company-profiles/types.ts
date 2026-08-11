export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  legal_name: string;
  tagline?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  state_code?: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_branch: string;
  upi_id?: string;
  terms_and_conditions: string[];
  logo_url?: string;
  stamp_url?: string;
  signature_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCompanyInput = Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at' | 'is_active'>;
export type UpdateCompanyInput = Partial<CreateCompanyInput>;
