import { Request, Response, NextFunction } from 'express';
import { MaterialService } from '../services/materialService';

export class MaterialController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const materials = await MaterialService.getAllMaterials();
      res.json({ success: true, data: materials });
    } catch (err: any) {
      console.error('[MaterialController.list] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch materials' });
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await MaterialService.createMaterial(req.body);
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      console.error('[MaterialController.create] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create material' });
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await MaterialService.updateMaterial(id, req.body);
      res.json({ success: true, data: record });
    } catch (err: any) {
      console.error('[MaterialController.update] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to update material' });
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await MaterialService.deleteMaterial(id);
      res.json({ success: true, message: 'Material deleted successfully', id });
    } catch (err: any) {
      console.error('[MaterialController.delete] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to delete material' });
    }
  }
}
