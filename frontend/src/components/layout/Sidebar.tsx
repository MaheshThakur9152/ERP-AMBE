import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ChevronDown,
  Users,
  MapPin,
  Camera,
  BookOpen,
  ShieldCheck,
  Phone,
  Sparkles,
  LogOut,
  FileSpreadsheet,
  Package,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

export const Sidebar: React.FC = () => {
  const { signOut } = useAuth();
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [officeEmployeeExpanded, setOfficeEmployeeExpanded] = useState(true);

  return (
    <aside className="w-72 bg-[#34495E] text-white flex flex-col h-screen sticky top-0 shadow-2xl z-40 select-none flex-shrink-0">
      {/* Sidebar Header Brand */}
      <div className="p-6 border-b border-gray-600 bg-[#34495E]/50 flex items-center gap-3">
        <div className="bg-[#20B2AA] p-2 rounded-lg text-white shadow-md">
          <LayoutDashboard size={20} />
        </div>
        <div>
          <h1 className="font-bold text-base text-white leading-tight">Ambe Admin (v2.3.1)</h1>
          <span className="text-[10px] text-teal-300 font-mono">Enterprise Portal</span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto sidebar-nav text-sm">
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
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Tax Invoices
              </NavLink>

              <NavLink
                to="/smart-generator"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Proforma Invoices
              </NavLink>

              <NavLink
                to="/invoice-vault"
                className={({ isActive }) =>
                  `w-full flex gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#20B2AA] text-white shadow-md'
                      : 'hover:bg-white/5 text-gray-300'
                  }`
                }
              >
                Invoice Vault
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

        {/* Photos */}
        <NavLink
          to="/photos"
          className={({ isActive }) =>
            `w-full flex gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/5 text-gray-200'
            }`
          }
        >
          <Camera size={18} /> <span>Photos</span>
        </NavLink>

        {/* Device History */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-full flex gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/5 text-gray-200'
            }`
          }
        >
          <Phone size={18} /> <span>Device History</span>
        </NavLink>
      </nav>

      {/* Footer Sign Out */}
      <div className="p-4 border-t border-gray-600">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 text-red-300 hover:text-white w-full px-4 py-2 rounded-lg hover:bg-white/5 transition-colors font-medium text-sm"
        >
          <LogOut size={16} /> <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
