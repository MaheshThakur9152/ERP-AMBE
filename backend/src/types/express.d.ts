import { Request } from 'express';

export interface AuthUser {
  id: string;
  email?: string;
  role: 'admin' | 'superadmin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
