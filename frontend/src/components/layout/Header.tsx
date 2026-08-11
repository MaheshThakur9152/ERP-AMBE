import React from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { LogOut, ChevronRight } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="topbar">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="font-semibold text-zinc-300">ERP</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-zinc-100 font-medium">Facility Management</span>
      </div>

      {/* Right: user controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
            {initials}
          </div>
          <span className="text-xs text-zinc-200 font-medium hidden sm:block">
            {profile?.full_name || user?.email}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={signOut}
          className="btn-ghost text-zinc-400 hover:text-zinc-100 text-xs px-2 py-1"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
};
