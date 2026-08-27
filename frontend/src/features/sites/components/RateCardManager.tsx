import React, { useState, useEffect } from 'react';
import { X, Plus, CreditCard, Loader2, Trash2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface RateCardRecord {
  id?: string;
  site_id?: string;
  site_name?: string;
  post_name: string;
  gross_salary: number;
  committed_salary?: number | null;
  basic_da: number;
  hra: number;
  washing_allowance?: number;
  conveyance_allowance?: number;
  other_cash_allowance?: number;
  other_allowance?: number;
  incentive_amount?: number;
  incentive?: number;
  is_flat_wage?: boolean;
  created_at?: string;
}

interface RateCardManagerProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  onRateCardUpdated?: () => void;
}

export const RateCardManager: React.FC<RateCardManagerProps> = ({
  isOpen,
  onClose,
  siteId,
  siteName,
  onRateCardUpdated,
}) => {
  const [rateCards, setRateCards] = useState<RateCardRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Site-scoped designations state
  const [siteDesignations, setSiteDesignations] = useState<string[]>([]);
  const [isCustomPost, setIsCustomPost] = useState<boolean>(false);
  const [customPostName, setCustomPostName] = useState<string>('');

  // New Rate Card Form State (Starts Empty, NOT 0)
  const [postName, setPostName] = useState('');
  const [grossSalary, setGrossSalary] = useState<number | ''>('');
  const [committedSalary, setCommittedSalary] = useState<number | ''>('');
  const [basicDa, setBasicDa] = useState<number | ''>('');
  const [hra, setHra] = useState<number | ''>('');
  const [otherAllowance, setOtherAllowance] = useState<number | ''>('');
  const [conveyanceAllowance, setConveyanceAllowance] = useState<number | ''>('');
  const [incentiveAmount, setIncentiveAmount] = useState<number | ''>('');
  const [isFlatWage, setIsFlatWage] = useState<boolean>(false);

  const resetForm = () => {
    setPostName('');
    setIsCustomPost(false);
    setCustomPostName('');
    setGrossSalary('');
    setCommittedSalary('');
    setBasicDa('');
    setHra('');
    setOtherAllowance('');
    setConveyanceAllowance('');
    setIncentiveAmount('');
    setIsFlatWage(false);
  };

  const fetchSiteDesignations = async () => {
    if (!siteId) return;
    try {
      const roles = new Set<string>();

      // 1. Fetch distinct designations from staff assigned to this site
      const { data: staffData } = await supabase
        .from('staff')
        .select('designation')
        .eq('site_id', siteId);

      if (staffData) {
        staffData.forEach((s: any) => {
          if (s.designation?.trim()) roles.add(s.designation.trim());
        });
      }

      // 2. Fetch designations from site's JSON rate_cards
      const { data: siteRow } = await supabase
        .from('sites')
        .select('rate_cards')
        .eq('id', siteId)
        .maybeSingle();

      if (siteRow?.rate_cards && Array.isArray(siteRow.rate_cards)) {
        siteRow.rate_cards.forEach((rc: any) => {
          const name = rc.roleName || rc.post_name || rc.designation;
          if (name?.trim()) roles.add(name.trim());
        });
      }

      setSiteDesignations(Array.from(roles));
    } catch (e) {
      console.warn('Could not fetch site designations:', e);
    }
  };

  const fetchRateCards = async () => {
    if (!siteId && !siteName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let list: RateCardRecord[] = [];

      // 1. Fetch from rate_cards table
      let query = supabase.from('rate_cards').select('*');
      if (siteId) {
        query = query.or(`site_id.eq.${siteId},site_name.eq.${siteName}`);
      } else {
        query = query.eq('site_name', siteName);
      }

      const { data: dbCards, error } = await query.order('created_at', { ascending: false });
      if (!error && dbCards) {
        list = [...dbCards];
      }

      // 2. Also check sites table for JSON rate_cards column
      if (siteId) {
        const { data: siteRow } = await supabase
          .from('sites')
          .select('id, site_name, rate_cards')
          .eq('id', siteId)
          .maybeSingle();

        if (siteRow?.rate_cards && Array.isArray(siteRow.rate_cards) && siteRow.rate_cards.length > 0) {
          const siteJsonCards: RateCardRecord[] = siteRow.rate_cards.map((rc: any, idx: number) => ({
            id: rc.id || `site-json-${idx}`,
            site_id: siteId,
            site_name: siteName,
            post_name: rc.roleName || rc.post_name || rc.designation || 'Staff',
            gross_salary: Number(rc.monthlyRate || rc.gross_salary || rc.grossSalary || 0),
            committed_salary: rc.committed_salary ? Number(rc.committed_salary) : null,
            basic_da: Number(rc.basic_da || 0),
            hra: Number(rc.hra || 0),
            other_allowance: Number(rc.other_allowance || 0),
            is_flat_wage: Boolean(rc.is_flat_wage || rc.isFlatWage),
          }));

          // Merge without duplicate post_names
          const existingPostNames = new Set(list.map((r) => r.post_name.toLowerCase()));
          for (const sjc of siteJsonCards) {
            if (!existingPostNames.has(sjc.post_name.toLowerCase())) {
              list.push(sjc);
            }
          }
        }
      }

      setRateCards(list);
    } catch (err: any) {
      console.error('Fetch rate cards failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRateCards();
      fetchSiteDesignations();
      resetForm();
    }
  }, [isOpen, siteId, siteName]);

  // Auto-calculate Basic, HRA, Other Allowance, Conveyance when Gross Salary is entered if blank
  const handleGrossChange = (valStr: string) => {
    if (valStr === '') {
      setGrossSalary('');
      if (!isFlatWage) {
        setBasicDa('');
        setHra('');
        setOtherAllowance('');
        setConveyanceAllowance('');
      }
      return;
    }
    const val = Number(valStr);
    setGrossSalary(isNaN(val) ? '' : val);
    if (val > 0 && !isFlatWage) {
      const b = Math.round(val * 0.5);
      const h = Math.round(val * 0.2);
      const o = Math.round(val * 0.15);
      const c = Math.max(0, val - b - h - o);
      setBasicDa(b);
      setHra(h);
      setOtherAllowance(o);
      setConveyanceAllowance(c);
    }
  };

  const handleAddRateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePostName = (isCustomPost ? customPostName : postName).trim();
    if (!effectivePostName || grossSalary === '') {
      setErrorMsg('Post Name and Gross Salary are required.');
      return;
    }

    // Lighter duplicate validation
    const duplicateExists = rateCards.some(
      (rc) => rc.post_name.trim().toLowerCase() === effectivePostName.toLowerCase()
    );
    if (duplicateExists) {
      const proceed = window.confirm(
        `A rate card for "${effectivePostName}" already exists for this site. Are you sure you want to add another rate card for this role?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: Record<string, any> = {
      site_id: siteId || null,
      site_name: siteName,
      post_name: effectivePostName,
      gross_salary: Number(grossSalary) || 0,
      committed_salary: committedSalary === '' ? null : Number(committedSalary),
      basic_da: isFlatWage ? 0 : (basicDa === '' ? 0 : Number(basicDa)),
      hra: isFlatWage ? 0 : (hra === '' ? 0 : Number(hra)),
      other_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
      washing_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
      conveyance_allowance: isFlatWage ? 0 : (conveyanceAllowance === '' ? 0 : Number(conveyanceAllowance)),
      incentive_amount: incentiveAmount === '' ? 0 : Number(incentiveAmount),
      incentive: incentiveAmount === '' ? 0 : Number(incentiveAmount),
      is_flat_wage: isFlatWage,
    };

    try {
      let { data, error } = await supabase.from('rate_cards').insert([payload]).select();

      if (error) {
        console.warn('Initial rate_cards insert note:', error.message);
        // Retry with exact standardized schema columns
        const fallbackPayload = {
          site_id: siteId || null,
          site_name: siteName,
          post_name: effectivePostName,
          gross_salary: Number(grossSalary) || 0,
          committed_salary: committedSalary === '' ? null : Number(committedSalary),
          basic_da: isFlatWage ? 0 : (basicDa === '' ? 0 : Number(basicDa)),
          hra: isFlatWage ? 0 : (hra === '' ? 0 : Number(hra)),
          other_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
          conveyance_allowance: isFlatWage ? 0 : (conveyanceAllowance === '' ? 0 : Number(conveyanceAllowance)),
          incentive_amount: incentiveAmount === '' ? 0 : Number(incentiveAmount),
          is_flat_wage: isFlatWage,
        };
        const retry = await supabase.from('rate_cards').insert([fallbackPayload]).select();
        error = retry.error;
        data = retry.data;
      }

      if (error) {
        console.error('Failed to insert rate_cards:', error.message);
        setErrorMsg(`Insert error: ${error.message}`);
      } else {
        setSuccessMsg(`Rate Card "${effectivePostName}" created successfully!`);
        resetForm();
        await fetchRateCards();
        await fetchSiteDesignations();
        if (onRateCardUpdated) onRateCardUpdated();
      }
    } catch (err: any) {
      console.error('Add rate card failed:', err);
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  const standardDesignations = [
    'Housekeeping',
    'Supervisor',
    'HK Supervisor',
    'Keyman',
    'Key Person',
    'Lift Operator',
    'Pantry',
    'Reliever',
    'Janitor',
    'Security Guard',
    'Store Assistant',
    'Trainee Staff',
  ];

  const remainingStandard = standardDesignations.filter(
    (d) => !siteDesignations.some((sd) => sd.toLowerCase() === d.toLowerCase())
  );

  const handleDeleteRateCard = async (id?: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this Rate Card?')) return;

    try {
      const { error } = await supabase.from('rate_cards').delete().eq('id', id);
      if (error) {
        alert(`Delete failed: ${error.message}`);
      } else {
        fetchRateCards();
        if (onRateCardUpdated) onRateCardUpdated();
      }
    } catch (err: any) {
      console.error('Delete rate card error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#34495E] text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Manage Rate Cards</h3>
              <p className="text-[11px] text-gray-300">Site: <strong className="text-teal-300">{siteName}</strong></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to Add Rate Card */}
          <form onSubmit={handleAddRateCard} className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add New Designation Rate Card
            </h4>

            {/* Row 1: Post Name, Gross Salary, Committed Salary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Post Name *</label>
                <select
                  value={isCustomPost ? '__custom__' : postName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setIsCustomPost(true);
                      setPostName('__custom__');
                    } else {
                      setIsCustomPost(false);
                      setPostName(val);
                      setCustomPostName('');
                    }
                  }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:border-[#20B2AA]"
                  required={!isCustomPost}
                >
                  <option value="">Select Role / Designation...</option>
                  {siteDesignations.length > 0 && (
                    <optgroup label="⭐ Site Roles (Active at this Site)">
                      {siteDesignations.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Standard Designations">
                    {remainingStandard.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__custom__">+ Enter Custom Designation...</option>
                </select>

                {isCustomPost && (
                  <input
                    type="text"
                    placeholder="Type custom designation name..."
                    value={customPostName}
                    onChange={(e) => setCustomPostName(e.target.value)}
                    className="w-full mt-2 bg-white border border-teal-400 rounded-lg px-3 py-1.5 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#20B2AA]"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Gross Salary (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={grossSalary === '' ? '' : grossSalary}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono font-bold focus:outline-none focus:border-[#20B2AA]"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-gray-700">Committed Salary (₹)</label>
                  <span className="text-[9px] text-gray-400 font-medium">Ref Only</span>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={committedSalary === '' ? '' : committedSalary}
                  onChange={(e) => setCommittedSalary(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono font-bold focus:outline-none focus:border-[#20B2AA]"
                />
                <p className="text-[9.5px] text-gray-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span>For reference only — not used in payroll calculations.</span>
                </p>
              </div>
            </div>

            {/* Non-Compliance / Flat Wage Setup Checkbox */}
            <div className="flex items-center gap-2 pt-1 pb-1">
              <input
                type="checkbox"
                id="isFlatWage"
                checked={isFlatWage}
                onChange={(e) => {
                  setIsFlatWage(e.target.checked);
                  if (e.target.checked) {
                    setBasicDa(0);
                    setHra(0);
                    setOtherAllowance(0);
                    setConveyanceAllowance(0);
                  } else {
                    setBasicDa('');
                    setHra('');
                    setOtherAllowance('');
                    setConveyanceAllowance('');
                  }
                }}
                className="w-4 h-4 rounded text-[#20B2AA] focus:ring-[#20B2AA]"
              />
              <label htmlFor="isFlatWage" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                <span>Non-Compliance / Flat Wage Setup</span>
                <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  (Bypasses EPF/ESIC/PT)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">Basic + DA (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  disabled={isFlatWage}
                  value={basicDa === '' ? '' : basicDa}
                  onChange={(e) => setBasicDa(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">HRA (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  disabled={isFlatWage}
                  value={hra === '' ? '' : hra}
                  onChange={(e) => setHra(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">Other Allow (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  disabled={isFlatWage}
                  value={otherAllowance === '' ? '' : otherAllowance}
                  onChange={(e) => setOtherAllowance(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-1">Conveyance (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  disabled={isFlatWage}
                  value={conveyanceAllowance === '' ? '' : conveyanceAllowance}
                  onChange={(e) => setConveyanceAllowance(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-indigo-700 mb-1">Fixed Incentive (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={incentiveAmount === '' ? '' : incentiveAmount}
                  onChange={(e) => setIncentiveAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs text-indigo-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#20B2AA] hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Save Rate Card</span>
              </button>
            </div>
          </form>

          {/* Existing Rate Cards List */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
              Existing Rate Cards ({rateCards.length})
            </h4>

            {loading ? (
              <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#20B2AA]" />
                <span>Loading rate cards...</span>
              </div>
            ) : rateCards.length === 0 ? (
              <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No rate cards created for this site yet. Create one using the form above.
              </div>
            ) : (
              <div className="space-y-2">
                {rateCards.map((rc) => (
                  <div
                    key={rc.id}
                    className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center justify-between shadow-2xs hover:border-teal-200 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <span>{rc.post_name}</span>
                        {rc.is_flat_wage && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                            Flat Wage
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Basic+DA: <strong>₹{rc.basic_da}</strong></span>
                        <span>HRA: <strong>₹{rc.hra}</strong></span>
                        <span>Other: <strong>₹{rc.other_allowance}</strong></span>
                        {rc.conveyance_allowance ? (
                          <span>Conveyance: <strong>₹{rc.conveyance_allowance}</strong></span>
                        ) : null}
                        {(rc.incentive_amount || rc.incentive) ? (
                          <span className="text-indigo-600 font-semibold">
                            Incentive: ₹{rc.incentive_amount || rc.incentive}
                          </span>
                        ) : null}
                        {rc.committed_salary != null && Number(rc.committed_salary) > 0 && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-sans text-[10.5px] border border-slate-200">
                            Ref Committed: <strong>₹{Number(rc.committed_salary).toLocaleString('en-IN')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right font-mono">
                        <div className="text-xs text-gray-400 uppercase font-sans">Gross Salary</div>
                        <div className="text-sm font-bold text-emerald-700">₹{rc.gross_salary?.toLocaleString('en-IN')}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRateCard(rc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete Rate Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

