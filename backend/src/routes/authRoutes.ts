import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

export default router;
