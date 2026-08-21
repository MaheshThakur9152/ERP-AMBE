export type UserRole = 'admin' | 'superadmin' | 'manager' | 'accountant' | 'employee';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
