import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '@/lib/apiClient';
import {
  FileText,
  Upload,
  Calendar,
  Building2,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  Loader2,
  FileCheck,
  Paperclip,
  Kanban,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchInvoicesApi } from '../api/invoiceApi';
import { InvoiceRecord } from '../types';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/features/invoices/utils/invoiceCalculator';

interface GroupedLineage {
  key: string;
  siteName: string;
  billingPeriod: string;
  invoices: InvoiceRecord[];
}

export const InvoiceTracker: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadingAttId, setUploadingAttId] = useState<string | null>(null);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInvoicesApi();
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load tracker invoices:', err);
      toast.error('Failed to load invoice lineage from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Group invoices by siteName & billing_period
  const groupedLineages = useMemo(() => {
    const groups: { [key: string]: InvoiceRecord[] } = {};

    invoices.forEach((inv) => {
      const site = inv.siteName || (inv as any).site_name || inv.payload?.party?.siteName || 'Unassigned Site';
      const period = inv.monthYear || inv.billing_period || (inv as any).month_year || inv.payload?.meta?.billingPeriod || 'Unknown Period';
      const groupKey = `${site}___${period}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(inv);
    });

    const result: GroupedLineage[] = Object.keys(groups).map((key) => {
      const [siteName, billingPeriod] = key.split('___');
      // Sort invoices in chronological / lineage order (created_at asc)
      const sortedInvoices = [...groups[key]].sort((a, b) => {
        const timeA = new Date(a.created_at || (a as any).created_at || 0).getTime();
        const timeB = new Date(b.created_at || (b as any).created_at || 0).getTime();
        return timeA - timeB;
      });

      return {
        key,
        siteName,
        billingPeriod,
        invoices: sortedInvoices,
      };
    });

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(
      (g) =>
        g.siteName.toLowerCase().includes(q) ||
        g.billingPeriod.toLowerCase().includes(q) ||
        g.invoices.some((inv) => inv.invoiceNo.toLowerCase().includes(q))
    );
  }, [invoices, searchQuery]);

  // Handle Inline Certified Bill Upload
  // Handle Inline Certified Bill Upload
  const handleUploadCertifiedBill = async (inv: InvoiceRecord, file: File) => {
    setUploadingDocId(inv.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('invoiceId', inv.id);
      formData.append('docType', 'bill');
      formData.append('fileName', `${inv.invoiceNo}_Certified_Bill.${file.name.split('.').pop()}`);

      const res = await fetch(getApiUrl('/api/invoices/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const json = await res.json();
      const docUrl = json.webViewLink || json.gcp_file_url || json.certified_doc_url;

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? { ...item, certified_doc_url: docUrl, certifiedDocUrl: docUrl }
            : item
        )
      );

      toast.success(`Certified Bill attached to ${inv.invoiceNo}`);
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

      const res = await fetch(getApiUrl('/api/invoices/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const json = await res.json();
      const attUrl = json.webViewLink || json.gcp_file_url || json.certified_attendance_url || json.certified_doc_url;

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? { ...item, certified_attendance_url: attUrl, certifiedAttendanceUrl: attUrl }
            : item
        )
      );

      toast.success(`Certified Attendance attached to ${inv.invoiceNo}`);
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-teal-200 flex items-center justify-center flex-shrink-0">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Invoice Lineage &amp; Document Tracker</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Visual billing progression (Proforma → Revision → Tax Invoice) and certified file attachments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs text-gray-800 shadow-xs gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter site, period, invoice #..."
              className="bg-transparent outline-none w-48 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={loadInvoices}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-slate-100 text-gray-700 transition-colors shadow-xs"
            title="Refresh Lineage Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Responsive Visual Lineage Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-xs text-gray-500">
          <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
          <span>Loading billing lineage cards...</span>
        </div>
      ) : groupedLineages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-xs text-gray-500 space-y-2">
          <Kanban className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No invoice lineages found.</p>
          <p>Create proforma or tax invoices in Invoice Hub to see lineage tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {groupedLineages.map((group) => (
            <div
              key={group.key}
              className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Card Header: Site Name & Billing Period (Minimalist White) */}
              <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-gray-800 font-semibold text-sm truncate flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#20B2AA] flex-shrink-0" />
                    <span>{group.siteName}</span>
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

              {/* Card Body: Streamlined List Items */}
              <div className="p-4 flex-1 bg-white divide-y divide-gray-50 space-y-1">
                {group.invoices.map((inv) => {
                  const isProforma = inv.type === 'Proforma Invoice';
                  const certDoc = inv.certified_doc_url || inv.certifiedDocUrl || (inv as any).certified_doc_url;
                  const certAtt = inv.certified_attendance_url || inv.certifiedAttendanceUrl || (inv as any).certified_attendance_url;

                  return (
                    <div
                      key={inv.id}
                      className="py-2.5 px-2 hover:bg-slate-50/80 rounded-lg transition-colors space-y-1.5"
                    >
                      {/* Top Row: Invoice No, Type Badge, Status */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 font-mono">{inv.invoiceNo}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                              isProforma
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-teal-50 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {inv.type}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === 'Revised'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : inv.status === 'Approved'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {inv.status || 'Pending'}
                        </span>
                      </div>

                      {/* Bottom Row: Amount + Minimal Outlined Buttons */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-sm font-medium text-gray-900 font-sans">
                          ₹{formatCurrency(Number(inv.amount || (inv as any).grand_total || 0))}
                        </span>

                        {/* Minimal Outlined Upload Buttons */}
                        <div className="flex items-center gap-2">
                          {/* 1. Upload / View Certified Bill */}
                          {certDoc ? (
                            <a
                              href={certDoc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 hover:bg-[#20B2AA]/10 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                              title="View Certified Bill PDF"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-[#20B2AA]" />
                              <span>Bill</span>
                            </a>
                          ) : (
                            <label
                              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                uploadingDocId === inv.id
                                  ? 'bg-gray-100 text-gray-400 border-gray-200'
                                  : 'text-[#20B2AA] border-[#20B2AA]/30 hover:bg-[#20B2AA]/10'
                              }`}
                              title="Upload Certified Bill PDF"
                            >
                              {uploadingDocId === inv.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#20B2AA]" />
                              ) : (
                                <Upload className="w-3 h-3 text-[#20B2AA]" />
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

                          {/* 2. Upload / View Certified Attendance */}
                          {certAtt ? (
                            <a
                              href={certAtt}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 hover:bg-[#20B2AA]/10 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                              title="View Certified Attendance sheet"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-[#20B2AA]" />
                              <span>Attendance</span>
                            </a>
                          ) : (
                            <label
                              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                uploadingAttId === inv.id
                                  ? 'bg-gray-100 text-gray-400 border-gray-200'
                                  : 'text-[#20B2AA] border-[#20B2AA]/30 hover:bg-[#20B2AA]/10'
                              }`}
                              title="Upload Certified Attendance sheet"
                            >
                              {uploadingAttId === inv.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#20B2AA]" />
                              ) : (
                                <Upload className="w-3 h-3 text-[#20B2AA]" />
                              )}
                              <span>+ Attendance</span>
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
