import { Request, Response, NextFunction } from 'express';
import { SiteService } from '../services/siteService';

export class SiteController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sites = await SiteService.getAllSites();
      res.json({ success: true, data: sites });
    } catch (err: any) {
      console.error('[SiteController.list] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch sites' });
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = await SiteService.getSiteById(id);
      if (!site) {
        res.status(404).json({ success: false, error: 'Site not found' });
        return;
      }
      res.json({ success: true, data: site });
    } catch (err: any) {
      console.error('[SiteController.getById] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch site' });
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const site = await SiteService.createSite(req.body);
      res.status(201).json({ success: true, data: site });
    } catch (err: any) {
      console.error('[SiteController.create] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create site' });
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = await SiteService.updateSite(id, req.body);
      res.json({ success: true, data: site });
    } catch (err: any) {
      console.error('[SiteController.update] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to update site' });
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await SiteService.deleteSite(id);
      res.status(200).json({ success: true, message: 'Site deleted successfully', id });
    } catch (err: any) {
      console.error('[SiteController.delete] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to delete site' });
    }
  }
}
