import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, fetchWithRetry } from '@/lib/apiClient';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileCheck,
  Building,
  Phone,
  ShieldCheck,
  X,
  User,
  MapPin,
  Briefcase,
  Calendar,
  CreditCard,
  Eye,
  RefreshCw,
  Loader2,
  Lock,
} from 'lucide-react';
import { StaffFormModal } from '@/features/staff/components/StaffFormModal';
import { supabase } from '@/lib/supabase';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/context/AuthContext';

export const isMatchingDocType = (docType?: string | null, category?: string | null): boolean => {
  if (!docType || !category) return false;
  const cleanDoc = docType.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanCat = category.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleanCat.includes('aadhaar') || cleanCat.includes('aadhar')) {
    return cleanDoc.includes('aadhaar') || cleanDoc.includes('aadhar');
  }
  if (cleanCat.includes('pan')) {
    return cleanDoc.includes('pan');
  }
  if (cleanCat.includes('bank') || cleanCat.includes('passbook')) {
    return cleanDoc.includes('bank') || cleanDoc.includes('passbook');
  }
  if (cleanCat.includes('uan')) {
    return cleanDoc.includes('uan');
  }
  if (cleanCat.includes('esic') || cleanCat.includes('esi')) {
    return cleanDoc.includes('esic') || cleanDoc.includes('esi');
  }
  return cleanDoc === cleanCat;
};

export interface StaffKycStatus {
  hasAadhaar: boolean;
  hasPan: boolean;
  hasBank: boolean;
  hasUan: boolean;
  hasEsic: boolean;
  hasBankDoc: boolean;
  hasBankNumber: boolean;
  hasUanDoc: boolean;
  hasUanNumber: boolean;
  hasEsicDoc: boolean;
  hasEsicNumber: boolean;
  hasAadhaarDoc: boolean;
  hasAadhaarNumber: boolean;
  hasPanDoc: boolean;
  hasPanNumber: boolean;
  missingUanNumberPrompt: boolean;
  missingEsicNumberPrompt: boolean;
  docCount: number;
}

export const computeStaffKycStatus = (staff: StaffMember): StaffKycStatus => {
  const docs = staff.employee_documents || (staff as any).documents || [];

  const hasAadhaarDoc = docs.some((d: any) =>
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'Aadhaar Card')
  );
  const hasAadhaarNumber = Boolean((staff.aadharNo || staff.aadhar_no || '').trim());
  const hasAadhaar = hasAadhaarDoc || hasAadhaarNumber;

  const hasPanDoc = docs.some((d: any) =>
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'PAN Card')
  );
  const hasPanNumber = Boolean((staff.panNo || staff.pan_no || '').trim());
  const hasPan = hasPanDoc || hasPanNumber;

  const hasBankDoc = docs.some((d: any) =>
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'Bank Passbook') ||
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'Bank Details')
  );
  const hasBankNumber = Boolean(
    (staff.bank_account_no || staff.bankAccountNo || '').trim() ||
    (staff.bank_ifsc_code || staff.bankIfsc || '').trim()
  );
  const hasBank = hasBankDoc || hasBankNumber;

  const hasUanDoc = docs.some((d: any) =>
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'UAN Card')
  );
  const hasUanNumber = Boolean((staff.uan_no || '').trim());
  const hasUan = hasUanDoc || hasUanNumber;

  const hasEsicDoc = docs.some((d: any) =>
    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'ESIC Card')
  );
  const hasEsicNumber = Boolean((staff.esic_no || '').trim());
  const hasEsic = hasEsicDoc || hasEsicNumber;

  return {
    hasAadhaar,
    hasPan,
    hasBank,
    hasUan,
    hasEsic,
    hasBankDoc,
    hasBankNumber,
    hasUanDoc,
    hasUanNumber,
    hasEsicDoc,
    hasEsicNumber,
    hasAadhaarDoc,
    hasAadhaarNumber,
    hasPanDoc,
    hasPanNumber,
    missingUanNumberPrompt: hasUanDoc && !hasUanNumber,
    missingEsicNumberPrompt: hasEsicDoc && !hasEsicNumber,
    docCount: docs.length,
  };
};

