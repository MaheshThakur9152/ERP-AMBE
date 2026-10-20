import { Router } from 'express';
import multer from 'multer';
import { AttendanceCalculatorController } from '../controllers/attendanceCalculatorController';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (_req, file, cb) => {
    const isExcel =
      file.originalname.match(/\.(xlsx|xls)$/i) ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/octet-stream';

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

router.post('/preview', requireAuth, requireAdmin, upload.single('file'), AttendanceCalculatorController.preview);
router.post('/save', requireAuth, requireAdmin, AttendanceCalculatorController.save);

export default router;
