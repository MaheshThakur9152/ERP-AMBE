export interface RateCardItem {
  id?: string;
  roleName: string;
  monthlyRate: number;
  workingDays?: number;
  hsnCode?: string;
  persons?: number;
}

export interface Site {
  id: string;
  company_id?: string;
  companyId?: string;
  siteName: string;
  code_name?: string;
  codeName?: string;
  clientName: string;
  gstin?: string;
  workOrderRefNo?: string;
  workOrderPeriod?: string;
  address: string;
  contactNo?: string;
  email?: string;
  status: 'Active' | 'Inactive';
  management_fee_percent?: number;
  mgmtPercent?: number;
  default_machinery_charges?: number;
  defaultMachineryCharges?: number;
  default_material_charges?: number;
  defaultMaterialCharges?: number;
  default_additional_charges?: { name: string; amount: number }[];
  defaultAdditionalCharges?: { name: string; amount: number }[];
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  rateCards: RateCardItem[];
}

export type CreateSiteDTO = Omit<Site, 'id' | 'createdAt' | 'created_at' | 'updated_at'> & {
  id?: string;
};
export type UpdateSiteDTO = Partial<CreateSiteDTO>;
