import { Router } from 'express';
import multer from 'multer';
import { LedgerController } from '../controllers/ledgerController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/summary', requireAuth, LedgerController.summary);
router.get('/export', requireAuth, LedgerController.exportAll);
router.get('/sites/:siteId', requireAuth, LedgerController.siteLedger);
router.get('/sites/:siteId/export', requireAuth, LedgerController.exportSite);
router.put('/sites/:siteId/opening', requireAuth, requireAdmin, LedgerController.setOpening);
router.post('/invoices/:invoiceId/payments', requireAuth, requireAdmin, LedgerController.addPayment);
router.patch('/payments/:id', requireAuth, requireAdmin, LedgerController.updatePayment);
router.delete('/payments/:id', requireAuth, requireAdmin, LedgerController.deletePayment);

router.post('/legacy/preview', requireAuth, requireAdmin, upload.single('file'), LedgerController.legacyPreview);
router.post('/legacy/import', requireAuth, requireAdmin, upload.single('file'), LedgerController.legacyImport);
router.get('/sites/:siteId/legacy', requireAuth, LedgerController.legacyRows);
router.post('/legacy/rows/:rowId/payments', requireAuth, requireAdmin, LedgerController.legacyAddPayment);
router.delete('/legacy/payments/:id', requireAuth, requireAdmin, LedgerController.legacyDeletePayment);

export default router;
