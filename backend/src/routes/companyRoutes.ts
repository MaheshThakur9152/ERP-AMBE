import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';
import { requireAuth, requireAdmin, requireSuperAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', CompanyController.list);
router.get('/:id', CompanyController.getById);
router.post('/', requireAdmin, CompanyController.create);
router.put('/:id', requireAdmin, checkLockBouncer('companies'), CompanyController.update);
router.patch('/:id/status', requireSuperAdmin, CompanyController.toggleStatus);

export default router;
