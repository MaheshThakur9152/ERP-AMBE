import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth, requireSuperAdmin } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.patch('/role', requireAuth, requireSuperAdmin, AuthController.updateRole);
router.post('/invite-user', requireAuth, requireSuperAdmin, AuthController.inviteUser);
router.post('/set-initial-password', authLimiter, AuthController.setInitialPassword);
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.post('/reset-password', authLimiter, AuthController.resetPassword);

export default router;


