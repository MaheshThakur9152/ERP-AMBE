import { Router } from 'express';
import multer from 'multer';
import { uploadDocument } from '../controllers/documentController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

const router = Router();

router.post('/upload', upload.single('file'), uploadDocument);

export default router;
