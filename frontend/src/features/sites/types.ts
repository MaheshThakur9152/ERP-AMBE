import { z } from 'zod';

export const rateCardSchema = z.object({
  id: z.string().optional(),
  roleName: z.string().min(1, 'Role name is required'),
  monthlyRate: z.number().min(0, 'Rate must be 0 or positive'),
  workingDays: z.number().optional().default(31),
  hsnCode: z.string().optional().default('9985'),
  persons: z.number().optional().default(1),
});

export const additionalChargeSchema = z.object({
  name: z.string().min(1, 'Charge name required'),
  amount: z.number().min(0, 'Amount must be positive'),
});

export const siteSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().optional(),
  companyId: z.string().optional(),
  siteName: z.string().min(2, 'Site name is required'),
  codeName: z.string().optional().or(z.literal('')),
  clientName: z.string().min(2, 'Client name is required'),
  gstin: z.string().optional().or(z.literal('')),
  workOrderRefNo: z.string().optional().or(z.literal('')),
  workOrderPeriod: z.string().optional().or(z.literal('')),
  address: z.string().min(5, 'Address is required'),
  contactNo: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
  mgmtPercent: z.number().optional().default(5),
  defaultMachineryCharges: z.number().optional().default(0),
  defaultMaterialCharges: z.number().optional().default(0),
  defaultAdditionalCharges: z.array(additionalChargeSchema).optional().default([
    { name: 'Machinery Charges', amount: 0 },
    { name: 'Material Charges', amount: 0 },
  ]),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  rateCards: z.array(rateCardSchema).min(1, 'At least one rate card item is required'),
});

export type AdditionalCharge = z.infer<typeof additionalChargeSchema>;
export type RateCardItem = z.infer<typeof rateCardSchema>;
export type SiteFormData = z.infer<typeof siteSchema>;

export interface Site extends SiteFormData {
  id: string;
  createdAt: string;
  company_id?: string;
  companyId?: string;
  code_name?: string;
  management_fee_percent?: number;
  default_machinery_charges?: number;
  default_material_charges?: number;
  default_additional_charges?: AdditionalCharge[];
}
