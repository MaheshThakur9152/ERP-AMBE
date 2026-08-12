import { Router } from 'express';
import companyRoutes from './companyRoutes';
import excelRoutes from './excelRoutes';
import invoiceRoutes from './invoiceRoutes';
import siteRoutes from './siteRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/companies', companyRoutes);
router.use('/excel', excelRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/sites', siteRoutes);

export default router;


