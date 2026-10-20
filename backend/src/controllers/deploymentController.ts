import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

const UpsertDeploymentSchema = z.object({
  month_year: z.string().min(1, 'month_year is required'),
  site_id: z.string().uuid('Invalid site_id'),
  staff_id: z.string().uuid('Invalid staff_id'),
  designation: z.string().optional().nullable(),
  rate_card_id: z.string().uuid().optional().nullable(),
});

export const DeploymentController = {
  /**
   * GET /api/deployments
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { month_year, site_id } = req.query;
      let query = `
        SELECT d.*, s.employee_name, s.biometric_code, sites.site_name, rc.post_name as rate_card_name
        FROM public.site_deployments d
        LEFT JOIN public.staff s ON s.id = d.staff_id
        LEFT JOIN public.sites sites ON sites.id = d.site_id
        LEFT JOIN public.rate_cards rc ON rc.id = d.rate_card_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (month_year) {
        params.push(month_year);
        query += ` AND d.month_year = $${params.length}`;
      }
      if (site_id) {
        params.push(site_id);
        query += ` AND d.site_id = $${params.length}`;
      }

      query += ' ORDER BY d.created_at DESC';

      const result = await pool.query(query, params);
      res.status(200).json({ success: true, data: result.rows || [] });
    } catch (err: any) {
      console.error('[DeploymentController:list] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/deployments/upsert
   */
  async upsert(req: Request, res: Response): Promise<void> {
    try {
      const parsed = UpsertDeploymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message || 'Validation error' });
        return;
      }

      const { month_year, site_id, staff_id, designation, rate_card_id } = parsed.data;

      const query = `
        INSERT INTO public.site_deployments (month_year, site_id, staff_id, designation, rate_card_id, updated_at)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (month_year, site_id, staff_id)
        DO UPDATE SET
          designation = EXCLUDED.designation,
          rate_card_id = EXCLUDED.rate_card_id,
          updated_at = now()
        RETURNING *;
      `;

      const result = await pool.query(query, [
        month_year,
        site_id,
        staff_id,
        designation || null,
        rate_card_id || null,
      ]);

      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      console.error('[DeploymentController:upsert] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * DELETE /api/deployments
   */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { month_year, staff_id, site_id } = req.body;
      if (!month_year || !staff_id) {
        res.status(400).json({ error: 'month_year and staff_id are required' });
        return;
      }

      let query = 'DELETE FROM public.site_deployments WHERE month_year = $1 AND staff_id = $2';
      const params = [month_year, staff_id];
      if (site_id) {
        query += ' AND site_id = $3';
        params.push(site_id);
      }

      await pool.query(query, params);
      res.status(200).json({ success: true, message: 'Deployment record removed' });
    } catch (err: any) {
      console.error('[DeploymentController:remove] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
};
