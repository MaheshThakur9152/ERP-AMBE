import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth, requireSuperAdmin } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.patch('/role', requireAuth, requireSuperAdmin, AuthController.updateRole);

export default router;

