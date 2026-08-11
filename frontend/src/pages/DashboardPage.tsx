import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileText, Users, CreditCard, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const tiles = [
  {
    title: 'Company Profiles',
    description: 'Manage entity parameters, GSTIN, bank details, and dynamic T&C.',
    icon: Building2,
    href: '/companies',
    status: 'Live',
    color: 'from-blue-500/20 to-indigo-500/10 text-blue-400',
  },
  {
    title: 'Invoices',
    description: 'Proforma and tax invoice lifecycle with auto-incrementing numbers.',
    icon: FileText,
    href: '/invoices',
    status: 'Phase 3',
    color: 'from-amber-500/20 to-orange-500/10 text-amber-400',
  },
  {
    title: 'Payroll Engine',
    description: 'Attendance-based payroll, bulk NEFT/RTGS Excel generation.',
    icon: CreditCard,
    href: '/payroll',
    status: 'Phase 7',
    color: 'from-purple-500/20 to-pink-500/10 text-purple-400',
  },
  {
    title: 'Employee KYC Vault',
    description: 'PAN, address proofs, and documents securely stored in Supabase.',
    icon: Users,
    href: '/employees',
    status: 'Phase 2',
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400',
  },
];

export const DashboardPage: React.FC = () => {
  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title text-xl font-bold tracking-tight text-white">Overview</h1>
        <p className="page-desc text-zinc-400">Enterprise Resource Planning — Facility Management Division</p>
      </div>

      {/* Status banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Phase 1 Deployed — Database, Authentication, and Company Profiles active.</span>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Link key={tile.title} to={tile.href}>
            <Card className="hover:border-white/20 transition-all duration-200 cursor-pointer group bg-zinc-900/50 hover:bg-zinc-900/80 backdrop-blur-sm">
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform`}>
                    <tile.icon className="w-5 h-5" />
                  </div>
                  <span className={`badge ${tile.status === 'Live' ? 'badge-green' : 'badge-slate'}`}>
                    {tile.status !== 'Live' && <Clock className="w-2.5 h-2.5 mr-1" />}
                    {tile.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {tile.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{tile.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors pt-2 border-t border-white/5">
                  <span>Open module</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