interface StaffDocument {
  name: string;
  url: string;
  type: 'Aadhar' | 'PAN' | 'Bank Passbook' | 'Other';
  uploadedAt: string;
}

interface StaffMember {
  id: string;
  employee_name?: string;
  name?: string;
  biometric_code?: string;
  biometricCode?: string;
  phone?: string;
  designation?: string;
  role?: string;
  gender?: string;
  monthly_incentive?: number;
  site_id?: string;
  site_name?: string;
  siteName?: string;
  rate_card_id?: string;
  rate_cards?: any;
  sites?: {
    site_name?: string;
    code_name?: string;
    companies?: {
      name?: string;
    };
  };
  status?: string;
  joining_date?: string;
  joiningDate?: string;
  created_at?: string;
  photoUrl?: string;
  aadharNo?: string;
  aadhar_no?: string;
  panNo?: string;
  pan_no?: string;
  uan_no?: string;
  esic_no?: string;
  bank_account_no?: string;
  bankAccountNo?: string;
  bank_ifsc_code?: string;
  bankIfsc?: string;
  bank_name?: string;
  bankName?: string;
  payee_name?: string;
  payeeName?: string;
  compliance_name?: string;
  complianceName?: string;
  is_locked?: boolean;
  isLocked?: boolean;
  documents?: StaffDocument[];
  employee_documents?: { id: string; document_type?: string; gcp_file_url?: string; view_url?: string; file_name?: string }[];
}

