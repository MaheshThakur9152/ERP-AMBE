export interface Material {
  id: string;
  item_name: string;
  hsn_code?: string;
  gst_rate: number;
  default_rate: number;
  unit: string;
  created_at?: string;
  updated_at?: string;
}

export type CreateMaterialInput = Omit<Material, 'id' | 'created_at' | 'updated_at'>;
export type UpdateMaterialInput = Partial<CreateMaterialInput>;
