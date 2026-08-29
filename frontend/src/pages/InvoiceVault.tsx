import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, fetchWithRetry } from '@/lib/apiClient';
import {
  FileText,
  Upload,
  Building,
  Calendar,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  CloudUpload,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Tag,
  Hash,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';

interface CompanyDocument {
  id: string;
  entity: string;
  doc_type: string;
  month: string;
  year: string;
  site_name: string;
  file_name: string;
  view_url?: string;
  gcp_file_url?: string;
  storage_provider?: string;
  storage_key?: string;
  created_at: string;
}

const ENTITIES = ['Ambe', 'ASF'];
const DOCUMENT_TYPES = ['Tax Invoice', 'Proforma Invoice', 'Certified Attendance'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = ['2026', '2025', '2024', '2023'];

export const InvoiceVault: React.FC = () => {
  const [entity, setEntity] = useState<string>('Ambe');
  const [documentType, setDocumentType] = useState<string>('Tax Invoice');
  const [month, setMonth] = useState<string>('Jan');
  const [year, setYear] = useState<string>('2026');
  const [siteName, setSiteName] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ id: string; fileName: string; title: string; url?: string } | null>(null);

  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);

  // Filters
  const [filterEntity, setFilterEntity] = useState<string>('All');
  const [filterDocType, setFilterDocType] = useState<string>('All');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase.from('sites').select('site_name, code_name');
      if (data) {
        const names = data
          .map((s) => s.code_name || s.site_name)
          .filter(Boolean)
          .sort();
        setSiteOptions(Array.from(new Set(names)));
        if (names.length > 0 && !siteName) {
          setSiteName(names[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchCompanyDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('company_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching company documents:', error);
      } else if (data) {
        setDocuments(data as CompanyDocument[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching company documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchCompanyDocuments();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploading) return;

    if (!selectedFile) {
      setUploadMessage({ type: 'error', text: 'Please select a document file to upload.' });
      return;
    }
    if (!siteName) {
      setUploadMessage({ type: 'error', text: 'Please select or enter a site name.' });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      // Auto-naming logic
      const cleanSite = siteName.replace(/[^a-zA-Z0-9]/g, '_');
      const extension = selectedFile.name.split('.').pop() || 'pdf';
      const generatedName = `${entity}_${documentType}_${month}_${year}_${cleanSite}_${
        billNumber ? 'Bill-' + billNumber : ''
      }.${extension}`.replace(/\s+/g, '');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('file_name', generatedName);
      formData.append('generatedName', generatedName);
      formData.append('entity', entity);
      formData.append('docType', documentType);
      formData.append('document_type', documentType);
      formData.append('month', month);
      formData.append('year', year);
      formData.append('siteName', siteName);
      formData.append('site_name', siteName);

      const response = await fetchWithRetry('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Upload failed' }));
        const errorDetails = errJson.details
          ? `${errJson.error || 'Upload failed'} - ${errJson.details}`
          : errJson.error || `Upload failed with status ${response.status}`;
        throw new Error(errorDetails);
      }

      const result = await response.json();

      setSelectedFile(null);
      setBillNumber('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setUploadMessage({
        type: 'success',
        text: `Document "${result.file_name || generatedName}" successfully uploaded to Google Drive Vault!`,
      });

      await fetchCompanyDocuments();
    } catch (err: any) {
      console.error('Invoice Vault Upload Error:', err);
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to upload invoice document. Please check console.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      const { error } = await supabase.from('company_documents').delete().eq('id', id);
      if (error) {
        alert(`Failed to delete document: ${error.message}`);
      } else {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      }
    } catch (err) {
      console.error('Delete company document error:', err);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesEntity = filterEntity === 'All' || doc.entity === filterEntity;
    const matchesDocType = filterDocType === 'All' || doc.doc_type === filterDocType;
    const matchesYear = filterYear === 'All' || doc.year === filterYear;

    const query = searchQuery.toLowerCase();
    const site = (doc.site_name || '').toLowerCase();
    const fileName = (doc.file_name || '').toLowerCase();
    const matchesSearch = !query || site.includes(query) || fileName.includes(query);

    return matchesEntity && matchesDocType && matchesYear && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Company Invoice &amp; Attendance Vault
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated file naming &amp; structured Google Drive archiving for Tax Invoices, Proforma &amp; Certified Attendance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchSites();
            fetchCompanyDocuments();
          }}
          className="px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
          <span>Refresh Vault</span>
        </button>
      </div>

      {/* Upload Form Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5">
        <h2 className="font-bold text-sm uppercase tracking-wider text-[#20B2AA] flex items-center gap-2 border-b border-gray-100 pb-3">
          <CloudUpload className="w-4 h-4" />
          <span>Upload &amp; Auto-Name New Document</span>
        </h2>

        {uploadMessage && (
          <div
            className={`p-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
              uploadMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            )}
            <span>{uploadMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Entity Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                Entity <span className="text-red-500">*</span>
              </label>
              <select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                required
              >
                {ENTITIES.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Type Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-gray-400" />
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                required
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Month <span className="text-red-500">*</span>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                required
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                Year <span className="text-red-500">*</span>
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                required
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Site Name Input / Dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                Site Name <span className="text-red-500">*</span>
              </label>
              {siteOptions.length > 0 ? (
                <select
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                  required
                >
                  <option value="">Select a Site</option>
                  {siteOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Phoenix_Mall"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                  required
                />
              )}
            </div>

            {/* Bill Number (Optional) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                Bill Number <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1042"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
              />
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Select Document File (PDF, Image) <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                uploading
                  ? 'border-teal-400 bg-teal-50/40 cursor-wait'
                  : isDragging
                  ? 'border-[#20B2AA] bg-teal-50/70 scale-[0.99]'
                  : selectedFile
                  ? 'border-green-300 bg-green-50/40'
                  : 'border-gray-300 bg-slate-50/50 hover:border-[#20B2AA] hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700 animate-pulse">
                      Processing Document...
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Communicating with Google Drive. This may take up to 10 seconds.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-[#20B2AA] flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>

                  {selectedFile ? (
                    <div>
                      <span className="font-bold text-xs text-gray-800 block">{selectedFile.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-gray-700 block">
                        Drag &amp; drop file here, or <span className="text-[#20B2AA] underline">browse</span>
                      </span>
                      <span className="text-[10px] text-gray-400">Supports PDF, PNG, JPG</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !siteName}
              className="px-6 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudUpload className={`w-4 h-4 ${uploading ? 'animate-bounce' : ''}`} />
              <span>{uploading ? 'Uploading...' : 'Upload to Cloud'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Data Grid Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-gray-900 tracking-tight">Invoice &amp; Attendance Repository</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/20">
              {filteredDocuments.length} Documents
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search site or file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
              />
            </div>

            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20"
            >
              <option value="All">All Entities</option>
              {ENTITIES.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>

            <select
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20"
            >
              <option value="All">All Types</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20"
            >
              <option value="All">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Site Name</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loadingDocs ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    Loading company documents...
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    No documents found in vault.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{doc.entity}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/20 inline-block">
                        {doc.doc_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {doc.month} {doc.year}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">{doc.site_name}</td>
                    <td className="py-3 px-4 font-mono text-gray-800 truncate max-w-xs" title={doc.file_name}>
                      {doc.file_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setViewingDoc({
                              id: doc.id,
                              fileName: doc.file_name,
                              title: `${doc.entity} - ${doc.doc_type} (${doc.site_name})`,
                              url: doc.view_url || doc.gcp_file_url,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-[#20B2AA]/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>View</span>
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Delete Document Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        documentId={viewingDoc?.id}
        url={viewingDoc?.url}
        fileName={viewingDoc?.fileName}
        title={viewingDoc?.title}
      />
    </div>
  );
};

export default InvoiceVault;
