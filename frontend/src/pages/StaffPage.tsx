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
import { AddStaffModal } from '@/features/attendance/components/AddStaffModal';
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal State for edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isCustomDesignationModal, setIsCustomDesignationModal] = useState(false);
  const [staffDocs, setStaffDocs] = useState<any[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [rateCardsOptions, setRateCardsOptions] = useState<any[]>([]);

  const isFieldFilled = (val: any) =>
    val !== null && val !== undefined && String(val).trim() !== '' && String(val) !== '0';

  const isLockedRecord = Boolean(editingStaff?.is_locked);
  const isPartiallyLocked = isLockedRecord && !isSuperAdmin;

  const isNameLocked = isPartiallyLocked && isFieldFilled(editingStaff?.employee_name || editingStaff?.name);
  const isBiometricLocked = isPartiallyLocked && isFieldFilled(editingStaff?.biometric_code || editingStaff?.biometricCode);
  const isPhoneLocked = isPartiallyLocked && isFieldFilled(editingStaff?.phone);
  const isGenderLocked = isPartiallyLocked && isFieldFilled(editingStaff?.gender);
  const isRoleLocked = isPartiallyLocked && isFieldFilled(editingStaff?.designation || editingStaff?.role);
  const isComplianceLocked = isPartiallyLocked && isFieldFilled(editingStaff?.compliance_name || (editingStaff as any)?.complianceName);
  const isSiteLocked = isPartiallyLocked && isFieldFilled(editingStaff?.site_id);
  const isRateCardLocked = isPartiallyLocked && isFieldFilled(editingStaff?.rate_card_id);
  const isIncentiveLocked = isPartiallyLocked && Boolean(editingStaff?.monthly_incentive && Number(editingStaff.monthly_incentive) > 0);
  const isBankAccLocked = isPartiallyLocked && isFieldFilled(editingStaff?.bank_account_no || (editingStaff as any)?.bankAccountNo);
  const isBankIfscLocked = isPartiallyLocked && isFieldFilled(editingStaff?.bank_ifsc_code || (editingStaff as any)?.bankIfsc);
  const isBankNameLocked = isPartiallyLocked && isFieldFilled(editingStaff?.bank_name || (editingStaff as any)?.bankName);
  const isPayeeLocked = isPartiallyLocked && isFieldFilled(editingStaff?.payee_name || (editingStaff as any)?.payeeName);
  const isAadharLocked = isPartiallyLocked && isFieldFilled(editingStaff?.aadharNo || editingStaff?.aadhar_no);
  const isPanLocked = isPartiallyLocked && isFieldFilled(editingStaff?.panNo || editingStaff?.pan_no);
  const isUanLocked = isPartiallyLocked && isFieldFilled(editingStaff?.uan_no);
  const isEsicLocked = isPartiallyLocked && isFieldFilled(editingStaff?.esic_no);

  // Dedicated Document Viewer Modal State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerStaff, setViewerStaff] = useState<StaffMember | null>(null);
  const [viewerDocs, setViewerDocs] = useState<any[]>([]);
  const [activeDocPreview, setActiveDocPreview] = useState<{ id: string; fileName: string; title: string; url?: string } | null>(null);
  const [viewerStaffName, setViewerStaffName] = useState('');
  const [dragOverDocType, setDragOverDocType] = useState<string | null>(null);

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

  // Form state
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    name: '',
    biometricCode: '',
    phone: '',
    role: 'Janitor',
    siteName: '',
    site_id: '',
    rate_card_id: '',
    status: 'Active',
    uan_no: '',
    esic_no: '',
    documents: [],
  });

  // Fetch sites for dropdown
  useEffect(() => {
    async function loadSites() {
      const { data } = await supabase.from('sites').select('id, site_name, code_name').order('site_name');
      if (data) setSitesList(data);
    }
    loadSites();
  }, []);

  const fetchRateCardsForSite = async (sId?: string, sName?: string) => {
    if (!sId && !sName) {
      setRateCardsOptions([]);
      return;
    }
    try {
      let list: any[] = [];
      let query = supabase.from('rate_cards').select('*');
      if (sId && sName) {
        query = query.or(`site_id.eq.${sId},site_name.eq.${sName}`);
      } else if (sId) {
        query = query.eq('site_id', sId);
      } else if (sName) {
        query = query.eq('site_name', sName);
      }
      const { data, error } = await query;
      if (!error && data) {
        list = [...data];
      }

      // Also fallback to site's JSON rate_cards column if table is empty
      if (list.length === 0 && sId) {
        const { data: siteData } = await supabase
          .from('sites')
          .select('id, site_name, rate_cards')
          .eq('id', sId)
          .maybeSingle();

        if (siteData?.rate_cards && Array.isArray(siteData.rate_cards) && siteData.rate_cards.length > 0) {
          const siteJsonCards = siteData.rate_cards.map((rc: any, idx: number) => ({
            id: rc.id || `site-rc-${idx}`,
            post_name: rc.roleName || rc.post_name || rc.designation || 'Staff',
            gross_salary: Number(rc.monthlyRate || rc.gross_salary || rc.grossSalary || 0),
            is_flat_wage: Boolean(rc.is_flat_wage || rc.isFlatWage),
          }));
          list = siteJsonCards;
        }
      }

      setRateCardsOptions(list);
    } catch (e) {
      console.warn('Error fetching rate cards for staff modal:', e);
      setRateCardsOptions([]);
    }
  };

  const fetchDocsForStaff = async (staffId: string) => {
    try {
      const response = await fetchWithRetry(`/api/documents/employee?staff_id=${encodeURIComponent(staffId)}`);
      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
          setStaffDocs(json.data);
          return;
        }
      }

      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('staff_id', staffId)
        .order('uploaded_at', { ascending: false });

      if (!error && data) {
        setStaffDocs(data);
      } else {
        setStaffDocs([]);
      }
    } catch (err) {
      console.error('Error fetching staff documents:', err);
      setStaffDocs([]);
    }
  };

  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Global Escape keydown listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDocPreview) {
          setActiveDocPreview(null);
        } else if (isViewerOpen) {
          setIsViewerOpen(false);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDocPreview, isViewerOpen, isModalOpen]);

  const handleUploadDocumentForStaff = async (
    staff: StaffMember,
    file: File,
    docType: string
  ) => {
    if (!file || !staff) {
      toast.error('Missing file or staff for document upload');
      return;
    }
    if (uploadingDocType || uploadingType) {
      console.warn(`[StaffEdit] Upload already in progress for ${uploadingDocType || uploadingType}, ignoring request for ${docType}`);
      return;
    }
    const staffId = staff.id || (staff as any).staff_id;
    if (!staffId) {
      console.error('[StaffEdit] Upload failed: missing staffId on staff object', staff);
      toast.error('Staff ID missing for upload');
      return;
    }

    setUploadingDocType(docType);
    setUploadingType(docType);
    try {
      const empName = staff.employee_name || staff.name || formData.employee_name || formData.name || 'Staff';
      const site = staff.sites?.site_name || staff.site_name || staff.siteName || formData.siteName || '';
      const designation = staff.designation || staff.role || formData.designation || formData.role || '';

      console.log(`[StaffEdit] Uploading ${docType} for employee id=${staffId} (${empName}), fileName=${file.name}`);

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

      // 2. Update staffDocs
      setStaffDocs((prev) => [
        ...prev.filter(
          (d) => !isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
        ),
        newDoc,
      ]);

      // 3. Update staffList in-place using stable staffId so table badges reflect immediately regardless of filters
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

      // 4. Update editingStaff & viewerStaff object references in state
      setEditingStaff((prev) =>
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

      // 5. Increment refreshKey for background query sync
      setRefreshKey((prev) => prev + 1);
      toast.success(`${docType} uploaded successfully`);
    } catch (err: any) {
      console.error('[StaffEdit] Document Upload Error:', err);
      toast.error(err.message || `Failed to upload ${docType}`);
    } finally {
      setUploadingDocType(null);
      setUploadingType(null);
    }
  };

  const handleDeleteStaffDocument = async (
    documentId: string,
    fileName?: string,
    targetStaffRecord?: StaffMember | null
  ) => {
    if (!documentId) return;

    const currentStaff = targetStaffRecord || viewerStaff || editingStaff;
    if (Boolean(currentStaff?.is_locked) && !isSuperAdmin) {
      toast.error('Cannot delete documents: Staff record is locked by SuperAdmin');
      return;
    }

    const confirmed = window.confirm(
      `Delete this document${fileName ? ` "${fileName}"` : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingDocId(documentId);
    console.log(`[StaffEdit] Deleting document id=${documentId} (${fileName || 'unnamed'})`);
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
      setStaffDocs((prev) => prev.filter((d) => d.id !== documentId));
      setViewerDocs((prev) => prev.filter((d) => d.id !== documentId));
      setStaffList((prevList) =>
        prevList.map((s) => ({
          ...s,
          employee_documents: (s.employee_documents || []).filter((d: any) => d.id !== documentId),
        }))
      );
      if (editingStaff) {
        fetchDocsForStaff(editingStaff.id);
      }
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('[StaffEdit] Delete document error:', err);
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
    if (formData.designation) fromStaff.push(formData.designation);
    if (formData.role) fromStaff.push(formData.role);
    return Array.from(new Set([...fromStaff, ...defaults])).filter(Boolean);
  }, [staffList, formData.designation, formData.role]);

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
    setEditingStaff(null);
    setStaffDocs([]);
    setIsCustomDesignationModal(false);
    setFormData({
      name: '',
      employee_name: '',
      biometricCode: '',
      biometric_code: '',
      phone: '',
      role: 'Janitor',
      designation: 'Janitor',
      gender: 'Male',
      siteName: '',
      site_id: '',
      rate_card_id: '',
      monthly_incentive: 0,
      bank_account_no: '',
      bank_ifsc_code: '',
      bank_name: '',
      payee_name: '',
      aadharNo: '',
      panNo: '',
      uan_no: '',
      esic_no: '',
      compliance_name: '',
      complianceName: '',
      status: 'Active',
      documents: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setIsCustomDesignationModal(false);
    const sId = staff.site_id || '';
    const sName = staff.sites?.site_name || staff.site_name || staff.siteName || '';
    const desig = staff.designation || staff.role || 'Janitor';
    setFormData({
      ...staff,
      name: staff.employee_name || staff.name || '',
      employee_name: staff.employee_name || staff.name || '',
      biometricCode: staff.biometric_code || staff.biometricCode || '',
      biometric_code: staff.biometric_code || staff.biometricCode || '',
      phone: staff.phone || '',
      role: desig,
      designation: desig,
      gender: staff.gender || 'Male',
      monthly_incentive: Number(staff.monthly_incentive || 0),
      site_id: sId,
      siteName: sName,
      rate_card_id: staff.rate_card_id || '',
      bank_account_no: staff.bank_account_no || staff.bankAccountNo || '',
      bank_ifsc_code: staff.bank_ifsc_code || staff.bankIfsc || '',
      bank_name: staff.bank_name || staff.bankName || '',
      payee_name: staff.payee_name || staff.payeeName || '',
      compliance_name: staff.compliance_name || (staff as any).complianceName || '',
      complianceName: staff.compliance_name || (staff as any).complianceName || '',
      aadharNo: staff.aadharNo || staff.aadhar_no || '',
      panNo: staff.panNo || staff.pan_no || '',
      uan_no: staff.uan_no || '',
      esic_no: staff.esic_no || '',
      status: staff.status || 'Active',
    });
    fetchDocsForStaff(staff.id);
    fetchRateCardsForSite(sId, sName);
    setIsModalOpen(true);
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

  const handleUploadStaffDoc = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadingType || uploadingDocType) {
      console.warn(`[StaffEdit] Upload already in progress, ignoring click for ${docType}`);
      e.target.value = '';
      return;
    }

    if (!editingStaff || !editingStaff.id) {
      toast.error('Please save staff record first before uploading documents.');
      e.target.value = '';
      return;
    }

    await handleUploadDocumentForStaff(editingStaff, file, docType);
    e.target.value = '';
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const empName = (formData.employee_name || formData.name || '').trim();
    if (!empName) {
      toast.error('Employee Name is required.');
      return;
    }

    const staffId = editingStaff?.id || formData.id;
    if (!staffId) {
      console.error('[StaffEdit] Update failed: Missing staff id', { editingStaff, formData });
      toast.error('Cannot update: Employee ID is missing.');
      return;
    }

    let payload: any = {
      employee_name: empName,
      biometric_code: (formData.biometric_code || formData.biometricCode || '').trim() || null,
      phone: (formData.phone || '').trim() || null,
      designation: (formData.designation || formData.role || 'Janitor').trim(),
      gender: formData.gender || 'Male',
      monthly_incentive: Number(formData.monthly_incentive) || 0,
      status: formData.status || 'Active',
      site_id: formData.site_id || null,
      rate_card_id: formData.rate_card_id || null,
      compliance_name: (formData.compliance_name || formData.complianceName || '').trim() || null,
      bank_account_no: (formData.bank_account_no || formData.bankAccountNo || '').trim() || null,
      bank_ifsc_code: (formData.bank_ifsc_code || formData.bankIfsc || '').trim() || null,
      bank_name: (formData.bank_name || formData.bankName || '').trim() || null,
      payee_name: (formData.payee_name || formData.payeeName || '').trim() || null,
      uan_no: (formData.uan_no || '').trim() || null,
      esic_no: (formData.esic_no || '').trim() || null,
      aadhar_no: (formData.aadharNo || formData.aadhar_no || '').trim() || null,
      pan_no: (formData.panNo || formData.pan_no || '').trim() || null,
    };

    // If partially locked, strictly preserve original filled values from DB record
    if (isPartiallyLocked && editingStaff) {
      if (isFieldFilled(editingStaff.employee_name || editingStaff.name)) {
        payload.employee_name = editingStaff.employee_name || editingStaff.name;
      }
      if (isFieldFilled(editingStaff.biometric_code || editingStaff.biometricCode)) {
        payload.biometric_code = editingStaff.biometric_code || editingStaff.biometricCode;
      }
      if (isFieldFilled(editingStaff.phone)) {
        payload.phone = editingStaff.phone;
      }
      if (isFieldFilled(editingStaff.designation || editingStaff.role)) {
        payload.designation = editingStaff.designation || editingStaff.role;
      }
      if (isFieldFilled(editingStaff.gender)) {
        payload.gender = editingStaff.gender;
      }
      if (editingStaff.monthly_incentive && Number(editingStaff.monthly_incentive) > 0) {
        payload.monthly_incentive = Number(editingStaff.monthly_incentive);
      }
      if (isFieldFilled(editingStaff.site_id)) {
        payload.site_id = editingStaff.site_id;
      }
      if (isFieldFilled(editingStaff.rate_card_id)) {
        payload.rate_card_id = editingStaff.rate_card_id;
      }
      if (isFieldFilled(editingStaff.compliance_name || (editingStaff as any).complianceName)) {
        payload.compliance_name = editingStaff.compliance_name || (editingStaff as any).complianceName;
      }
      if (isFieldFilled(editingStaff.bank_account_no || (editingStaff as any).bankAccountNo)) {
        payload.bank_account_no = editingStaff.bank_account_no || (editingStaff as any).bankAccountNo;
      }
      if (isFieldFilled(editingStaff.bank_ifsc_code || (editingStaff as any).bankIfsc)) {
        payload.bank_ifsc_code = editingStaff.bank_ifsc_code || (editingStaff as any).bankIfsc;
      }
      if (isFieldFilled(editingStaff.bank_name || (editingStaff as any).bankName)) {
        payload.bank_name = editingStaff.bank_name || (editingStaff as any).bankName;
      }
      if (isFieldFilled(editingStaff.payee_name || (editingStaff as any).payeeName)) {
        payload.payee_name = editingStaff.payee_name || (editingStaff as any).payeeName;
      }
      if (isFieldFilled(editingStaff.uan_no)) {
        payload.uan_no = editingStaff.uan_no;
      }
      if (isFieldFilled(editingStaff.esic_no)) {
        payload.esic_no = editingStaff.esic_no;
      }
      if (isFieldFilled(editingStaff.aadharNo || editingStaff.aadhar_no)) {
        payload.aadhar_no = editingStaff.aadharNo || editingStaff.aadhar_no;
      }
      if (isFieldFilled(editingStaff.panNo || editingStaff.pan_no)) {
        payload.pan_no = editingStaff.panNo || editingStaff.pan_no;
      }
    }

    console.log(`[StaffEdit] Updating employee id=${staffId} payload:`, payload);

    try {
      const response = await fetchWithRetry(`/api/staff/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Update failed (HTTP ${response.status})`);
      }

      const resData = await response.json();
      const updatedRow = resData.data || payload;

      // Update local state in-place so table updates immediately even with active filters
      setStaffList((prevList) =>
        prevList.map((s) =>
          s.id === staffId
            ? {
                ...s,
                ...updatedRow,
                name: updatedRow.employee_name || payload.employee_name,
                role: updatedRow.designation || payload.designation,
                biometricCode: updatedRow.biometric_code || payload.biometric_code,
                sites: sitesList.find((site) => site.id === payload.site_id) || s.sites,
              }
            : s
        )
      );

      // Keep editingStaff object in sync
      if (editingStaff) {
        setEditingStaff((prev) =>
          prev
            ? {
                ...prev,
                ...updatedRow,
                name: updatedRow.employee_name || payload.employee_name,
                role: updatedRow.designation || payload.designation,
              }
            : null
        );
      }

      setRefreshKey((prev) => prev + 1);
      toast.success(
        isPartiallyLocked
          ? 'Staff updated (blank fields & new details saved)'
          : 'Staff record updated successfully'
      );
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('[StaffEdit] Unexpected error updating staff:', err);
      toast.error(err.message || 'Unexpected error updating staff record');
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
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
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

      {/* Staff Add / Edit Modal with Document Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#34495E] px-6 py-4 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base">
                      {editingStaff ? `Edit Staff: ${editingStaff.employee_name || editingStaff.name || ''}` : 'Add New Staff Member'}
                    </h2>
                    {isLockedRecord && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked Record</span>
                      </span>
                    )}
                  </div>
                  {isPartiallyLocked && (
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      Existing filled fields are read-only. Empty fields &amp; new KYC uploads can be saved.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveStaff} className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50 text-xs">
              {/* Lock Notice Banner */}
              {isPartiallyLocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Partial Lock Active:</span> Existing filled fields cannot be modified by Admins. You can still enter data for any missing/empty fields and upload new KYC documents.
                  </div>
                </div>
              )}

              {/* Photo & Basic Details */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>Personal Details &amp; Profile Picture</span>
                </h3>

                <div className="flex items-center gap-5">
                  {/* Photo Upload Avatar */}
                  <div className="relative group w-20 h-20 flex-shrink-0">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 border-2 border-[#20B2AA]/30 relative flex items-center justify-center">
                      {formData.photoUrl ? (
                        <img
                          src={formData.photoUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 text-white">
                        <Upload className="w-4 h-4 mb-1" />
                        <span className="text-[9px] font-bold uppercase">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-gray-700">Full Name *</label>
                        {isNameLocked && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin — existing value cannot be changed">
                            <Lock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        disabled={isNameLocked}
                        value={formData.employee_name || formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value, employee_name: e.target.value })}
                        className={`w-full border rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none ${
                          isNameLocked
                            ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                            : 'bg-white border-gray-200 text-gray-800 focus:border-[#20B2AA]'
                        }`}
                        title={isNameLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                        required
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-gray-700">Biometric Code</label>
                        {isBiometricLocked && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin — existing value cannot be changed">
                            <Lock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 3765"
                        disabled={isBiometricLocked}
                        value={formData.biometric_code || formData.biometricCode || ''}
                        onChange={(e) => setFormData({ ...formData, biometricCode: e.target.value, biometric_code: e.target.value })}
                        className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none ${
                          isBiometricLocked
                            ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                            : 'bg-white border-gray-200 text-gray-800 focus:border-[#20B2AA]'
                        }`}
                        title={isBiometricLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Phone Number</label>
                      {isPhoneLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="9876543210"
                      disabled={isPhoneLocked}
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                        isPhoneLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isPhoneLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Gender</label>
                      {isGenderLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.gender || 'Male'}
                      disabled={isGenderLocked}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-medium ${
                        isGenderLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isGenderLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    >
                      <option value="Male">Male (M)</option>
                      <option value="Female">Female (F)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Role / Designation</label>
                      {isRoleLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    {isCustomDesignationModal ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          disabled={isRoleLocked}
                          placeholder="Enter new designation..."
                          value={formData.designation || formData.role || ''}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value, designation: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none ${
                            isRoleLocked
                              ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                              : 'bg-white border-[#20B2AA] text-gray-800'
                          }`}
                          title={isRoleLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                        />
                        {!isRoleLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomDesignationModal(false);
                              if (allStaffDesignations.length > 0) {
                                setFormData({ ...formData, role: allStaffDesignations[0], designation: allStaffDesignations[0] });
                              }
                            }}
                            className="px-2 py-2 text-[10px] font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap cursor-pointer"
                            title="Switch back to dropdown list"
                          >
                            List
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={formData.designation || formData.role || 'Janitor'}
                        disabled={isRoleLocked}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomDesignationModal(true);
                            setFormData({ ...formData, role: '', designation: '' });
                          } else {
                            setIsCustomDesignationModal(false);
                            setFormData({ ...formData, role: e.target.value, designation: e.target.value });
                          }
                        }}
                        className={`w-full border rounded-lg px-3 py-2 text-xs font-medium ${
                          isRoleLocked
                            ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                            : 'bg-white border-gray-200 text-gray-800'
                        }`}
                        title={isRoleLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                      >
                        {allStaffDesignations.map((desig) => (
                          <option key={desig} value={desig}>
                            {desig}
                          </option>
                        ))}
                        {!isRoleLocked && <option value="__custom__">+ Add New Designation...</option>}
                      </select>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Compliance Name</label>
                      {isComplianceLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Ambe Enterprises"
                      disabled={isComplianceLocked}
                      value={formData.compliance_name || formData.complianceName || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          compliance_name: e.target.value,
                          complianceName: e.target.value,
                        })
                      }
                      className={`w-full border rounded-lg px-3 py-2 text-xs ${
                        isComplianceLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isComplianceLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Assigned Site</label>
                      {isSiteLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.site_id || ''}
                      disabled={isSiteLocked}
                      onChange={(e) => {
                        const sId = e.target.value;
                        const sObj = sitesList.find((s) => s.id === sId);
                        const sName = sObj?.site_name || '';
                        setFormData({ ...formData, site_id: sId, siteName: sName, rate_card_id: '' });
                        fetchRateCardsForSite(sId, sName);
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-medium truncate ${
                        isSiteLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isSiteLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    >
                      <option value="">Select a Site...</option>
                      {sitesList.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.code_name || site.site_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Assigned Rate Card</label>
                      {isRateCardLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.rate_card_id || ''}
                      disabled={isRateCardLocked}
                      onChange={(e) => setFormData({ ...formData, rate_card_id: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-medium truncate ${
                        isRateCardLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isRateCardLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    >
                      <option value="">Select Rate Card...</option>
                      {rateCardsOptions.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.post_name}{card.remark ? ` (${card.remark})` : ''} (₹{card.gross_salary}){card.is_flat_wage ? ' [Flat]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Monthly Incentive (₹)</label>
                      {isIncentiveLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={isIncentiveLocked}
                      value={formData.monthly_incentive || 0}
                      onChange={(e) => setFormData({ ...formData, monthly_incentive: Number(e.target.value) })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono font-bold ${
                        isIncentiveLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isIncentiveLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>
                </div>
              </div>

              {/* Banking & Salary Payout Details Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>Banking &amp; Salary Payout Details</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Bank Account Number</label>
                      {isBankAccLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
                          <Lock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 68036705039"
                      disabled={isBankAccLocked}
                      value={formData.bank_account_no || formData.bankAccountNo || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_account_no: e.target.value,
                          bankAccountNo: e.target.value,
                        })
                      }
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                        isBankAccLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isBankAccLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Bank IFSC Code</label>
                      {isBankIfscLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
                          <Lock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. MAHB0000294"
                      disabled={isBankIfscLocked}
                      value={formData.bank_ifsc_code || formData.bankIfsc || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_ifsc_code: e.target.value,
                          bankIfsc: e.target.value,
                        })
                      }
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono uppercase ${
                        isBankIfscLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isBankIfscLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Bank Name</label>
                      {isBankNameLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
                          <Lock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Bank of Maharashtra"
                      disabled={isBankNameLocked}
                      value={formData.bank_name || formData.bankName || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_name: e.target.value,
                          bankName: e.target.value,
                        })
                      }
                      className={`w-full border rounded-lg px-3 py-2 text-xs ${
                        isBankNameLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isBankNameLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Payee Name (as per Bank)</label>
                      {isPayeeLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
                          <Lock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Feroj Mohammad Shakeel Shaikh"
                      disabled={isPayeeLocked}
                      value={formData.payee_name || formData.payeeName || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payee_name: e.target.value,
                          payeeName: e.target.value,
                        })
                      }
                      className={`w-full border rounded-lg px-3 py-2 text-xs ${
                        isPayeeLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isPayeeLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>
                </div>
              </div>

              {/* KYC Document Upload Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>KYC Vault &amp; Employee Document Upload</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Aadhar Card Number</label>
                      {isAadharLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="4839-2938-1928"
                      disabled={isAadharLocked}
                      value={formData.aadharNo || formData.aadhar_no || ''}
                      onChange={(e) => setFormData({ ...formData, aadharNo: e.target.value, aadhar_no: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                        isAadharLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isAadharLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">PAN Card Number</label>
                      {isPanLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      disabled={isPanLocked}
                      value={formData.panNo || formData.pan_no || ''}
                      onChange={(e) => setFormData({ ...formData, panNo: e.target.value, pan_no: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono uppercase ${
                        isPanLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isPanLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        UAN Number
                        {staffDocs.some((d) => isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'UAN Card')) && !formData.uan_no && (
                          <span className="text-[10px] text-amber-600 font-normal ml-1">(Card uploaded)</span>
                        )}
                      </label>
                      {isUanLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="100123456789"
                      disabled={isUanLocked}
                      value={formData.uan_no || ''}
                      onChange={(e) => setFormData({ ...formData, uan_no: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                        isUanLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isUanLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        ESIC Number
                        {staffDocs.some((d) => isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'ESIC Card')) && !formData.esic_no && (
                          <span className="text-[10px] text-orange-600 font-normal ml-1">(Card uploaded)</span>
                        )}
                      </label>
                      {isEsicLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                          <Lock className="w-2 h-2 text-amber-600" />
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="31001234560000001"
                      disabled={isEsicLocked}
                      value={formData.esic_no || ''}
                      onChange={(e) => setFormData({ ...formData, esic_no: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                        isEsicLocked
                          ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-800'
                      }`}
                      title={isEsicLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                    />
                  </div>
                </div>

                {/* Upload / View / Replace Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                  {/* Aadhaar Card */}
                  {(() => {
                    const aadhaarDoc = staffDocs.find((d) =>
                      isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'Aadhaar Card')
                    );
                    if (aadhaarDoc) {
                      return (
                        <div className="flex items-center gap-2 p-2.5 border border-teal-200 rounded-xl bg-teal-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDocPreview({
                                id: aadhaarDoc.id,
                                fileName: aadhaarDoc.file_name || 'Aadhaar-Card.pdf',
                                title: `${formData.name || 'Staff'} - Aadhaar Card`,
                                url: aadhaarDoc.view_url || aadhaarDoc.gcp_file_url,
                              })
                            }
                            className="flex-1 text-center text-xs font-bold text-teal-700 hover:text-teal-900 truncate cursor-pointer"
                          >
                            View Aadhaar
                          </button>
                          {!isPartiallyLocked && (
                            <label
                              className="p-1 text-gray-500 hover:text-teal-600 cursor-pointer rounded transition-colors"
                              title="Replace Document"
                            >
                              {uploadingType === 'Aadhaar Card' ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleUploadStaffDoc(e, 'Aadhaar Card')}
                                disabled={!editingStaff || !!uploadingType}
                              />
                            </label>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${
                          editingStaff && !uploadingType ? 'cursor-pointer hover:border-[#20B2AA] hover:bg-teal-50/50' : 'opacity-50 pointer-events-none cursor-not-allowed'
                        }`}
                      >
                        {uploadingType === 'Aadhaar Card' ? (
                          <RefreshCw className="w-5 h-5 text-[#20B2AA] mb-1 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-[#20B2AA] mb-1" />
                        )}
                        <span className="text-[11px] font-bold text-gray-700 text-center">
                          {uploadingType === 'Aadhaar Card' ? 'Uploading...' : 'Upload Aadhaar'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUploadStaffDoc(e, 'Aadhaar Card')}
                          disabled={!editingStaff || !!uploadingType}
                        />
                      </label>
                    );
                  })()}

                  {/* PAN Card */}
                  {(() => {
                    const panDoc = staffDocs.find((d) =>
                      isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'PAN Card')
                    );
                    if (panDoc) {
                      return (
                        <div className="flex items-center gap-2 p-2.5 border border-indigo-200 rounded-xl bg-indigo-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDocPreview({
                                id: panDoc.id,
                                fileName: panDoc.file_name || 'PAN-Card.pdf',
                                title: `${formData.name || 'Staff'} - PAN Card`,
                                url: panDoc.view_url || panDoc.gcp_file_url,
                              })
                            }
                            className="flex-1 text-center text-xs font-bold text-indigo-700 hover:text-indigo-900 truncate cursor-pointer"
                          >
                            View PAN
                          </button>
                          {!isPartiallyLocked && (
                            <label
                              className={`p-1 text-gray-500 hover:text-indigo-600 rounded transition-colors ${
                                uploadingType ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title="Replace Document"
                            >
                              {uploadingType === 'PAN Card' ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleUploadStaffDoc(e, 'PAN Card')}
                                disabled={!editingStaff || !!uploadingType}
                              />
                            </label>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${
                          editingStaff && !uploadingType ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50' : 'opacity-50 pointer-events-none cursor-not-allowed'
                        }`}
                      >
                        {uploadingType === 'PAN Card' ? (
                          <RefreshCw className="w-5 h-5 text-indigo-600 mb-1 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-indigo-600 mb-1" />
                        )}
                        <span className="text-[11px] font-bold text-gray-700 text-center">
                          {uploadingType === 'PAN Card' ? 'Uploading...' : 'Upload PAN'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUploadStaffDoc(e, 'PAN Card')}
                          disabled={!editingStaff || !!uploadingType}
                        />
                      </label>
                    );
                  })()}

                  {/* Bank Passbook */}
                  {(() => {
                    const bankDoc = staffDocs.find((d) =>
                      isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'Bank Passbook')
                    );
                    if (bankDoc) {
                      return (
                        <div className="flex items-center gap-2 p-2.5 border border-purple-200 rounded-xl bg-purple-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDocPreview({
                                id: bankDoc.id,
                                fileName: bankDoc.file_name || 'Bank-Passbook.pdf',
                                title: `${formData.name || 'Staff'} - Bank Passbook`,
                                url: bankDoc.view_url || bankDoc.gcp_file_url,
                              })
                            }
                            className="flex-1 text-center text-xs font-bold text-purple-700 hover:text-purple-900 truncate cursor-pointer"
                          >
                            View Passbook
                          </button>
                          {!isPartiallyLocked && (
                            <label
                              className={`p-1 text-gray-500 hover:text-purple-600 rounded transition-colors ${
                                uploadingType ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title="Replace Document"
                            >
                              {uploadingType === 'Bank Details' ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleUploadStaffDoc(e, 'Bank Details')}
                                disabled={!editingStaff || !!uploadingType}
                              />
                            </label>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${
                          editingStaff && !uploadingType ? 'cursor-pointer hover:border-purple-400 hover:bg-purple-50/50' : 'opacity-50 pointer-events-none cursor-not-allowed'
                        }`}
                      >
                        {uploadingType === 'Bank Details' ? (
                          <RefreshCw className="w-5 h-5 text-purple-600 mb-1 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-purple-600 mb-1" />
                        )}
                        <span className="text-[11px] font-bold text-gray-700 text-center">
                          {uploadingType === 'Bank Details' ? 'Uploading...' : 'Upload Passbook'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUploadStaffDoc(e, 'Bank Details')}
                          disabled={!editingStaff || !!uploadingType}
                        />
                      </label>
                    );
                  })()}

                  {/* UAN Card */}
                  {(() => {
                    const uanDoc = staffDocs.find((d) =>
                      isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'UAN Card')
                    );
                    if (uanDoc) {
                      return (
                        <div className="flex items-center gap-2 p-2.5 border border-amber-200 rounded-xl bg-amber-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDocPreview({
                                id: uanDoc.id,
                                fileName: uanDoc.file_name || 'UAN-Card.pdf',
                                title: `${formData.name || 'Staff'} - UAN Card`,
                                url: uanDoc.view_url || uanDoc.gcp_file_url,
                              })
                            }
                            className="flex-1 text-center text-xs font-bold text-amber-700 hover:text-amber-900 truncate cursor-pointer"
                          >
                            View UAN
                          </button>
                          {!isPartiallyLocked && (
                            <label
                              className={`p-1 text-gray-500 hover:text-amber-600 rounded transition-colors ${
                                uploadingType ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title="Replace Document"
                            >
                              {uploadingType === 'UAN Card' ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleUploadStaffDoc(e, 'UAN Card')}
                                disabled={!editingStaff || !!uploadingType}
                              />
                            </label>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${
                          editingStaff && !uploadingType ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/50' : 'opacity-50 pointer-events-none cursor-not-allowed'
                        }`}
                      >
                        {uploadingType === 'UAN Card' ? (
                          <RefreshCw className="w-5 h-5 text-amber-600 mb-1 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-amber-600 mb-1" />
                        )}
                        <span className="text-[11px] font-bold text-gray-700 text-center">
                          {uploadingType === 'UAN Card' ? 'Uploading...' : 'Upload UAN Card'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUploadStaffDoc(e, 'UAN Card')}
                          disabled={!editingStaff || !!uploadingType}
                        />
                      </label>
                    );
                  })()}

                  {/* ESIC Card */}
                  {(() => {
                    const esicDoc = staffDocs.find((d) =>
                      isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, 'ESIC Card')
                    );
                    if (esicDoc) {
                      return (
                        <div className="flex items-center gap-2 p-2.5 border border-orange-200 rounded-xl bg-orange-50/50">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDocPreview({
                                id: esicDoc.id,
                                fileName: esicDoc.file_name || 'ESIC-Card.pdf',
                                title: `${formData.name || 'Staff'} - ESIC Card`,
                                url: esicDoc.view_url || esicDoc.gcp_file_url,
                              })
                            }
                            className="flex-1 text-center text-xs font-bold text-orange-700 hover:text-orange-900 truncate cursor-pointer"
                          >
                            View ESIC
                          </button>
                          {!isPartiallyLocked && (
                            <label
                              className={`p-1 text-gray-500 hover:text-orange-600 rounded transition-colors ${
                                uploadingType ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title="Replace Document"
                            >
                              {uploadingType === 'ESIC Card' ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleUploadStaffDoc(e, 'ESIC Card')}
                                disabled={!editingStaff || !!uploadingType}
                              />
                            </label>
                          )}
                        </div>
                      );
                    }
                    return (
                      <label
                        className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${
                          editingStaff && !uploadingType ? 'cursor-pointer hover:border-orange-400 hover:bg-orange-50/50' : 'opacity-50 pointer-events-none cursor-not-allowed'
                        }`}
                      >
                        {uploadingType === 'ESIC Card' ? (
                          <RefreshCw className="w-5 h-5 text-orange-600 mb-1 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-orange-600 mb-1" />
                        )}
                        <span className="text-[11px] font-bold text-gray-700 text-center">
                          {uploadingType === 'ESIC Card' ? 'Uploading...' : 'Upload ESIC Card'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUploadStaffDoc(e, 'ESIC Card')}
                          disabled={!editingStaff || !!uploadingType}
                        />
                      </label>
                    );
                  })()}
                </div>

                {/* Uploaded Documents Repository List */}
                {staffDocs && staffDocs.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                      All Uploaded Documents ({staffDocs.length}):
                    </span>
                    <div className="space-y-1">
                      {staffDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-gray-200 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileCheck className="w-4 h-4 text-[#20B2AA] flex-shrink-0" />
                            <span className="font-semibold text-gray-800 truncate" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-[#20B2AA] font-mono flex-shrink-0">
                              {doc.document_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveDocPreview({
                                  id: doc.id,
                                  fileName: doc.file_name,
                                  title: `${formData.name || 'Staff'} - ${doc.document_type || 'Document'}`,
                                  url: doc.view_url || doc.gcp_file_url,
                                })
                              }
                              className="text-[11px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                            >
                              <span>View</span>
                              <Eye className="w-3 h-3" />
                            </button>
                            {!isPartiallyLocked && (
                              <button
                                type="button"
                                disabled={deletingDocId === doc.id}
                                onClick={() => handleDeleteStaffDocument(doc.id, doc.file_name, editingStaff)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete Document"
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  title={isPartiallyLocked ? 'Only newly filled empty fields and new documents will be saved' : undefined}
                >
                  {isPartiallyLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Save Blank Fields &amp; KYC</span>
                    </>
                  ) : editingStaff ? (
                    'Update Staff Record'
                  ) : (
                    'Save Staff Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
