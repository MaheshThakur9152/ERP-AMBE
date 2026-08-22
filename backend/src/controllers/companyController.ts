import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/companyService';

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await CompanyService.getAllCompanies();
      res.json({ success: true, data: companies });
    } catch (err: any) {
      console.error('[CompanyController.list] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch companies' });
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
      res.json({ success: true, data: company });
    } catch (err: any) {
      console.error('[CompanyController.getById] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch company profile' });
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await CompanyService.createCompany(req.body);
      res.status(201).json({ success: true, data: company });
    } catch (err: any) {
      console.error('[CompanyController.create] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create company profile' });
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = await CompanyService.getCompanyById(id);
      if (existing && (existing as any).is_locked) {
        const userRole = (req as any).user?.role || (req as any).auth?.role;
        if (userRole !== 'SuperAdmin') {
          res.status(403).json({
            success: false,
            error: 'This company profile entity is locked by SuperAdmin and cannot be modified.',
          });
          return;
        }
      }
      const company = await CompanyService.updateCompany(id, req.body);
      res.json({ success: true, data: company });
    } catch (err: any) {
      console.error('[CompanyController.update] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to update company profile' });
    }
  }

  static async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const company = await CompanyService.toggleActiveState(id, Boolean(is_active));
      res.json({ success: true, data: company });
    } catch (err: any) {
      console.error('[CompanyController.toggleStatus] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to toggle company status' });
    }
  }
}
