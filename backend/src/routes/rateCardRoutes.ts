import { Router } from 'express';
import { RateCardController } from '../controllers/rateCardController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, RateCardController.list);
router.get('/:id', requireAuth, RateCardController.getById);
router.post('/', requireAuth, requireAdmin, RateCardController.create);
router.put('/:id', requireAuth, requireAdmin, RateCardController.update);
router.delete('/:id', requireAuth, requireAdmin, RateCardController.delete);

export default router;
