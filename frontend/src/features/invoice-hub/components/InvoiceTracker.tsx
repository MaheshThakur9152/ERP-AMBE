import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithRetry } from '@/lib/apiClient';
import {
  FileText,
  Upload,
  Calendar,
  Building2,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  CheckCircle2,
  Loader2,
  FileCheck,
  Paperclip,
  Kanban,
  ExternalLink,
  Ban,
  ArrowRight,
  Plus,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  DollarSign,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  XCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchInvoicesApi,
  cancelInvoiceApi,
  approveInvoiceApi,
  convertToTaxInvoiceApi,
  createInvoiceApi,
  certifyInvoiceDocApi,
  deleteInvoiceDocApi,
  toggleInvoiceLockApi,
} from '../api/invoiceApi';
import { InvoiceRecord } from '../types';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/features/invoices/utils/invoiceCalculator';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';

interface GroupedLineage {
  key: string;
  siteName: string;
  siteCodeName?: string;
  billingPeriod: string;
  invoices: InvoiceRecord[];
}

type StatFilterType = 'all' | 'fully-certified' | 'missing-docs' | 'pending-proforma' | 'approved';

export const InvoiceTracker: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('All');
  const [statFilter, setStatFilter] = useState<StatFilterType>('all');
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadingAttId, setUploadingAttId] = useState<string | null>(null);
  const [certifyingDocId, setCertifyingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [creatingRevisionId, setCreatingRevisionId] = useState<string | null>(null);
  const [togglingLockId, setTogglingLockId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ id?: string; fileName: string; title: string; url?: string; onDelete?: () => void } | null>(null);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInvoicesApi();
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load tracker invoices:', err);
      toast.error(err.message || 'Failed to load invoice lineage from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Distinct Billing Periods
  const distinctPeriods = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const p = inv.billing_period || inv.monthYear || (inv as any).month_year || inv.payload?.meta?.billingPeriod;
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Group invoices by site_id / siteName & billing_period
  const groupedLineages = useMemo(() => {
    const groups: { [key: string]: InvoiceRecord[] } = {};

    invoices.forEach((inv) => {
      const siteId = inv.site_id || inv.siteId || '';
      const site = inv.siteName || (inv as any).site_name || inv.payload?.party?.siteName || 'Unassigned Site';
      const period = inv.billing_period || inv.monthYear || (inv as any).month_year || inv.payload?.meta?.billingPeriod || 'Unknown Period';
      const groupKey = `${siteId || site}___${period}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(inv);
    });

    const result: GroupedLineage[] = Object.keys(groups).map((key) => {
      const [sKey, billingPeriod] = key.split('___');
      // Sort invoices in chronological order (invoice_date / date asc, falling back to created_at)
      const sortedInvoices = [...groups[key]].sort((a, b) => {
        const timeA = new Date(a.invoice_date || a.date || a.created_at || (a as any).created_at || 0).getTime();
        const timeB = new Date(b.invoice_date || b.date || b.created_at || (b as any).created_at || 0).getTime();
        return timeA - timeB;
      });

      const firstWithCode = sortedInvoices.find(
        (inv) => inv.sites?.code_name || inv.sites?.codeName || (inv as any).code_name || (inv as any).codeName
      );
      const siteCodeName =
        firstWithCode?.sites?.code_name ||
        firstWithCode?.sites?.codeName ||
        (firstWithCode as any)?.code_name ||
        (firstWithCode as any)?.codeName ||
        '';

      const siteName =
        sortedInvoices[0]?.siteName ||
        (sortedInvoices[0] as any)?.site_name ||
        sortedInvoices[0]?.payload?.party?.siteName ||
        sKey;

      return {
        key,
        siteName,
        siteCodeName,
        billingPeriod,
        invoices: sortedInvoices,
      };
    });

    return result;
  }, [invoices]);

  // Month-level Summary Stats (Driven by confirmed_at status)
  const summaryStats = useMemo(() => {
    let filtered = groupedLineages;
    if (selectedPeriod !== 'All') {
      filtered = filtered.filter((g) => g.billingPeriod === selectedPeriod);
    }

    const totalGroups = filtered.length;
    let grandTotalSum = 0;
    let fullyCertifiedCount = 0;
    let missingDocsCount = 0;
    let pendingProformasCount = 0;
    let approvedProformasCount = 0;

    filtered.forEach((g) => {
      const latest = g.invoices[g.invoices.length - 1];
      if (!latest) return;

      if (latest.status !== 'Cancelled') {
        grandTotalSum += Number(latest.grand_total || latest.amount || 0);
      }

      const hasDocConfirmed = Boolean(latest.certified_doc_confirmed_at || (latest as any).certifiedDocConfirmedAt);
      const hasAttConfirmed = Boolean(latest.certified_attendance_confirmed_at || (latest as any).certifiedAttendanceConfirmedAt);

      if (hasDocConfirmed && hasAttConfirmed) {
        fullyCertifiedCount++;
      } else if (latest.status !== 'Cancelled') {
        missingDocsCount++;
      }

      const isProforma =
        latest.type === 'Proforma Invoice' ||
        latest.type === 'Proforma' ||
        String(latest.type || '').toLowerCase().includes('proforma');

      if (isProforma && latest.status === 'Pending') {
        pendingProformasCount++;
      }
      if (isProforma && latest.status === 'Approved') {
        approvedProformasCount++;
      }
    });

    return {
      totalGroups,
      grandTotalSum,
      fullyCertifiedCount,
      missingDocsCount,
      pendingProformasCount,
      approvedProformasCount,
    };
  }, [groupedLineages, selectedPeriod]);

  // Filtered Lineages for display
  const displayedLineages = useMemo(() => {
    let list = groupedLineages;

    if (selectedPeriod !== 'All') {
      list = list.filter((g) => g.billingPeriod === selectedPeriod);
    }

    if (statFilter === 'fully-certified') {
      list = list.filter((g) => {
        const latest = g.invoices[g.invoices.length - 1];
        return (
          latest &&
          Boolean(latest.certified_doc_confirmed_at || (latest as any).certifiedDocConfirmedAt) &&
          Boolean(latest.certified_attendance_confirmed_at || (latest as any).certifiedAttendanceConfirmedAt)
        );
      });
    } else if (statFilter === 'missing-docs') {
      list = list.filter((g) => {
        const latest = g.invoices[g.invoices.length - 1];
        return (
          latest &&
          latest.status !== 'Cancelled' &&
          (!latest.certified_doc_confirmed_at || !latest.certified_attendance_confirmed_at)
        );
      });
    } else if (statFilter === 'pending-proforma') {
      list = list.filter((g) => {
        const latest = g.invoices[g.invoices.length - 1];
        const isProforma =
          latest &&
          (latest.type === 'Proforma Invoice' ||
            latest.type === 'Proforma' ||
            String(latest.type || '').toLowerCase().includes('proforma'));
        return isProforma && latest?.status === 'Pending';
      });
    } else if (statFilter === 'approved') {
      list = list.filter((g) => {
        const latest = g.invoices[g.invoices.length - 1];
        const isProforma =
          latest &&
          (latest.type === 'Proforma Invoice' ||
            latest.type === 'Proforma' ||
            String(latest.type || '').toLowerCase().includes('proforma'));
        return isProforma && latest?.status === 'Approved';
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (g) =>
        g.siteName.toLowerCase().includes(q) ||
        (g.siteCodeName && g.siteCodeName.toLowerCase().includes(q)) ||
        g.billingPeriod.toLowerCase().includes(q) ||
        g.invoices.some(
          (inv) =>
            inv.invoiceNo.toLowerCase().includes(q) ||
            (inv.status && inv.status.toLowerCase().includes(q)) ||
            (inv.cancelled_reason && inv.cancelled_reason.toLowerCase().includes(q)) ||
            (inv.type && inv.type.toLowerCase().includes(q))
        )
    );
  }, [groupedLineages, selectedPeriod, statFilter, searchQuery]);

  // Action: Toggle Invoice Lock
  const handleToggleLock = async (inv: InvoiceRecord) => {
    setTogglingLockId(inv.id);
    const newLock = !(inv.is_locked || (inv as any).isLocked);
    try {
      await toggleInvoiceLockApi(inv.id, newLock);
      toast.success(`Invoice ${inv.invoiceNo} ${newLock ? 'locked 🔒' : 'unlocked 🔓'}`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Toggle lock error:', err);
      toast.error(err.message || 'Failed to update lock status');
    } finally {
      setTogglingLockId(null);
    }
  };

  // Action: Approve Proforma Invoice
  const handleApproveInvoice = async (inv: InvoiceRecord) => {
    setApprovingId(inv.id);
    try {
      await approveInvoiceApi(inv.id);
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? { ...item, status: 'Approved', approved_at: new Date().toISOString() }
            : item
        )
      );
      toast.success(`Proforma ${inv.invoiceNo} approved`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Approve invoice error:', err);
      toast.error(err.message || 'Failed to approve invoice');
    } finally {
      setApprovingId(null);
    }
  };

  // Action: Convert Approved Proforma to Tax Invoice
  const handleConvertToTaxInvoice = async (inv: InvoiceRecord) => {
    setConvertingId(inv.id);
    try {
      const res = await convertToTaxInvoiceApi(inv.id);
      toast.success(`Tax Invoice ${res.data.invoiceNo} created`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Convert to tax invoice error:', err);
      toast.error(err.message || 'Failed to convert to tax invoice');
    } finally {
      setConvertingId(null);
    }
  };

  // Action: Create Next Proforma in Chain after Cancellation
  const handleCreateNewProforma = async (cancelledInv: InvoiceRecord) => {
    setCreatingRevisionId(cancelledInv.id);
    try {
      let baseNo = cancelledInv.invoiceNo;
      let revNum = 1;
      const match = baseNo.match(/^(.*)-R(\d+)$/);
      if (match) {
        baseNo = match[1];
        revNum = Number(match[2]) + 1;
      }
      const newInvoiceNo = `${baseNo}-R${revNum}`;

      const payload = {
        company_id: cancelledInv.company_id || cancelledInv.companyId,
        site_id: cancelledInv.site_id || cancelledInv.siteId,
        invoice_no: newInvoiceNo,
        type: 'Proforma Invoice' as const,
        status: 'Pending' as const,
        invoice_date: new Date().toISOString().split('T')[0],
        billing_period: cancelledInv.billing_period || cancelledInv.monthYear,
        line_items: cancelledInv.line_items || [],
        sub_total: cancelledInv.sub_total || 0,
        tax_total: cancelledInv.tax_total || 0,
        grand_total: cancelledInv.grand_total || cancelledInv.amount || 0,
        management_fee_percent: (cancelledInv as any).management_fee_percent ?? (cancelledInv as any).mgmt_percent ?? 0,
        mgmt_percent: (cancelledInv as any).management_fee_percent ?? (cancelledInv as any).mgmt_percent ?? 0,
        machinery_charges: (cancelledInv as any).machinery_charges || 0,
        material_charges: (cancelledInv as any).material_charges || 0,
        additional_charges: (cancelledInv as any).additional_charges || [],
        is_material: (cancelledInv as any).is_material || false,
        previous_version_id: cancelledInv.id,
      };

      await createInvoiceApi(payload as any);
      toast.success(`Created next Proforma revision: ${newInvoiceNo}`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Create new proforma error:', err);
      toast.error(err.message || 'Failed to create new proforma');
    } finally {
      setCreatingRevisionId(null);
    }
  };

  // Action: Handle Invoice Cancellation (Soft-Delete)
  const handleCancelInvoice = async (inv: InvoiceRecord) => {
    const reason = window.prompt(`Enter cancellation reason for invoice "${inv.invoiceNo}":`, 'Client requested revision / modifications');
    if (reason === null) return;

    setCancellingId(inv.id);
    try {
      await cancelInvoiceApi(inv.id, reason || 'Cancelled by user');
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? {
                ...item,
                status: 'Cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_reason: reason || 'Cancelled by user',
              }
            : item
        )
      );
      toast.success(`Invoice ${inv.invoiceNo} cancelled`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Cancel invoice error:', err);
      toast.error(err.message || 'Failed to cancel invoice');
    } finally {
      setCancellingId(null);
    }
  };

  // Action: Mark document as Certified
  const handleMarkAsCertified = async (inv: InvoiceRecord, docType: 'bill' | 'attendance') => {
    setCertifyingDocId(`${inv.id}-${docType}`);
    try {
      await certifyInvoiceDocApi(inv.id, docType);
      toast.success(`${docType === 'bill' ? 'Bill' : 'Attendance'} marked as certified`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Certify document error:', err);
      toast.error(err.message || 'Failed to certify document');
    } finally {
      setCertifyingDocId(null);
    }
  };

  // Action: Delete document attachment
  const handleDeleteDocument = async (inv: InvoiceRecord, docType: 'bill' | 'attendance') => {
    const confirmed = window.confirm(`Delete ${docType === 'bill' ? 'Certified Bill' : 'Attendance Proof'} from ${inv.invoiceNo}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDocId(`${inv.id}-${docType}`);
    try {
      await deleteInvoiceDocApi(inv.id, docType);
      toast.success(`${docType === 'bill' ? 'Bill' : 'Attendance'} removed`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Delete document error:', err);
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Handle Inline Certified Bill Upload
  const handleUploadCertifiedBill = async (inv: InvoiceRecord, file: File) => {
    setUploadingDocId(inv.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('invoiceId', inv.id);
      formData.append('docType', 'bill');
      formData.append('fileName', `${inv.invoiceNo}_Certified_Bill.${file.name.split('.').pop()}`);

      const res = await fetchWithRetry('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errMsg = `Upload failed with status ${res.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errMsg = parsed.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      toast.success(`Bill uploaded for ${inv.invoiceNo} (Click "Mark as Certified" to confirm)`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Upload certified bill error:', err);
      toast.error(err.message || 'Failed to upload certified bill');
    } finally {
      setUploadingDocId(null);
    }
  };

  // Handle Inline Certified Attendance Upload
  const handleUploadCertifiedAttendance = async (inv: InvoiceRecord, file: File) => {
    setUploadingAttId(inv.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('invoiceId', inv.id);
      formData.append('docType', 'attendance');
      formData.append('fileName', `${inv.invoiceNo}_Certified_Attendance.${file.name.split('.').pop()}`);

      const res = await fetchWithRetry('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errMsg = `Upload failed with status ${res.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error) errMsg = parsed.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      toast.success(`Attendance uploaded for ${inv.invoiceNo} (Click "Mark as Certified" to confirm)`);
      await loadInvoices();
    } catch (err: any) {
      console.error('Upload certified attendance error:', err);
      toast.error(err.message || 'Failed to upload certified attendance');
    } finally {
      setUploadingAttId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-teal-200 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Invoice Lineage &amp; Document Tracker</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Full lifecycle tracking (Proforma → Revision → Tax Invoice) with document certification verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Period Selector */}
          <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white text-xs text-gray-800 shadow-xs gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent outline-none text-xs font-medium cursor-pointer"
            >
              <option value="All">All Months</option>
              {distinctPeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-white text-xs text-gray-800 shadow-xs gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter site, invoice #, reason..."
              className="bg-transparent outline-none w-44 text-xs"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadInvoices}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-slate-50 text-gray-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh Lineage Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#20B2AA]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Month-Level Summary Strip (Driven by confirmed_at verification) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Groups & Billed Sum */}
        <button
          type="button"
          onClick={() => setStatFilter('all')}
          className={`p-4 rounded-xl border transition-all text-left cursor-pointer shadow-xs ${
            statFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400/20'
              : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statFilter === 'all' ? 'text-slate-300' : 'text-gray-500 font-medium'}>
              Total Lineages
            </span>
            <Layers className={`w-4 h-4 ${statFilter === 'all' ? 'text-teal-400' : 'text-[#20B2AA]'}`} />
          </div>
          <div className="text-xl font-bold font-mono tracking-tight">{summaryStats.totalGroups}</div>
          <div className={`text-[11px] mt-1 font-mono ${statFilter === 'all' ? 'text-teal-300' : 'text-teal-700'}`}>
            ₹{formatCurrency(summaryStats.grandTotalSum)}
          </div>
        </button>

        {/* Fully Certified */}
        <button
          type="button"
          onClick={() => setStatFilter(statFilter === 'fully-certified' ? 'all' : 'fully-certified')}
          className={`p-4 rounded-xl border transition-all text-left cursor-pointer shadow-xs ${
            statFilter === 'fully-certified'
              ? 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-400/20'
              : 'bg-white text-gray-800 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statFilter === 'fully-certified' ? 'text-emerald-100' : 'text-gray-500 font-medium'}>
              Fully Certified
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statFilter === 'fully-certified' ? 'text-emerald-200' : 'text-emerald-600'}`} />
          </div>
          <div className="text-xl font-bold font-mono tracking-tight">
            <span className={statFilter === 'fully-certified' ? 'text-white' : 'text-emerald-700'}>
              {summaryStats.fullyCertifiedCount}
            </span>
          </div>
          <div className={`text-[11px] mt-1 ${statFilter === 'fully-certified' ? 'text-emerald-200' : 'text-gray-400'}`}>
            Bill &amp; Attendance Confirmed
          </div>
        </button>

        {/* Missing Proofs */}
        <button
          type="button"
          onClick={() => setStatFilter(statFilter === 'missing-docs' ? 'all' : 'missing-docs')}
          className={`p-4 rounded-xl border transition-all text-left cursor-pointer shadow-xs ${
            statFilter === 'missing-docs'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/20'
              : 'bg-white text-gray-800 border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statFilter === 'missing-docs' ? 'text-amber-100' : 'text-gray-500 font-medium'}>
              Missing Proofs
            </span>
            <AlertTriangle className={`w-4 h-4 ${statFilter === 'missing-docs' ? 'text-amber-200' : 'text-amber-600'}`} />
          </div>
          <div className="text-xl font-bold font-mono tracking-tight">
            <span className={statFilter === 'missing-docs' ? 'text-white' : 'text-amber-700'}>
              {summaryStats.missingDocsCount}
            </span>
          </div>
          <div className={`text-[11px] mt-1 ${statFilter === 'missing-docs' ? 'text-amber-200' : 'text-gray-400'}`}>
            Unconfirmed / Pending Upload
          </div>
        </button>

        {/* Pending Proformas */}
        <button
          type="button"
          onClick={() => setStatFilter(statFilter === 'pending-proforma' ? 'all' : 'pending-proforma')}
          className={`p-4 rounded-xl border transition-all text-left cursor-pointer shadow-xs ${
            statFilter === 'pending-proforma'
              ? 'bg-blue-700 text-white border-blue-700 ring-2 ring-blue-400/20'
              : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statFilter === 'pending-proforma' ? 'text-blue-100' : 'text-gray-500 font-medium'}>
              Pending Proformas
            </span>
            <Clock className={`w-4 h-4 ${statFilter === 'pending-proforma' ? 'text-blue-200' : 'text-blue-600'}`} />
          </div>
          <div className="text-xl font-bold font-mono tracking-tight">
            <span className={statFilter === 'pending-proforma' ? 'text-white' : 'text-blue-700'}>
              {summaryStats.pendingProformasCount}
            </span>
          </div>
          <div className={`text-[11px] mt-1 ${statFilter === 'pending-proforma' ? 'text-blue-200' : 'text-gray-400'}`}>
            Requires Client Approval
          </div>
        </button>

        {/* Approved Proformas */}
        <button
          type="button"
          onClick={() => setStatFilter(statFilter === 'approved' ? 'all' : 'approved')}
          className={`p-4 rounded-xl border transition-all text-left cursor-pointer shadow-xs ${
            statFilter === 'approved'
              ? 'bg-purple-700 text-white border-purple-700 ring-2 ring-purple-400/20'
              : 'bg-white text-gray-800 border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={statFilter === 'approved' ? 'text-purple-100' : 'text-gray-500 font-medium'}>
              Approved Ready
            </span>
            <Sparkles className={`w-4 h-4 ${statFilter === 'approved' ? 'text-purple-200' : 'text-purple-600'}`} />
          </div>
          <div className="text-xl font-bold font-mono tracking-tight">
            <span className={statFilter === 'approved' ? 'text-white' : 'text-purple-700'}>
              {summaryStats.approvedProformasCount}
            </span>
          </div>
          <div className={`text-[11px] mt-1 ${statFilter === 'approved' ? 'text-purple-200' : 'text-gray-400'}`}>
            Ready for Tax Conversion
          </div>
        </button>
      </div>

      {/* Visual Lineage Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-xs text-gray-500">
          <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
          <span>Loading billing lineage cards...</span>
        </div>
      ) : displayedLineages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-xs text-gray-500 space-y-2 shadow-xs">
          <Kanban className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No invoice lineages match the active filter.</p>
          <p>Try selecting a different filter chip or searching another keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          {displayedLineages.map((group) => {
            const latestInv = group.invoices[group.invoices.length - 1];
            const isLatestProforma =
              latestInv &&
              (latestInv.type === 'Proforma Invoice' ||
                latestInv.type === 'Proforma' ||
                String(latestInv.type || '').toLowerCase().includes('proforma'));
            const isLatestCancelled = latestInv?.status === 'Cancelled';
            const isLatestApproved = latestInv?.status === 'Approved';

            return (
              <div
                key={group.key}
                className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                {/* Card Header: Site Name & Billing Period */}
                <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-gray-900 font-semibold text-sm truncate flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#20B2AA] flex-shrink-0" />
                      <span className="truncate">{group.siteName}</span>
                      {group.siteCodeName && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                          {group.siteCodeName}
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-500 text-xs font-mono mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span>{group.billingPeriod}</span>
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-[#20B2AA] border border-teal-200">
                    {group.invoices.length} {group.invoices.length === 1 ? 'Version' : 'Versions'}
                  </span>
                </div>

                {/* Card Body: All Invoices in Lineage Chain */}
                <div className="p-3.5 flex-1 bg-white space-y-3">
                  {group.invoices.map((inv, invIdx) => {
                    const isProforma =
                      inv.type === 'Proforma Invoice' ||
                      inv.type === 'Proforma' ||
                      String(inv.type || '').toLowerCase().includes('proforma');
                    const isCancelled = inv.status === 'Cancelled';
                    const isApproved = inv.status === 'Approved';
                    const isPending = inv.status === 'Pending';
                    const isLocked = Boolean(inv.is_locked || (inv as any).isLocked);
                    const hasGeneratedPdf = Boolean(
                      inv.generated_pdf_storage_key ||
                      (inv as any).generated_pdf_key ||
                      inv.generated_pdf_url ||
                      inv.generatedPdfUrl
                    );
                    const hasBillUpload = Boolean(inv.certified_doc_url || (inv as any).certifiedDocUrl);
                    const isBillConfirmed = Boolean(inv.certified_doc_confirmed_at || (inv as any).certifiedDocConfirmedAt);
                    const hasAttUpload = Boolean(inv.certified_attendance_url || (inv as any).certifiedAttendanceUrl);
                    const isAttConfirmed = Boolean(inv.certified_attendance_confirmed_at || (inv as any).certifiedAttendanceConfirmedAt);

                    return (
                      <div
                        key={inv.id}
                        className={`rounded-lg transition-all p-3 space-y-2.5 border ${
                          isCancelled
                            ? 'bg-gray-50/80 border-gray-200 opacity-60'
                            : isApproved
                            ? 'bg-purple-50/20 border-purple-100 hover:border-purple-200'
                            : 'bg-slate-50/40 border-gray-200/80 hover:bg-slate-50'
                        }`}
                      >
                        {/* Top Line: Lineage Badge + Invoice No + Type + Lock Status + Status */}
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="text-[10px] font-mono text-gray-400 font-semibold">
                              v{invIdx + 1}
                            </span>
                            <span
                              className={`text-xs font-semibold font-mono truncate ${
                                isCancelled ? 'text-red-600 line-through' : 'text-gray-900'
                              }`}
                            >
                              {inv.invoiceNo}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide ${
                                isProforma
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-teal-50 text-teal-800 border border-teal-200'
                              }`}
                            >
                              {inv.type}
                            </span>

                            {/* Legacy Badge */}
                            {inv.is_legacy && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5"
                                title="Legacy Historical Bill Record"
                              >
                                <span>Legacy</span>
                              </span>
                            )}

                            {/* Locked Badge */}
                            {isLocked && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-0.5"
                                title="This invoice is locked by SuperAdmin"
                              >
                                <Lock className="w-2.5 h-2.5 text-red-600" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* SuperAdmin Lock/Unlock Toggle */}
                            <button
                              type="button"
                              disabled={togglingLockId === inv.id}
                              onClick={() => handleToggleLock(inv)}
                              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title={isLocked ? 'Unlock invoice (SuperAdmin)' : 'Lock invoice (SuperAdmin)'}
                            >
                              {togglingLockId === inv.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                              ) : isLocked ? (
                                <Unlock className="w-3 h-3 text-red-500 hover:text-red-700" />
                              ) : (
                                <Lock className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>

                            {/* Status Badge */}
                            <span
                              title={isCancelled && inv.cancelled_reason ? `Reason: ${inv.cancelled_reason}` : undefined}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isCancelled
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : isApproved
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : inv.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : inv.status === 'Revised'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {inv.status || 'Pending'}
                            </span>
                          </div>
                        </div>

                        {/* If Cancelled: Show Reason */}
                        {isCancelled && inv.cancelled_reason && (
                          <div className="text-[10px] text-red-600 italic bg-red-50/50 px-2 py-1 rounded border border-red-100">
                            Reason: {inv.cancelled_reason}
                          </div>
                        )}

                        {/* Middle Line: Amount & Prominent Cancel / Approve Actions */}
                        <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                          <span className={`text-xs font-semibold font-mono ${isCancelled ? 'text-gray-400' : 'text-gray-900'}`}>
                            ₹{formatCurrency(Number(inv.grand_total || inv.amount || 0))}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Inline Approve Button for Pending Proforma */}
                            {!isCancelled && isProforma && isPending && (
                              <button
                                type="button"
                                disabled={approvingId === inv.id}
                                onClick={() => handleApproveInvoice(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="Mark Proforma as Approved by Client"
                              >
                                {approvingId === inv.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                )}
                                <span>Approve</span>
                              </button>
                            )}

                            {/* Prominent Cancel Button */}
                            {!isCancelled && (
                              <button
                                type="button"
                                disabled={cancellingId === inv.id}
                                onClick={() => handleCancelInvoice(inv)}
                                className="px-2 py-1 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 hover:border-red-600 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                                title="Cancel Invoice & Record Reason"
                              >
                                {cancellingId === inv.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                                ) : (
                                  <Ban className="w-3 h-3 text-current" />
                                )}
                                <span>Cancel</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Document Controls & Certification Flow */}
                        <div className="space-y-2 pt-1 border-t border-gray-100 text-xs">
                          {/* 1. Generated PDF View (Conditional on presence) */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] text-gray-500 font-medium">System Copy:</span>
                            {hasGeneratedPdf ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingDoc({
                                    id: inv.id,
                                    url: `/api/invoices/${inv.id}/document/generated/view`,
                                    fileName: `${inv.invoiceNo}_Generated.pdf`,
                                    title: `Invoice ${inv.invoiceNo} - Generated Copy`,
                                  })
                                }
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="View System Generated PDF"
                              >
                                <FileText className="w-3 h-3 text-indigo-600" />
                                <span>View PDF</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-50 text-gray-400 border border-gray-200 rounded text-[10px] font-normal italic select-none">
                                Not system-generated
                              </span>
                            )}
                          </div>

                          {/* Non-Cancelled Rows: Certified Bill & Attendance proof */}
                          {!isCancelled && (
                            <>
                              {/* 2. Certified Bill Slot */}
                              <div className="flex items-center justify-between gap-1 flex-wrap bg-white/80 p-1.5 rounded border border-gray-200/60">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[11px] font-semibold text-gray-700">Bill:</span>
                                  {hasBillUpload ? (
                                    isBillConfirmed ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        <span>Certified</span>
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                        <Paperclip className="w-3 h-3 text-slate-500" />
                                        <span>Uploaded — not certified</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic">No bill uploaded</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  {hasBillUpload ? (
                                    <>
                                      {/* View Bill */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingDoc({
                                            id: inv.id,
                                            url: `/api/invoices/${inv.id}/document/bill/view`,
                                            fileName: `${inv.invoiceNo}_Certified_Bill.pdf`,
                                            title: `Invoice ${inv.invoiceNo} - Certified Bill`,
                                            onDelete: () => handleDeleteDocument(inv, 'bill'),
                                          })
                                        }
                                        className="p-1 rounded bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-teal-200 transition-colors"
                                        title="View Uploaded Bill"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>

                                      {/* Mark as Certified Trigger (if not yet confirmed) */}
                                      {!isBillConfirmed && (
                                        <button
                                          type="button"
                                          disabled={certifyingDocId === `${inv.id}-bill`}
                                          onClick={() => handleMarkAsCertified(inv, 'bill')}
                                          className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                          title="Mark this uploaded bill as client certified"
                                        >
                                          {certifyingDocId === `${inv.id}-bill` ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-600" />
                                          ) : (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                          )}
                                          <span>Certify</span>
                                        </button>
                                      )}

                                      {/* Delete Bill Trigger */}
                                      <button
                                        type="button"
                                        disabled={deletingDocId === `${inv.id}-bill`}
                                        onClick={() => handleDeleteDocument(inv, 'bill')}
                                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete Uploaded Bill"
                                      >
                                        {deletingDocId === `${inv.id}-bill` ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                                        ) : (
                                          <Trash2 className="w-3 h-3" />
                                        )}
                                      </button>
                                    </>
                                  ) : (
                                    <label
                                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                        uploadingDocId === inv.id
                                          ? 'bg-gray-100 text-gray-400 border-gray-200'
                                          : 'text-[#20B2AA] border-[#20B2AA]/30 hover:bg-[#20B2AA]/10'
                                      }`}
                                      title="Upload Signed/Certified Bill"
                                    >
                                      {uploadingDocId === inv.id ? (
                                        <Loader2 className="w-2.5 h-2.5 animate-spin text-[#20B2AA]" />
                                      ) : (
                                        <Upload className="w-2.5 h-2.5 text-[#20B2AA]" />
                                      )}
                                      <span>+ Bill</span>
                                      <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        className="hidden"
                                        disabled={uploadingDocId === inv.id}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleUploadCertifiedBill(inv, e.target.files[0]);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>

                              {/* 3. Certified Attendance Slot */}
                              <div className="flex items-center justify-between gap-1 flex-wrap bg-white/80 p-1.5 rounded border border-gray-200/60">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[11px] font-semibold text-gray-700">Att.:</span>
                                  {hasAttUpload ? (
                                    isAttConfirmed ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        <span>Certified</span>
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                        <Paperclip className="w-3 h-3 text-slate-500" />
                                        <span>Uploaded — not certified</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic">No attendance uploaded</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  {hasAttUpload ? (
                                    <>
                                      {/* View Attendance */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingDoc({
                                            id: inv.id,
                                            url: `/api/invoices/${inv.id}/document/attendance/view`,
                                            fileName: `${inv.invoiceNo}_Certified_Attendance.pdf`,
                                            title: `Invoice ${inv.invoiceNo} - Certified Attendance`,
                                            onDelete: () => handleDeleteDocument(inv, 'attendance'),
                                          })
                                        }
                                        className="p-1 rounded bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-teal-200 transition-colors"
                                        title="View Uploaded Attendance"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>

                                      {/* Mark as Certified Trigger */}
                                      {!isAttConfirmed && (
                                        <button
                                          type="button"
                                          disabled={certifyingDocId === `${inv.id}-attendance`}
                                          onClick={() => handleMarkAsCertified(inv, 'attendance')}
                                          className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                          title="Mark this uploaded attendance muster as client certified"
                                        >
                                          {certifyingDocId === `${inv.id}-attendance` ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-600" />
                                          ) : (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                          )}
                                          <span>Certify</span>
                                        </button>
                                      )}

                                      {/* Delete Attendance Trigger */}
                                      <button
                                        type="button"
                                        disabled={deletingDocId === `${inv.id}-attendance`}
                                        onClick={() => handleDeleteDocument(inv, 'attendance')}
                                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete Uploaded Attendance"
                                      >
                                        {deletingDocId === `${inv.id}-attendance` ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                                        ) : (
                                          <Trash2 className="w-3 h-3" />
                                        )}
                                      </button>
                                    </>
                                  ) : (
                                    <label
                                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                        uploadingAttId === inv.id
                                          ? 'bg-gray-100 text-gray-400 border-gray-200'
                                          : 'text-[#20B2AA] border-[#20B2AA]/30 hover:bg-[#20B2AA]/10'
                                      }`}
                                      title="Upload Certified Attendance Sheet"
                                    >
                                      {uploadingAttId === inv.id ? (
                                        <Loader2 className="w-2.5 h-2.5 animate-spin text-[#20B2AA]" />
                                      ) : (
                                        <Upload className="w-2.5 h-2.5 text-[#20B2AA]" />
                                      )}
                                      <span>+ Att.</span>
                                      <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        className="hidden"
                                        disabled={uploadingAttId === inv.id}
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleUploadCertifiedAttendance(inv, e.target.files[0]);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Group-Level Action Bar (Below All Rows) */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                  {/* Case 1: Latest is Proforma and Cancelled -> + New Proforma */}
                  {isLatestProforma && isLatestCancelled && (
                    <button
                      type="button"
                      disabled={creatingRevisionId === latestInv.id}
                      onClick={() => handleCreateNewProforma(latestInv)}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      title="Create next revision linked to cancelled proforma"
                    >
                      {creatingRevisionId === latestInv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>+ New Proforma (Revision)</span>
                    </button>
                  )}

                  {/* Case 2: Latest is Proforma and Approved -> Convert to Tax Invoice */}
                  {isLatestProforma && isLatestApproved && (
                    <button
                      type="button"
                      disabled={convertingId === latestInv.id}
                      onClick={() => handleConvertToTaxInvoice(latestInv)}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      title="Generate Tax Invoice from this Approved Proforma"
                    >
                      {convertingId === latestInv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>Convert to Tax Invoice</span>
                    </button>
                  )}

                  {/* Case 3: All caught up / Tax Invoice / Pending state info */}
                  {(!isLatestProforma || (!isLatestCancelled && !isLatestApproved)) && (
                    <div className="w-full flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>Latest: {latestInv?.type}</span>
                      <span className="font-semibold text-gray-700">{latestInv?.status || 'Pending'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        documentId={viewingDoc?.id}
        url={viewingDoc?.url}
        fileName={viewingDoc?.fileName}
        title={viewingDoc?.title}
        onDelete={viewingDoc?.onDelete}
      />
    </div>
  );
};
