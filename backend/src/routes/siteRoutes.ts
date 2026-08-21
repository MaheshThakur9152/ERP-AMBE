import { Router } from 'express';
import { SiteController } from '../controllers/siteController';
import { requireAuth, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', SiteController.list);
router.get('/:id', SiteController.getById);
router.post('/', requireAuth, SiteController.create);
router.put('/:id', requireAuth, checkLockBouncer('sites'), SiteController.update);
router.delete('/:id', requireAuth, checkLockBouncer('sites'), SiteController.delete);

export default router;
