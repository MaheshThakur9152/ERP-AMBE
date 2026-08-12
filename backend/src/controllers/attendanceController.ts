import { Request, Response } from 'express';
import { AttendanceService } from '../services/attendanceService';

export class AttendanceController {
  static async getAllSheets(req: Request, res: Response): Promise<void> {
    try {
      const siteId = req.query.siteId as string | undefined;
      const month = req.query.month as string | undefined;
      const year = req.query.year as string | undefined;

      const sheets = await AttendanceService.getAllSheets(siteId, month, year);
      res.json({ success: true, data: sheets });
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheets:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSheetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.getSheetById(id);
      if (!sheet) {
        res.status(404).json({ success: false, message: 'Attendance sheet not found' });
        return;
      }
      res.json({ success: true, data: sheet });
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheet:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createSheet(req: Request, res: Response): Promise<void> {
    try {
      const sheet = await AttendanceService.createSheet(req.body);
      res.status(201).json({ success: true, data: sheet });
    } catch (error: any) {
      console.error('❌ Controller error creating attendance sheet:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateSheet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.updateSheet(id, req.body);
      res.json({ success: true, data: sheet });
    } catch (error: any) {
      console.error('❌ Controller error updating attendance sheet:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteSheet(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await AttendanceService.deleteSheet(id);
      res.json({ success: true, message: 'Attendance sheet deleted successfully' });
    } catch (error: any) {
      console.error('❌ Controller error deleting attendance sheet:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
