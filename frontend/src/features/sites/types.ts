import { z } from 'zod';

export const rateCardSchema = z.object({
  id: z.string().optional(),
  roleName: z.string().min(1, 'Role name is required'),
  monthlyRate: z.number().min(0, 'Rate must be 0 or positive'),
  workingDays: z.number().optional().default(31),
  hsnCode: z.string().optional().default('9985'),
});

export const siteSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().optional(),
  companyId: z.string().optional(),
  siteName: z.string().min(2, 'Site name is required'),
  clientName: z.string().min(2, 'Client name is required'),
  gstin: z.string().optional().or(z.literal('')),
  workOrderRefNo: z.string().optional().or(z.literal('')),
  workOrderPeriod: z.string().optional().or(z.literal('')),
  address: z.string().min(5, 'Address is required'),
  contactNo: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  rateCards: z.array(rateCardSchema).min(1, 'At least one rate card item is required'),
});

export type RateCardItem = z.infer<typeof rateCardSchema>;
export type SiteFormData = z.infer<typeof siteSchema>;

export interface Site extends SiteFormData {
  id: string;
  createdAt: string;
  company_id?: string;
  companyId?: string;
}
