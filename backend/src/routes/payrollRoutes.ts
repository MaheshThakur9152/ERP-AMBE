import { Router } from 'express';
import { PayrollController } from '../controllers/payrollController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, PayrollController.list);
router.post('/calculate', requireAuth, requireAdmin, PayrollController.calculate);
router.post('/records', requireAuth, requireAdmin, PayrollController.upsertRecords);

export default router;
