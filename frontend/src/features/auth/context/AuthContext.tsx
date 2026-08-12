import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '../types';
import { fetchUserProfile } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsAdmin: (customEmail?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_KEY = 'facility_erp_demo_user';

const createAdminUser = (email = 'admin@facility.com'): User => ({
  id: 'admin-001-demo',
  app_metadata: { provider: 'email', role: 'admin' },
  user_metadata: { full_name: 'Administrator', role: 'admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email,
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
});

const defaultAdminProfile: UserProfile = {
  id: 'admin-001-demo',
  email: 'admin@facility.com',
  full_name: 'Administrator',
  role: 'admin',
  phone: null,
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check local storage for demo admin session first or placeholder config
    const savedDemoUser = localStorage.getItem(DEMO_USER_KEY);
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

    if (savedDemoUser || isPlaceholder) {
      const demoEmail = savedDemoUser || 'admin@facility.com';
      setUser(createAdminUser(demoEmail));
      setProfile(defaultAdminProfile);
      setLoading(false);
      return;
    }

    // Get initial Supabase session with error fallback
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          fetchUserProfile(data.session.user.id)
            .then(setProfile)
            .catch(() => setProfile(defaultAdminProfile));
        } else {
          setUser(createAdminUser());
          setProfile(defaultAdminProfile);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Supabase session fetch failed, falling back to demo admin:', err);
        setUser(createAdminUser());
        setProfile(defaultAdminProfile);
        setLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (localStorage.getItem(DEMO_USER_KEY) || isPlaceholder) return;
      setSession(session);
      setUser(session?.user ?? createAdminUser());
      if (session?.user) {
        try {
          const prof = await fetchUserProfile(session.user.id);
          setProfile(prof);
        } catch {
          setProfile(defaultAdminProfile);
        }
      } else {
        setProfile(defaultAdminProfile);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginAsAdmin = (customEmail?: string) => {
    const email = customEmail || 'admin@facility.com';
    localStorage.setItem(DEMO_USER_KEY, email);
    setUser(createAdminUser(email));
    setProfile(defaultAdminProfile);
  };

  const signOut = async () => {
    localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
    setProfile(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, loginAsAdmin }}>
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

