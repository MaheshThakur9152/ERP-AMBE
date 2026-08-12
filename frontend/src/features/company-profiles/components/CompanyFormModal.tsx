import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CompanyProfile, CreateCompanyInput } from '../types';
import { toast } from '@/components/ui/toast';
import { X, Plus, Trash2, Building2, MapPin, CreditCard, FileCheck, Hash } from 'lucide-react';

export const companyProfileSchema = z.object({
  code: z.string().min(1, 'Entity Code is required'),
  name: z.string().min(1, 'Brand Name is required'),
  legal_name: z.string().min(1, 'Legal Registered Name is required'),
  gstin: z.string().optional().or(z.literal('')),
  cin: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
  address_line1: z.string().min(1, 'Address Line 1 is required'),
  address_line2: z.string().optional().or(z.literal('')),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().min(1, 'Pincode is required'),
  bank_name: z.string().min(1, 'Bank Name is required'),
  bank_account_no: z.string().min(1, 'Account Number is required'),
  bank_ifsc: z.string().min(1, 'IFSC Code is required'),
  bank_branch: z.string().min(1, 'Branch Name is required'),
  tax_prefix: z.string().default('AS/26-27/'),
  tax_sequence: z.coerce.number().default(1),
  proforma_prefix: z.string().default('AS/P/26-27/'),
  proforma_sequence: z.coerce.number().default(1),
  terms: z.array(z.object({ text: z.string() })).default([
    { text: 'Payment can only be done in cheque/DD, NEFT, RTGS' },
    { text: 'Payment due within 15 days of invoice date.' },
  ]),
});

export type CompanyFormData = z.infer<typeof companyProfileSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateCompanyInput) => Promise<void>;
  initialData?: CompanyProfile | null;
}

