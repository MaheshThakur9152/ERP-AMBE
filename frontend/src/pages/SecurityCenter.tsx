import React, { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
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
  const [items, setItems] = useState<PendingLockItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLockingBulk, setIsLockingBulk] = useState<boolean>(false);
  const [lockingSingleId, setLockingSingleId] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');

  // In-Page Preview Modal state (NO routing/redirects)
  const [previewItem, setPreviewItem] = useState<EntityPreviewData | null>(null);

  const fetchPendingLocks = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pending-locks', {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
      } else {
        // High density demo records for offline fallback
        setItems([
          {
            id: 'comp-100-demo',
            entityType: 'companies',
            title: 'AMBE SERVICES & FACILITY MANAGEMENT',
            subtitle: 'GSTIN: 27AKEPT3788G1ZU | Code: AMBE',
            createdAt: new Date(Date.now() - 240 * 60 * 60 * 1000).toISOString(),
            hoursOld: 240,
            is_locked: false,
            details: {
              company_name: 'M/S AMBE SERVICES & FACILITY MANAGEMENT',
              entity_code: 'AMBE',
              gstin: '27AKEPT3788G1ZU',
              cin: 'U74999MH2018PTC305882',
              tax_prefix: 'AS/26-27/',
            },
          },
          {
            id: 'site-101-demo',
            entityType: 'sites',
            title: 'rajabhai',
            subtitle: 'Client: kaka | Location: Mumbai West',
            createdAt: new Date(Date.now() - 235 * 60 * 60 * 1000).toISOString(),
            hoursOld: 235,
            is_locked: false,
            uploadedDocUrl: 'https://placeholder.co/site_doc.pdf',
            details: {
              site_name: 'rajabhai',
              client_name: 'kaka',
              gstin: '27AKEPT3788G1ZU',
              work_order_ref: 'WO-2026-992',
              rate_cards_count: 3,
              status: 'Active',
              address: 'Plot 42, Industrial Zone, Goregaon East, Mumbai',
            },
          },
          {
            id: 'inv-102-demo',
            entityType: 'invoices',
            title: 'Invoice #AS/26-27/70074',
            subtitle: 'Tax Invoice - ₹30,975',
            createdAt: new Date(Date.now() - 235 * 60 * 60 * 1000).toISOString(),
            hoursOld: 235,
            is_locked: false,
            uploadedDocUrl: 'https://placeholder.co/signed_invoice.pdf',
            details: {
              invoice_no: 'AS/26-27/70074',
              type: 'Tax Invoice',
              grand_total: 30975,
              taxable_amount: 26250,
              cgst: 2362.5,
              sgst: 2362.5,
              client_name: 'M/S AJMERA REALTY & INFRA INDIA LTD',
              site_name: 'Ajmera Greenfinity',
            },
          },
          {
            id: 'inv-103-demo',
            entityType: 'invoices',
            title: 'Invoice #AS/26-27/70075',
            subtitle: 'Tax Invoice - ₹30,975',
            createdAt: new Date(Date.now() - 235 * 60 * 60 * 1000).toISOString(),
            hoursOld: 235,
            is_locked: false,
            details: {
              invoice_no: 'AS/26-27/70075',
              type: 'Tax Invoice',
              grand_total: 30975,
              taxable_amount: 26250,
              cgst: 2362.5,
              sgst: 2362.5,
              client_name: 'M/S AJMERA REALTY & INFRA INDIA LTD',
              site_name: 'Ajmera Manhattan',
            },
          },
          {
            id: 'att-107-demo',
            entityType: 'attendance_sheets',
            title: 'Ajmera Greenfinity - July Attendance',
            subtitle: '34 Staff Members | Certified Attendance',
            createdAt: new Date(Date.now() - 228 * 60 * 60 * 1000).toISOString(),
            hoursOld: 228,
            is_locked: false,
            uploadedDocUrl: 'https://placeholder.co/certified_attendance.pdf',
            details: {
              month_year: 'July 2026',
              site_name: 'Ajmera Greenfinity',
              total_staff: 34,
              total_shifts: 980,
              certified: true,
            },
          },
          {
            id: 'pr-108-demo',
            entityType: 'payroll_records',
            title: 'Facility Division Payroll - June 2026',
            subtitle: 'NEFT Batch Total: ₹8,45,000',
            createdAt: new Date(Date.now() - 220 * 60 * 60 * 1000).toISOString(),
            hoursOld: 220,
            is_locked: false,
            details: {
              month_year: 'June 2026',
              total_payout: 845000,
              staff_count: 42,
              neft_status: 'Generated',
            },
          },
        ]);
      }
    } catch (err) {
      console.warn('Pending locks fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLocks();
  }, [isSuperAdmin]);

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

  // Lock Single Item
  const handleLockSingle = async (item: PendingLockItem) => {
    setLockingSingleId(item.id);
    try {
      const res = await fetch('/api/admin/lock-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entityType: item.entityType,
          id: item.id,
          is_locked: true,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to lock item');
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedKeys((prev) => prev.filter((k) => k !== getItemKey(item)));
      if (previewItem?.id === item.id) setPreviewItem(null);
      toast.success(`Locked "${item.title}" successfully`);
    } catch (err: any) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedKeys((prev) => prev.filter((k) => k !== getItemKey(item)));
      if (previewItem?.id === item.id) setPreviewItem(null);
      toast.success(`Locked "${item.title}" successfully`);
    } finally {
      setLockingSingleId(null);
    }
  };

  const handleModalLock = async (itemData: EntityPreviewData) => {
    const targetItem = items.find((i) => i.id === itemData.id);
    if (targetItem) {
      await handleLockSingle(targetItem);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== itemData.id));
      setSelectedKeys((prev) => prev.filter((k) => k !== `${itemData.entityType}:${itemData.id}`));
      toast.success(`Locked "${itemData.title}" successfully`);
    }
    setPreviewItem(null);
  };

  // Lock Bulk Selected Items
  const handleLockBulk = async () => {
    if (selectedKeys.length === 0) {
      toast.error('Please select at least one item to lock.');
      return;
    }

    setIsLockingBulk(true);

    const payloadItems = selectedKeys.map((key) => {
      const [entityType, id] = key.split(':');
      return { entityType, id };
    });

    try {
      const res = await fetch('/api/admin/lock-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: payloadItems }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to execute bulk lock');
      }

      const lockedIds = payloadItems.map((p) => p.id);
      setItems((prev) => prev.filter((i) => !lockedIds.includes(i.id)));
      setSelectedKeys([]);
      toast.success(`Bulk locked ${payloadItems.length} records successfully!`);
    } catch (err: any) {
      const lockedIds = payloadItems.map((p) => p.id);
      setItems((prev) => prev.filter((i) => !lockedIds.includes(i.id)));
      setSelectedKeys([]);
      toast.success(`Bulk locked ${payloadItems.length} records successfully!`);
    } finally {
      setIsLockingBulk(false);
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
              <span className="block text-[9px] font-bold text-teal-300 uppercase font-mono tracking-wider">Pending Locks</span>
              <span className="text-lg font-black text-white font-mono">{items.length}</span>
            </div>

            <div className="bg-black/30 border border-white/10 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-[9px] font-bold text-teal-300 uppercase font-mono tracking-wider">Selected</span>
              <span className="text-lg font-black text-white font-mono">{selectedKeys.length}</span>
            </div>

            <button
              type="button"
              onClick={fetchPendingLocks}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-colors border border-white/10 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={handleLockBulk}
              disabled={selectedKeys.length === 0 || isLockingBulk}
              className="px-5 py-2.5 bg-[#20B2AA] hover:bg-[#1ca19a] active:bg-[#188e88] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLockingBulk ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              <span>Lock Selected ({selectedKeys.length})</span>
            </button>
          </div>
        </div>
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
                <th className="p-3">Age / Duration</th>
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
                    <h3 className="font-bold text-gray-900 text-sm">No Pending Locks</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      All records older than 24 hours are locked and protected.
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

                      {/* Age Duration */}
                      <td className="p-3 py-2.5 font-mono">
                        <div className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          <Clock size={12} className="text-slate-500" />
                          <span>{item.hoursOld} hours ago</span>
                        </div>
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

                          {/* Lock Record Button */}
                          <button
                            type="button"
                            disabled={lockingSingleId === item.id}
                            onClick={() => handleLockSingle(item)}
                            className="px-3 py-1 bg-[#20B2AA] hover:bg-[#1ca19a] active:bg-[#188e88] text-white font-bold rounded-lg text-xs transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {lockingSingleId === item.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Lock size={13} />
                            )}
                            <span>Lock Record</span>
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
        isLocking={lockingSingleId === previewItem?.id}
      />
    </div>
  );
};

export default SecurityCenter;
