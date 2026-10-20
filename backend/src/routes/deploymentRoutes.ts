import { Router } from 'express';
import { DeploymentController } from '../controllers/deploymentController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, DeploymentController.list);
router.post('/upsert', requireAuth, requireAdmin, DeploymentController.upsert);
router.delete('/', requireAuth, requireAdmin, DeploymentController.remove);

export default router;
