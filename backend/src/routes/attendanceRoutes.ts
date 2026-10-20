import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { requireAuth, requireAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

router.get('/records', requireAuth, AttendanceController.getRecords);
router.post('/records', requireAuth, requireAdmin, AttendanceController.upsertRecords);

router.get('/', requireAuth, AttendanceController.getAllSheets);
router.get('/:id', requireAuth, AttendanceController.getSheetById);
router.post('/', requireAuth, requireAdmin, AttendanceController.createSheet);
router.post('/:id/batch', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.batchUpdate);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.updateSheet);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.deleteSheet);

export default router;
