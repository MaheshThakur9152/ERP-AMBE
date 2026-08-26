import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { fetchWithRetry, getApiUrl } from '@/lib/apiClient';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Clock,
  CheckSquare,
  Square,
  RefreshCw,
  Search,
  CheckCircle2,
  Loader2,
  Building2,
  FileText,
  Calendar,
  CreditCard,
  UserCheck,
  Layers,
  Eye,
  X,
  Paperclip,
  FileCode,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { toast, ToastContainer } from '@/components/ui/toast';
import EntityPreviewModal, { EntityPreviewData } from '@/components/ui/EntityPreviewModal';

export interface PendingLockItem {
  id: string;
  entityType: 'sites' | 'invoices' | 'attendance_sheets' | 'payroll_records' | 'staff' | 'companies';
  title: string;
  subtitle: string;
  createdAt: string;
  hoursOld: number;
  is_locked: boolean;
  uploadedDocUrl?: string | null;
  details?: Record<string, any>;
}

export const SecurityCenter: React.FC = () => {
  const { isSuperAdmin, role, user } = useAuth();
  const [viewMode, setViewMode] = useState<'pending' | 'locked'>('pending');
  const [pendingItems, setPendingItems] = useState<PendingLockItem[]>([]);
  const [lockedItems, setLockedItems] = useState<PendingLockItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);
  const [processingSingleId, setProcessingSingleId] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');

  // In-Page Preview Modal state (NO routing/redirects)
  const [previewItem, setPreviewItem] = useState<EntityPreviewData | null>(null);

  const fetchLocksData = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const [pendingRes, lockedRes] = await Promise.all([
        fetchWithRetry('/api/admin/pending-locks', { method: 'GET' }).catch(() => null),
        fetchWithRetry('/api/admin/locked-items', { method: 'GET' }).catch(() => null),
      ]);

      if (pendingRes && pendingRes.ok) {
        const json = await pendingRes.json();
        setPendingItems(json.data || []);
      }
      if (lockedRes && lockedRes.ok) {
        const json = await lockedRes.json();
        setLockedItems(json.data || []);
      }
    } catch (err) {
      console.warn('Locks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocksData();
  }, [isSuperAdmin]);

  const items = viewMode === 'pending' ? pendingItems : lockedItems;

  const getItemKey = (item: PendingLockItem) => `${item.entityType}:${item.id}`;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedEntityType === 'all' || item.entityType === selectedEntityType;
    return matchesSearch && matchesType;
  });

  // Checkbox Selection
  const isAllSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.includes(getItemKey(item)));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(filteredItems.map(getItemKey));
    }
  };

  const toggleSelectRow = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Open In-Page Preview (Zero page redirects)
  const openSoftwareCopyPreview = (item: PendingLockItem) => {
    setPreviewItem({ ...item, mode: 'software' });
  };

  const openUploadedCopyPreview = (item: PendingLockItem) => {
    setPreviewItem({ ...item, mode: 'uploaded' });
  };

  // Toggle Lock/Unlock Single Item
  const handleToggleSingle = async (item: PendingLockItem, targetLockState: boolean) => {
    if (!targetLockState) {
      if (!window.confirm(`Unlock "${item.title}"? Admins will be able to edit this record again.`)) {
        return;
      }
    }

    setProcessingSingleId(item.id);
    try {
      const res = await fetchWithRetry('/api/admin/lock-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: item.entityType,
          id: item.id,
          is_locked: targetLockState,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${targetLockState ? 'lock' : 'unlock'} item`);
      }

      if (targetLockState) {
        setPendingItems((prev) => prev.filter((i) => i.id !== item.id));
        setLockedItems((prev) => [{ ...item, is_locked: true }, ...prev]);
      } else {
        setLockedItems((prev) => prev.filter((i) => i.id !== item.id));
        setPendingItems((prev) => [{ ...item, is_locked: false }, ...prev]);
      }

      setSelectedKeys((prev) => prev.filter((k) => k !== getItemKey(item)));
      if (previewItem?.id === item.id) setPreviewItem(null);
      toast.success(`Record "${item.title}" ${targetLockState ? 'locked' : 'unlocked'} successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${targetLockState ? 'lock' : 'unlock'} item`);
    } finally {
      setProcessingSingleId(null);
    }
  };

  const handleModalLock = async (itemData: EntityPreviewData) => {
    const targetItem = items.find((i) => i.id === itemData.id);
    const targetLockState = !(itemData.is_locked ?? true);
    if (targetItem) {
      await handleToggleSingle(targetItem, targetLockState);
    }
    setPreviewItem(null);
  };

  // Bulk Lock or Unlock Selected Items
  const handleBulkAction = async (targetLockState: boolean) => {
    if (selectedKeys.length === 0) {
      toast.error(`Please select at least one item to ${targetLockState ? 'lock' : 'unlock'}.`);
      return;
    }

    if (!targetLockState) {
      if (!window.confirm(`Unlock all ${selectedKeys.length} selected records? Admins will be able to edit them again.`)) {
        return;
      }
    }

    setIsProcessingBulk(true);

    const payloadItems = selectedKeys.map((key) => {
      const [entityType, id] = key.split(':');
      return { entityType, id };
    });

    try {
      const res = await fetchWithRetry('/api/admin/lock-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, is_locked: targetLockState }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to execute bulk ${targetLockState ? 'lock' : 'unlock'}`);
      }

      const affectedIds = payloadItems.map((p) => p.id);
      if (targetLockState) {
        setPendingItems((prev) => prev.filter((i) => !affectedIds.includes(i.id)));
      } else {
        setLockedItems((prev) => prev.filter((i) => !affectedIds.includes(i.id)));
      }

      setSelectedKeys([]);
      await fetchLocksData();
      toast.success(`Bulk ${targetLockState ? 'lock' : 'unlock'} completed for ${payloadItems.length} records!`);
    } catch (err: any) {
      toast.error(err.message || `Failed to process bulk ${targetLockState ? 'lock' : 'unlock'}`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const getEntityMeta = (entityType: string) => {
    switch (entityType) {
      case 'companies':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'ENTITY',
          icon: Building2,
        };
      case 'sites':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'SITE',
          icon: Building2,
        };
      case 'invoices':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          label: 'INVOICE',
          icon: FileText,
        };
      case 'attendance_sheets':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'ATTENDANCE',
          icon: Calendar,
        };
      case 'payroll_records':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'PAYROLL',
          icon: CreditCard,
        };
      case 'staff':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          label: 'STAFF',
          icon: UserCheck,
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          label: entityType.toUpperCase(),
          icon: Layers,
        };
    }
  };

  // Access Guard
  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 bg-white rounded-3xl border border-red-200 text-center shadow-xl font-sans">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">SuperAdmin Access Restricted</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          The Security Center controls data immutability locks and is strictly restricted to SuperAdmin role credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 bg-[#F8FAFC] min-h-screen font-sans">
      <ToastContainer />

      {/* Top Hero Banner - Sleek Teal & Dark Slate Theme */}
      <div className="bg-[#2C3E50] text-white rounded-2xl p-5 border border-gray-700 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#20B2AA] text-white flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck size={26} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Security Center & Lock Panel</h1>
                <span className="text-[10px] font-extrabold font-mono uppercase bg-indigo-600 text-white px-2.5 py-0.5 rounded-md border border-indigo-400/30">
                  SUPERADMIN MODE
                </span>
              </div>
              <p className="text-xs text-teal-200 mt-0.5">
                Enforce permanent data immutability for records older than 24 hours. Locked records become read-only for Admins.
              </p>
            </div>
          </div>

          {/* Metrics & Main Bulk Action */}
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <div className="bg-black/30 border border-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-[9px] font-bold text-teal-300 uppercase font-mono tracking-wider">
                {viewMode === 'pending' ? 'Pending' : 'Locked'}
              </span>
              <span className="text-lg font-black text-white font-mono">{items.length}</span>
            </div>

            <div className="bg-black/30 border border-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-[9px] font-bold text-teal-300 uppercase font-mono tracking-wider">Selected</span>
              <span className="text-lg font-black text-white font-mono">{selectedKeys.length}</span>
            </div>

            <button
              type="button"
              onClick={fetchLocksData}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-colors border border-white/10 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => handleBulkAction(viewMode === 'pending')}
              disabled={selectedKeys.length === 0 || isProcessingBulk}
              className={`px-5 py-2.5 font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                viewMode === 'pending'
                  ? 'bg-[#20B2AA] hover:bg-[#1ca19a] active:bg-[#188e88] text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
              }`}
            >
              {isProcessingBulk ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              <span>
                {viewMode === 'pending' ? 'Lock Selected' : 'Unlock Selected'} ({selectedKeys.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Section Mode Tabs (Pending Locks vs Currently Locked) */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setViewMode('pending');
            setSelectedKeys([]);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'pending'
              ? 'bg-[#2C3E50] text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Clock size={14} />
          <span>Pending Locks (&gt;24h)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${viewMode === 'pending' ? 'bg-[#20B2AA] text-white' : 'bg-gray-200 text-gray-700'}`}>
            {pendingItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('locked');
            setSelectedKeys([]);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'locked'
              ? 'bg-[#2C3E50] text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Lock size={14} />
          <span>Currently Locked</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${viewMode === 'locked' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {lockedItems.length}
          </span>
        </button>
      </div>

      {/* Control Bar: Compact Search & Type Filter Tabs */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, invoice #, or site..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'companies', label: 'Entities' },
            { id: 'sites', label: 'Sites' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'attendance_sheets', label: 'Attendance' },
            { id: 'payroll_records', label: 'Payroll' },
            { id: 'staff', label: 'Staff' },
          ].map((tab) => {
            const count = tab.id === 'all' ? items.length : items.filter((i) => i.entityType === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedEntityType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedEntityType === tab.id
                    ? 'bg-[#20B2AA] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedEntityType === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* High-Density Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-[#20B2AA] transition-colors"
                  >
                    {isAllSelected ? <CheckSquare size={17} className="text-[#20B2AA]" /> : <Square size={17} />}
                  </button>
                </th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Details & Reference</th>
                <th className="p-3">{viewMode === 'pending' ? 'Age / Duration' : 'Status'}</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 font-mono">
                    <Loader2 size={20} className="animate-spin text-[#20B2AA] mx-auto mb-2" />
                    Loading database records...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#20B2AA] flex items-center justify-center mx-auto mb-2 border border-teal-100">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">
                      {viewMode === 'pending' ? 'No Pending Locks' : 'No Locked Records'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {viewMode === 'pending'
                        ? 'All records older than 24 hours are locked and protected.'
                        : 'No records are currently locked across companies, sites, invoices, staff, attendance, or payroll.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const itemKey = getItemKey(item);
                  const isSelected = selectedKeys.includes(itemKey);
                  const meta = getEntityMeta(item.entityType);
                  const Icon = meta.icon;

                  return (
                    <tr
                      key={itemKey}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/50' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectRow(itemKey)}
                          className="text-gray-400 hover:text-[#20B2AA] transition-colors"
                        >
                          {isSelected ? <CheckSquare size={17} className="text-[#20B2AA]" /> : <Square size={17} />}
                        </button>
                      </td>

                      {/* Entity Type Badge */}
                      <td className="p-3 py-2.5">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded border tracking-wider inline-flex items-center gap-1 ${meta.bg}`}
                        >
                          <Icon size={11} />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      {/* Details & Subtitle */}
                      <td className="p-3 py-2.5">
                        <div className="font-bold text-gray-900 text-xs">{item.title}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">{item.subtitle}</div>
                      </td>

                      {/* Age / Lock Status */}
                      <td className="p-3 py-2.5 font-mono">
                        {viewMode === 'pending' ? (
                          <div className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-bold">
                            <Clock size={12} className="text-slate-500" />
                            <span>{item.hoursOld} hours ago</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                            <Lock size={12} className="text-emerald-600" />
                            <span>Locked by SuperAdmin</span>
                          </div>
                        )}
                      </td>

                      {/* Action Buttons: ZERO page redirects */}
                      <td className="p-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Uploaded Copy Button */}
                          <button
                            type="button"
                            onClick={() => openUploadedCopyPreview(item)}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Preview Uploaded Copy In-Page"
                          >
                            <Paperclip size={13} />
                            <span>Uploaded Copy</span>
                          </button>

                          {/* Software Copy Button (In-Page Preview) */}
                          <button
                            type="button"
                            onClick={() => openSoftwareCopyPreview(item)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Preview Software Copy In-Page"
                          >
                            <FileCode size={13} />
                            <span>Software Copy</span>
                          </button>

                          {/* Lock / Unlock Record Button */}
                          <button
                            type="button"
                            disabled={processingSingleId === item.id}
                            onClick={() => handleToggleSingle(item, viewMode === 'pending')}
                            className={`px-3 py-1 font-bold rounded-lg text-xs transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                              viewMode === 'pending'
                                ? 'bg-[#20B2AA] hover:bg-[#1ca19a] active:bg-[#188e88] text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                            }`}
                          >
                            {processingSingleId === item.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Lock size={13} />
                            )}
                            <span>{viewMode === 'pending' ? 'Lock Record' : 'Unlock Record'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Entity Preview Modal */}
      <EntityPreviewModal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        entityData={previewItem}
        onLockConfirm={handleModalLock}
        isLocking={processingSingleId === previewItem?.id}
      />
    </div>
  );
};

export default SecurityCenter;

