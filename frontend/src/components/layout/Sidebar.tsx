import React, { useState, useEffect } from 'react';
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
  FolderArchive,
  Gift,
  CalendarCheck,
  Calculator,
  CreditCard,
  FileSpreadsheet,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

export const Sidebar: React.FC = () => {
  const { signOut, isSuperAdmin, user } = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [officeEmployeeExpanded, setOfficeEmployeeExpanded] = useState(true);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Failed to save sidebar state to localStorage:', e);
      }
      return next;
    });
  };

  const roleLabel = isSuperAdmin ? 'SUPERADMIN' : 'ADMIN';
  const displayEmail = user?.email || (isSuperAdmin ? 'superadmin@facility.com' : 'admin@facility.com');

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64 lg:w-72'
      } bg-[#34495E] text-white flex flex-col h-screen sticky top-0 shadow-2xl z-40 select-none flex-shrink-0 transition-all duration-200 ease-in-out`}
    >
      {/* Sidebar Header */}
      <div className={`border-b border-gray-600 bg-[#2C3E50] flex flex-col gap-2.5 flex-shrink-0 ${collapsed ? 'p-2.5 items-center' : 'p-3.5'}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapse}
            className="w-10 h-10 rounded-xl bg-[#20B2AA] hover:bg-[#1ca19a] text-white shadow-md flex items-center justify-center transition-all cursor-pointer group shrink-0"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between min-h-[40px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-[#20B2AA] p-2 rounded-xl text-white shadow-md shrink-0">
                  <LayoutDashboard size={20} />
                </div>
                <div className="flex-1 min-w-0 animate-in fade-in duration-150">
                  <h1 className="font-bold text-sm text-white leading-tight truncate">Ambe Admin</h1>
                  <span className="text-[10px] text-teal-300 font-mono">Enterprise Portal</span>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Role Badge Indicator */}
            <div className="flex items-center justify-between bg-black/25 px-2.5 py-1 rounded-lg border border-white/10 animate-in fade-in duration-150">
              <span className="text-[10px] font-mono text-gray-300 font-medium">Role:</span>
              {isSuperAdmin ? (
                <span className="text-[10px] font-extrabold font-mono tracking-wider px-2 py-0.5 rounded bg-indigo-600 text-white shadow-xs flex items-center gap-1 border border-indigo-400/30">
                  <ShieldAlert size={11} />
                  <span>SUPERADMIN</span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold font-mono tracking-wider px-2 py-0.5 rounded bg-teal-600 text-white shadow-xs flex items-center gap-1 border border-teal-400/30">
                  <ShieldCheck size={11} />
                  <span>ADMIN</span>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden sidebar-nav text-sm">
        {/* Security Center (SuperAdmin only) */}
        {isSuperAdmin && (
          <div className="pb-1.5 border-b border-gray-600/60 mb-1.5">
            <NavLink
              to="/security-center"
              title="Security Center"
              className={({ isActive }) =>
                `w-full flex items-center ${
                  collapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl font-bold transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-lg ring-2 ring-teal-400/40'
                    : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30'
                }`
              }
            >
              <div className="flex gap-3 items-center">
                <ShieldCheck size={18} className="text-teal-300 shrink-0" />
                {!collapsed && <span className="tracking-wide text-xs">Security Center</span>}
              </div>
              {!collapsed && (
                <span className="text-[9px] font-extrabold uppercase bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded border border-teal-300/30 font-mono">
                  LOCK
                </span>
              )}
            </NavLink>
          </div>
        )}

        {/* Invoices Group */}
        {collapsed ? (
          // Collapsed: Flat list of invoice items with tooltips
          <>
            <NavLink
              to="/invoice-hub"
              title="Invoice Hub"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <FileText size={18} />
            </NavLink>
            <NavLink
              to="/invoice-tracker"
              title="Invoice Tracker"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Kanban size={18} />
            </NavLink>
          </>
        ) : (
          // Expanded: Collapsible Accordion
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setInvoicesExpanded(!invoicesExpanded)}
              className="w-full flex justify-between items-center px-3.5 py-2.5 rounded-lg hover:bg-white/5 text-left text-gray-200 font-medium transition-colors cursor-pointer"
            >
              <div className="flex gap-3 items-center">
                <FileText size={18} className="shrink-0" /> <span className="text-xs font-semibold">Invoices</span>
              </div>
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 text-gray-400 ${invoicesExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {invoicesExpanded && (
              <div className="pl-3 space-y-1 bg-black/10 py-1.5 rounded-lg">
                <NavLink
                  to="/invoice-hub"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <FileText size={14} className="shrink-0" /> <span>Invoice Hub</span>
                </NavLink>

                <NavLink
                  to="/invoice-tracker"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Kanban size={14} className="shrink-0" /> <span>Invoice Tracker</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Office Employee Group */}
        {collapsed ? (
          // Collapsed: Flat list of office employee links
          <>
            <NavLink
              to="/employees"
              title="Staff"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Users size={18} />
            </NavLink>
            <NavLink
              to="/attendance"
              title="Attendance"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <CalendarCheck size={18} />
            </NavLink>
            <NavLink
              to="/attendance-calculator"
              title="Attendance Calculator"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Calculator size={18} />
            </NavLink>
            <NavLink
              to="/payroll"
              title="Payroll"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <CreditCard size={18} />
            </NavLink>
            <NavLink
              to="/bonus"
              title="Bonus"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Gift size={18} />
            </NavLink>
            <NavLink
              to="/payslips"
              title="Payslips"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <FileSpreadsheet size={18} />
            </NavLink>
            <NavLink
              to="/advances"
              title="Advances"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Wallet size={18} />
            </NavLink>
            <NavLink
              to="/deployments"
              title="Deployments"
              className={({ isActive }) =>
                `w-full flex justify-center p-2.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#20B2AA] text-white shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`
              }
            >
              <Briefcase size={18} />
            </NavLink>
          </>
        ) : (
          // Expanded: Collapsible Accordion
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setOfficeEmployeeExpanded(!officeEmployeeExpanded)}
              className="w-full flex justify-between items-center px-3.5 py-2.5 rounded-lg hover:bg-white/5 text-left text-gray-200 font-medium transition-colors cursor-pointer"
            >
              <div className="flex gap-3 items-center">
                <Users size={18} className="shrink-0" /> <span className="text-xs font-semibold">Office Employee</span>
              </div>
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 text-gray-400 ${officeEmployeeExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {officeEmployeeExpanded && (
              <div className="pl-3 space-y-1 bg-black/10 py-1.5 rounded-lg">
                <NavLink
                  to="/employees"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Users size={14} className="shrink-0" /> <span>Staff</span>
                </NavLink>
                <NavLink
                  to="/attendance"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <CalendarCheck size={14} className="shrink-0" /> <span>Attendance</span>
                </NavLink>
                <NavLink
                  to="/attendance-calculator"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Calculator size={14} className="shrink-0" /> <span>Attendance Calculator</span>
                </NavLink>
                <NavLink
                  to="/payroll"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <CreditCard size={14} className="shrink-0" /> <span>Payroll</span>
                </NavLink>
                <NavLink
                  to="/bonus"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Gift size={14} className="shrink-0" /> <span>Bonus</span>
                </NavLink>
                <NavLink
                  to="/payslips"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <FileSpreadsheet size={14} className="shrink-0" /> <span>Payslips</span>
                </NavLink>
                <NavLink
                  to="/advances"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Wallet size={14} className="shrink-0" /> <span>Advances</span>
                </NavLink>
                <NavLink
                  to="/deployments"
                  className={({ isActive }) =>
                    `w-full flex gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 items-center ${
                      isActive
                        ? 'bg-[#20B2AA] text-white shadow-md'
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`
                  }
                >
                  <Briefcase size={14} className="shrink-0" /> <span>Deployments</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Sites */}
        <NavLink
          to="/sites"
          title="Sites"
          className={({ isActive }) =>
            `w-full flex items-center ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            } rounded-lg text-xs font-semibold transition-colors duration-150 ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/10 text-gray-300 hover:text-white'
            }`
          }
        >
          <MapPin size={18} className="shrink-0" /> {!collapsed && <span>Sites</span>}
        </NavLink>

        {/* Documents */}
        <NavLink
          to="/documents"
          title="Documents"
          className={({ isActive }) =>
            `w-full flex items-center ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            } rounded-lg text-xs font-semibold transition-colors duration-150 ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/10 text-gray-300 hover:text-white'
            }`
          }
        >
          <FolderArchive size={18} className="shrink-0" /> {!collapsed && <span>Documents</span>}
        </NavLink>

        {/* Entities */}
        <NavLink
          to="/entities"
          title="Entities"
          className={({ isActive }) =>
            `w-full flex items-center ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
            } rounded-lg text-xs font-semibold transition-colors duration-150 ${
              isActive
                ? 'bg-[#20B2AA] text-white shadow-md'
                : 'hover:bg-white/10 text-gray-300 hover:text-white'
            }`
          }
        >
          <Building2 size={18} className="shrink-0" /> {!collapsed && <span>Entities</span>}
        </NavLink>
      </nav>

      {/* Footer User Info & Sign Out */}
      <div className="p-3 border-t border-gray-600/80 bg-[#2C3E50]/60 flex flex-col gap-2 flex-shrink-0">
        <div
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-2 py-1'}`}
          title={collapsed ? `${displayEmail} (${roleLabel})` : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-teal-300 shrink-0 border border-white/10">
            <User size={14} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 animate-in fade-in duration-150">
              <p className="text-xs font-bold text-white truncate">{displayEmail}</p>
              <p className="text-[10px] text-gray-300 font-mono tracking-wider">ROLE: {roleLabel}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={signOut}
          className={`flex items-center ${
            collapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'
          } text-red-300 hover:text-white w-full rounded-lg hover:bg-red-500/20 transition-colors font-semibold text-xs border border-red-500/20 mt-1 cursor-pointer`}
          title={collapsed ? 'Sign Out' : undefined}
          aria-label="Sign Out"
        >
          <LogOut size={15} className="shrink-0" /> {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
