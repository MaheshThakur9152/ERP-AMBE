import { Request, Response, NextFunction } from 'express';
import { MaterialService } from '../services/materialService';
import { ApiResponse } from '../types/api';

export class MaterialController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const materials = await MaterialService.getAllMaterials();
      const response: ApiResponse = { success: true, data: materials };
      res.json(response);
    } catch (err: any) {
      console.error('[MaterialController.list] Error:', err);
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await MaterialService.createMaterial(req.body);
      const response: ApiResponse = { success: true, data: record };
      res.status(201).json(response);
    } catch (err: any) {
      console.error('[MaterialController.create] Error:', err);
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await MaterialService.updateMaterial(id, req.body);
      const response: ApiResponse = { success: true, data: record };
      res.json(response);
    } catch (err: any) {
      console.error('[MaterialController.update] Error:', err);
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await MaterialService.deleteMaterial(id);
      const response: ApiResponse = { success: true, message: 'Material deleted successfully', id };
      res.json(response);
    } catch (err: any) {
      console.error('[MaterialController.delete] Error:', err);
      next(err);
    }
  }
}
