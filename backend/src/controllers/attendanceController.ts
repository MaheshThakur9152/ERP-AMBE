import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendanceService';
import { ApiResponse } from '../types/api';

export class AttendanceController {
  static async getAllSheets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const siteId = req.query.siteId as string | undefined;
      const month = req.query.month as string | undefined;
      const year = req.query.year as string | undefined;

      const sheets = await AttendanceService.getAllSheets(siteId, month, year, req.user);
      const response: ApiResponse = { success: true, data: sheets };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheets:', error.message);
      next(error);
    }
  }

  static async getSheetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.getSheetById(id, req.user);
      if (!sheet) {
        res.status(404).json({ success: false, error: 'Attendance sheet not found' });
        return;
      }
      const response: ApiResponse = { success: true, data: sheet };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error fetching attendance sheet:', error.message);
      next(error);
    }
  }

  static async createSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sheet = await AttendanceService.createSheet(req.body, req.user);
      const response: ApiResponse = { success: true, data: sheet };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('❌ Controller error creating attendance sheet:', error.message);
      next(error);
    }
  }

  static async updateSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const sheet = await AttendanceService.updateSheet(id, req.body, req.user);
      const response: ApiResponse = { success: true, data: sheet };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error updating attendance sheet:', error.message);
      next(error);
    }
  }

  static async deleteSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await AttendanceService.deleteSheet(id, req.user);
      const response: ApiResponse = { success: true, message: 'Attendance sheet deleted successfully' };
      res.json(response);
    } catch (error: any) {
      console.error('❌ Controller error deleting attendance sheet:', error.message);
      next(error);
    }
  }
}
