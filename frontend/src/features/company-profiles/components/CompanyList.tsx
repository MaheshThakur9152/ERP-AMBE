import React, { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/apiClient';
import { CompanyProfile, CreateCompanyInput } from '../types';
import { fetchCompanies, createCompany, updateCompany } from '../api/companyApi';
import { setEntityLockApi } from '@/features/auth/api/authApi';
import { CompanyCard } from './CompanyCard';
import { CompanyFormModal } from './CompanyFormModal';
import { toast, ToastContainer } from '@/components/ui/toast';
import { Plus, Building2, RotateCcw } from 'lucide-react';

export const CompanyList: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyProfile | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, []);

  const handleEdit = (c: CompanyProfile) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleSave = async (payload: CreateCompanyInput) => {
    if (editing) {
      await updateCompany(editing.id, payload);
    } else {
      await createCompany(payload);
    }
    await load();
  };

  const handleLock = async (c: CompanyProfile) => {
    const targetState = !c.is_locked;
    if (!targetState) {
      if (!window.confirm('Unlock this company profile? Admins will be able to edit it again.')) {
        return;
      }
    }

    setLockingId(c.id);
    try {
      await setEntityLockApi('companies', c.id, targetState);

      setCompanies((prev) =>
        prev.map((comp) => (comp.id === c.id ? { ...comp, is_locked: targetState } : comp))
      );
      toast.success(`Company entity "${c.name}" ${targetState ? 'locked' : 'unlocked'} successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${targetState ? 'lock' : 'unlock'} company profile`);
    } finally {
      setLockingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Company Profiles</h1>
            <span className="bg-teal-50 text-[#20B2AA] border border-teal-100 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              PostgreSQL / Database
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Configure entity parameters, GSTIN compliance, registered addresses, bank credentials, and invoice sequence settings.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={load}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Refresh Profiles"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Profile</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 py-16 bg-white border border-gray-200 rounded-2xl">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-[#20B2AA] rounded-full animate-spin" />
          <span className="font-semibold text-gray-700">Loading company profiles…</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && companies.length === 0 && (
        <div className="border border-gray-200 rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#20B2AA] mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-gray-900">No Company Profiles Configured</p>
          <p className="text-xs text-gray-500 mt-1 mb-6 max-w-sm font-medium">
            Create your first company profile to set up your entity’s GSTIN, address, bank account, and invoice sequence settings.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> <span>Add First Profile</span>
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && companies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              onEdit={handleEdit}
              onLock={handleLock}
              isLocking={lockingId === c.id}
            />
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
