declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: 'admin' | 'manager' | 'accountant' | 'employee';
    };
  }
}