export const CompanyFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companyProfileSchema) as any,
    defaultValues: {
      code: 'AMBE',
      name: '',
      legal_name: '',
      gstin: '',
      cin: '',
      phone: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
      bank_branch: '',
      tax_prefix: 'AS/26-27/',
      tax_sequence: 1,
      proforma_prefix: 'AS/P/26-27/',
      proforma_sequence: 1,
      terms: [
        { text: 'Payment can only be done in cheque/DD, NEFT, RTGS' },
        { text: 'Payment due within 15 days of invoice date.' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'terms',
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code || 'AMBE',
        name: initialData.name || '',
        legal_name: initialData.legal_name || '',
        gstin: initialData.gstin || '',
        cin: initialData.cin || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        address_line1: initialData.address_line1 || '',
        address_line2: initialData.address_line2 || '',
        city: initialData.city || '',
        state: initialData.state || '',
        pincode: initialData.pincode || '',
        bank_name: initialData.bank_name || '',
        bank_account_no: initialData.bank_account_no || '',
        bank_ifsc: initialData.bank_ifsc || '',
        bank_branch: initialData.bank_branch || '',
        tax_prefix: initialData.tax_prefix || 'AS/26-27/',
        tax_sequence: initialData.tax_sequence ?? 1,
        proforma_prefix: initialData.proforma_prefix || 'AS/P/26-27/',
        proforma_sequence: initialData.proforma_sequence ?? 1,
        terms: initialData.terms_and_conditions?.length
          ? initialData.terms_and_conditions.map((t) => ({ text: t }))
          : [{ text: 'Payment can only be done in cheque/DD, NEFT, RTGS' }],
      });
    } else {
      reset({
        code: 'AMBE',
        name: '',
        legal_name: '',
        gstin: '',
        cin: '',
        phone: '',
        email: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        bank_name: '',
        bank_account_no: '',
        bank_ifsc: '',
        bank_branch: '',
        tax_prefix: 'AS/26-27/',
        tax_sequence: 1,
        proforma_prefix: 'AS/P/26-27/',
        proforma_sequence: 1,
        terms: [
          { text: 'Payment can only be done in cheque/DD, NEFT, RTGS' },
          { text: 'Payment due within 15 days of invoice date.' },
        ],
      });
    }
  }, [initialData, isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: CompanyFormData) => {
    try {
      const payload: CreateCompanyInput = {
        code: data.code,
        name: data.name,
        legal_name: data.legal_name,
        gstin: data.gstin,
        cin: data.cin,
        phone: data.phone,
        email: data.email,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        bank_name: data.bank_name,
        bank_account_no: data.bank_account_no,
        bank_ifsc: data.bank_ifsc,
        bank_branch: data.bank_branch,
        tax_prefix: data.tax_prefix,
        tax_sequence: Number(data.tax_sequence) || 1,
        proforma_prefix: data.proforma_prefix,
        proforma_sequence: Number(data.proforma_sequence) || 1,
        terms_and_conditions: data.terms.map((t) => t.text).filter(Boolean),
      };
      await onSave(payload);
      toast.success('Company profile saved successfully');
      onClose();
    } catch (err: any) {
      console.error('[CompanyFormModal] Error saving company profile:', err);
      toast.error(`Failed to save company profile: ${err.message || 'Server error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-2xl my-4 text-gray-900 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#20B2AA] rounded-lg text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">
                {initialData ? 'Edit Company Profile' : 'New Company Profile'}
              </h2>
              <p className="text-xs text-slate-300">All billing documents will use this entity configuration.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-6 space-y-6 max-h-[72vh] overflow-y-auto bg-gray-50/50">
            {/* Entity Identity Section */}
            <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#20B2AA] uppercase tracking-wider bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Entity Identity
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Entity Code *</label>
                  <input
                    type="text"
                    placeholder="AMBE"
                    {...register('code')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.code && <p className="text-[11px] text-red-500 mt-0.5">{errors.code.message}</p>}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ambe Management"
                    {...register('name')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Legal Registered Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ambe Service Facilities Private Limited"
                  {...register('legal_name')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
                {errors.legal_name && <p className="text-[11px] text-red-500 mt-0.5">{errors.legal_name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="27AAZCA5609F1ZA"
                    {...register('gstin')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">CIN No (Optional)</label>
                  <input
                    type="text"
                    placeholder="U80200MH2023PTC412420"
                    {...register('cin')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Contact No</label>
                  <input
                    type="text"
                    placeholder="022 45066566 / 9619607537"
                    {...register('phone')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email / Website</label>
                  <input
                    type="text"
                    placeholder="contact@ambeservice.com"
                    {...register('email')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                </div>
              </div>
            </section>

            {/* Invoice Sequence Settings Section */}
            <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#20B2AA] uppercase tracking-wider bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Invoice Sequence Settings
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Tax Invoice Sequence Settings */}
                <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-100 space-y-2">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wide block border-b border-teal-100 pb-1">
                    Tax Invoice Sequence
                  </span>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Tax Invoice Prefix</label>
                    <input
                      type="text"
                      placeholder="AS/26-27/"
                      {...register('tax_prefix')}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Tax Next Sequence Number</label>
                    <input
                      type="number"
                      placeholder="42"
                      {...register('tax_sequence')}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                    />
                  </div>
                </div>

                {/* Proforma Invoice Sequence Settings */}
                <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 space-y-2">
                  <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide block border-b border-purple-100 pb-1">
                    Proforma Invoice Sequence
                  </span>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Proforma Prefix</label>
                    <input
                      type="text"
                      placeholder="AS/P/26-27/"
                      {...register('proforma_prefix')}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Proforma Next Sequence Number</label>
                    <input
                      type="number"
                      placeholder="35"
                      {...register('proforma_sequence')}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Registered Address Section */}
            <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#20B2AA] uppercase tracking-wider bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Registered Address
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  placeholder="Shop No - 49 A, Ground Floor, Pooja Enclave CHS Ltd"
                  {...register('address_line1')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
                {errors.address_line1 && <p className="text-[11px] text-red-500 mt-0.5">{errors.address_line1.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  placeholder="Ganesh Nagar, Kandivali (West)"
                  {...register('address_line2')}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    {...register('city')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.city && <p className="text-[11px] text-red-500 mt-0.5">{errors.city.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    {...register('state')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.state && <p className="text-[11px] text-red-500 mt-0.5">{errors.state.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    placeholder="400067"
                    {...register('pincode')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.pincode && <p className="text-[11px] text-red-500 mt-0.5">{errors.pincode.message}</p>}
                </div>
              </div>
            </section>

            {/* Bank Account Section */}
            <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#20B2AA] uppercase tracking-wider bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Bank Account Credentials
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    placeholder="Axis Bank"
                    {...register('bank_name')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.bank_name && <p className="text-[11px] text-red-500 mt-0.5">{errors.bank_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Account Number *</label>
                  <input
                    type="text"
                    placeholder="924020001871570"
                    {...register('bank_account_no')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.bank_account_no && <p className="text-[11px] text-red-500 mt-0.5">{errors.bank_account_no.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    placeholder="UTIB0001572"
                    {...register('bank_ifsc')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.bank_ifsc && <p className="text-[11px] text-red-500 mt-0.5">{errors.bank_ifsc.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    placeholder="Kandivali West, Link Road"
                    {...register('bank_branch')}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                  />
                  {errors.bank_branch && <p className="text-[11px] text-red-500 mt-0.5">{errors.bank_branch.message}</p>}
                </div>
              </div>
            </section>

            {/* Default Invoice Terms Section (useFieldArray) */}
            <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-[#20B2AA] uppercase tracking-wider bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" /> Default Invoice Terms ({fields.length})
                </span>
                <button
                  type="button"
                  onClick={() => append({ text: '' })}
                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#20B2AA] text-xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-teal-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Term Line
                </button>
              </div>

              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}.</span>
                    <input
                      type="text"
                      {...register(`terms.${i}.text`)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA]"
                      placeholder="Enter term or condition line..."
                    />
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove term line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-300 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Profile...' : initialData ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
