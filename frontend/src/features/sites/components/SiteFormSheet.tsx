import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { siteSchema, SiteFormData, Site } from '../types';
import { createSiteApi, updateSiteApi } from '../api/siteApi';
import { fetchCompanies } from '@/features/company-profiles/api/companyApi';
import { CompanyProfile } from '@/features/company-profiles/types';
import { toast } from '@/components/ui/toast';
import { X, Plus, Trash2, Building, FileText, CreditCard, ShieldCheck, Loader2, FolderArchive, Lock } from 'lucide-react';
import { SiteDocumentsTab } from './SiteDocumentsTab';
import { useAuth } from '@/features/auth/context/AuthContext';

interface SiteFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingSite?: Site | null;
}

export const SiteFormSheet: React.FC<SiteFormSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingSite,
}) => {
  const { isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');

  const isLockedRecord = Boolean(editingSite?.is_locked);
  const isPartiallyLocked = isLockedRecord && !isSuperAdmin;

  const isFieldFilled = (val: any) =>
    val !== null && val !== undefined && String(val).trim() !== '' && String(val) !== '0';

  const isCompanyLocked = isPartiallyLocked && isFieldFilled(editingSite?.company_id || editingSite?.companyId);
  const isSiteNameLocked = isPartiallyLocked && isFieldFilled(editingSite?.siteName || (editingSite as any)?.site_name);
  const isCodeNameLocked = isPartiallyLocked && isFieldFilled(editingSite?.codeName || editingSite?.code_name);
  const isClientNameLocked = isPartiallyLocked && isFieldFilled(editingSite?.clientName || (editingSite as any)?.client_name);
  const isGstinLocked = isPartiallyLocked && isFieldFilled(editingSite?.gstin);
  const isContactLocked = isPartiallyLocked && isFieldFilled(editingSite?.contactNo || editingSite?.contact_no);
  const isEmailLocked = isPartiallyLocked && isFieldFilled(editingSite?.email);
  const isAddressLocked = isPartiallyLocked && isFieldFilled(editingSite?.address);
  const isWorkOrderRefLocked = isPartiallyLocked && isFieldFilled(editingSite?.workOrderRefNo || editingSite?.work_order_ref_no);
  const isWorkOrderPeriodLocked = isPartiallyLocked && isFieldFilled(editingSite?.workOrderPeriod || editingSite?.work_order_period);
  const isMgmtPercentLocked = isPartiallyLocked && (Number(editingSite?.mgmtPercent ?? editingSite?.management_fee_percent) > 0);
  const isStatusLocked = isPartiallyLocked && isFieldFilled(editingSite?.status);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
      setIsLoadingCompanies(true);
      fetchCompanies()
        .then((data) => {
          setCompanies(data);
          const targetCompId = editingSite?.company_id || editingSite?.companyId;
          if (targetCompId && data.some((c) => c.id === targetCompId)) {
            setSelectedCompanyId(targetCompId);
          } else if (data.length > 0) {
            setSelectedCompanyId((prev) => (prev ? prev : data[0].id));
          }
        })
        .catch((err) => {
          console.error('[SiteFormSheet] Failed to fetch companies:', err);
        })
        .finally(() => {
          setIsLoadingCompanies(false);
        });
    }
  }, [isOpen, editingSite]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema) as any,
    defaultValues: {
      siteName: '',
      codeName: '',
      clientName: '',
      gstin: '',
      workOrderRefNo: '',
      workOrderPeriod: '',
      address: '',
      contactNo: '',
      email: '',
      mgmtPercent: 5,
      defaultMachineryCharges: 0,
      defaultMaterialCharges: 0,
      defaultAdditionalCharges: [
        { name: 'Machinery Charges', amount: 0 },
        { name: 'Material Charges', amount: 0 },
      ],
      status: 'Active',
      rateCards: [
        { roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985', persons: 1 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rateCards',
  });

  const {
    fields: additionalChargeFields,
    append: appendAdditionalCharge,
    remove: removeAdditionalCharge,
  } = useFieldArray({
    control,
    name: 'defaultAdditionalCharges',
  });

  useEffect(() => {
    if (editingSite) {
      if (editingSite.company_id || editingSite.companyId) {
        setSelectedCompanyId(editingSite.company_id || editingSite.companyId || '');
      }

      const existingAdditional = editingSite.defaultAdditionalCharges || editingSite.default_additional_charges || (editingSite as any).additional_charges;

      // Check if there are actual legacy monetary values we need to preserve
      const legacyMachinery = Number(editingSite.defaultMachineryCharges ?? editingSite.default_machinery_charges ?? 0);
      const legacyMaterial = Number(editingSite.defaultMaterialCharges ?? editingSite.default_material_charges ?? 0);
      const hasLegacyValues = legacyMachinery > 0 || legacyMaterial > 0;

      let finalAdditional: { name: string; amount: number }[];

      if (existingAdditional && existingAdditional.length > 0) {
        // 1. We have a populated dynamic array, use it.
        finalAdditional = existingAdditional;
      } else if (hasLegacyValues && (!existingAdditional || existingAdditional.length === 0)) {
        // 2. The array is empty, BUT they have older legacy charges > 0. Preserve them.
        finalAdditional = [
          { name: 'Machinery Charges', amount: legacyMachinery },
          { name: 'Material Charges', amount: legacyMaterial },
        ];
      } else {
        // 3. The array is empty, and they have no legacy charges > 0. Respect the user's deletion!
        finalAdditional = [];
      }

      reset({
        siteName: editingSite.siteName || '',
        codeName: editingSite.codeName || editingSite.code_name || '',
        clientName: editingSite.clientName || '',
        gstin: editingSite.gstin || '',
        workOrderRefNo: editingSite.workOrderRefNo || '',
        workOrderPeriod: editingSite.workOrderPeriod || '',
        address: editingSite.address || '',
        contactNo: editingSite.contactNo || '',
        email: editingSite.email || '',
        mgmtPercent: editingSite.mgmtPercent ?? editingSite.management_fee_percent ?? 5,
        defaultMachineryCharges: editingSite.defaultMachineryCharges ?? editingSite.default_machinery_charges ?? 0,
        defaultMaterialCharges: editingSite.defaultMaterialCharges ?? editingSite.default_material_charges ?? 0,
        defaultAdditionalCharges: finalAdditional,
        status: editingSite.status || 'Active',
        rateCards: editingSite.rateCards || [],
      });
    } else {
      reset({
        siteName: '',
        codeName: '',
        clientName: '',
        gstin: '',
        workOrderRefNo: '',
        workOrderPeriod: '',
        address: '',
        contactNo: '',
        email: '',
        mgmtPercent: 5,
        defaultMachineryCharges: 0,
        defaultMaterialCharges: 0,
        defaultAdditionalCharges: [
          { name: 'Machinery Charges', amount: 0 },
          { name: 'Material Charges', amount: 0 },
        ],
        status: 'Active',
        rateCards: [
          { roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985', persons: 1 },
        ],
      });
    }
  }, [editingSite, isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: SiteFormData) => {
    let payload: any = {
      ...data,
      company_id: selectedCompanyId || (companies[0]?.id || undefined),
      code_name: data.codeName || '',
      codeName: data.codeName || '',
      contact_no: data.contactNo || '',
      email: data.email || '',
      management_fee_percent: Number(data.mgmtPercent) ?? 5,
      default_machinery_charges: Number(data.defaultMachineryCharges) || 0,
      default_material_charges: Number(data.defaultMaterialCharges) || 0,
      additional_charges: data.defaultAdditionalCharges || [],
      default_additional_charges: data.defaultAdditionalCharges || [],
      defaultAdditionalCharges: data.defaultAdditionalCharges || [],
    };

    // If partially locked, preserve original filled values from DB
    if (isPartiallyLocked && editingSite) {
      if (isFieldFilled(editingSite.company_id || editingSite.companyId)) {
        payload.company_id = editingSite.company_id || editingSite.companyId;
      }
      if (isFieldFilled(editingSite.siteName || (editingSite as any).site_name)) {
        payload.siteName = editingSite.siteName || (editingSite as any).site_name;
      }
      if (isFieldFilled(editingSite.codeName || editingSite.code_name)) {
        payload.codeName = editingSite.codeName || editingSite.code_name;
        payload.code_name = editingSite.codeName || editingSite.code_name;
      }
      if (isFieldFilled(editingSite.clientName || (editingSite as any).client_name)) {
        payload.clientName = editingSite.clientName || (editingSite as any).client_name;
      }
      if (isFieldFilled(editingSite.gstin)) {
        payload.gstin = editingSite.gstin;
      }
      if (isFieldFilled(editingSite.contactNo || editingSite.contact_no)) {
        payload.contactNo = editingSite.contactNo || editingSite.contact_no;
        payload.contact_no = editingSite.contactNo || editingSite.contact_no;
      }
      if (isFieldFilled(editingSite.email)) {
        payload.email = editingSite.email;
      }
      if (isFieldFilled(editingSite.address)) {
        payload.address = editingSite.address;
      }
      if (isFieldFilled(editingSite.workOrderRefNo || editingSite.work_order_ref_no)) {
        payload.workOrderRefNo = editingSite.workOrderRefNo || editingSite.work_order_ref_no;
      }
      if (isFieldFilled(editingSite.workOrderPeriod || editingSite.work_order_period)) {
        payload.workOrderPeriod = editingSite.workOrderPeriod || editingSite.work_order_period;
      }
    }

    try {
      if (editingSite) {
        await updateSiteApi(editingSite.id, payload);
        toast.success('Site master updated successfully');
      } else {
        await createSiteApi(payload);
        toast.success('Site master created successfully');
      }
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[SiteFormSheet] Error saving site:', err);
      toast.error(`Failed to save site: ${err.message || 'Server error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white border-l border-gray-200 text-gray-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#34495E] text-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">
                    {editingSite ? `Edit Site Master: ${editingSite.siteName || (editingSite as any).site_name || ''}` : 'Add New Site Master'}
                  </h2>
                  {isLockedRecord && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked Record</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isPartiallyLocked
                    ? 'Existing filled fields are read-only. Empty fields & documents can be saved.'
                    : 'Define client party details, operating entity, work order reference & rate cards.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {editingSite && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'details'
                    ? 'bg-white text-[#34495E] shadow-xs'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Site Details</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'documents'
                    ? 'bg-white text-[#34495E] shadow-xs'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Documents</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        {activeTab === 'documents' && editingSite ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <SiteDocumentsTab siteId={editingSite.id} siteName={editingSite.siteName || (editingSite as any).site_name || 'Site'} />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {/* Lock Notice Banner */}
          {isPartiallyLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Partial Lock Active:</span> Existing filled fields cannot be modified by Admins. You can still enter data for any missing/empty fields and upload new site documents.
              </div>
            </div>
          )}

          {/* Section 1: Operating Entity & Client Party Info */}
          <div className="space-y-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-[#20B2AA] tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Operating Entity &amp; Client Details</span>
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Operating Company Entity *</label>
                {isCompanyLocked && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title="Locked by SuperAdmin">
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              {isLoadingCompanies ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                  <span>Loading company profiles...</span>
                </div>
              ) : (
                <select
                  value={selectedCompanyId}
                  disabled={isCompanyLocked}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isCompanyLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isCompanyLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.legal_name || c.name} ({c.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Site Name *</label>
                  {isSiteNameLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Minerva"
                  disabled={isSiteNameLocked}
                  {...register('siteName')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isSiteNameLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isSiteNameLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
                {errors.siteName && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.siteName.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Code Name (Internal)</label>
                  {isCodeNameLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Ajmera(HK)"
                  disabled={isCodeNameLocked}
                  {...register('codeName')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none ${
                    isCodeNameLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isCodeNameLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Client Party Name *</label>
                  {isClientNameLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Lokhandwala Minerva CHS LTD"
                  disabled={isClientNameLocked}
                  {...register('clientName')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isClientNameLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isClientNameLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
                {errors.clientName && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.clientName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">GSTIN (Optional)</label>
                  {isGstinLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. 27AAEAL7350F1ZM"
                  disabled={isGstinLocked}
                  {...register('gstin')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 uppercase focus:outline-none ${
                    isGstinLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isGstinLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Status</label>
                  {isStatusLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <select
                  disabled={isStatusLocked}
                  {...register('status')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isStatusLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isStatusLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Contact Number (Optional)</label>
                  {isContactLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  disabled={isContactLocked}
                  {...register('contactNo')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none ${
                    isContactLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isContactLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Email Address (Optional)</label>
                  {isEmailLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="e.g. client@example.com"
                  disabled={isEmailLocked}
                  {...register('email')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isEmailLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isEmailLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Address *</label>
                {isAddressLocked && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                    <Lock className="w-2 h-2 text-amber-600" />
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                placeholder="Site address details..."
                disabled={isAddressLocked}
                {...register('address')}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                  isAddressLocked
                    ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                    : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                }`}
                title={isAddressLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
              />
              {errors.address && (
                <p className="text-[11px] text-red-500 mt-1">{errors.address.message}</p>
              )}
            </div>
          </div>

          {/* Section 2: Work Order Info */}
          <div className="space-y-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-[#20B2AA] tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <FileText className="w-4 h-4" />
              <span>Work Order Details</span>
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Work Order Ref No.</label>
                  {isWorkOrderRefLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="LMCHS/003/2026-27"
                  disabled={isWorkOrderRefLocked}
                  {...register('workOrderRefNo')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none ${
                    isWorkOrderRefLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isWorkOrderRefLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Work Order Period</label>
                  {isWorkOrderPeriodLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="01st April 2026 to 31st March 2027"
                  disabled={isWorkOrderPeriodLocked}
                  {...register('workOrderPeriod')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none ${
                    isWorkOrderPeriodLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isWorkOrderPeriodLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Management Fee (%)</label>
                  {isMgmtPercentLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1" title="Locked by SuperAdmin">
                      <Lock className="w-2 h-2 text-amber-600" />
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="5"
                  disabled={isMgmtPercentLocked}
                  {...register('mgmtPercent', { valueAsNumber: true })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none ${
                    isMgmtPercentLocked
                      ? 'bg-slate-100 text-gray-500 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-gray-200 focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]'
                  }`}
                  title={isMgmtPercentLocked ? "Locked by SuperAdmin — existing value cannot be changed" : undefined}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">Default Additional Charges (₹)</label>
                <button
                  type="button"
                  onClick={() => appendAdditionalCharge({ name: '', amount: 0 })}
                  className="text-xs text-[#20B2AA] hover:text-[#188B85] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Charge Field
                </button>
              </div>

              {additionalChargeFields.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Charge Name (e.g. Machinery Charges)"
                    {...register(`defaultAdditionalCharges.${idx}.name` as const)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    {...register(`defaultAdditionalCharges.${idx}.amount` as const, { valueAsNumber: true })}
                    className="w-32 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAdditionalCharge(idx)}
                    className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Dynamic Rate Cards (useFieldArray) */}
          <div className="space-y-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase text-[#20B2AA] tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>Rate Cards Setup ({fields.length})</span>
              </h3>
              <button
                type="button"
                onClick={() =>
                  append({ roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985', persons: 1 })
                }
                className="text-xs px-3 py-1.5 rounded-lg bg-[#20B2AA]/10 text-[#20B2AA] hover:bg-[#20B2AA]/20 border border-[#20B2AA]/30 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Role Rate</span>
              </button>
            </div>

            {errors.rateCards && typeof errors.rateCards.message === 'string' && (
              <p className="text-[11px] text-red-500">{errors.rateCards.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2 bg-slate-50 p-3.5 rounded-xl border border-gray-200 items-end"
                >
                  <div className="col-span-4">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Role / Designation *</label>
                    <input
                      type="text"
                      placeholder="e.g. HouseKeeping"
                      {...register(`rateCards.${idx}.roleName`)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#20B2AA]"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Monthly Rate (₹) *</label>
                    <input
                      type="number"
                      placeholder="20570"
                      {...register(`rateCards.${idx}.monthlyRate`, { valueAsNumber: true })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono focus:outline-none focus:border-[#20B2AA]"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">HSN Code</label>
                    <input
                      type="text"
                      {...register(`rateCards.${idx}.hsnCode`)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono text-center focus:outline-none focus:border-[#20B2AA]"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Persons</label>
                    <input
                      type="number"
                      placeholder="1"
                      min={1}
                      {...register(`rateCards.${idx}.persons`, { valueAsNumber: true })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono text-center focus:outline-none focus:border-[#20B2AA]"
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                        title="Remove Role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit Action */}
          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] disabled:opacity-50 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title={isPartiallyLocked ? 'Only newly filled empty fields and new documents will be saved' : undefined}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Site...</span>
                </>
              ) : isPartiallyLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Save Blank Fields &amp; Documents</span>
                </>
              ) : editingSite ? (
                'Update Site Master'
              ) : (
                'Save Site Master'
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
