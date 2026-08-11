import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart2,
  Building2,
  FileText,
  Users,
  CreditCard,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: BarChart2 },
      { name: 'Company Profiles', href: '/companies', icon: Building2 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Payroll', href: '/payroll', icon: CreditCard },
      { name: 'Employees', href: '/employees', icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Facility ERP</p>
            <p className="text-[10px] text-zinc-500 font-mono">v2.0 Enterprise</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn('nav-link', isActive && 'active')
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 nav-icon" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer status */}
      <div className="p-3 border-t border-white/10 m-2 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-zinc-400 font-medium">PostgreSQL Connected</span>
        </div>
      </div>
    </aside>
  );
};
