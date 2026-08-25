import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { requireAuth, requireAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, AttendanceController.getAllSheets);
router.get('/:id', requireAuth, AttendanceController.getSheetById);
router.post('/', requireAuth, requireAdmin, AttendanceController.createSheet);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.updateSheet);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.deleteSheet);

export default router;
