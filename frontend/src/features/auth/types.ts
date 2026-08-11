export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'manager' | 'accountant' | 'employee';
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
