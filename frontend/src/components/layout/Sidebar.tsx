import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ChevronDown,
  Users,
  MapPin,
  Building2,
  Wallet,
  Kanban,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

export const Sidebar: React.FC = () => {
  const { signOut, isSuperAdmin, role, user, switchRole } = useAuth();
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [officeEmployeeExpanded, setOfficeEmployeeExpanded] = useState(true);

  const roleLabel = isSuperAdmin ? 'SUPERADMIN' : 'ADMIN';
  const displayEmail = user?.email || (isSuperAdmin ? 'superadmin@facility.com' : 'admin@facility.com');

  const handleToggleRole = async () => {
    if (isSwitchingRole) return;
    setIsSwitchingRole(true);
    try {
      const nextRole = isSuperAdmin ? 'admin' : 'superadmin';
      await switchRole(nextRole);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  return (
    <aside className="w-72 bg-[#34495E] text-white flex flex-col h-screen sticky top-0 shadow-2xl z-40 select-none flex-shrink-0">
      {/* Sidebar Header Brand & Role Badge */}
      <div className="p-5 border-b border-gray-600 bg-[#2C3E50] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#20B2AA] p-2 rounded-xl text-white shadow-md">
            <LayoutDashboard size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base text-white leading-tight truncate">Ambe Admin (v2.3.1)</h1>
            <span className="text-[10px] text-teal-300 font-mono">Enterprise Portal</span>
          </div>
        </div>

        {/* Clear Role Badge Indicator (Interactive Toggle with DB Persistence) */}
        <div className="flex items-center justify-between bg-black/25 px-3 py-1.5 rounded-lg border border-white/10 mt-1">
          <span className="text-[10px] font-mono text-gray-300 font-medium">Role (click to switch):</span>
          <button
            type="button"
            onClick={handleToggleRole}
            disabled={isSwitchingRole}
            title="Click to toggle Admin / SuperAdmin role (persists to database)"
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isSuperAdmin ? (
              <span className="text-[10px] font-extrabold font-mono tracking-wider px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs flex items-center gap-1 border border-indigo-400/30">
                <ShieldAlert size={11} />
                <span>{isSwitchingRole ? 'SAVING...' : 'SUPERADMIN'}</span>
              </span>
            ) : (
              <span className="text-[10px] font-extrabold font-mono tracking-wider px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white shadow-xs flex items-center gap-1 border border-teal-400/30">
                <ShieldCheck size={11} />
                <span>{isSwitchingRole ? 'SAVING...' : 'ADMIN'}</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto sidebar-nav text-sm">
        {/* Security Center (MOVED TO TOP FOR SUPERADMIN) */}
        {isSuperAdmin && (
          <div className="pb-2 border-b border-gray-600/60 mb-2">
            <NavLink
              to="/security-center"
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-lg ring-2 ring-teal-400/40'
                    : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30'
                }`
              }
            >
              <div className="flex gap-3 items-center">
                <ShieldCheck size={19} className="text-teal-300" />
                <span className="tracking-wide">Security Center</span>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-teal-400/20 text-teal-200 px-2 py-0.5 rounded-full border border-teal-300/30 font-mono">
                LOCK
              </span>
            </NavLink>
          </div>
        )}

        {/* Invoices Group */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setInvoicesExpanded(!invoicesExpanded)}
            className="w-full flex justify-between items-center px-4 py-3 rounded-lg hover:bg-white/5 text-left text-gray-200 font-medium transition-colors"
          >
            <div className="flex gap-3 items-center">
              <FileText size={18} /> <span>Invoices</span>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${invoicesExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {invoicesExpanded && (
            <div className="pl-4 space-y-1 bg-black/10 py-2 rounded-lg">
              <NavLink
                to="/invoice-hub"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors items-center ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                <FileText size={14} /> <span>Invoice Hub</span>
              </NavLink>

              <NavLink
                to="/invoice-tracker"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors items-center ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                <Kanban size={14} /> <span>Invoice Tracker</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Office Employee Group */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setOfficeEmployeeExpanded(!officeEmployeeExpanded)}
            className="w-full flex justify-between items-center px-4 py-3 rounded-lg hover:bg-white/5 text-left text-gray-200 font-medium transition-colors"
          >
            <div className="flex gap-3 items-center">
              <Users size={18} /> <span>Office Employee</span>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${officeEmployeeExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {officeEmployeeExpanded && (
            <div className="pl-4 space-y-1 bg-black/10 py-2 rounded-lg">
              <NavLink
                to="/employees"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Staff
              </NavLink>
              <NavLink
                to="/attendance"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Attendance
              </NavLink>
              <NavLink
                to="/payroll"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Payroll
              </NavLink>
              <NavLink
                to="/payslips"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Payslips
              </NavLink>
              <NavLink
                to="/advances"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors items-center ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                <Wallet size={14} /> <span>Advances</span>
              </NavLink>
              <NavLink
                to="/deployments"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Deployments
              </NavLink>
            </div>
          )}
        </div>

        {/* Sites */}
        <NavLink
          to="/sites"
          className={({ isActive }) =>
            `w-full flex gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/5 text-gray-200'
            }`
          }
        >
          <MapPin size={18} /> <span>Sites</span>
        </NavLink>

        {/* Entities */}
        <NavLink
          to="/entities"
          className={({ isActive }) =>
            `w-full flex gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/5 text-gray-200'
            }`
          }
        >
          <Building2 size={18} /> <span>Entities</span>
        </NavLink>
      </nav>

      {/* Footer User Info & Sign Out */}
      <div className="p-4 border-t border-gray-600/80 bg-[#2C3E50]/60 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-teal-300 shrink-0 border border-white/10">
            <User size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{displayEmail}</p>
            <p className="text-[10px] text-gray-300 font-mono tracking-wider">ROLE: {roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 text-red-300 hover:text-white w-full px-3 py-2 rounded-lg hover:bg-red-500/20 transition-colors font-semibold text-xs border border-red-500/20 mt-1"
        >
          <LogOut size={15} /> <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
