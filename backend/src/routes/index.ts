import { Router } from 'express';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import companyRoutes from './companyRoutes';
import excelRoutes from './excelRoutes';
import invoiceRoutes from './invoiceRoutes';
import siteRoutes from './siteRoutes';
import materialRoutes from './materialRoutes';
import documentRoutes from './documentRoutes';
import attendanceRoutes from './attendanceRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/companies', companyRoutes);
router.use('/excel', excelRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/sites', siteRoutes);
router.use('/materials', materialRoutes);
router.use('/documents', documentRoutes);
router.use('/attendance', attendanceRoutes);

export default router;


