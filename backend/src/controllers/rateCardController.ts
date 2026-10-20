import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { RedisCache } from '../config/redis';

const RateCardSchema = z.object({
  site_id: z.string().uuid().optional().nullable(),
  site_name: z.string().optional().nullable(),
  post_name: z.string().min(1, 'Post name is required'),
  gross_salary: z.number().nonnegative().default(0),
  committed_salary: z.number().nullable().optional(),
  remark: z.string().optional().default(''),
  basic_da: z.number().nonnegative().default(0),
  hra: z.number().nonnegative().default(0),
  other_allowance: z.number().nonnegative().default(0),
  washing_allowance: z.number().nonnegative().default(0),
  conveyance_allowance: z.number().nonnegative().default(0),
  incentive_amount: z.number().nonnegative().default(0),
  incentive: z.number().nonnegative().default(0),
  bonus_amount: z.number().nullable().optional(),
  part_bonus_amount: z.number().nullable().optional(),
  part_bonus_percent: z.number().optional().default(0),
  is_flat_wage: z.boolean().default(false),
  location: z.string().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
});

export const RateCardController = {
  /**
   * GET /api/rate-cards
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { site_id, site_name } = req.query;
      const cacheKey = `erp:ratecards:${site_id || site_name || 'all'}`;
      const cached = await RedisCache.get<any[]>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json({ success: true, data: cached });
        return;
      }

      let query = 'SELECT * FROM public.rate_cards WHERE 1=1';
      const params: any[] = [];
      if (site_id) {
        params.push(site_id);
        query += ` AND site_id = $${params.length}`;
      } else if (site_name) {
        params.push(site_name);
        query += ` AND site_name = $${params.length}`;
      }
      query += ' ORDER BY created_at DESC';

      const pgResult = await pool.query(query, params);
      const rows = pgResult.rows || [];
      await RedisCache.set(cacheKey, rows, 300);
      res.setHeader('X-Cache', 'MISS');
      res.status(200).json({ success: true, data: rows });
    } catch (err: any) {
      console.error('[RateCardController:list] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/rate-cards/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const pgResult = await pool.query('SELECT * FROM public.rate_cards WHERE id = $1', [id]);
      if (!pgResult.rows || pgResult.rows.length === 0) {
        res.status(404).json({ error: 'Rate card not found' });
        return;
      }
      res.status(200).json({ success: true, data: pgResult.rows[0] });
    } catch (err: any) {
      console.error('[RateCardController:getById] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/rate-cards
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const parsed = RateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message || 'Validation error' });
        return;
      }

      const payload: Record<string, any> = { ...parsed.data };
      if (!payload.company_id && req.user?.company_id) {
        payload.company_id = req.user.company_id;
      }

      const keys = Object.keys(payload);
      const values = keys.map((k) => payload[k]);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const insertResult = await pool.query(
        `INSERT INTO public.rate_cards (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      await RedisCache.invalidatePrefix('erp:ratecards:');
      await RedisCache.invalidatePrefix('erp:sites:');

      res.status(201).json({ success: true, data: insertResult.rows[0] });
    } catch (err: any) {
      console.error('[RateCardController:create] Fatal error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * PUT /api/rate-cards/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = RateCardSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message || 'Validation error' });
        return;
      }

      const payload: Record<string, any> = { ...parsed.data };
      const keys = Object.keys(payload);
      if (keys.length === 0) {
        const getRes = await pool.query('SELECT * FROM public.rate_cards WHERE id = $1', [id]);
        res.status(200).json({ success: true, data: getRes.rows[0] });
        return;
      }

      const values = keys.map((k) => payload[k]);
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

      const updateResult = await pool.query(
        `UPDATE public.rate_cards SET ${setClauses} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );

      if (!updateResult.rows || updateResult.rows.length === 0) {
        res.status(404).json({ error: 'Rate card not found' });
        return;
      }

      await RedisCache.invalidatePrefix('erp:ratecards:');
      await RedisCache.invalidatePrefix('erp:sites:');

      res.status(200).json({ success: true, data: updateResult.rows[0] });
    } catch (err: any) {
      console.error('[RateCardController:update] Fatal error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * DELETE /api/rate-cards/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if any staff or deployments reference this rate card
      const checkRes = await pool.query(
        'SELECT count(*)::int as count FROM public.staff WHERE rate_card_id = $1',
        [id]
      );
      if (checkRes.rows[0].count > 0) {
        res.status(400).json({
          error: `Cannot delete rate card: ${checkRes.rows[0].count} staff member(s) are currently assigned to it.`,
        });
        return;
      }

      const delRes = await pool.query('DELETE FROM public.rate_cards WHERE id = $1', [id]);
      if ((delRes.rowCount ?? 0) === 0) {
        res.status(404).json({ error: 'Rate card not found' });
        return;
      }

      await RedisCache.invalidatePrefix('erp:ratecards:');
      await RedisCache.invalidatePrefix('erp:sites:');

      res.status(200).json({ success: true, message: 'Rate card deleted successfully' });
    } catch (err: any) {
      console.error('[RateCardController:delete] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
};
