import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { requireAuth, requireSuperAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Protect all admin routes with SuperAdmin privileges
router.use(requireAuth, requireSuperAdmin);

router.get('/pending-locks', AdminController.getPendingLocks);
router.get('/locked-items', AdminController.getLockedItems);
router.post('/lock-item', AdminController.lockItem);
router.post('/lock-bulk', AdminController.lockBulk);

export default router;
