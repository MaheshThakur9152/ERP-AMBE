import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.post('/role', requireAuth, AuthController.updateRole);
router.patch('/role', requireAuth, AuthController.updateRole);

export default router;
