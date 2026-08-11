import React, { useEffect, useState } from 'react';
import { CompanyProfile, CreateCompanyInput } from '../types';
import { fetchCompanies, createCompany, updateCompany } from '../api/companyApi';
import { CompanyCard } from './CompanyCard';
import { CompanyFormModal } from './CompanyFormModal';
import { Button } from '@/components/ui/button';
import { Plus, Building2 } from 'lucide-react';

export const CompanyList: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyProfile | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCompanies(await fetchCompanies());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (c: CompanyProfile) => { setEditing(c); setModalOpen(true); };
  const handleCreate = () => { setEditing(null); setModalOpen(true); };
  const handleSave = async (payload: CreateCompanyInput) => {
    if (editing) await updateCompany(editing.id, payload);
    else await createCompany(payload);
    await load();
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl font-bold tracking-tight text-white">Company Profiles</h1>
          <p className="page-desc text-zinc-400">
            Entity parameters stored in PostgreSQL, used to generate all billing documents.
          </p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <Plus className="w-4 h-4" />
          Add profile
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 py-12">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
          <span>Loading company profiles…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && companies.length === 0 && (
        <div className="empty-state border border-white/10 rounded-2xl bg-zinc-900/40 p-12">
          <Building2 className="empty-state-icon text-zinc-600" />
          <p className="text-sm font-semibold text-zinc-200">No company profiles found</p>
          <p className="text-xs text-zinc-400 mt-1 mb-5 max-w-xs">
            Create your first company profile to configure GSTIN, address, and bank info.
          </p>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus className="w-3.5 h-3.5" /> Add first profile
          </Button>
        </div>
      )}

      {/* Grid */}
      {!loading && companies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((c) => (
            <CompanyCard key={c.id} company={c} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <CompanyFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editing}
      />
    </div>
  );
};
