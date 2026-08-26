import React, { useState, useEffect } from 'react';
import { Site } from '../types';
import { fetchSitesApi, uploadSiteDocumentApi } from '../api/siteApi';
import { toast } from '@/components/ui/toast';
import {
  X,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Search,
  Tag,
  Building,
} from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSiteId?: string;
  initialDocumentType?: string;
  lockSite?: boolean;
  lockDocumentType?: boolean;
  sites?: Site[];
}

const DOCUMENT_TYPES = [
  'Work Order',
  'NOC',
  'Agreement',
  'Insurance',
  'Other',
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSiteId = '',
  initialDocumentType = 'Work Order',
  lockSite = false,
  lockDocumentType = false,
  sites: propSites,
}) => {
  const [sites, setSites] = useState<Site[]>(propSites || []);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId);
  const [siteSearch, setSiteSearch] = useState<string>('');
  const [docType, setDocType] = useState<string>(initialDocumentType || 'Work Order');
  const [customDocType, setCustomDocType] = useState<string>('');
  const [docLabel, setDocLabel] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedSiteId(initialSiteId || '');
      setSiteSearch('');
      setDocType(initialDocumentType || 'Work Order');
      setCustomDocType('');
      setDocLabel('');
      setFile(null);
      setErrorMessage(null);

      if (!propSites || propSites.length === 0) {
        setIsLoadingSites(true);
        fetchSitesApi()
          .then((data) => {
            setSites(data);
            if (initialSiteId) {
              setSelectedSiteId(initialSiteId);
            } else if (data.length > 0) {
              setSelectedSiteId(data[0].id);
            }
          })
          .catch((err) => {
            console.error('Failed to load sites for upload modal:', err);
          })
          .finally(() => setIsLoadingSites(false));
      } else {
        setSites(propSites);
        if (initialSiteId) {
          setSelectedSiteId(initialSiteId);
        } else if (propSites.length > 0) {
          setSelectedSiteId(propSites[0].id);
        }
      }
    }
  }, [isOpen, initialSiteId, initialDocumentType, propSites]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSiteId) {
      setErrorMessage('Please select a facility site.');
      return;
    }

    const finalType = docType === 'Other' && customDocType.trim() ? customDocType.trim() : docType;
    if (docType === 'Other' && !docLabel.trim() && !customDocType.trim()) {
      setErrorMessage('Document label or custom type specification is required when type is Other.');
      return;
    }

    if (!file) {
      setErrorMessage('Please select a file to upload (.pdf, .jpg, .jpeg, .png).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum allowed limit of 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadSiteDocumentApi(
        selectedSiteId,
        file,
        finalType,
        docLabel.trim() || undefined
      );

      toast.success(`Uploaded "${res.file_name}" successfully`);
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Upload modal error:', err);
      setErrorMessage(err.message || 'Failed to upload document. Please check connection and file type.');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  // Filter sites for select dropdown
  const filteredSites = sites.filter((s) => {
    if (!siteSearch.trim()) return true;
    const q = siteSearch.toLowerCase();
    const sName = (s.siteName || (s as any).site_name || '').toLowerCase();
    const cCode = (s.codeName || s.code_name || '').toLowerCase();
    const clName = (s.clientName || (s as any).client_name || '').toLowerCase();
    return sName.includes(q) || cCode.includes(q) || clName.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Dark Header Bar */}
        <div className="px-6 py-4 bg-[#34495E] text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-[#20B2AA] border border-[#20B2AA]/40 flex items-center justify-center">
              <Upload className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-snug">Upload Site Document</h3>
              <p className="text-xs text-slate-300">
                Automatic compression &amp; sync to GCP Storage and Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto bg-slate-50/50 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Facility Site Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Facility Site *</span>
              {lockSite && (
                <span className="text-[10px] font-mono text-[#20B2AA] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase font-semibold">
                  Locked for this site
                </span>
              )}
            </label>

            {lockSite && selectedSite ? (
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-xs flex items-center gap-2.5 text-xs font-medium text-gray-800">
                <MapPin className="w-4 h-4 text-[#20B2AA] shrink-0" />
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <span className="font-bold text-gray-900">{selectedSite.siteName || (selectedSite as any).site_name}</span>
                  {(selectedSite.codeName || selectedSite.code_name) && (
                    <span className="text-[10px] font-mono bg-teal-50 text-[#20B2AA] px-1.5 py-0.5 rounded border border-teal-200 font-semibold">
                      {selectedSite.codeName || selectedSite.code_name}
                    </span>
                  )}
                  <span className="text-gray-500 text-[11px]">({selectedSite.clientName})</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {sites.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter sites list..."
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#20B2AA] shadow-xs"
                    />
                  </div>
                )}
                <select
                  value={selectedSiteId}
                  disabled={isLoadingSites}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs cursor-pointer"
                >
                  <option value="" disabled>-- Select Facility Site --</option>
                  {isLoadingSites && <option value="">Loading sites from database...</option>}
                  {filteredSites.map((s) => {
                    const sName = s.siteName || (s as any).site_name || 'Site';
                    const cCode = s.codeName || s.code_name ? ` [${s.codeName || s.code_name}]` : '';
                    const client = s.clientName || (s as any).client_name || '';
                    return (
                      <option key={s.id} value={s.id}>
                        {sName}{cCode} — {client}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Document Type & Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Document Type *
              </label>
              <select
                value={docType}
                disabled={lockDocumentType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs cursor-pointer"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Document Label {docType === 'Other' ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                placeholder={docType === 'Other' ? 'e.g. Society Undertaking' : 'e.g. FY 2026-27 Renewal'}
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                required={docType === 'Other'}
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
              />
            </div>
          </div>

          {docType === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Custom Type Specification (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Pollution Board Clearance Certificate"
                value={customDocType}
                onChange={(e) => setCustomDocType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
              />
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Select Document File *
            </label>
            <div className="border-2 border-dashed border-gray-300 hover:border-[#20B2AA] bg-white rounded-xl p-5 transition-colors flex flex-col items-center justify-center cursor-pointer relative group">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setErrorMessage(null);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-10 h-10 rounded-full bg-teal-50 text-[#20B2AA] group-hover:bg-[#20B2AA] group-hover:text-white transition-colors flex items-center justify-center mb-2 shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              {file ? (
                <div className="text-center">
                  <span className="text-xs font-bold text-gray-900 block truncate max-w-xs">{file.name}</span>
                  <span className="text-[11px] text-teal-600 font-semibold mt-0.5 inline-block">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for auto-compression
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-xs font-bold text-gray-700 block">
                    Click to browse or drop file here
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5 inline-block">
                    Supports PDF, JPG, PNG up to 10MB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file || !selectedSiteId}
              className="px-5 py-2.5 rounded-xl bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compressing &amp; Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
