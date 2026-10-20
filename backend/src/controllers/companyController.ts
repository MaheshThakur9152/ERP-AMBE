import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/companyService';
import { ApiResponse } from '../types/api';
import { RedisCache } from '../config/redis';

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cacheKey = 'erp:companies:all';
      const cached = await RedisCache.get<any[]>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json({ success: true, data: cached });
        return;
      }

      const companies = await CompanyService.getAllCompanies();
      await RedisCache.set(cacheKey, companies, 300);
      res.setHeader('X-Cache', 'MISS');
      const response: ApiResponse = { success: true, data: companies };
      res.json(response);
    } catch (err: any) {
      console.error('[CompanyController.list] Error:', err);
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await CompanyService.getCompanyById(id);
      if (!company) {
        res.status(404).json({ success: false, error: 'Company profile not found' });
        return;
      }
      const response: ApiResponse = { success: true, data: company };
      res.json(response);
    } catch (err: any) {
      console.error('[CompanyController.getById] Error:', err);
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await CompanyService.createCompany(req.body);
      await RedisCache.del('erp:companies:all');
      const response: ApiResponse = { success: true, data: company };
      res.status(201).json(response);
    } catch (err: any) {
      console.error('[CompanyController.create] Error:', err);
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await CompanyService.updateCompany(id, req.body);
      await RedisCache.del('erp:companies:all');
      const response: ApiResponse = { success: true, data: company };
      res.json(response);
    } catch (err: any) {
      console.error('[CompanyController.update] Error:', err);
      next(err);
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const company = await CompanyService.toggleActiveState(id, Boolean(is_active));
      await RedisCache.del('erp:companies:all');
      const response: ApiResponse = { success: true, data: company };
      res.json(response);
    } catch (err: any) {
      console.error('[CompanyController.toggleStatus] Error:', err);
      next(err);
    }
  }
}
