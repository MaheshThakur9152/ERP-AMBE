import { Router } from 'express';
import { StaffController } from '../controllers/staffController';
import { requireAuth, requireAdmin, checkLockBouncer, checkFieldLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

// Staff creation
router.post('/', requireAuth, requireAdmin, StaffController.create);

// Staff listing & details
router.get('/', requireAuth, StaffController.list);
router.get('/:id', requireAuth, StaffController.getById);

// Bulk assign staff to rate card
router.patch('/bulk-assign-rate-card', requireAuth, requireAdmin, StaffController.bulkAssignRateCard);

// Staff updates (partial field-level locking for admins)
router.put('/:id', requireAuth, requireAdmin, checkFieldLockBouncer('staff'), StaffController.update);
router.patch('/:id', requireAuth, requireAdmin, checkFieldLockBouncer('staff'), StaffController.update);

// Staff deletion (full lock protection)
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('staff'), StaffController.delete);

export default router;
