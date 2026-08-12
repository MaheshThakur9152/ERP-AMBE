export interface RateCardItem {
  id?: string;
  roleName: string;
  monthlyRate: number;
  workingDays?: number;
  hsnCode?: string;
}

export interface Site {
  id: string;
  company_id?: string;
  companyId?: string;
  siteName: string;
  clientName: string;
  gstin?: string;
  workOrderRefNo?: string;
  workOrderPeriod?: string;
  address: string;
  contactNo?: string;
  email?: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  rateCards: RateCardItem[];
}

export type CreateSiteDTO = Omit<Site, 'id' | 'createdAt' | 'created_at' | 'updated_at'> & {
  id?: string;
};
export type UpdateSiteDTO = Partial<CreateSiteDTO>;
