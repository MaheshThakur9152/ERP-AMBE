import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, fetchWithRetry } from '@/lib/apiClient';
import {
  FileText,
  Upload,
  FileCheck,
  User,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  CloudUpload,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StaffOption {
  id: string;
  name: string;
  biometricCode?: string;
  role?: string;
  siteName?: string;
}

interface EmployeeDocument {
  id: string;
  staff_id: string;
  document_type: string;
  file_name: string;
  view_url?: string;
  gcp_file_url?: string | null;
  storage_provider?: string | null;
  storage_key?: string | null;
  uploaded_at: string;
  staff?: {
    employee_name?: string;
    designation?: string;
  };
}

const DOCUMENT_TYPES = [
  'ID Proof',
  'Address Proof',
  'Bank Details',
  'Certificates',
  'Aadhar Card',
  'PAN Card',
  'Other',
];

export const EmployeeDocuments: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('ID Proof');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [filterStaffId, setFilterStaffId] = useState<string>('All');
  const [filterDocType, setFilterDocType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, employee_name, biometric_code, designation, site_id, sites:site_id(site_name)');

      if (error) {
        console.error('Failed to fetch staff list:', error);
      } else if (data) {
        const mapped: StaffOption[] = (data as any[])
          .map((item) => ({
            id: item.id,
            name: item.employee_name || 'Unnamed Employee',
            biometricCode: item.biometric_code || '',
            role: item.designation || '',
            siteName: item.sites?.site_name || '',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setStaffList(mapped);
        if (mapped.length > 0 && !selectedStaffId) {
          setSelectedStaffId(mapped[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await fetchWithRetry('/api/documents/employee');
      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
          setDocuments(json.data as EmployeeDocument[]);
          return;
        }
      }

      // Fallback to Supabase direct query
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*, staff:staff_id(employee_name, designation)')
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching employee documents:', error);
      } else if (data) {
        setDocuments(data as EmployeeDocument[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchDocuments();
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

    if (uploading) return; // prevent double submit

    if (!selectedFile) {
      setUploadMessage({ type: 'error', text: 'Please select a file to upload.' });
      return;
    }
    if (!selectedStaffId) {
      setUploadMessage({ type: 'error', text: 'Please select an employee.' });
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setUploadMessage({ type: 'error', text: 'File size exceeds strict 2MB limit.' });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const selectedEmployee = staffList.find((s) => s.id === selectedStaffId);
      const employeeName = selectedEmployee?.name || '';
      const siteName = selectedEmployee?.siteName || '';
      const designation = selectedEmployee?.role || '';

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('staff_id', selectedStaffId);
      formData.append('employeeName', employeeName);
      formData.append('docType', documentType);
      formData.append('document_type', documentType);
      formData.append('siteName', siteName);
      formData.append('designation', designation);

      const response = await fetchWithRetry('/api/documents/upload', {
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

      const uploadResult = await response.json();

      if (!uploadResult.view_url && !uploadResult.gcp_file_url) {
        throw new Error('Backend did not return a valid file URL.');
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadMessage({
        type: 'success',
        text: `Document "${uploadResult.file_name || selectedFile.name}" successfully uploaded to secure storage!`,
      });

      await fetchDocuments();
    } catch (err: any) {
      console.error('Upload Error:', err);
      setUploadMessage({
        type: 'error',
        text: err.message || 'Failed to upload document. Please check console.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      const { error } = await supabase.from('employee_documents').delete().eq('id', id);
      if (error) {
        alert(`Failed to delete document: ${error.message}`);
      } else {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      }
    } catch (err) {
      console.error('Delete document error:', err);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesStaff = filterStaffId === 'All' || doc.staff_id === filterStaffId;
    const matchesDocType = filterDocType === 'All' || doc.document_type === filterDocType;
    const staffName = doc.staff?.employee_name?.toLowerCase() || '';
    const fileName = doc.file_name.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || staffName.includes(query) || fileName.includes(query);

    return matchesStaff && matchesDocType && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Employee Documents Vault
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Securely upload, manage, and view employee KYC &amp; compliance files in Google Cloud Storage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchStaff();
            fetchDocuments();
          }}
          className="px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5">
        <h2 className="font-bold text-sm uppercase tracking-wider text-[#20B2AA] flex items-center gap-2 border-b border-gray-100 pb-3">
          <CloudUpload className="w-4 h-4" />
          <span>Upload New Employee Document</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Select Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-xs"
                required
              >
                {staffList.length === 0 ? (
                  <option value="">No employees found</option>
                ) : (
                  staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.biometricCode ? `(Bio: ${s.biometricCode})` : ''} {s.role ? `- ${s.role}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

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
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Select Document File (PDF, Image, Doc) <span className="text-red-500">*</span>
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
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  {/* Spinning Loader */}
                  <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>

                  {/* Loading Text */}
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
                      <span className="text-[10px] text-gray-400">Supports PDF, PNG, JPG, DOCX (Max 2MB)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !selectedStaffId}
              className="px-6 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudUpload className={`w-4 h-4 ${uploading ? 'animate-bounce' : ''}`} />
              <span>{uploading ? 'Uploading...' : 'Upload to Cloud'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-gray-900 tracking-tight">Uploaded Document Repository</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/20">
              {filteredDocuments.length} Documents
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search file or staff name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
              />
            </div>

            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20"
            >
              <option value="All">All Employees</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Uploaded At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loadingDocs ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    Loading employee documents...
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    No employee documents found.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{doc.staff?.employee_name || 'Unknown Staff'}</div>
                      {doc.staff?.designation && (
                        <div className="text-[10px] text-gray-400 font-mono">
                          {doc.staff.designation}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/20 inline-block">
                        {doc.document_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-800 truncate max-w-xs">
                      {doc.file_name}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {new Date(doc.uploaded_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={doc.view_url || doc.gcp_file_url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-[#20B2AA]/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>View</span>
                          <Eye className="w-3 h-3" />
                        </a>
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
    </div>
  );
};

export default EmployeeDocuments;
