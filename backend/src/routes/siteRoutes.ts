import { Router } from 'express';
import multer from 'multer';
import { SiteController } from '../controllers/siteController';
import { requireAuth, requireAdmin, checkLockBouncer } from '../middlewares/authMiddleware';
import { validateFileMagicBytes } from '../middlewares/fileValidator';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  },
});

const router = Router();

router.get('/', requireAuth, SiteController.list);
router.get('/:id', requireAuth, SiteController.getById);
router.post('/', requireAuth, requireAdmin, SiteController.create);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('sites'), SiteController.update);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('sites'), SiteController.delete);

// Site documents routes
router.get('/:siteId/documents', requireAuth, SiteController.getDocuments);
router.post(
  '/:siteId/documents',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  validateFileMagicBytes,
  SiteController.uploadDocument
);

export default router;
