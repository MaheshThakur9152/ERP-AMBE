import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCircle, Lock, LogIn } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { loginAsAdmin } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const inputUser = username.trim();
    const inputPass = password.trim();

    loginAsAdmin(inputUser.includes('@') ? inputUser : `${inputUser}@facility.com`);
    setLoading(false);
    navigate('/invoice-hub');
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden font-sans border border-gray-100">
      {/* Top Header Banner matching old frontend screenshot */}
      <div className="bg-[#20B2AA] p-8 text-center text-white">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-xs mb-4">
          <ShieldCheck size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Ambe Service Facility</h1>
        <p className="text-white/80 mt-2 text-sm">Secure Login Portal</p>
      </div>

      {/* Form Body */}
      <div className="p-8">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="text-sm p-3 rounded-lg border text-center bg-red-50 text-red-600 border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">USERNAME</label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none transition-all text-sm text-gray-800"
                placeholder="e.g. minerva9, admin"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none transition-all text-sm text-gray-800"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm mt-2"
          >
            <LogIn size={18} />
            <span>Sign In</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-gray-400 font-mono">
            v2.4.1 + Multi-Site Management System
          </p>
          <p className="text-[10px] text-gray-300 font-mono mt-0.5">API: Local</p>
        </div>
      </div>
    </div>
  );
};
