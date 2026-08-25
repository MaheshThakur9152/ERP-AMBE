import { Router } from 'express';
import { SiteController } from '../controllers/siteController';
import { requireAuth, requireAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, SiteController.list);
router.get('/:id', requireAuth, SiteController.getById);
router.post('/', requireAuth, requireAdmin, SiteController.create);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('sites'), SiteController.update);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('sites'), SiteController.delete);

export default router;
