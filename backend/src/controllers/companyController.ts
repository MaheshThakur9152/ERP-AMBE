import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/companyService';
import { ApiResponse } from '../types/api';

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await CompanyService.getAllCompanies();
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
      if (
        req.user?.role !== 'superadmin' &&
        req.user?.company_id &&
        req.body.id &&
        req.body.id !== req.user.company_id
      ) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Cannot create profiles for other company entities',
        });
        return;
      }

      const company = await CompanyService.createCompany(req.body);
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

      if (
        req.user?.role !== 'superadmin' &&
        req.user?.company_id &&
        id !== req.user.company_id
      ) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Cannot modify profiles of other company entities',
        });
        return;
      }

      const company = await CompanyService.updateCompany(id, req.body);
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
      const response: ApiResponse = { success: true, data: company };
      res.json(response);
    } catch (err: any) {
      console.error('[CompanyController.toggleStatus] Error:', err);
      next(err);
    }
  }
}
