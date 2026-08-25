import { Request } from 'express';

export interface AuthUser {
  id: string;
  email?: string;
  role: 'admin' | 'superadmin';
  company_id?: string;
  companyId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
