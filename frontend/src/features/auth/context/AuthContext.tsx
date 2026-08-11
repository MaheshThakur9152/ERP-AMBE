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
    // Check local storage for demo admin session first
    const savedDemoUser = localStorage.getItem(DEMO_USER_KEY);
    if (savedDemoUser) {
      const demoEmail = savedDemoUser || 'admin@facility.com';
      setUser(createAdminUser(demoEmail));
      setProfile(defaultAdminProfile);
      setLoading(false);
      return;
    }

    // Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchUserProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (localStorage.getItem(DEMO_USER_KEY)) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const prof = await fetchUserProfile(session.user.id);
        setProfile(prof);
      } else {
        setProfile(null);
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

