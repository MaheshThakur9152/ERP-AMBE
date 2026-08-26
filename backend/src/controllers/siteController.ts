import { Request, Response, NextFunction } from 'express';
import { SiteService } from '../services/siteService';
import { ApiResponse } from '../types/api';

export class SiteController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sites = await SiteService.getAllSites(req.user);
      const response: ApiResponse = { success: true, data: sites };
      res.json(response);
    } catch (err: any) {
      console.error('[SiteController.list] Error:', err);
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = await SiteService.getSiteById(id, req.user);
      if (!site) {
        res.status(404).json({ success: false, error: 'Site not found' });
        return;
      }
      const response: ApiResponse = { success: true, data: site };
      res.json(response);
    } catch (err: any) {
      console.error('[SiteController.getById] Error:', err);
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const site = await SiteService.createSite(req.body, req.user);
      const response: ApiResponse = { success: true, data: site };
      res.status(201).json(response);
    } catch (err: any) {
      console.error('[SiteController.create] Error:', err);
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = await SiteService.updateSite(id, req.body, req.user);
      const response: ApiResponse = { success: true, data: site };
      res.json(response);
    } catch (err: any) {
      console.error('[SiteController.update] Error:', err);
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await SiteService.deleteSite(id, req.user);
      const response: ApiResponse = { success: true, message: 'Site deleted successfully', id };
      res.status(200).json(response);
    } catch (err: any) {
      console.error('[SiteController.delete] Error:', err);
      next(err);
    }
  }

  static async getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId, id } = req.params;
      const targetSiteId = siteId || id;
      const docs = await SiteService.getSiteDocuments(targetSiteId, req.user);
      const response: ApiResponse = { success: true, data: docs };
      res.status(200).json(response);
    } catch (err: any) {
      console.error('[SiteController.getDocuments] Error:', err);
      next(err);
    }
  }

  static async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId, id } = req.params;
      const targetSiteId = siteId || id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const documentType = req.body.document_type || req.body.documentType || req.body.doc_type || 'Document';
      const documentLabel = req.body.document_label || req.body.documentLabel || req.body.label;

      const result = await SiteService.uploadSiteDocument(
        targetSiteId,
        file,
        documentType,
        documentLabel,
        req.user
      );

      res.status(201).json(result);
    } catch (err: any) {
      console.error('[SiteController.uploadDocument] Error:', err);
      next(err);
    }
  }
}
