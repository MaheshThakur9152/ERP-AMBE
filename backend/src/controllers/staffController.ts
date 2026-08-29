import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';

const BulkAssignRateCardSchema = z.object({
  rate_card_id: z.string().uuid('Invalid rate card ID'),
  added: z.array(z.string().uuid()).default([]),
  removed: z.array(z.string().uuid()).default([]),
});

export const StaffController = {
  /**
   * Bulk assign or unassign staff to/from a specific rate card
   * PATCH /api/staff/bulk-assign-rate-card
   */
  async bulkAssignRateCard(req: Request, res: Response): Promise<void> {
    try {
      const parsed = BulkAssignRateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid request payload',
          details: parsed.error.format(),
        });
        return;
      }

      const { rate_card_id, added, removed } = parsed.data;

      if (added.length === 0 && removed.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No changes requested',
          addedCount: 0,
          removedCount: 0,
        });
        return;
      }

      // Assign rate_card_id to added staff
      if (added.length > 0) {
        const { error: addError } = await supabaseAdmin
          .from('staff')
          .update({
            rate_card_id,
          })
          .in('id', added);

        if (addError) {
          console.error('[StaffController:bulkAssignRateCard] Error adding staff to rate card:', addError);
          res.status(500).json({ error: `Failed to assign staff: ${addError.message}` });
          return;
        }
      }

      // Unassign rate_card_id from removed staff
      if (removed.length > 0) {
        const { error: removeError } = await supabaseAdmin
          .from('staff')
          .update({
            rate_card_id: null,
          })
          .in('id', removed);

        if (removeError) {
          console.error('[StaffController:bulkAssignRateCard] Error removing staff from rate card:', removeError);
          res.status(500).json({ error: `Failed to unassign staff: ${removeError.message}` });
          return;
        }
      }

      console.info(
        `[StaffController:bulkAssignRateCard] rate_card_id=${rate_card_id} added=${added.length} removed=${removed.length}`
      );

      res.status(200).json({
        success: true,
        message: 'Rate card roster updated successfully',
        addedCount: added.length,
        removedCount: removed.length,
      });
    } catch (err: any) {
      console.error('[StaffController:bulkAssignRateCard] Unexpected error:', err);
      res.status(500).json({ error: err.message || 'Internal server error while assigning rate card roster' });
    }
  },
};
