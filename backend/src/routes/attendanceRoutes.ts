import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';

const router = Router();

router.get('/', AttendanceController.getAllSheets);
router.get('/:id', AttendanceController.getSheetById);
router.post('/', AttendanceController.createSheet);
router.put('/:id', AttendanceController.updateSheet);
router.delete('/:id', AttendanceController.deleteSheet);

export default router;
