import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { requireAuth, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', AttendanceController.getAllSheets);
router.get('/:id', AttendanceController.getSheetById);
router.post('/', requireAuth, AttendanceController.createSheet);
router.put('/:id', requireAuth, checkLockBouncer('attendance_sheets'), AttendanceController.updateSheet);
router.delete('/:id', requireAuth, checkLockBouncer('attendance_sheets'), AttendanceController.deleteSheet);

export default router;
