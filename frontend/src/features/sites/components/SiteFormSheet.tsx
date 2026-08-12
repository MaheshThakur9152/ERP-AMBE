import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { siteSchema, SiteFormData, Site } from '../types';
import { createSiteApi, updateSiteApi } from '../api/siteApi';
import { fetchCompanies } from '@/features/company-profiles/api/companyApi';
import { CompanyProfile } from '@/features/company-profiles/types';
import { toast } from '@/components/ui/toast';
import { X, Plus, Trash2, Building, FileText, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';

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
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingCompanies(true);
      fetchCompanies()
        .then((data) => {
          setCompanies(data);
          if (data.length > 0) {
            setSelectedCompanyId(data[0].id);
          }
        })
        .catch((err) => {
          console.error('[SiteFormSheet] Failed to fetch companies:', err);
        })
        .finally(() => {
          setIsLoadingCompanies(false);
        });
    }
  }, [isOpen]);

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
      clientName: '',
      gstin: '',
      workOrderRefNo: '',
      workOrderPeriod: '',
      address: '',
      contactNo: '',
      email: '',
      status: 'Active',
      rateCards: [
        { roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rateCards',
  });

  useEffect(() => {
    if (editingSite) {
      if (editingSite.company_id || editingSite.companyId) {
        setSelectedCompanyId(editingSite.company_id || editingSite.companyId || '');
      }
      reset({
        siteName: editingSite.siteName || '',
        clientName: editingSite.clientName || '',
        gstin: editingSite.gstin || '',
        workOrderRefNo: editingSite.workOrderRefNo || '',
        workOrderPeriod: editingSite.workOrderPeriod || '',
        address: editingSite.address || '',
        contactNo: editingSite.contactNo || '',
        email: editingSite.email || '',
        status: editingSite.status || 'Active',
        rateCards: editingSite.rateCards || [],
      });
    } else {
      reset({
        siteName: '',
        clientName: '',
        gstin: '',
        workOrderRefNo: '',
        workOrderPeriod: '',
        address: '',
        contactNo: '',
        email: '',
        status: 'Active',
        rateCards: [
          { roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985' },
        ],
      });
    }
  }, [editingSite, isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: SiteFormData) => {
    const payload = {
      ...data,
      company_id: selectedCompanyId || (companies[0]?.id || undefined),
    };

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
        <div className="px-6 py-5 bg-[#34495E] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {editingSite ? 'Edit Site Master' : 'Add New Site Master'}
              </h2>
              <p className="text-xs text-slate-300">
                Define client party details, operating entity, work order reference &amp; role rate cards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {/* Section 1: Operating Entity & Client Party Info */}
          <div className="space-y-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase text-[#20B2AA] tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Operating Entity &amp; Client Details</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Operating Company Entity *</label>
              {isLoadingCompanies ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                  <span>Loading company profiles...</span>
                </div>
              ) : (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.legal_name || c.name} ({c.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Site Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Minerva"
                  {...register('siteName')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
                {errors.siteName && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.siteName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Client Party Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Lokhandwala Minerva CHS LTD"
                  {...register('clientName')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
                {errors.clientName && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.clientName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAEAL7350F1ZM"
                  {...register('gstin')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 uppercase focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select
                  {...register('status')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Address *</label>
              <textarea
                rows={2}
                placeholder="Site address details..."
                {...register('address')}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Work Order Ref No. (Optional)</label>
                <input
                  type="text"
                  placeholder="LMCHS/003/2026-27"
                  {...register('workOrderRefNo')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Work Order Period (Optional)</label>
                <input
                  type="text"
                  placeholder="01st April 2026 to 31st March 2027"
                  {...register('workOrderPeriod')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
              </div>
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
                  append({ roleName: '', monthlyRate: 0, workingDays: 31, hsnCode: '9985' })
                }
                className="text-xs px-3 py-1.5 rounded-lg bg-[#20B2AA]/10 text-[#20B2AA] hover:bg-[#20B2AA]/20 border border-[#20B2AA]/30 flex items-center gap-1 font-semibold transition-colors"
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
                  <div className="col-span-5">
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

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-200 rounded-lg transition-colors"
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
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] disabled:opacity-50 shadow-sm transition-all"
            >
              {isSubmitting ? 'Saving Site...' : editingSite ? 'Update Site Master' : 'Save Site Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
