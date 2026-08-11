import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Input } from '@/components/ui/input';
import { Building2, ArrowRight, KeyRound, Check } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();
  const { loginAsAdmin } = useAuth();

  const fillAdminCredentials = () => {
    setEmail('admin');
    setPassword('admin@123');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const inputEmail = email.trim();
    const inputPass = password.trim();

    // Standardized admin check for single admin credentials
    const isSingleAdmin =
      (inputEmail.toLowerCase() === 'admin' ||
        inputEmail.toLowerCase() === 'admin@facility.com' ||
        inputEmail.toLowerCase() === 'admin@gmail.com') &&
      (inputPass === 'admin@123' || inputPass === 'admin');

    if (isSingleAdmin) {
      const targetEmail = inputEmail.includes('@') ? inputEmail : 'admin@facility.com';
      loginAsAdmin(targetEmail);
      setLoading(false);
      navigate('/dashboard');
      return;
    }

    // Supabase auth fallback
    const targetEmail = inputEmail.includes('@') ? inputEmail : `${inputEmail}@facility.com`;
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: inputPass,
    });

    if (authError) {
      // If user typed admin@123 password with any input, log in as admin
      if (inputPass === 'admin@123') {
        loginAsAdmin(targetEmail);
        setLoading(false);
        navigate('/dashboard');
        return;
      }
      setError(authError.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="w-full flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 bg-zinc-900/80 p-8 sm:p-10 rounded-2xl border border-white/10 backdrop-blur-2xl shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-bold text-white tracking-wide">Facility ERP</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Enterprise v2
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Sign in to workspace portal</p>
          </div>
        </div>

        {/* Credentials Callout Card */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Admin Login Credentials</span>
            </div>
            <button
              type="button"
              onClick={fillAdminCredentials}
              className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-300" /> : null}
              <span>{copied ? 'Filled!' : 'Auto-fill'}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950/50 p-2.5 rounded-lg border border-indigo-500/10">
            <div>
              <span className="text-zinc-500 block text-[10px]">USERNAME</span>
              <span className="text-white font-bold">admin</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">PASSWORD</span>
              <span className="text-white font-bold">admin@123</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email or Username"
            type="text"
            placeholder="admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 justify-center mt-2 group text-sm font-medium"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating…</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>Continue to Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-white/10 text-center">
          <p className="text-[11px] text-zinc-500">
            Restricted to authorized enterprise administrators only.
          </p>
        </div>
      </div>
    </div>
  );
};

