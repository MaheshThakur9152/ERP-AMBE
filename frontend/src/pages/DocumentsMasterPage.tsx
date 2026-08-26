import React, { useState, useEffect, useMemo } from 'react';
import { SiteDocument, Site } from '@/features/sites/types';
import { fetchAllDocumentsApi, deleteDocumentApi, fetchSitesApi } from '@/features/sites/api/siteApi';
import { DocumentUploadModal } from '@/features/sites/components/DocumentUploadModal';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast, ToastContainer } from '@/components/ui/toast';
import {
  FolderArchive,
  Search,
  Plus,
  RotateCcw,
  ExternalLink,
  Download,
  Trash2,
  FileText,
  FileCheck,
  ShieldCheck,
  Building,
  Loader2,
  Tag,
  Calendar,
  User,
} from 'lucide-react';

export const DocumentsMasterPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [siteFilter, setSiteFilter] = useState<string>('All');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [docsData, sitesData] = await Promise.all([
        fetchAllDocumentsApi(),
        fetchSitesApi().catch(() => [] as Site[]),
      ]);
      setDocuments(docsData);
      setSites(sitesData);
    } catch (err: any) {
      console.error('Failed to load documents data:', err);
      toast.error('Failed to load documents list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (doc: SiteDocument) => {
    if (!isSuperAdmin) {
      toast.error('Only superadmin can delete documents.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete "${doc.file_name}"?`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      await deleteDocumentApi(doc.id);
      toast.success('Document deleted successfully');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      console.error('Delete document error:', err);
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const site: any = (doc as any).sites || sites.find((s) => s.id === doc.site_id) || {};
      const siteName = (site.site_name || site.siteName || '').toLowerCase();
      const codeName = (site.code_name || site.codeName || '').toLowerCase();
      const clientName = (site.client_name || site.clientName || '').toLowerCase();
      const fileName = (doc.file_name || '').toLowerCase();
      const docLabel = (doc.document_label || '').toLowerCase();
      const docType = (doc.document_type || '').toLowerCase();

      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        siteName.includes(q) ||
        codeName.includes(q) ||
        clientName.includes(q) ||
        fileName.includes(q) ||
        docLabel.includes(q) ||
        docType.includes(q);

      const matchesType = typeFilter === 'All' || doc.document_type === typeFilter;
      const matchesSite = siteFilter === 'All' || doc.site_id === siteFilter;

      return matchesSearch && matchesType && matchesSite;
    });
  }, [documents, sites, searchTerm, typeFilter, siteFilter]);

  // Stat calculations
  const totalCount = documents.length;
  const workOrderCount = documents.filter((d) => d.document_type === 'Work Order').length;
  const complianceCount = documents.filter((d) => ['NOC', 'Agreement', 'Insurance'].includes(d.document_type)).length;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime())
        ? isoString
        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Documents Vault</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Centralized repository for site Work Orders, NOCs, compliance certificates, and client contracts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Refresh documents"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#20B2AA]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Documents</h3>
            <span className="p-2.5 rounded-xl bg-teal-50 text-[#20B2AA]">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-xs text-gray-500 mt-1">Archived across all facility locations</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-[#20B2AA]" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Work Orders</h3>
            <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <FileCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{workOrderCount}</div>
            <div className="text-xs text-indigo-600 mt-1">Active site contracts &amp; renewals</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-indigo-600" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Certificates &amp; NOCs</h3>
            <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{complianceCount}</div>
            <div className="text-xs text-emerald-600 mt-1">NOCs, policies &amp; agreements</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-emerald-500" />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        {/* Filter Controls Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search site, code, label, file..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
              />
            </div>

            {/* Document Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-xs"
            >
              <option value="All">All Document Types</option>
              <option value="Work Order">Work Order</option>
              <option value="NOC">NOC</option>
              <option value="Agreement">Agreement</option>
              <option value="Insurance">Insurance</option>
              <option value="Other">Other</option>
            </select>

            {/* Site Filter */}
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-xs max-w-xs truncate"
            >
              <option value="All">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteName || (s as any).site_name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-900">{filteredDocuments.length}</strong> of {totalCount} documents
          </span>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 uppercase font-bold text-[11px] text-gray-600 border-b border-gray-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Site Name</th>
                <th className="py-3.5 px-4">Client Party</th>
                <th className="py-3.5 px-4">Document Type</th>
                <th className="py-3.5 px-4">File Name &amp; Label</th>
                <th className="py-3.5 px-4">Uploaded Date</th>
                <th className="py-3.5 px-4">Uploaded By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#20B2AA] animate-spin" />
                      <span>Loading documents vault...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FolderArchive className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-700">No documents uploaded yet.</p>
                      <p className="text-[11px] text-gray-400">
                        Upload Work Orders, NOCs, or compliance files using the button above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const site: any = (doc as any).sites || sites.find((s) => s.id === doc.site_id) || {};
                  const siteName = site.site_name || site.siteName || 'Facility Site';
                  const codeName = site.code_name || site.codeName;
                  const clientName = site.client_name || site.clientName || '—';
                  const docUrl = doc.gcp_file_url || doc.drive_web_view_link;
                  const isDeleting = deletingId === doc.id;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Site Name & Code */}
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-[#20B2AA] shrink-0" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{siteName}</span>
                            {codeName && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-50 text-[#20B2AA] border border-teal-200 font-semibold">
                                {codeName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 font-medium text-gray-800">{clientName}</td>

                      {/* Document Type */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            doc.document_type === 'Work Order'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : doc.document_type === 'NOC'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-teal-50 text-[#20B2AA] border-teal-200'
                          }`}
                        >
                          {doc.document_type}
                        </span>
                      </td>

                      {/* File Name & Label */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-medium text-gray-800 truncate max-w-xs" title={doc.file_name}>
                            {doc.file_name}
                          </span>
                          {doc.document_label && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-sans">
                              <Tag className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                              <span>{doc.document_label}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Uploaded Date */}
                      <td className="py-3.5 px-4 text-gray-500 font-mono">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{formatDate(doc.uploaded_at || doc.created_at)}</span>
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="flex items-center gap-1 text-[11px]">
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{doc.uploaded_by || 'Admin'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {docUrl ? (
                            <>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg border border-teal-200 transition-colors"
                                title="View Document"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={docUrl}
                                download={doc.file_name}
                                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No link</span>
                          )}

                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc)}
                              disabled={isDeleting}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                              title="Delete Document (Superadmin only)"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
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

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={loadData}
        sites={sites}
      />
    </div>
  );
};
