import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '../types';
import { loginApi, logoutApi, fetchMeApi, fetchUserProfile } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  role: UserRole;
  isSuperAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loginAsAdmin: (customEmail?: string, customRole?: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_KEY = 'facility_erp_demo_user';
const ROLE_STORAGE_KEY = 'facility_erp_user_role';

const createMockUser = (email = 'ambe@ambe.local', role: UserRole = 'admin'): User => ({
  id: 'user-001-demo',
  app_metadata: { provider: 'email', role },
  user_metadata: { full_name: email.split('@')[0], role },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email,
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
});

const createMockProfile = (email = 'ambe@ambe.local', role: UserRole = 'admin'): UserProfile => ({
  id: 'user-001-demo',
  email,
  full_name: email.split('@')[0],
  role,
  phone: null,
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem(ROLE_STORAGE_KEY) as UserRole) || 'admin';
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Try backend HTTP-only cookie session check first (/api/auth/me)
        const meData = await fetchMeApi();
        if (meData?.user) {
          const backendUser = meData.user;
          const userObj = createMockUser(backendUser.email, backendUser.role);
          setUser(userObj);
          setRole(backendUser.role);
          localStorage.setItem(ROLE_STORAGE_KEY, backendUser.role);
          setProfile(createMockProfile(backendUser.email, backendUser.role));
          return;
        }

        // 2. Check explicitly saved user session in local storage
        const savedDemoUser = localStorage.getItem(DEMO_USER_KEY);
        const savedRole = (localStorage.getItem(ROLE_STORAGE_KEY) as UserRole) || 'admin';

        if (savedDemoUser) {
          setUser(createMockUser(savedDemoUser, savedRole));
          setRole(savedRole);
          setProfile(createMockProfile(savedDemoUser, savedRole));
          return;
        }

        // 3. Fallback to Supabase JS Client session
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          try {
            const prof = await fetchUserProfile(data.session.user.id);
            if (prof) {
              setProfile(prof);
              setRole(prof.role);
              localStorage.setItem(ROLE_STORAGE_KEY, prof.role);
            }
          } catch {
            setProfile(createMockProfile(data.session.user.email || 'ambe@ambe.local', 'admin'));
          }
          return;
        }

        // 4. No active session -> unauthenticated (redirect to /login via ProtectedRoute)
        setUser(null);
        setProfile(null);
        setSession(null);
      } catch (err) {
        setUser(null);
        setProfile(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      const authenticatedRole = res.user.role;

      localStorage.setItem(DEMO_USER_KEY, res.user.email);
      localStorage.setItem(ROLE_STORAGE_KEY, authenticatedRole);

      setRole(authenticatedRole);
      setUser(createMockUser(res.user.email, authenticatedRole));
      setProfile(createMockProfile(res.user.email, authenticatedRole));
    } catch (err: any) {
      console.error('Login failed:', err?.message || err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsAdmin = (customEmail?: string, customRole: UserRole = 'admin') => {
    const email = customEmail || 'ambe@ambe.local';
    localStorage.setItem(DEMO_USER_KEY, email);
    localStorage.setItem(ROLE_STORAGE_KEY, customRole);
    setRole(customRole);
    setUser(createMockUser(email, customRole));
    setProfile(createMockProfile(email, customRole));
  };

  const signOut = async () => {
    localStorage.removeItem(DEMO_USER_KEY);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    setUser(null);
    setProfile(null);
    setSession(null);
    setRole('admin');
    await logoutApi().catch(() => {});
    await supabase.auth.signOut().catch(() => {});
  };

  const isSuperAdmin = role === 'superadmin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        role,
        isSuperAdmin,
        loading,
        login,
        signOut,
        loginAsAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
