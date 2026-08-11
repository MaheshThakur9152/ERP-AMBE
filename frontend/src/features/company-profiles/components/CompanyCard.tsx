import React from 'react';
import { CompanyProfile } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Pencil, Building2, CreditCard, FileText } from 'lucide-react';

interface CompanyCardProps {
  company: CompanyProfile;
  onEdit: (company: CompanyProfile) => void;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({ company, onEdit }) => {
  return (
    <Card className="hover:border-white/20 transition-all duration-200 bg-zinc-900/60 backdrop-blur-md">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono font-semibold text-indigo-400">{company.code}</span>
                <Badge variant={company.is_active ? 'green' : 'slate'}>
                  {company.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-white truncate">{company.name}</p>
              <p className="text-xs text-zinc-400 truncate">{company.legal_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(company)} className="flex-shrink-0 text-zinc-400 hover:text-white">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="divider" />

        {/* Tax & Compliance */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">GSTIN</p>
            <p className="text-xs font-mono text-zinc-200">{company.gstin || '—'}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">PAN</p>
            <p className="text-xs font-mono text-zinc-200">{company.pan || '—'}</p>
          </div>
        </div>

        {/* Address */}
        <div className="mb-4 text-xs text-zinc-400 leading-relaxed">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">Registered Address</p>
          <p className="text-zinc-300">
            {company.address_line1}{company.address_line2 ? `, ${company.address_line2}` : ''}
          </p>
          <p className="text-zinc-500">{company.city}, {company.state} — {company.pincode}</p>
        </div>

        {/* Bank */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
            <CreditCard className="w-3 h-3 text-indigo-400" />
            <span>Bank Account</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-zinc-500">Bank: </span>
              <span className="font-medium text-zinc-200">{company.bank_name}</span>
            </div>
            <div>
              <span className="text-zinc-500">A/C: </span>
              <span className="font-mono text-zinc-200">{company.bank_account_no}</span>
            </div>
            <div>
              <span className="text-zinc-500">IFSC: </span>
              <span className="font-mono text-zinc-300">{company.bank_ifsc}</span>
            </div>
            <div>
              <span className="text-zinc-500">Branch: </span>
              <span className="text-zinc-300">{company.bank_branch}</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-5 py-3 border-t border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <FileText className="w-3.5 h-3.5" />
          <span>{company.terms_and_conditions?.length || 0} terms &amp; conditions configured</span>
        </div>
      </CardFooter>
    </Card>
  );
};
