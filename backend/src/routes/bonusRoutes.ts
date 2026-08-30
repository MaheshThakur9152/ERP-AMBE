import { Router } from 'express';
import { BonusController } from '../controllers/bonusController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// GET statutory bonus reconciliation summary for site + FY
router.get('/summary', requireAuth, BonusController.getSummary);

// POST record a bonus disbursement
router.post('/disburse', requireAuth, BonusController.recordDisbursement);

// GET disbursement history for a staff member
router.get('/history/:staffId', requireAuth, BonusController.getHistory);

export default router;
