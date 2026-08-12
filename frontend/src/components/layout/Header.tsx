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
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="font-bold text-[#34495E]">ERP</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-800 font-semibold">Facility Management</span>
      </div>

      {/* Right: user controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full shadow-sm">
          <div className="w-5 h-5 rounded-full bg-[#20B2AA] text-white flex items-center justify-center text-[10px] font-bold">
            {initials}
          </div>
          <span className="text-xs text-gray-800 font-semibold hidden sm:block">
            {profile?.full_name || user?.email}
          </span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={signOut}
          className="text-xs font-semibold text-gray-600 hover:text-red-600 flex items-center gap-1 px-2 py-1 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
};
