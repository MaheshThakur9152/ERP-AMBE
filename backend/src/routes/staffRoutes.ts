import { Router } from 'express';
import { StaffController } from '../controllers/staffController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Bulk assign staff to rate card
router.patch('/bulk-assign-rate-card', requireAuth, requireAdmin, StaffController.bulkAssignRateCard);

export default router;
