import { pool } from '../db/pool';
import { MaterialItem, CreateMaterialDTO, UpdateMaterialDTO } from '../types/material';

export class MaterialService {
  /**
   * Get all materials
   */
  static async getAllMaterials(): Promise<MaterialItem[]> {
    try {
      const res = await pool.query('SELECT * FROM public.materials ORDER BY item_name ASC;');
      return (res.rows || []).map((row: any) => ({
        id: row.id,
        item_name: row.item_name || '',
        hsn_code: row.hsn_code || '',
        gst_rate: Number(row.gst_rate ?? 18),
        default_rate: Number(row.default_rate ?? 0),
        unit: row.unit || 'Nos',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error: any) {
      console.warn('⚠️ Error querying materials table from PostgreSQL:', error.message);
      return [];
    }
  }

  /**
   * Create material
   */
  static async createMaterial(payload: CreateMaterialDTO): Promise<MaterialItem> {
    const insertSql = `
      INSERT INTO public.materials (
        item_name, hsn_code, gst_rate, default_rate, unit, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *;
    `;

    const res = await pool.query(insertSql, [
      payload.item_name,
      payload.hsn_code || '',
      Number(payload.gst_rate ?? 18),
      Number(payload.default_rate ?? 0),
      payload.unit || 'Nos',
    ]);

    const data = res.rows[0];
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
    const updateSql = `
      UPDATE public.materials SET
        item_name = COALESCE($1, item_name),
        hsn_code = COALESCE($2, hsn_code),
        gst_rate = COALESCE($3, gst_rate),
        default_rate = COALESCE($4, default_rate),
        unit = COALESCE($5, unit),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `;

    const res = await pool.query(updateSql, [
      payload.item_name ?? null,
      payload.hsn_code ?? null,
      payload.gst_rate !== undefined ? Number(payload.gst_rate) : null,
      payload.default_rate !== undefined ? Number(payload.default_rate) : null,
      payload.unit ?? null,
      id,
    ]);

    if (!res.rows || res.rows.length === 0) {
      throw new Error(`Material not found: ${id}`);
    }

    const data = res.rows[0];
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
    const res = await pool.query('DELETE FROM public.materials WHERE id = $1', [id]);
    if ((res.rowCount ?? 0) === 0) {
      throw new Error(`Failed to delete material: not found`);
    }
    return true;
  }
}
