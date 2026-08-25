import { Router } from 'express';
import { MaterialController } from '../controllers/materialController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, MaterialController.list);
router.post('/', requireAuth, requireAdmin, MaterialController.create);
router.put('/:id', requireAuth, requireAdmin, MaterialController.update);
router.delete('/:id', requireAuth, requireAdmin, MaterialController.delete);

export default router;
