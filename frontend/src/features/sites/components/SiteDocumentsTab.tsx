import React, { useState, useEffect } from 'react';
import { SiteDocument } from '../types';
import { fetchSiteDocumentsApi, uploadSiteDocumentApi } from '../api/siteApi';
import { toast } from '@/components/ui/toast';
import {
  FileText,
  Upload,
  ExternalLink,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  FileCheck,
  Calendar,
  Tag,
  Paperclip,
} from 'lucide-react';

interface SiteDocumentsTabProps {
  siteId: string;
  siteName: string;
}

const DOCUMENT_TYPES = [
  'Work Order',
  'NOC',
  'Agreement',
  'License',
  'Insurance Policy',
  'Other',
];

export const SiteDocumentsTab: React.FC<SiteDocumentsTabProps> = ({ siteId, siteName }) => {
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);

  // Upload Form State
  const [selectedDocType, setSelectedDocType] = useState<string>('Work Order');
  const [customDocType, setCustomDocType] = useState<string>('');
  const [docLabel, setDocLabel] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocuments = async () => {
    if (!siteId) return;
    setIsLoading(true);
    try {
      const data = await fetchSiteDocumentsApi(siteId);
      setDocuments(data);
    } catch (err: any) {
      console.error('Failed to load site documents:', err);
      toast.error('Failed to load site documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [siteId]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    const docType = selectedDocType === 'Other' && customDocType.trim() ? customDocType.trim() : selectedDocType;

    setIsUploading(true);
    try {
      const res = await uploadSiteDocumentApi(
        siteId,
        selectedFile,
        docType,
        docLabel.trim() || undefined
      );

      toast.success(`Document "${res.file_name}" uploaded successfully`);
      setSelectedFile(null);
      setDocLabel('');
      setCustomDocType('');
      setShowUploadForm(false);
      await loadDocuments();
    } catch (err: any) {
      console.error('Upload site document error:', err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime()) ? isoString : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#20B2AA]" />
            <span>Site Documents &amp; Certificates</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Store and manage work orders, NOCs, compliance certificates, and client agreements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDocuments}
            disabled={isLoading}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Refresh documents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#20B2AA]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="px-3 py-1.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showUploadForm ? 'Cancel' : '+ Upload Document'}</span>
          </button>
        </div>
      </div>

      {/* Upload Form Accordion/Card */}
      {showUploadForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="bg-white p-5 rounded-xl border border-teal-200 shadow-sm space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h4 className="text-xs font-bold uppercase text-[#20B2AA] tracking-wider flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Site Document</span>
            </h4>
            <span className="text-[11px] text-gray-400">PDFs, JPGs &amp; PNGs compressed automatically</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Document Type *</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {selectedDocType === 'Other' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custom Document Type *</label>
                <input
                  type="text"
                  placeholder="e.g. Society Undertaking"
                  value={customDocType}
                  onChange={(e) => setCustomDocType(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Document Label / Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Work Order 2026-27 Renewal"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select File *</label>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col items-center justify-center cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="w-5 h-5 text-gray-400 mb-1" />
              {selectedFile ? (
                <div className="text-center">
                  <span className="text-xs font-semibold text-gray-800">{selectedFile.name}</span>
                  <p className="text-[11px] text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-xs font-medium text-gray-700">Click or drag file to attach</span>
                  <p className="text-[11px] text-gray-400">PDF, PNG, JPG up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="px-4 py-2 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{isUploading ? 'Compressing & Uploading...' : 'Upload & Store'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Documents Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-xs text-gray-500 gap-2">
            <Loader2 className="w-6 h-6 text-[#20B2AA] animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-2 text-gray-500 text-xs">
            <FileText className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No documents uploaded for this site yet.</p>
            <p>Upload Work Orders, NOCs, or agreements using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 uppercase font-bold text-[11px] text-gray-600 border-b border-gray-200 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">File Name / Label</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => {
                  const docUrl = doc.gcp_file_url || doc.drive_web_view_link;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-[#20B2AA] border border-teal-200">
                          {doc.document_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 font-mono text-[11px] truncate max-w-xs" title={doc.file_name}>
                            {doc.file_name}
                          </span>
                          {doc.document_label && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Tag className="w-2.5 h-2.5 text-gray-400" />
                              <span>{doc.document_label}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{formatDate(doc.uploaded_at || doc.created_at)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {docUrl ? (
                            <>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-[#20B2AA] hover:bg-teal-50 border border-[#20B2AA]/30 transition-colors flex items-center gap-1 font-semibold text-[10px]"
                                title="View Document in New Tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>View</span>
                              </a>
                              <a
                                href={docUrl}
                                download={doc.file_name}
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No link available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
