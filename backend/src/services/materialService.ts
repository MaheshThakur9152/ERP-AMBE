import { supabaseAdmin } from '../config/supabase';
import { MaterialItem, CreateMaterialDTO, UpdateMaterialDTO } from '../types/material';

export class MaterialService {
  /**
   * Get all materials
   */
  static async getAllMaterials(): Promise<MaterialItem[]> {
    const { data, error } = await supabaseAdmin
      .from('materials')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) {
      console.warn('⚠️ Error querying materials table from Supabase:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      item_name: row.item_name || row.itemName || '',
      hsn_code: row.hsn_code || row.hsnCode || '',
      gst_rate: Number(row.gst_rate ?? row.gstRate ?? 18),
      default_rate: Number(row.default_rate ?? row.defaultRate ?? row.rate ?? 0),
      unit: row.unit || 'Nos',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Create material
   */
  static async createMaterial(payload: CreateMaterialDTO): Promise<MaterialItem> {
    const now = new Date().toISOString();
    const insertRow = {
      item_name: payload.item_name,
      hsn_code: payload.hsn_code || '',
      gst_rate: Number(payload.gst_rate ?? 18),
      default_rate: Number(payload.default_rate ?? 0),
      unit: payload.unit || 'Nos',
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('materials')
      .insert([insertRow])
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase insert material error:', error.message);
      throw new Error(`Failed to create material: ${error.message}`);
    }

    return {
      id: data.id,
      item_name: data.item_name,
      hsn_code: data.hsn_code,
      gst_rate: Number(data.gst_rate),
      default_rate: Number(data.default_rate),
      unit: data.unit,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Update material
   */
  static async updateMaterial(id: string, payload: UpdateMaterialDTO): Promise<MaterialItem> {
    const updateRow: any = {
      updated_at: new Date().toISOString(),
    };
    if (payload.item_name !== undefined) updateRow.item_name = payload.item_name;
    if (payload.hsn_code !== undefined) updateRow.hsn_code = payload.hsn_code;
    if (payload.gst_rate !== undefined) updateRow.gst_rate = Number(payload.gst_rate);
    if (payload.default_rate !== undefined) updateRow.default_rate = Number(payload.default_rate);
    if (payload.unit !== undefined) updateRow.unit = payload.unit;

    const { data, error } = await supabaseAdmin
      .from('materials')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('❌ Supabase update material error:', error.message);
      throw new Error(`Failed to update material: ${error.message}`);
    }

    return {
      id: data.id,
      item_name: data.item_name,
      hsn_code: data.hsn_code,
      gst_rate: Number(data.gst_rate),
      default_rate: Number(data.default_rate),
      unit: data.unit,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Delete material
   */
  static async deleteMaterial(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase delete material error:', error.message);
      throw new Error(`Failed to delete material: ${error.message}`);
    }

    return true;
  }
}
