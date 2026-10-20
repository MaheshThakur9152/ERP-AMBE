import React, { createContext, useContext, useEffect, useState } from 'react';
export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  aud?: string;
  created_at?: string;
  updated_at?: string;
  phone?: string;
  role?: string;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  user: User;
}
import { setInMemoryToken } from '@/lib/apiClient';
import { UserProfile, UserRole } from '../types';
import { loginApi, logoutApi, refreshTokenApi, fetchMeApi, fetchUserProfile } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  role: UserRole;
  isSuperAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Attempt silent refresh via HTTP-only rotating refresh token cookie
        const refreshData = await refreshTokenApi();
        if (refreshData?.user) {
          const backendUser = refreshData.user;
          const userObj: User = {
            id: backendUser.id,
            app_metadata: { provider: 'email', role: backendUser.role },
            user_metadata: { email: backendUser.email, role: backendUser.role },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: backendUser.email,
            phone: '',
            role: 'authenticated',
            updated_at: new Date().toISOString(),
          };
          setUser(userObj);
          setRole(backendUser.role);
          setProfile({
            id: backendUser.id,
            email: backendUser.email,
            full_name: backendUser.email.split('@')[0],
            role: backendUser.role,
            phone: null,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return;
        }

        // 2. Fallback check for active session (/api/auth/me)
        const meData = await fetchMeApi();
        if (meData?.user) {
          const backendUser = meData.user;
          const userObj: User = {
            id: backendUser.id,
            app_metadata: { provider: 'email', role: backendUser.role },
            user_metadata: { email: backendUser.email, role: backendUser.role },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: backendUser.email,
            phone: '',
            role: 'authenticated',
            updated_at: new Date().toISOString(),
          };
          setUser(userObj);
          setRole(backendUser.role);
          setProfile({
            id: backendUser.id,
            email: backendUser.email,
            full_name: backendUser.email.split('@')[0],
            role: backendUser.role,
            phone: null,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return;
        }

        // 3. No active credentials -> unauthenticated
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

    // Listen for genuine session expiry event from apiClient 401 interceptor
    // Preserves sessionStorage form drafts so unsaved work isn't lost
    const handleSessionExpired = () => {
      console.warn('[AuthContext] Session expired event received. Transitioning to unauthenticated state.');
      setUser(null);
      setProfile(null);
      setSession(null);
      setInMemoryToken(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      const authenticatedRole = res.user.role;
      const authenticatedUser: User = {
        id: res.user.id,
        app_metadata: { provider: 'email', role: authenticatedRole },
        user_metadata: { email: res.user.email, role: authenticatedRole },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: res.user.email,
        phone: '',
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      };

      setRole(authenticatedRole);
      setUser(authenticatedUser);
      setProfile({
        id: res.user.id,
        email: res.user.email,
        full_name: res.user.email.split('@')[0],
        role: authenticatedRole,
        phone: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Login failed:', err?.message || err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    setSession(null);
    setRole('admin');
    setInMemoryToken(null);
    await logoutApi().catch(() => {});
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
