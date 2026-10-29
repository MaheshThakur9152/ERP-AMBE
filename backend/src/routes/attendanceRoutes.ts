import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { GoogleAttendanceSheetController } from '../controllers/googleAttendanceSheetController';
import { requireAuth, requireAdmin, checkLockBouncer } from '../middlewares/authMiddleware';

const router = Router();

// Google Sheets Attendance Integration routes
router.get('/google-sheet/auth', requireAuth, requireAdmin, GoogleAttendanceSheetController.getAuthUrl);
router.get('/google-sheet/callback', GoogleAttendanceSheetController.handleAuthCallback);
router.get('/google-sheet', requireAuth, GoogleAttendanceSheetController.getExistingSheet);
router.post('/google-sheet/sync', requireAuth, requireAdmin, GoogleAttendanceSheetController.syncSheet);

router.get('/records', requireAuth, AttendanceController.getRecords);
router.post('/records', requireAuth, requireAdmin, AttendanceController.upsertRecords);

router.get('/', requireAuth, AttendanceController.getAllSheets);
router.get('/:id', requireAuth, AttendanceController.getSheetById);
router.post('/', requireAuth, requireAdmin, AttendanceController.createSheet);
router.post('/:id/batch', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.batchUpdate);
router.put('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.updateSheet);
router.delete('/:id', requireAuth, requireAdmin, checkLockBouncer('attendance_sheets'), AttendanceController.deleteSheet);

export default router;
