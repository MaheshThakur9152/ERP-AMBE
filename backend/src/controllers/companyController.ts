import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/companyService';

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await CompanyService.getAllCompanies();
      res.json({ success: true, data: companies });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await CompanyService.getCompanyById(id);
      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await CompanyService.createCompany(req.body);
      res.status(201).json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await CompanyService.updateCompany(id, req.body);
      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const company = await CompanyService.toggleActiveState(id, Boolean(is_active));
      res.json({ success: true, data: company });
    } catch (err) {
      next(err);
    }
  }
}
