import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', CompanyController.list);
router.get('/:id', CompanyController.getById);
router.post('/', requireAdmin, CompanyController.create);
router.put('/:id', requireAdmin, CompanyController.update);
router.patch('/:id/status', requireAdmin, CompanyController.toggleStatus);

export default router;
