import React, { useState, useEffect } from 'react';
import { CompanyProfile, CreateCompanyInput } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2 } from 'lucide-react';

const BLANK: CreateCompanyInput = {
  code: '', name: '', legal_name: '', gstin: '', pan: '',
  address_line1: '', address_line2: '', city: '', state: '', pincode: '', state_code: '',
  bank_name: '', bank_account_no: '', bank_ifsc: '', bank_branch: '', upi_id: '',
  terms_and_conditions: ['Payment due within 15 days.', 'Interest @ 18% p.a. on delayed payments.'],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateCompanyInput) => Promise<void>;
  initialData?: CompanyProfile | null;
}

export const CompanyFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [form, setForm] = useState<CreateCompanyInput>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      const { id, created_at, updated_at, is_active, ...rest } = initialData;
      setForm(rest);
    } else {
      setForm(BLANK);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const set = (key: keyof CreateCompanyInput, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const addTerm = () => setForm((f) => ({ ...f, terms_and_conditions: [...f.terms_and_conditions, ''] }));
  const removeTerm = (i: number) => setForm((f) => ({ ...f, terms_and_conditions: f.terms_and_conditions.filter((_, idx) => idx !== i) }));
  const updateTerm = (i: number, v: string) => setForm((f) => {
    const t = [...f.terms_and_conditions]; t[i] = v;
    return { ...f, terms_and_conditions: t };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl my-4 text-zinc-100">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">
              {initialData ? 'Edit Company Profile' : 'New Company Profile'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">All billing documents will use this data.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Identity */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Identity</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Code" placeholder="AMBE" value={form.code} onChange={(e) => set('code', e.target.value)} required />
                <Input label="Brand Name" placeholder="Ambe Management" value={form.name} onChange={(e) => set('name', e.target.value)} required className="col-span-2" />
              </div>
              <Input label="Legal Registered Name" placeholder="Ambe Management Services Pvt. Ltd." value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="GSTIN" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
                <Input label="PAN" placeholder="AAAAA0000A" value={form.pan} onChange={(e) => set('pan', e.target.value)} />
              </div>
            </section>

            {/* Address */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Registered Address</p>
              <Input label="Address Line 1" value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} required />
              <Input label="Address Line 2 (optional)" value={form.address_line2} onChange={(e) => set('address_line2', e.target.value)} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} required />
                <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} required />
                <Input label="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} required />
              </div>
            </section>

            {/* Banking */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Bank Account</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Bank Name" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} required />
                <Input label="Account Number" value={form.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} required />
                <Input label="IFSC Code" value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value)} required />
                <Input label="Branch" value={form.bank_branch} onChange={(e) => set('bank_branch', e.target.value)} required />
              </div>
            </section>

            {/* Terms */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Terms &amp; Conditions</p>
                <button type="button" onClick={addTerm} className="btn-ghost btn-sm text-indigo-400 hover:text-indigo-300">
                  <Plus className="w-3.5 h-3.5" />Add line
                </button>
              </div>
              <div className="space-y-2">
                {form.terms_and_conditions.map((term, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-4 flex-shrink-0">{i + 1}.</span>
                    <input
                      value={term}
                      onChange={(e) => updateTerm(i, e.target.value)}
                      className="field-input flex-1 text-xs"
                      placeholder="Add a term…"
                    />
                    <button type="button" onClick={() => removeTerm(i)} className="btn-ghost p-1.5 text-zinc-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Modal footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-white/10 bg-zinc-950/50">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : initialData ? 'Save changes' : 'Create profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
