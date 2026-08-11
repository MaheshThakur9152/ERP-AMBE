import { Router } from 'express';
import companyRoutes from './companyRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/companies', companyRoutes);

export default router;
