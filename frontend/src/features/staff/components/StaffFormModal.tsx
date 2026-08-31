import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  UserPlus,
  Building,
  Phone,
  ShieldCheck,
  CreditCard,
  Upload,
  RefreshCw,
  FileCheck,
  Eye,
  Trash2,
  Loader2,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';

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

export interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'add' | 'edit';
  existingStaff?: any | null;
  defaultSiteId?: string;
  sites?: any[];
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'add',
  existingStaff = null,
  defaultSiteId = '',
  sites: propSites,
}) => {
  const { isSuperAdmin } = useAuth();
  const isEdit = mode === 'edit' && Boolean(existingStaff?.id);

  // Form State
  const [formData, setFormData] = useState<any>({
    name: '',
    employee_name: '',
    biometric_code: '',
    phone: '',
    designation: 'Janitor',
    role: 'Janitor',
    gender: 'Male',
    status: 'Active',
    weekly_off: 'Sunday',
    site_id: defaultSiteId,
    siteName: '',
    rate_card_id: '',
    monthly_incentive: 0,
    compliance_name: '',
    bank_account_no: '',
    bank_ifsc_code: '',
    bank_name: '',
    payee_name: '',
    aadhar_no: '',
    pan_no: '',
    uan_no: '',
    esic_no: '',
    photoUrl: '',
  });

  const [isCustomDesignationModal, setIsCustomDesignationModal] = useState(false);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [availableDesignations, setAvailableDesignations] = useState<string[]>([]);
  const [rateCardsOptions, setRateCardsOptions] = useState<any[]>([]);
  const [staffDocs, setStaffDocs] = useState<any[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Doc Preview Modal
  const [activeDocPreview, setActiveDocPreview] = useState<{
    id: string;
    fileName: string;
    title: string;
    url?: string;
  } | null>(null);

  const isFieldFilled = (val: any) =>
    val !== null && val !== undefined && String(val).trim() !== '' && String(val) !== '0';

  const isLockedRecord = Boolean(existingStaff?.is_locked);
  const isPartiallyLocked = isEdit && isLockedRecord && !isSuperAdmin;

  const isNameLocked = isPartiallyLocked && isFieldFilled(existingStaff?.employee_name || existingStaff?.name);
  const isBiometricLocked = isPartiallyLocked && isFieldFilled(existingStaff?.biometric_code || existingStaff?.biometricCode);
  const isPhoneLocked = isPartiallyLocked && isFieldFilled(existingStaff?.phone);
  const isGenderLocked = isPartiallyLocked && isFieldFilled(existingStaff?.gender);
  const isRoleLocked = isPartiallyLocked && isFieldFilled(existingStaff?.designation || existingStaff?.role);
  const isComplianceLocked = isPartiallyLocked && isFieldFilled(existingStaff?.compliance_name || existingStaff?.complianceName);
  const isSiteLocked = isPartiallyLocked && isFieldFilled(existingStaff?.site_id);
  const isRateCardLocked = isPartiallyLocked && isFieldFilled(existingStaff?.rate_card_id);
  const isIncentiveLocked = isPartiallyLocked && Boolean(existingStaff?.monthly_incentive && Number(existingStaff.monthly_incentive) > 0);
  const isBankAccLocked = isPartiallyLocked && isFieldFilled(existingStaff?.bank_account_no || existingStaff?.bankAccountNo);
  const isBankIfscLocked = isPartiallyLocked && isFieldFilled(existingStaff?.bank_ifsc_code || existingStaff?.bankIfsc);
  const isBankNameLocked = isPartiallyLocked && isFieldFilled(existingStaff?.bank_name || existingStaff?.bankName);
  const isPayeeLocked = isPartiallyLocked && isFieldFilled(existingStaff?.payee_name || existingStaff?.payeeName);
  const isAadharLocked = isPartiallyLocked && isFieldFilled(existingStaff?.aadharNo || existingStaff?.aadhar_no);
  const isPanLocked = isPartiallyLocked && isFieldFilled(existingStaff?.panNo || existingStaff?.pan_no);
  const isUanLocked = isPartiallyLocked && isFieldFilled(existingStaff?.uan_no);
  const isEsicLocked = isPartiallyLocked && isFieldFilled(existingStaff?.esic_no);

  // Fetch Rate Cards for selected Site
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
      console.warn('Error fetching rate cards for modal:', e);
      setRateCardsOptions([]);
    }
  };

  // Fetch Documents for existing Staff
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

  // Load Sites and Distinct Designations on Mount
  useEffect(() => {
    async function loadMasterData() {
      try {
        if (propSites && propSites.length > 0) {
          setAvailableSites(propSites);
        } else {
          const { data: sitesData } = await supabase
            .from('sites')
            .select('id, site_name, code_name, companies(name)')
            .order('site_name', { ascending: true });
          if (sitesData) setAvailableSites(sitesData);
        }

        const { data: desigData } = await supabase
          .from('staff')
          .select('designation')
          .not('designation', 'is', null)
          .neq('designation', '')
          .order('designation', { ascending: true });

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
        ];

        const distinct = Array.from(
          new Set([
            ...defaults,
            ...(desigData ? desigData.map((d: any) => d.designation?.trim()).filter(Boolean) : []),
          ])
        ) as string[];

        setAvailableDesignations(distinct);
      } catch (err) {
        console.warn('Error loading master data for StaffFormModal:', err);
      }
    }

    if (isOpen) {
      loadMasterData();
    }
  }, [isOpen, propSites]);

  // Pre-populate or Reset Form State when isOpen or existingStaff changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setIsCustomDesignationModal(false);

    if (isEdit && existingStaff) {
      const sId = existingStaff.site_id || '';
      const sName = existingStaff.sites?.site_name || existingStaff.site_name || existingStaff.siteName || '';
      const desig = existingStaff.designation || existingStaff.role || 'Janitor';

      setFormData({
        id: existingStaff.id,
        name: existingStaff.employee_name || existingStaff.name || '',
        employee_name: existingStaff.employee_name || existingStaff.name || '',
        biometric_code: existingStaff.biometric_code || existingStaff.biometricCode || '',
        phone: existingStaff.phone || '',
        designation: desig,
        role: desig,
        gender: existingStaff.gender || 'Male',
        status: existingStaff.status || 'Active',
        weekly_off: existingStaff.weekly_off || 'Sunday',
        site_id: sId,
        siteName: sName,
        rate_card_id: existingStaff.rate_card_id || '',
        monthly_incentive: Number(existingStaff.monthly_incentive || 0),
        compliance_name: existingStaff.compliance_name || existingStaff.complianceName || '',
        bank_account_no: existingStaff.bank_account_no || existingStaff.bankAccountNo || '',
        bank_ifsc_code: existingStaff.bank_ifsc_code || existingStaff.bankIfsc || '',
        bank_name: existingStaff.bank_name || existingStaff.bankName || '',
        payee_name: existingStaff.payee_name || existingStaff.payeeName || '',
        aadhar_no: existingStaff.aadhar_no || existingStaff.aadharNo || '',
        pan_no: existingStaff.pan_no || existingStaff.panNo || '',
        uan_no: existingStaff.uan_no || '',
        esic_no: existingStaff.esic_no || '',
        photoUrl: existingStaff.photoUrl || '',
      });

      fetchDocsForStaff(existingStaff.id);
      fetchRateCardsForSite(sId, sName);
    } else {
      // Add Mode: fresh blank state
      const initialSite = defaultSiteId || '';
      setFormData({
        name: '',
        employee_name: '',
        biometric_code: '',
        phone: '',
        designation: 'Janitor',
        role: 'Janitor',
        gender: 'Male',
        status: 'Active',
        weekly_off: 'Sunday',
        site_id: initialSite,
        siteName: '',
        rate_card_id: '',
        monthly_incentive: 0,
        compliance_name: '',
        bank_account_no: '',
        bank_ifsc_code: '',
        bank_name: '',
        payee_name: '',
        aadhar_no: '',
        pan_no: '',
        uan_no: '',
        esic_no: '',
        photoUrl: '',
      });
      setStaffDocs([]);
      if (initialSite) {
        fetchRateCardsForSite(initialSite, '');
      } else {
        setRateCardsOptions([]);
      }
    }
  }, [isOpen, mode, existingStaff, defaultSiteId]);

  if (!isOpen) return null;

  // Handle Photo File Upload / Preview
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev: any) => ({ ...prev, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Document Upload Handler (for existing staff)
  const handleUploadStaffDoc = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadingType) {
      toast.info('Upload already in progress, please wait');
      e.target.value = '';
      return;
    }

    if (!existingStaff?.id) {
      toast.error('Please save staff record first before uploading documents.');
      e.target.value = '';
      return;
    }

    setUploadingType(docType);
    try {
      const empName = formData.employee_name || formData.name || 'Staff';
      const site = formData.siteName || '';
      const desig = formData.designation || formData.role || '';

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('staff_id', existingStaff.id);
      uploadData.append('employee_name', empName);
      uploadData.append('employeeName', empName);
      uploadData.append('doc_type', docType);
      uploadData.append('docType', docType);
      uploadData.append('document_type', docType);
      uploadData.append('site_name', site);
      uploadData.append('siteName', site);
      uploadData.append('designation', desig);

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
        staff_id: existingStaff.id,
        document_type: docType,
        file_name: file.name,
        view_url: resJson.view_url,
        gcp_file_url: resJson.gcp_file_url,
        uploaded_at: new Date().toISOString(),
      };

      setStaffDocs((prev) => [
        ...prev.filter(
          (d) => !isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
        ),
        newDoc,
      ]);

      toast.success(`${docType} uploaded successfully`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Document upload error:', err);
      toast.error(err.message || `Failed to upload ${docType}`);
    } finally {
      setUploadingType(null);
      e.target.value = '';
    }
  };

  // Document Delete Handler
  const handleDeleteStaffDocument = async (documentId: string, fileName?: string) => {
    if (!documentId) return;

    if (isPartiallyLocked) {
      toast.error('Cannot delete documents: Staff record is locked by SuperAdmin');
      return;
    }

    const confirmed = window.confirm(
      `Delete this document${fileName ? ` "${fileName}"` : ''}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingDocId(documentId);
    try {
      const response = await fetchWithRetry(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to delete document (HTTP ${response.status})`);
      }

      setStaffDocs((prev) => prev.filter((d) => d.id !== documentId));
      toast.success('Document deleted successfully');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Delete document error:', err);
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Submit Handler (Add vs Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empName = (formData.employee_name || formData.name || '').trim();
    if (!empName) {
      setErrorMsg('Employee Name is required');
      toast.error('Employee Name is required');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const desig = (formData.designation || formData.role || 'Janitor').trim();

      let payload: any = {
        employee_name: empName,
        biometric_code: (formData.biometric_code || formData.biometricCode || '').trim() || null,
        phone: (formData.phone || '').trim() || null,
        designation: desig,
        gender: formData.gender || 'Male',
        status: formData.status || 'Active',
        weekly_off: formData.weekly_off || 'Sunday',
        site_id: formData.site_id || null,
        rate_card_id: formData.rate_card_id || null,
        monthly_incentive: Number(formData.monthly_incentive) || 0,
        compliance_name: (formData.compliance_name || formData.complianceName || '').trim() || null,
        bank_account_no: (formData.bank_account_no || formData.bankAccountNo || '').trim() || null,
        bank_ifsc_code: (formData.bank_ifsc_code || formData.bankIfsc || '').trim() || null,
        bank_name: (formData.bank_name || formData.bankName || '').trim() || null,
        payee_name: (formData.payee_name || formData.payeeName || '').trim() || null,
        aadhar_no: (formData.aadhar_no || formData.aadharNo || '').trim() || null,
        pan_no: (formData.pan_no || formData.panNo || '').trim() || null,
        uan_no: (formData.uan_no || '').trim() || null,
        esic_no: (formData.esic_no || '').trim() || null,
      };

      if (isEdit) {
        const staffId = existingStaff.id;

        // If partially locked, preserve original filled values
        if (isPartiallyLocked) {
          if (isFieldFilled(existingStaff.employee_name || existingStaff.name)) {
            payload.employee_name = existingStaff.employee_name || existingStaff.name;
          }
          if (isFieldFilled(existingStaff.biometric_code || existingStaff.biometricCode)) {
            payload.biometric_code = existingStaff.biometric_code || existingStaff.biometricCode;
          }
          if (isFieldFilled(existingStaff.phone)) {
            payload.phone = existingStaff.phone;
          }
          if (isFieldFilled(existingStaff.designation || existingStaff.role)) {
            payload.designation = existingStaff.designation || existingStaff.role;
          }
          if (isFieldFilled(existingStaff.gender)) {
            payload.gender = existingStaff.gender;
          }
          if (existingStaff.monthly_incentive && Number(existingStaff.monthly_incentive) > 0) {
            payload.monthly_incentive = Number(existingStaff.monthly_incentive);
          }
          if (isFieldFilled(existingStaff.site_id)) {
            payload.site_id = existingStaff.site_id;
          }
          if (isFieldFilled(existingStaff.rate_card_id)) {
            payload.rate_card_id = existingStaff.rate_card_id;
          }
          if (isFieldFilled(existingStaff.compliance_name || existingStaff.complianceName)) {
            payload.compliance_name = existingStaff.compliance_name || existingStaff.complianceName;
          }
          if (isFieldFilled(existingStaff.bank_account_no || existingStaff.bankAccountNo)) {
            payload.bank_account_no = existingStaff.bank_account_no || existingStaff.bankAccountNo;
          }
          if (isFieldFilled(existingStaff.bank_ifsc_code || existingStaff.bankIfsc)) {
            payload.bank_ifsc_code = existingStaff.bank_ifsc_code || existingStaff.bankIfsc;
          }
          if (isFieldFilled(existingStaff.bank_name || existingStaff.bankName)) {
            payload.bank_name = existingStaff.bank_name || existingStaff.bankName;
          }
          if (isFieldFilled(existingStaff.payee_name || existingStaff.payeeName)) {
            payload.payee_name = existingStaff.payee_name || existingStaff.payeeName;
          }
          if (isFieldFilled(existingStaff.uan_no)) {
            payload.uan_no = existingStaff.uan_no;
          }
          if (isFieldFilled(existingStaff.esic_no)) {
            payload.esic_no = existingStaff.esic_no;
          }
          if (isFieldFilled(existingStaff.aadhar_no || existingStaff.aadharNo)) {
            payload.aadhar_no = existingStaff.aadhar_no || existingStaff.aadharNo;
          }
          if (isFieldFilled(existingStaff.pan_no || existingStaff.panNo)) {
            payload.pan_no = existingStaff.pan_no || existingStaff.panNo;
          }
        }

        // Try backend API first, fallback to supabase update
        let updatedSuccess = false;
        try {
          const response = await fetchWithRetry(`/api/staff/${encodeURIComponent(staffId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            updatedSuccess = true;
          }
        } catch (apiErr) {
          console.warn('API staff update failed, falling back to supabase client:', apiErr);
        }

        if (!updatedSuccess) {
          const { error: sbErr } = await supabase
            .from('staff')
            .update(payload)
            .eq('id', staffId);

          if (sbErr) throw sbErr;
        }

        toast.success(
          isPartiallyLocked
            ? 'Staff updated (blank fields & new details saved)'
            : 'Staff record updated successfully'
        );
      } else {
        // Add Mode -> insert with explicit is_locked: false
        payload.is_locked = false;
        const { error: insertErr } = await supabase.from('staff').insert([payload]);
        if (insertErr) throw insertErr;

        toast.success('Staff member added successfully');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Staff form submit error:', err);
      const msg = err.message || 'Failed to save staff record';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="bg-[#34495E] px-6 py-4 text-white flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                {isEdit ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5 text-[#20B2AA]" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base">
                    {isEdit
                      ? `Edit Staff: ${formData.employee_name || formData.name || ''}`
                      : 'Add New Staff Member'}
                  </h2>
                  {isLockedRecord && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked Record</span>
                    </span>
                  )}
                </div>
                {isPartiallyLocked ? (
                  <p className="text-[11px] text-amber-200/90 mt-0.5">
                    Existing filled fields are read-only. Empty fields &amp; new KYC uploads can be saved.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    {isEdit
                      ? 'Update workforce credentials, payout details & KYC vault.'
                      : 'Create a new employee profile with full credentials & KYC info.'}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-300 hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50 text-xs">
            {errorMsg && (
              <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {errorMsg}
              </div>
            )}

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
                      <label className="block text-[11px] font-bold text-gray-700">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      {isNameLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
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
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-gray-700">Biometric Code</label>
                      {isBiometricLocked && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
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
                        placeholder="Enter designation..."
                        value={formData.designation || formData.role || ''}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value, designation: e.target.value })}
                        className={`w-full border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none ${
                          isRoleLocked
                            ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                            : 'bg-white border-[#20B2AA] text-gray-800'
                        }`}
                      />
                      {!isRoleLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomDesignationModal(false);
                            if (availableDesignations.length > 0) {
                              setFormData({ ...formData, role: availableDesignations[0], designation: availableDesignations[0] });
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
                    >
                      {availableDesignations.map((desig) => (
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
                      const sObj = availableSites.find((s) => s.id === sId);
                      const sName = sObj?.site_name || '';
                      setFormData({ ...formData, site_id: sId, siteName: sName, rate_card_id: '' });
                      fetchRateCardsForSite(sId, sName);
                    }}
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-medium truncate ${
                      isSiteLocked
                        ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  >
                    <option value="">Select a Site...</option>
                    {availableSites.map((site) => (
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
                  >
                    <option value="">Select Rate Card...</option>
                    {rateCardsOptions.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.post_name}{card.remark ? ` (${card.remark})` : ''} (₹{card.gross_salary || card.basic_da || 0}){card.is_flat_wage ? ' [Flat]' : ''}
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
                    placeholder="e.g. Rahul Sharma"
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
                  />
                </div>
              </div>
            </div>

            {/* KYC Document Upload Section */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>KYC Vault &amp; Employee Documents</span>
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
                    value={formData.aadhar_no || formData.aadharNo || ''}
                    onChange={(e) => setFormData({ ...formData, aadharNo: e.target.value, aadhar_no: e.target.value })}
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${
                      isAadharLocked
                        ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-800'
                    }`}
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
                    value={formData.pan_no || formData.panNo || ''}
                    onChange={(e) => setFormData({ ...formData, panNo: e.target.value, pan_no: e.target.value })}
                    className={`w-full border rounded-lg px-3 py-2 text-xs font-mono uppercase ${
                      isPanLocked
                        ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-800'
                    }`}
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
                  />
                </div>
              </div>

              {/* Upload / View / Replace Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                {['Aadhaar Card', 'PAN Card', 'Bank Passbook', 'UAN Card', 'ESIC Card'].map((docType) => {
                  const uploadedDoc = staffDocs.find((d) =>
                    isMatchingDocType(d.document_type || d.doc_type || d.type || d.file_name, docType)
                  );
                  const isUploading = uploadingType === docType;
                  const canUpload = isEdit && Boolean(existingStaff?.id);

                  if (uploadedDoc) {
                    return (
                      <div
                        key={docType}
                        className="flex items-center gap-1.5 p-2 border border-teal-200 rounded-xl bg-teal-50/50"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDocPreview({
                              id: uploadedDoc.id,
                              fileName: uploadedDoc.file_name || `${docType}.pdf`,
                              title: `${formData.employee_name || formData.name || 'Staff'} - ${docType}`,
                              url: uploadedDoc.view_url || uploadedDoc.gcp_file_url,
                            })
                          }
                          className="flex-1 text-center text-xs font-bold text-teal-700 hover:text-teal-900 truncate cursor-pointer"
                        >
                          View {docType.split(' ')[0]}
                        </button>
                        {!isPartiallyLocked && (
                          <label
                            className="p-1 text-gray-500 hover:text-teal-600 cursor-pointer rounded transition-colors"
                            title="Replace Document"
                          >
                            {isUploading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => handleUploadStaffDoc(e, docType)}
                              disabled={!canUpload || !!uploadingType}
                            />
                          </label>
                        )}
                      </div>
                    );
                  }

                  return (
                    <label
                      key={docType}
                      className={`border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center transition-colors select-none ${
                        canUpload && !uploadingType
                          ? 'cursor-pointer hover:border-[#20B2AA] hover:bg-teal-50/50'
                          : 'opacity-60 cursor-not-allowed bg-slate-50'
                      }`}
                      title={
                        !canUpload
                          ? 'Save staff record first to enable document upload'
                          : `Upload ${docType}`
                      }
                    >
                      {isUploading ? (
                        <RefreshCw className="w-5 h-5 text-[#20B2AA] mb-1 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                      )}
                      <span className="text-[11px] font-bold text-gray-700 text-center">
                        {isUploading ? 'Uploading...' : `Upload ${docType.split(' ')[0]}`}
                      </span>
                      {!canUpload && (
                        <span className="text-[9px] text-gray-400 mt-0.5">(Save first)</span>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => handleUploadStaffDoc(e, docType)}
                        disabled={!canUpload || !!uploadingType}
                      />
                    </label>
                  );
                })}
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
                                title: `${formData.employee_name || formData.name || 'Staff'} - ${doc.document_type || 'Document'}`,
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
                              onClick={() => handleDeleteStaffDocument(doc.id, doc.file_name)}
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
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isPartiallyLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Save Blank Fields &amp; KYC</span>
                  </>
                ) : isEdit ? (
                  'Update Staff Record'
                ) : (
                  'Save Staff Record'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Document Viewer Modal */}
      {activeDocPreview && (
        <DocumentViewerModal
          isOpen={!!activeDocPreview}
          onClose={() => setActiveDocPreview(null)}
          documentId={activeDocPreview.id}
          url={activeDocPreview.url}
          fileName={activeDocPreview.fileName}
          title={activeDocPreview.title}
        />
      )}
    </>
  );
};
