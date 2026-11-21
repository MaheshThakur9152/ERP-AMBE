import { Router } from 'express';
import { LedgerController } from '../controllers/ledgerController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/summary', requireAuth, LedgerController.summary);
router.get('/export', requireAuth, LedgerController.exportAll);
router.get('/sites/:siteId', requireAuth, LedgerController.siteLedger);
router.get('/sites/:siteId/export', requireAuth, LedgerController.exportSite);
router.put('/sites/:siteId/opening', requireAuth, requireAdmin, LedgerController.setOpening);
router.post('/invoices/:invoiceId/payments', requireAuth, requireAdmin, LedgerController.addPayment);
router.patch('/payments/:id', requireAuth, requireAdmin, LedgerController.updatePayment);
router.delete('/payments/:id', requireAuth, requireAdmin, LedgerController.deletePayment);

export default router;
