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
    color: 'bg-teal-50 text-[#20B2AA]',
  },
  {
    title: 'Invoices Hub',
    description: 'Proforma and tax invoice lifecycle with auto-incrementing numbers.',
    icon: FileText,
    href: '/invoice-hub',
    status: 'Live',
    color: 'bg-[#20B2AA]/10 text-[#20B2AA]',
  },
  {
    title: 'Payroll Engine',
    description: 'Attendance-based payroll, bulk NEFT/RTGS Excel generation.',
    icon: CreditCard,
    href: '/payroll',
    status: 'Live',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    title: 'Sites Master',
    description: 'Manage client facility locations, GSTIN details & designation rate cards.',
    icon: Users,
    href: '/sites',
    status: 'Live',
    color: 'bg-green-50 text-green-600',
  },
];

export const DashboardPage: React.FC = () => {
  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Overview</h1>
        <p className="text-xs text-gray-500 mt-0.5">Enterprise Resource Planning — Facility Management Division</p>
      </div>

      {/* Status banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-xs text-green-700 font-semibold">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span>Facility ERP Modules Active — Invoices, Sites Master, Smart Generator, and Payroll Engine ready.</span>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Link key={tile.title} to={tile.href}>
            <Card className="hover:border-[#20B2AA] transition-all duration-200 cursor-pointer group bg-white border border-gray-200 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${tile.color} flex items-center justify-center border border-gray-200 group-hover:scale-105 transition-transform`}>
                    <tile.icon className="w-5 h-5" />
                  </div>
                  <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {tile.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-[#20B2AA] transition-colors">
                    {tile.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tile.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-[#20B2AA] group-hover:translate-x-0.5 transition-transform pt-2 border-t border-gray-100">
                  <span>Open module</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