export const StaffPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [filterMissingUan, setFilterMissingUan] = useState<boolean>(false);
  const [filterMissingEsic, setFilterMissingEsic] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Unified Staff Form Modal State
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Dedicated Document Viewer Modal State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerStaff, setViewerStaff] = useState<StaffMember | null>(null);
  const [viewerDocs, setViewerDocs] = useState<any[]>([]);
  const [activeDocPreview, setActiveDocPreview] = useState<{ id: string; fileName: string; title: string; url?: string } | null>(null);
  const [viewerStaffName, setViewerStaffName] = useState('');
  const [dragOverDocType, setDragOverDocType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Missing Documents Multi-Select Filter State
  const [missingDocFilters, setMissingDocFilters] = useState<string[]>([]);
  const [isDocFilterOpen, setIsDocFilterOpen] = useState<boolean>(false);
  const docFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (docFilterRef.current && !docFilterRef.current.contains(e.target as Node)) {
        setIsDocFilterOpen(false);
      }
    };
    if (isDocFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDocFilterOpen]);

  // Global Escape keydown listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDocPreview) {
          setActiveDocPreview(null);
        } else if (isViewerOpen) {
          setIsViewerOpen(false);
        } else if (staffModalOpen) {
          setStaffModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDocPreview, isViewerOpen, staffModalOpen]);

  const handleUploadDocumentForStaff = async (
    staff: StaffMember,
    file: File,
    docType: string
  ) => {
    if (!file || !staff) {
      toast.error('Missing file or staff for document upload');
      return;
    }
    if (uploadingDocType) {
      console.warn(`[StaffViewer] Upload already in progress for ${uploadingDocType}, ignoring request for ${docType}`);
      return;
    }
    const staffId = staff.id || (staff as any).staff_id;
    if (!staffId) {
      console.error('[StaffViewer] Upload failed: missing staffId on staff object', staff);
      toast.error('Staff ID missing for upload');
      return;
    }

    setUploadingDocType(docType);
    try {
      const empName = staff.employee_name || staff.name || 'Staff';
      const site = staff.sites?.site_name || staff.site_name || staff.siteName || '';
      const designation = staff.designation || staff.role || '';

      console.log(`[StaffViewer] Uploading ${docType} for employee id=${staffId} (${empName}), fileName=${file.name}`);

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('staff_id', staffId);
      uploadData.append('employee_name', empName);
      uploadData.append('employeeName', empName);
      uploadData.append('doc_type', docType);
      uploadData.append('docType', docType);
      uploadData.append('document_type', docType);
      uploadData.append('site_name', site);
      uploadData.append('siteName', site);
      uploadData.append('designation', designation);

      const response = await fetchWithRetry('/api/documents/upload', {
        method: 'POST',
        body: uploadData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errJson.error || `Upload failed with status ${response.status}`);
      }

      const resJson = await response.json();
      const newDoc = resJson.document || {
        id: resJson.document?.id || `temp-${Date.now()}`,
        staff_id: staffId,
        document_type: docType,
        file_name: file.name,
        view_url: resJson.view_url,
        gcp_file_url: resJson.gcp_file_url,
        uploaded_at: new Date().toISOString(),
      };

      // 1. Update viewerDocs
      setViewerDocs((prev) => [
        ...prev.filter(
          (d) => !isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
        ),
        newDoc,
      ]);

      // 2. Update staffList in-place using stable staffId so table badges reflect immediately regardless of filters
      setStaffList((prevList) =>
        prevList.map((s) => {
          if (s.id === staffId) {
            const currentDocs = s.employee_documents || s.documents || [];
            const updatedDocs = [
              ...currentDocs.filter(
                (d: any) => !isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
              ),
              newDoc,
            ];
            return {
              ...s,
              employee_documents: updatedDocs,
            };
          }
          return s;
        })
      );

      // 3. Update viewerStaff object reference in state
      setViewerStaff((prev) =>
        prev && prev.id === staffId
          ? {
              ...prev,
              employee_documents: [
                ...(prev.employee_documents || []).filter(
                  (d: any) => !isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
                ),
                newDoc,
              ],
            }
          : prev
      );

      // 4. Increment refreshKey for background query sync
      setRefreshKey((prev) => prev + 1);
      toast.success(`${docType} uploaded successfully`);
    } catch (err: any) {
      console.error('[StaffViewer] Document Upload Error:', err);
      toast.error(err.message || `Failed to upload ${docType}`);
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDeleteStaffDocument = async (
    documentId: string,
    fileName?: string,
    targetStaffRecord?: StaffMember | null
  ) => {
    if (!documentId) return;

    const currentStaff = targetStaffRecord || viewerStaff;
    if (Boolean(currentStaff?.is_locked) && !isSuperAdmin) {
      toast.error('Cannot delete documents: Staff record is locked by SuperAdmin');
      return;
    }

    const confirmed = window.confirm(
      `Delete this document${fileName ? ` "${fileName}"` : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingDocId(documentId);
    console.log(`[StaffViewer] Deleting document id=${documentId} (${fileName || 'unnamed'})`);
    try {
      const response = await fetchWithRetry(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errJson.error || `Failed to delete document (HTTP ${response.status})`);
      }

      toast.success('Document deleted successfully');

      // Update local state in sync
      setViewerDocs((prev) => prev.filter((d) => d.id !== documentId));
      setStaffList((prevList) =>
        prevList.map((s) => ({
          ...s,
          employee_documents: (s.employee_documents || []).filter((d: any) => d.id !== documentId),
        }))
      );
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('[StaffViewer] Delete document error:', err);
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Fetch live staff data on mount & refresh
  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*, sites(site_name, code_name, companies(name)), rate_cards(*), employee_documents(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching staff:', error);
      } else if (data) {
        setStaffList(data);
      }
    };

    fetchStaff();
  }, [refreshKey]);

  // Distinct designations for dropdown
  const allStaffDesignations = React.useMemo(() => {
    const defaults = [
      'Keyman',
      'HK',
      'Housekeeping',
      'Janitor',
      'Supervisor',
      'HK Supervisor',
      '(HK-SUP)',
      'LIFT OPERATOR',
      'Pantry',
      '58th Pantry',
      'Reliever',
      'Security Guard',
      'Store Assistant',
      'Trainee Staff',
      'HO - 58th',
      'HK - HO',
      'HK -P8',
    ];
    const fromStaff = staffList.map((s) => s.designation || s.role).filter(Boolean);
    return Array.from(new Set([...fromStaff, ...defaults])).filter(Boolean);
  }, [staffList]);

  // Missing Document metrics (checks both text number field and uploaded card document)
  const missingCounts = React.useMemo(() => {
    let aadhar = 0;
    let pan = 0;
    let bank = 0;
    let uan = 0;
    let esic = 0;
    for (const s of staffList) {
      const kyc = computeStaffKycStatus(s);
      if (!kyc.hasAadhaar) aadhar++;
      if (!kyc.hasPan) pan++;
      if (!kyc.hasBank) bank++;
      if (!kyc.hasUan) uan++;
      if (!kyc.hasEsic) esic++;
    }
    return { aadhar, pan, bank, uan, esic };
  }, [staffList]);

  const missingUanCount = missingCounts.uan;
  const missingEsicCount = missingCounts.esic;

  // Filtered staff list by search name, biometric code, site name, role, status, missing uan/esic, missing doc filters
  const filteredStaff = staffList.filter((staff) => {
    const empName = (staff.employee_name || staff.name || '').toLowerCase();
    const bioCode = (staff.biometric_code || staff.biometricCode || '').toLowerCase();
    const phone = (staff.phone || 'n/a').toLowerCase();
    const siteText = (
      staff.sites?.companies?.name
        ? `${staff.sites.companies.name} - ${staff.sites.code_name || staff.sites.site_name || ''}`
        : (staff.sites?.code_name || staff.sites?.site_name || staff.site_name || staff.siteName || '')
    ).toLowerCase();

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      empName.includes(searchLower) ||
      bioCode.includes(searchLower) ||
      phone.includes(searchLower) ||
      siteText.includes(searchLower);

    const roleName = staff.designation || staff.role || '';
    const matchesRole = roleFilter === 'All' || roleName === roleFilter;
    const matchesStatus = statusFilter === 'All' || staff.status === statusFilter;
    const kyc = computeStaffKycStatus(staff);
    const matchesUan = !filterMissingUan || !kyc.hasUan;
    const matchesEsic = !filterMissingEsic || !kyc.hasEsic;

    // Multi-select Missing Docs Filter: OR logic across selected doc types
    const matchesMissingDocs =
      missingDocFilters.length === 0 ||
      missingDocFilters.some((docKey) => {
        if (docKey === 'Aadhar') return !kyc.hasAadhaar;
        if (docKey === 'PAN') return !kyc.hasPan;
        if (docKey === 'Bank') return !kyc.hasBank;
        if (docKey === 'UAN') return !kyc.hasUan;
        if (docKey === 'ESIC') return !kyc.hasEsic;
        return false;
      });

    return matchesSearch && matchesRole && matchesStatus && matchesUan && matchesEsic && matchesMissingDocs;
  });

  const handleOpenAddModal = () => {
    setSelectedStaff(null);
    setStaffModalMode('add');
    setStaffModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setStaffModalMode('edit');
    setStaffModalOpen(true);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!id) {
      toast.error('Staff ID missing for deletion');
      return;
    }

    const targetStaff = staffList.find((s) => s.id === id);
    if (targetStaff?.is_locked && !isSuperAdmin) {
      toast.error('Cannot delete: Staff record is locked by SuperAdmin');
      return;
    }

    if (confirm('Are you sure you want to remove this staff member?')) {
      console.log(`[StaffEdit] Deleting staff id=${id}`);
      try {
        const response = await fetchWithRetry(`/api/staff/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Failed to delete staff (HTTP ${response.status})`);
        }

        setStaffList((prev) => prev.filter((s) => s.id !== id));
        setRefreshKey((prev) => prev + 1);
        toast.success('Staff member removed successfully');
      } catch (err: any) {
        console.error('[StaffEdit] Delete staff error:', err);
        toast.error(`Failed to delete staff: ${err.message || 'Server error'}`);
      }
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Staff &amp; Employee Directory
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage workforce records, biometric codes, salary details &amp; document KYC vault.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      <StaffFormModal
        isOpen={staffModalOpen}
        mode={staffModalMode}
        existingStaff={selectedStaff}
        onClose={() => setStaffModalOpen(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
          setStaffModalOpen(false);
        }}
      />

      {/* Main Staff Container (Extended Full Height & Search) */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Search & Filter Control Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input for Employee Names */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Employee Name, Code, Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-sm font-medium"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-sm font-medium"
            >
              <option value="All">All Roles</option>
              {allStaffDesignations.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-sm font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* Missing UAN Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterMissingUan((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMissingUan
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
              }`}
              title="Filter employees without UAN Number"
            >
              <span>Missing UAN</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filterMissingUan ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {missingUanCount}
              </span>
            </button>

            {/* Missing ESIC Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterMissingEsic((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMissingEsic
                  ? 'bg-orange-500 text-white border-orange-600 shadow-xs ring-2 ring-orange-500/20'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-300'
              }`}
              title="Filter employees without ESIC Number"
            >
              <span>Missing ESIC</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filterMissingEsic ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-800'
                }`}
              >
                {missingEsicCount}
              </span>
            </button>

            {/* Filter by Missing Docs Multi-Select Dropdown */}
            <div className="relative" ref={docFilterRef}>
              <button
                type="button"
                onClick={() => setIsDocFilterOpen((prev) => !prev)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${
                  missingDocFilters.length > 0
                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/20'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                title="Filter employees missing required KYC documents"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Filter by Missing Docs</span>
                {missingDocFilters.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white">
                      {missingDocFilters.length}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setMissingDocFilters([]);
                      }}
                      className="hover:bg-white/30 rounded p-0.5 ml-0.5 transition-colors cursor-pointer"
                      title="Clear doc filters"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </span>
                ) : null}
              </button>

              {isDocFilterOpen && (
                <div className="absolute left-0 mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 px-1">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Missing Document
                    </span>
                    {missingDocFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMissingDocFilters([])}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5 pt-1">
                    {[
                      { key: 'Aadhar', label: 'Aadhaar Card', count: missingCounts.aadhar, color: 'text-green-700 bg-green-50 border-green-200' },
                      { key: 'PAN', label: 'PAN Card', count: missingCounts.pan, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                      { key: 'Bank', label: 'Bank Details / Passbook', count: missingCounts.bank, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                      { key: 'UAN', label: 'UAN Card / No.', count: missingCounts.uan, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { key: 'ESIC', label: 'ESIC Card / No.', count: missingCounts.esic, color: 'text-orange-700 bg-orange-50 border-orange-200' },
                    ].map((item) => {
                      const isChecked = missingDocFilters.includes(item.key);
                      return (
                        <label
                          key={item.key}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors select-none"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setMissingDocFilters((prev) =>
                                  isChecked ? prev.filter((k) => k !== item.key) : [...prev, item.key]
                                );
                              }}
                              className="rounded border-gray-300 text-[#20B2AA] focus:ring-[#20B2AA] h-4 w-4 cursor-pointer"
                            />
                            <span className="font-medium text-gray-800">{item.label}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}
                          >
                            {item.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Showing <strong className="text-gray-900">{filteredStaff.length}</strong> of{' '}
            {staffList.length} staff records
          </div>
        </div>

        {/* Extended Staff Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm text-gray-700 min-w-[900px]">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4 text-center">Bio Code</th>
                <th className="py-3.5 px-4">Role / Site</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4 text-center">KYC Documents</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No staff found matching query "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const empName = staff.employee_name || staff.name || 'Unnamed Employee';
                  const bioCode = staff.biometric_code || staff.biometricCode || '-';
                  const roleName = staff.designation || staff.role || 'Staff';
                  const siteDisplay = staff.sites?.companies?.name
                    ? `${staff.sites.companies.name} - ${staff.sites.code_name || staff.sites.site_name || 'Unassigned'}`
                    : (staff.sites?.code_name || staff.sites?.site_name || staff.site_name || staff.siteName || 'Unassigned');
                  const phoneNo = staff.phone || 'N/A';
                  const joinDate = staff.created_at
                    ? new Date(staff.created_at).toLocaleDateString()
                    : (staff.joiningDate || 'N/A');

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee Profile */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                            {staff.photoUrl ? (
                              <img
                                src={staff.photoUrl}
                                alt={empName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#20B2AA]/10 text-[#20B2AA] flex items-center justify-center font-bold text-sm">
                                {empName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{empName}</div>
                            <div className="text-xs text-gray-400 font-mono">
                              Joined: {joinDate}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Biometric Code */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 font-mono font-bold text-xs text-gray-800">
                          {bioCode}
                        </span>
                      </td>

                      {/* Role & Site */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-800 text-xs">{roleName}</div>
                        <div className="text-xs text-gray-500 font-medium">{siteDisplay}</div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 font-mono text-xs text-gray-700">
                        {phoneNo}
                      </td>

                      {/* KYC Documents Badge */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {(() => {
                            const kyc = computeStaffKycStatus(staff);

                            return (
                              <>
                                {kyc.hasAadhaar ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200"
                                    title={kyc.hasAadhaarDoc ? 'Aadhaar Card uploaded' : 'Aadhaar Number entered'}
                                  >
                                    Aadhar ✓
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-200">
                                    No Aadhar
                                  </span>
                                )}
                                {kyc.hasPan ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    title={kyc.hasPanDoc ? 'PAN Card uploaded' : 'PAN Number entered'}
                                  >
                                    PAN ✓
                                  </span>
                                ) : null}
                                {kyc.hasBank ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                                    title={kyc.hasBankDoc ? 'Bank Passbook uploaded' : 'Bank Account entered'}
                                  >
                                    Bank ✓
                                  </span>
                                ) : null}
                                {kyc.hasUan ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                                    title={
                                      kyc.missingUanNumberPrompt
                                        ? 'UAN Card uploaded (Number field empty)'
                                        : kyc.hasUanDoc
                                        ? 'UAN Card uploaded & verified'
                                        : 'UAN Number entered'
                                    }
                                  >
                                    UAN ✓
                                  </span>
                                ) : null}
                                {kyc.hasEsic ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200"
                                    title={
                                      kyc.missingEsicNumberPrompt
                                        ? 'ESIC Card uploaded (Number field empty)'
                                        : kyc.hasEsicDoc
                                        ? 'ESIC Card uploaded & verified'
                                        : 'ESIC Number entered'
                                    }
                                  >
                                    ESIC ✓
                                  </span>
                                ) : null}
                              </>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={async () => {
                              const name = staff.employee_name || staff.name || 'Staff';
                              setViewerStaff(staff);
                              setViewerStaffName(name);
                              // Fetch latest documents for this staff member via backend endpoint
                              try {
                                const response = await fetchWithRetry(`/api/documents/employee?staff_id=${encodeURIComponent(staff.id)}`);
                                if (response.ok) {
                                  const json = await response.json();
                                  if (json.success && Array.isArray(json.data)) {
                                    setViewerDocs(json.data);
                                    setIsViewerOpen(true);
                                    return;
                                  }
                                }
                              } catch (e) {
                                console.warn('API fetch failed for KYC documents, falling back:', e);
                              }

                              const { data } = await supabase
                                .from('employee_documents')
                                .select('*')
                                .eq('staff_id', staff.id)
                                .order('uploaded_at', { ascending: false });
                              setViewerDocs(data || staff.employee_documents || []);
                              setIsViewerOpen(true);
                            }}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md transition-colors cursor-pointer ${
                              (staff.employee_documents?.length || staff.documents?.length || 0) > 0
                                ? 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100'
                                : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                            title="View Employee KYC Documents"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{staff.employee_documents?.length || staff.documents?.length || 0} Docs</span>
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            staff.status === 'Active'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {staff.status || 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(staff)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#20B2AA] bg-teal-50 hover:bg-teal-100 border border-[#20B2AA]/30 rounded-lg flex items-center gap-1 transition-colors"
                            title="Edit Staff & Documents"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit / KYC</span>
                          </button>

                          <button
                            type="button"
                            disabled={staff.is_locked && !isSuperAdmin}
                            onClick={() => handleDeleteStaff(staff.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              staff.is_locked && !isSuperAdmin
                                ? 'text-gray-300 cursor-not-allowed opacity-40'
                                : 'text-gray-400 hover:text-red-600 hover:bg-gray-100 cursor-pointer'
                            }`}
                            title={staff.is_locked && !isSuperAdmin ? 'Staff record is locked by SuperAdmin' : 'Delete Staff Record'}
                          >
                            <Trash2 className="w-4 h-4" />
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



      {/* Dedicated Lightweight Document Viewer Modal */}
      {isViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsViewerOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#20B2AA]" />
                <h3 className="text-sm font-bold text-gray-800">
                  KYC Documents: {viewerStaffName}
                </h3>
                {Boolean(viewerStaff?.is_locked) && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsViewerOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold text-sm transition-colors p-1 cursor-pointer"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Document List */}
            <div className="p-5 space-y-3">
              {['Aadhaar Card', 'PAN Card', 'Bank Passbook', 'UAN Card', 'ESIC Card'].map((docType) => {
                const uploadedDoc = viewerDocs.find((d) =>
                  isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
                );
                const isUploading = uploadingDocType === docType;
                const isDraggingOver = dragOverDocType === docType;
                const isViewerStaffLocked = Boolean(viewerStaff?.is_locked) && !isSuperAdmin;

                return (
                  <div
                    key={docType}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverDocType !== docType) setDragOverDocType(docType);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverDocType(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverDocType(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file && viewerStaff) {
                        handleUploadDocumentForStaff(viewerStaff, file, docType);
                      }
                    }}
                    className={`flex justify-between items-center p-3 border rounded-xl transition-all ${
                      isDraggingOver
                        ? 'border-[#20B2AA] bg-teal-50/80 ring-2 ring-[#20B2AA]/30'
                        : 'border-gray-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-xs text-gray-800">{docType}</span>
                      {uploadedDoc && (
                        <span className="text-[10px] text-gray-500 truncate" title={uploadedDoc.file_name}>
                          {uploadedDoc.file_name}
                        </span>
                      )}
                    </div>

                    {isUploading ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#20B2AA] bg-teal-50 border border-teal-200 rounded-lg">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                      </span>
                    ) : uploadedDoc ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDocPreview({
                              id: uploadedDoc.id,
                              fileName: uploadedDoc.file_name || `${docType}.pdf`,
                              title: `${viewerStaffName} - ${docType}`,
                              url: uploadedDoc.view_url || uploadedDoc.gcp_file_url,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        {!isViewerStaffLocked && (
                          <button
                            type="button"
                            disabled={deletingDocId === uploadedDoc.id}
                            onClick={() => handleDeleteStaffDocument(uploadedDoc.id, uploadedDoc.file_name || docType, viewerStaff)}
                            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                            title="Delete Document"
                          >
                            {deletingDocId === uploadedDoc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-white border border-dashed border-teal-400 rounded-lg hover:bg-teal-50 hover:border-teal-500 transition-all cursor-pointer shadow-2xs flex-shrink-0"
                        title={`Upload or drop ${docType}`}
                      >
                        <Upload className="w-3.5 h-3.5 text-[#20B2AA]" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && viewerStaff) {
                              handleUploadDocumentForStaff(viewerStaff, file, docType);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Inline Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!activeDocPreview}
        onClose={() => setActiveDocPreview(null)}
        documentId={activeDocPreview?.id}
        url={activeDocPreview?.url}
        fileName={activeDocPreview?.fileName}
        title={activeDocPreview?.title}
      />
    </div>
  );
};
