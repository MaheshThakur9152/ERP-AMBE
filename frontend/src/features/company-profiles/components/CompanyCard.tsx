import React from 'react';
import { CompanyProfile } from '../types';
import { Badge } from '@/components/ui/badge';
import { Pencil, Building2, CreditCard, FileText, MapPin, Hash, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

interface CompanyCardProps {
  company: CompanyProfile;
  onEdit: (company: CompanyProfile) => void;
  onLock?: (company: CompanyProfile) => void;
  isLocking?: boolean;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit, onLock, isLocking = false }) => {
  const { isSuperAdmin } = useAuth();
  const isLocked = Boolean(company.is_locked);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#20B2AA]/50 transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div className="p-5 space-y-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#20B2AA] flex-shrink-0 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-[#20B2AA] bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                  {company.code}
                </span>
                <Badge variant={company.is_active ? 'green' : 'slate'}>
                  {company.is_active ? 'Active Entity' : 'Inactive'}
                </Badge>
              </div>
              <h3 className="text-base font-bold text-gray-900 truncate leading-snug">{company.name}</h3>
              <p className="text-xs text-gray-500 truncate font-medium">{company.legal_name}</p>
            </div>
          </div>

          {/* Action Buttons / Lock Badge */}
          {isLocked ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 shrink-0">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Locked by SuperAdmin</span>
            </span>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(company)}
                className="p-2 rounded-lg text-gray-400 hover:text-[#20B2AA] hover:bg-teal-50 transition-all border border-transparent hover:border-teal-100 flex-shrink-0 cursor-pointer"
                title="Edit Company Profile"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {isSuperAdmin && onLock && (
                <button
                  type="button"
                  disabled={isLocking}
                  onClick={() => onLock(company)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 flex-shrink-0 cursor-pointer disabled:opacity-50"
                  title="Quick Lock Entity (SuperAdmin)"
                >
                  {isLocking ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-red-500" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tax & Compliance Boxes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#20B2AA]" /> GSTIN
            </p>
            <p className="text-xs font-mono font-bold text-gray-900">{company.gstin || 'N/A'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#20B2AA]" /> PAN
            </p>
            <p className="text-xs font-mono font-bold text-gray-900">{company.pan || 'N/A'}</p>
          </div>
        </div>

        {/* Registered Address */}
        <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#20B2AA]" /> Registered Office
          </p>
          <p className="font-semibold text-gray-800 leading-snug">
            {company.address_line1}
            {company.address_line2 ? `, ${company.address_line2}` : ''}
          </p>
          <p className="text-gray-500 font-medium">
            {company.city}, {company.state} — {company.pincode}
          </p>
        </div>

        {/* Bank Credentials Sleek Dark Card */}
        <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2.5 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-teal-400 uppercase">
              <CreditCard className="w-3.5 h-3.5 text-teal-400" />
              <span>Primary Bank Account</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              IFSC: {company.bank_ifsc}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Bank Name:</span>
              <p className="font-bold text-white truncate">{company.bank_name}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Account No:</span>
              <p className="font-mono font-bold text-teal-300 truncate">{company.bank_account_no}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 font-medium">Branch:</span>
              <p className="text-slate-200 truncate">{company.bank_branch}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-[#20B2AA]" />
          <span className="font-medium text-gray-600">
            {company.terms_and_conditions?.length || 0} Invoice Terms Attached
          </span>
        </div>
        {isLocked ? (
          <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
            <Lock className="w-3.5 h-3.5" />
            <span>Locked</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-600 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active</span>
          </div>
        )}
      </div>
    </div>
  );
};
