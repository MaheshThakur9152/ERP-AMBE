import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  CreditCard,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  UserCheck,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';

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

export interface SiteStaffMember {
  id: string;
  employee_name?: string;
  biometric_code?: string | null;
  designation?: string | null;
  rate_card_id?: string | null;
  status?: string;
  site_id?: string;
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

  // Site staff state for roster management
  const [siteStaff, setSiteStaff] = useState<SiteStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);

  // Expanded Roster State (which rate card row is open)
  const [expandedRosterCardId, setExpandedRosterCardId] = useState<string | null>(null);
  const [draftAssignedStaffIds, setDraftAssignedStaffIds] = useState<Set<string>>(new Set());
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [savingRoster, setSavingRoster] = useState<boolean>(false);
  const [rosterErrorMsg, setRosterErrorMsg] = useState<string | null>(null);

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

  const fetchSiteStaff = async () => {
    if (!siteId) return;
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, employee_name, biometric_code, designation, rate_card_id, status, site_id')
        .eq('site_id', siteId)
        .order('employee_name', { ascending: true });

      if (error) {
        console.error('Could not fetch site staff for roster:', error.message);
      } else if (data) {
        setSiteStaff(data);
      }
    } catch (e) {
      console.error('Fetch site staff error:', e);
    } finally {
      setLoadingStaff(false);
    }
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

      // 1. Fetch from rate_cards table scoped directly to this site_id
      let query = supabase.from('rate_cards').select('*');
      if (siteId) {
        query = query.eq('site_id', siteId);
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
      fetchSiteStaff();
      fetchSiteDesignations();
      resetForm();
      setExpandedRosterCardId(null);
    }
  }, [isOpen, siteId, siteName]);

  // Rate card mapping lookup for staff display
  const rateCardMap = useMemo(() => {
    const map = new Map<string, string>();
    rateCards.forEach((rc) => {
      if (rc.id) {
        map.set(rc.id, rc.post_name);
      }
    });
    return map;
  }, [rateCards]);

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
        const minimalPayload = {
          site_id: siteId || null,
          site_name: siteName,
          post_name: effectivePostName,
          gross_salary: Number(grossSalary) || 0,
          committed_salary: committedSalary === '' ? null : Number(committedSalary),
          basic_da: isFlatWage ? 0 : (basicDa === '' ? 0 : Number(basicDa)),
          hra: isFlatWage ? 0 : (hra === '' ? 0 : Number(hra)),
          washing_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
          conveyance_allowance: isFlatWage ? 0 : (conveyanceAllowance === '' ? 0 : Number(conveyanceAllowance)),
          incentive_amount: incentiveAmount === '' ? 0 : Number(incentiveAmount),
          is_flat_wage: isFlatWage,
        };
        const retryRes = await supabase.from('rate_cards').insert([minimalPayload]).select();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;

      // Also sync to sites JSON rate_cards column
      if (siteId) {
        const { data: siteRow } = await supabase
          .from('sites')
          .select('rate_cards')
          .eq('id', siteId)
          .maybeSingle();

        const currentJsonCards = Array.isArray(siteRow?.rate_cards) ? siteRow.rate_cards : [];
        const newJsonEntry = {
          id: data?.[0]?.id || `rc-${Date.now()}`,
          roleName: effectivePostName,
          post_name: effectivePostName,
          monthlyRate: Number(grossSalary) || 0,
          gross_salary: Number(grossSalary) || 0,
          committed_salary: committedSalary === '' ? null : Number(committedSalary),
          basic_da: isFlatWage ? 0 : (basicDa === '' ? 0 : Number(basicDa)),
          hra: isFlatWage ? 0 : (hra === '' ? 0 : Number(hra)),
          other_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
          conveyance_allowance: isFlatWage ? 0 : (conveyanceAllowance === '' ? 0 : Number(conveyanceAllowance)),
          incentive_amount: incentiveAmount === '' ? 0 : Number(incentiveAmount),
          is_flat_wage: isFlatWage,
          workingDays: 31,
          persons: 1,
        };

        const updatedJsonCards = [...currentJsonCards, newJsonEntry];
        await supabase.from('sites').update({ rate_cards: updatedJsonCards }).eq('id', siteId);
      }

      setSuccessMsg(`Rate card for "${effectivePostName}" created successfully!`);
      resetForm();
      fetchRateCards();
      fetchSiteDesignations();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Add rate card failed:', err);
      setErrorMsg(err.message || 'Failed to save rate card.');
    } finally {
      setSaving(false);
    }
  };

  const standardDesignations = [
    'Janitor',
    'Housekeeping',
    'Housekeeping Boy',
    'Supervisor',
    'Reliever',
    'Security Guard',
    'Pantry',
    'Keyman',
    'Trainee Staff',
    'Store Assistant',
    'HK - HO',
    'HK -P8',
  ];

  const remainingStandard = standardDesignations.filter(
    (d) => !siteDesignations.some((sd) => sd.toLowerCase() === d.toLowerCase())
  );

  const handleDeleteRateCard = async (id?: string) => {
    if (!id) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Query staff and payroll_records referencing this rate card
    try {
      const [{ count: staffCount, error: staffErr }, { count: payrollCount, error: payrollErr }] =
        await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }).eq('rate_card_id', id),
          supabase.from('payroll_records').select('id', { count: 'exact', head: true }).eq('rate_card_id', id),
        ]);

      if (staffErr) {
        console.warn('Could not check staff FK references for rate card:', staffErr.message);
      }
      if (payrollErr) {
        console.warn('Could not check payroll_records FK references for rate card:', payrollErr.message);
      }

      const assignedStaff = staffCount || 0;
      const linkedPayrolls = payrollCount || 0;

      // 2. Block delete client-side if any references exist
      if (assignedStaff > 0 || linkedPayrolls > 0) {
        const msg = `Can't delete this rate card — ${assignedStaff} staff ${
          assignedStaff === 1 ? 'is' : 'are'
        } currently assigned and/or ${linkedPayrolls} payroll record(s) reference it. Reassign staff to a different rate card first via 'Manage Roster', then try again.`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
    } catch (checkErr: any) {
      console.error('Error pre-checking rate card FK constraints:', checkErr);
    }

    if (!confirm('Are you sure you want to delete this Rate Card?')) return;

    try {
      const { error } = await supabase.from('rate_cards').delete().eq('id', id);

      if (error) {
        console.error('Delete rate card error from Supabase:', error);
        // Handle FK 409 / 23503 or any constraint violation
        if (error.code === '23503' || error.message.includes('foreign key constraint') || error.message.includes('409')) {
          const friendlyMsg =
            "Can't delete this rate card — active staff members or past payroll records still reference it. Please reassign all staff via 'Manage Roster' first, then try again.";
          setErrorMsg(friendlyMsg);
          toast.error(friendlyMsg);
        } else {
          setErrorMsg(`Delete failed: ${error.message}`);
          toast.error(`Delete failed: ${error.message}`);
        }
        return;
      }

      // Also clean up from sites JSON rate_cards column if present
      if (siteId) {
        try {
          const { data: siteRow } = await supabase
            .from('sites')
            .select('rate_cards')
            .eq('id', siteId)
            .maybeSingle();

          if (Array.isArray(siteRow?.rate_cards)) {
            const updatedJson = siteRow.rate_cards.filter((rc: any) => rc.id !== id);
            await supabase.from('sites').update({ rate_cards: updatedJson }).eq('id', siteId);
          }
        } catch (syncErr) {
          console.warn('Could not sync JSON rate card deletion:', syncErr);
        }
      }

      setSuccessMsg('Rate card deleted successfully.');
      toast.success('Rate card deleted successfully.');
      fetchRateCards();
      fetchSiteStaff();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Delete rate card unexpected error:', err);
      const friendlyMsg =
        "Can't delete this rate card — active staff members or past payroll records reference it. Please reassign staff first.";
      setErrorMsg(friendlyMsg);
      toast.error(friendlyMsg);
    }
  };

  // Toggle Roster Drawer for a specific Rate Card
  const toggleRosterPanel = (rc: RateCardRecord) => {
    if (!rc.id) {
      toast.error('Cannot manage roster on unsaved rate card.');
      return;
    }
    if (expandedRosterCardId === rc.id) {
      setExpandedRosterCardId(null);
      setDraftAssignedStaffIds(new Set());
      setRosterSearch('');
      setRosterErrorMsg(null);
    } else {
      setExpandedRosterCardId(rc.id);
      const currentAssigned = siteStaff
        .filter((s) => s.rate_card_id === rc.id)
        .map((s) => s.id);
      setDraftAssignedStaffIds(new Set(currentAssigned));
      setRosterSearch('');
      setRosterErrorMsg(null);
    }
  };

  // Add staff to draft roster
  const handleAddStaffToDraft = (staffId: string) => {
    setDraftAssignedStaffIds((prev) => {
      const next = new Set(prev);
      next.add(staffId);
      return next;
    });
  };

  // Remove staff from draft roster
  const handleRemoveStaffFromDraft = (staffId: string) => {
    setDraftAssignedStaffIds((prev) => {
      const next = new Set(prev);
      next.delete(staffId);
      return next;
    });
  };

  // Bulk save roster changes for the active rate card
  const handleSaveRoster = async (rc: RateCardRecord) => {
    if (!rc.id) return;

    const originalAssigned = siteStaff
      .filter((s) => s.rate_card_id === rc.id)
      .map((s) => s.id);
    const originalSet = new Set(originalAssigned);

    const added = Array.from(draftAssignedStaffIds).filter((id) => !originalSet.has(id));
    const removed = originalAssigned.filter((id) => !draftAssignedStaffIds.has(id));

    // No-op if no changes
    if (added.length === 0 && removed.length === 0) {
      setExpandedRosterCardId(null);
      return;
    }

    setSavingRoster(true);
    setRosterErrorMsg(null);

    try {
      const response = await fetchWithRetry('/api/staff/bulk-assign-rate-card', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_card_id: rc.id,
          added,
          removed,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to update rate card roster');
      }

      toast.success(`Roster updated for "${rc.post_name}" (+${added.length}, -${removed.length})`);
      await fetchSiteStaff();
      if (onRateCardUpdated) onRateCardUpdated();
      setExpandedRosterCardId(null);
    } catch (err: any) {
      console.error('[RateCardManager:handleSaveRoster] Error saving roster:', err);
      setRosterErrorMsg(err.message || 'Failed to save roster changes.');
      toast.error(err.message || 'Failed to save roster changes.');
    } finally {
      setSavingRoster(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#34495E] text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Manage Rate Cards & Rosters</h3>
              <p className="text-[11px] text-gray-300">
                Site: <strong className="text-teal-300">{siteName}</strong>
                {siteStaff.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-700/80 text-teal-200 text-[10px] font-mono">
                    {siteStaff.length} active staff on site
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
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

          {/* Existing Rate Cards List with Roster Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                Existing Rate Cards & Assigned Rosters ({rateCards.length})
              </h4>
              <span className="text-[11px] text-gray-400">
                Click <strong>"N staff assigned"</strong> on any card to bulk manage employee rosters.
              </span>
            </div>

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
              <div className="space-y-3">
                {rateCards.map((rc) => {
                  const assignedStaffList = siteStaff.filter((s) => s.rate_card_id === rc.id);
                  const assignedCount = assignedStaffList.length;
                  const isRosterExpanded = expandedRosterCardId === rc.id;

                  // Candidate staff at this site not in the draft selection
                  const candidateStaff = siteStaff.filter(
                    (s) => !draftAssignedStaffIds.has(s.id)
                  );

                  // Filter candidates by search term
                  const searchLower = rosterSearch.trim().toLowerCase();
                  const filteredCandidates = candidateStaff.filter((s) => {
                    if (!searchLower) return true;
                    const name = (s.employee_name || '').toLowerCase();
                    const bio = (s.biometric_code || '').toLowerCase();
                    const des = (s.designation || '').toLowerCase();
                    return name.includes(searchLower) || bio.includes(searchLower) || des.includes(searchLower);
                  });

                  // Draft assigned staff objects for rendering chips
                  const draftAssignedStaffObjects = siteStaff.filter((s) =>
                    draftAssignedStaffIds.has(s.id)
                  );

                  // Compute diff metrics for warning and button state
                  const originalAssignedIds = new Set(assignedStaffList.map((s) => s.id));
                  const addedCount = Array.from(draftAssignedStaffIds).filter(
                    (id) => !originalAssignedIds.has(id)
                  ).length;
                  const removedList = assignedStaffList.filter(
                    (s) => !draftAssignedStaffIds.has(s.id)
                  );
                  const removedCount = removedList.length;
                  const hasDiff = addedCount > 0 || removedCount > 0;

                  return (
                    <div
                      key={rc.id || rc.post_name}
                      className={`bg-white p-4 rounded-xl border transition-all shadow-2xs ${
                        isRosterExpanded
                          ? 'border-teal-400 ring-2 ring-teal-500/10'
                          : 'border-gray-200 hover:border-teal-200'
                      }`}
                    >
                      {/* Rate Card Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span>{rc.post_name}</span>
                            {rc.is_flat_wage && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                                Flat Wage
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
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

                        {/* Actions & Roster Trigger */}
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right font-mono pr-2">
                            <div className="text-[10px] text-gray-400 uppercase font-sans">Gross Salary</div>
                            <div className="text-sm font-bold text-emerald-700">₹{rc.gross_salary?.toLocaleString('en-IN')}</div>
                          </div>

                          {/* Roster Expansion Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleRosterPanel(rc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              isRosterExpanded
                                ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                                : assignedCount > 0
                                ? 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800'
                                : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                            }`}
                            title="Click to bulk manage assigned staff"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>
                              {assignedCount} {assignedCount === 1 ? 'staff' : 'staff'} assigned
                            </span>
                            {isRosterExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-60" />
                            )}
                          </button>

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

                      {/* Expandable Bulk Roster Management Drawer */}
                      {isRosterExpanded && (
                        <div className="mt-3.5 pt-3.5 border-t border-teal-100 bg-teal-50/40 rounded-xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-bold text-xs text-teal-900 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-teal-600" />
                                <span>Manage Assigned Roster for "{rc.post_name}"</span>
                              </h5>
                              <p className="text-[11px] text-teal-700/80 mt-0.5">
                                Add or remove staff stationed at this site to assign this salary structure.
                              </p>
                            </div>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                              {draftAssignedStaffObjects.length} Staff in Roster
                            </span>
                          </div>

                          {rosterErrorMsg && (
                            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                              <span>{rosterErrorMsg}</span>
                            </div>
                          )}

                          {/* Section 1: Currently Selected / Assigned Staff (Removable Chips) */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                              Assigned Staff Members ({draftAssignedStaffObjects.length})
                            </label>
                            {draftAssignedStaffObjects.length === 0 ? (
                              <div className="p-3 rounded-lg bg-white border border-dashed border-gray-300 text-center text-gray-400 text-xs">
                                No staff currently assigned to this rate card. Use the search below to assign staff.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-teal-200/80 shadow-2xs">
                                {draftAssignedStaffObjects.map((s) => {
                                  const name = s.employee_name || 'Unnamed';
                                  const bio = s.biometric_code;
                                  const isNewlyAdded = !originalAssignedIds.has(s.id);

                                  return (
                                    <div
                                      key={s.id}
                                      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                        isNewlyAdded
                                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/30'
                                          : 'bg-slate-50 text-slate-800 border-slate-200'
                                      }`}
                                    >
                                      <UserCheck className={`w-3.5 h-3.5 ${isNewlyAdded ? 'text-emerald-600' : 'text-teal-600'}`} />
                                      <span>{name}</span>
                                      {bio && (
                                        <span className="text-[10px] font-mono px-1 py-0.2 bg-white rounded border border-gray-200 text-gray-600">
                                          {bio}
                                        </span>
                                      )}
                                      {isNewlyAdded && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 bg-emerald-200 text-emerald-800 rounded">
                                          New
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveStaffFromDraft(s.id)}
                                        className="ml-0.5 p-0.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                        title={`Remove ${name} from this rate card`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Section 2: Add Staff Multi-Select Search */}
                          <div className="space-y-2">
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                              Add Staff Stationed at {siteName}
                            </label>

                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="Search available staff by name, bio code, or designation..."
                                value={rosterSearch}
                                onChange={(e) => setRosterSearch(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            {/* Candidate List (Max 5 items scrollable) */}
                            <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-gray-200 shadow-2xs divide-y divide-gray-50">
                              {loadingStaff ? (
                                <div className="py-4 text-center text-gray-400 flex items-center justify-center gap-2">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  <span>Loading staff records...</span>
                                </div>
                              ) : siteStaff.length === 0 ? (
                                <div className="py-4 text-center text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                  No staff members are currently assigned to this site in the staff directory.
                                </div>
                              ) : filteredCandidates.length === 0 ? (
                                <div className="py-3 text-center text-gray-400 text-xs">
                                  {candidateStaff.length === 0
                                    ? `All ${siteStaff.length} staff member(s) on this site are already assigned to this rate card.`
                                    : `No remaining staff matching "${rosterSearch}".`}
                                </div>
                              ) : (
                                filteredCandidates.map((staff) => {
                                  const empName = staff.employee_name || 'Unnamed';
                                  const bio = staff.biometric_code || '-';
                                  const role = staff.designation || 'Staff';
                                  const currentCardName = staff.rate_card_id ? rateCardMap.get(staff.rate_card_id) : null;

                                  return (
                                    <div
                                      key={staff.id}
                                      className="flex items-center justify-between p-2 hover:bg-teal-50/50 rounded-lg transition-colors text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                          {empName.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="truncate">
                                          <span className="font-semibold text-gray-900">{empName}</span>
                                          <span className="ml-2 font-mono text-[10px] text-gray-500">Bio: {bio}</span>
                                          <span className="ml-2 text-[10px] text-gray-400">({role})</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {currentCardName ? (
                                          <span
                                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[140px]"
                                            title={`Currently on rate card: ${currentCardName}`}
                                          >
                                            Current: {currentCardName}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                                            Unassigned
                                          </span>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleAddStaffToDraft(staff.id)}
                                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                        >
                                          <UserPlus className="w-3.5 h-3.5" />
                                          <span>Assign</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Section 3: Warning if Removed Staff Left Unassigned */}
                          {removedCount > 0 && (
                            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-bold">Caution: {removedCount} staff member(s) will be left unassigned:</strong>
                                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-amber-800">
                                  {removedList.map((s) => (
                                    <li key={s.id}>
                                      {s.employee_name} (Bio: {s.biometric_code || '-'})
                                    </li>
                                  ))}
                                </ul>
                                <p className="text-[10.5px] text-amber-700 mt-1">
                                  Their <code className="font-mono bg-amber-100 px-1 rounded">rate_card_id</code> will be set to unassigned unless reassigned to another rate card.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Section 4: Action Buttons (Cancel / Save Changes) */}
                          <div className="flex items-center justify-between pt-2 border-t border-teal-200/60">
                            <button
                              type="button"
                              onClick={() => setExpandedRosterCardId(null)}
                              className="px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              disabled={savingRoster || !hasDiff}
                              onClick={() => handleSaveRoster(rc)}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                                hasDiff
                                  ? 'bg-[#20B2AA] hover:bg-teal-700 text-white'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {savingRoster ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Saving Roster...</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>
                                    {hasDiff
                                      ? `Save Changes (+${addedCount}, -${removedCount})`
                                      : 'No Changes to Save'}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
