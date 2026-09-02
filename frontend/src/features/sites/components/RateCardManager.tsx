import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Pencil,
  CreditCard,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Receipt,
  Banknote,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';
import { RateCardItem } from '@/features/sites/types';

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
  bonus_amount?: number | null;
  part_bonus_amount?: number | null;
  remark?: string;
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
  // Navigation Tabs: 'billing' (Client Invoicing) vs 'payroll' (Salary & Rosters)
  const [activeTab, setActiveTab] = useState<'billing' | 'payroll'>('billing');

  // ==========================================
  // BILLING RATE CARDS STATE (sites.rate_cards)
  // ==========================================
  const [billingCards, setBillingCards] = useState<RateCardItem[]>([]);
  const [loadingBilling, setLoadingBilling] = useState<boolean>(false);
  const [savingBilling, setSavingBilling] = useState<boolean>(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [editingBillingIndex, setEditingBillingIndex] = useState<number | null>(null);

  // Billing Form Fields
  const [billingRole, setBillingRole] = useState<string>('');
  const [billingLocation, setBillingLocation] = useState<string>('');
  const [billingMonthlyRate, setBillingMonthlyRate] = useState<number | ''>('');
  const [billingWorkingDays, setBillingWorkingDays] = useState<number | ''>(31);
  const [billingHsnCode, setBillingHsnCode] = useState<string>('9985');
  const [billingPersons, setBillingPersons] = useState<number | ''>(1);

  // ==========================================
  // PAYROLL RATE CARDS STATE (public.rate_cards)
  // ==========================================
  const [payrollCards, setPayrollCards] = useState<RateCardRecord[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState<boolean>(false);
  const [savingPayroll, setSavingPayroll] = useState<boolean>(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payrollSuccess, setPayrollSuccess] = useState<string | null>(null);

  // Site staff state for roster management
  const [siteStaff, setSiteStaff] = useState<SiteStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);

  // Expanded Roster State (which payroll rate card row is open)
  const [expandedRosterCardId, setExpandedRosterCardId] = useState<string | null>(null);
  const [draftAssignedStaffIds, setDraftAssignedStaffIds] = useState<Set<string>>(new Set());
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [savingRoster, setSavingRoster] = useState<boolean>(false);
  const [rosterErrorMsg, setRosterErrorMsg] = useState<string | null>(null);

  // Designations state
  const [siteDesignations, setSiteDesignations] = useState<string[]>([]);
  const [isCustomPost, setIsCustomPost] = useState<boolean>(false);
  const [customPostName, setCustomPostName] = useState<string>('');

  // Editing Payroll Rate Card State
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);

  // Payroll Form State
  const [postName, setPostName] = useState('');
  const [grossSalary, setGrossSalary] = useState<number | ''>('');
  const [committedSalary, setCommittedSalary] = useState<number | ''>('');
  const [remark, setRemark] = useState<string>('');
  const [basicDa, setBasicDa] = useState<number | ''>('');
  const [hra, setHra] = useState<number | ''>('');
  const [otherAllowance, setOtherAllowance] = useState<number | ''>('');
  const [conveyanceAllowance, setConveyanceAllowance] = useState<number | ''>('');
  const [incentiveAmount, setIncentiveAmount] = useState<number | ''>('');
  const [bonusAmount, setBonusAmount] = useState<number | ''>('');
  const [partBonusAmount, setPartBonusAmount] = useState<number | ''>('');
  const [isFlatWage, setIsFlatWage] = useState<boolean>(false);

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

  // -------------------------------------------------------------
  // FETCH METHODS
  // -------------------------------------------------------------
  const fetchBillingCards = async () => {
    if (!siteId) return;
    setLoadingBilling(true);
    setBillingError(null);
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, rate_cards')
        .eq('id', siteId)
        .maybeSingle();

      if (error) throw error;

      if (data?.rate_cards && Array.isArray(data.rate_cards)) {
        setBillingCards(data.rate_cards);
      } else {
        setBillingCards([]);
      }
    } catch (err: any) {
      console.error('Fetch billing rate cards failed:', err);
      setBillingError(err.message || 'Failed to load billing rate cards');
    } finally {
      setLoadingBilling(false);
    }
  };

  const fetchPayrollCards = async () => {
    if (!siteId && !siteName) return;
    setLoadingPayroll(true);
    setPayrollError(null);
    try {
      let query = supabase.from('rate_cards').select('*');
      if (siteId) {
        query = query.eq('site_id', siteId);
      } else {
        query = query.eq('site_name', siteName);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setPayrollCards(data || []);
    } catch (err: any) {
      console.error('Fetch payroll rate cards failed:', err);
      setPayrollError(err.message || 'Failed to load payroll rate cards');
    } finally {
      setLoadingPayroll(false);
    }
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

      const { data: staffData } = await supabase
        .from('staff')
        .select('designation')
        .eq('site_id', siteId);

      if (staffData) {
        staffData.forEach((s: any) => {
          if (s.designation?.trim()) roles.add(s.designation.trim());
        });
      }

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

  useEffect(() => {
    if (isOpen) {
      fetchBillingCards();
      fetchPayrollCards();
      fetchSiteStaff();
      fetchSiteDesignations();
      resetBillingForm();
      resetPayrollForm();
      setExpandedRosterCardId(null);
    }
  }, [isOpen, siteId, siteName]);

  // Rate card mapping lookup for staff display
  const payrollRateCardMap = useMemo(() => {
    const map = new Map<string, string>();
    payrollCards.forEach((rc) => {
      if (rc.id) {
        map.set(rc.id, rc.post_name);
      }
    });
    return map;
  }, [payrollCards]);

  // -------------------------------------------------------------
  // BILLING RATE CARD HANDLERS (sites.rate_cards JSONB ONLY)
  // -------------------------------------------------------------
  const resetBillingForm = () => {
    setEditingBillingIndex(null);
    setBillingRole('');
    setBillingLocation('');
    setBillingMonthlyRate('');
    setBillingWorkingDays(31);
    setBillingHsnCode('9985');
    setBillingPersons(1);
    setBillingError(null);
    setBillingSuccess(null);
  };

  const handleStartEditBilling = (index: number) => {
    const card = billingCards[index];
    if (!card) return;
    setEditingBillingIndex(index);
    setBillingRole(card.roleName || '');
    setBillingLocation(card.location || '');
    setBillingMonthlyRate(card.monthlyRate != null ? card.monthlyRate : '');
    setBillingWorkingDays(card.workingDays != null ? card.workingDays : 31);
    setBillingHsnCode(card.hsnCode || '9985');
    setBillingPersons(card.persons != null ? card.persons : 1);
    setBillingError(null);
    setBillingSuccess(null);
  };

  const handleSaveBillingCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) {
      setBillingError('Site ID missing.');
      return;
    }
    const roleTrim = billingRole.trim();
    if (!roleTrim) {
      setBillingError('Role Name is required for billing rate card.');
      return;
    }
    if (billingMonthlyRate === '' || Number(billingMonthlyRate) < 0) {
      setBillingError('Valid Monthly Rate (₹) is required.');
      return;
    }

    setSavingBilling(true);
    setBillingError(null);
    setBillingSuccess(null);

    const newCardItem: RateCardItem = {
      id: editingBillingIndex !== null && billingCards[editingBillingIndex]?.id
        ? billingCards[editingBillingIndex].id
        : `rc-${Date.now()}`,
      roleName: roleTrim,
      location: billingLocation.trim(),
      monthlyRate: Number(billingMonthlyRate),
      workingDays: billingWorkingDays === '' ? 31 : Number(billingWorkingDays),
      hsnCode: billingHsnCode.trim() || '9985',
      persons: billingPersons === '' ? 1 : Number(billingPersons),
    };

    let updatedList: RateCardItem[];
    if (editingBillingIndex !== null) {
      updatedList = billingCards.map((c, idx) => (idx === editingBillingIndex ? newCardItem : c));
    } else {
      updatedList = [...billingCards, newCardItem];
    }

    try {
      const { error } = await supabase
        .from('sites')
        .update({ rate_cards: updatedList })
        .eq('id', siteId);

      if (error) throw error;

      setBillingCards(updatedList);
      setBillingSuccess(`Billing rate card for "${roleTrim}" saved successfully!`);
      toast.success(`Billing rate card for "${roleTrim}" saved.`);
      resetBillingForm();
      fetchSiteDesignations();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Failed to save billing rate card:', err);
      setBillingError(err.message || 'Failed to save billing rate card.');
      toast.error(err.message || 'Failed to save billing rate card.');
    } finally {
      setSavingBilling(false);
    }
  };

  const handleDeleteBillingCard = async (index: number) => {
    const card = billingCards[index];
    if (!card) return;
    if (!confirm(`Are you sure you want to remove the billing rate card for "${card.roleName}"?`)) return;

    setSavingBilling(true);
    setBillingError(null);
    setBillingSuccess(null);

    const updatedList = billingCards.filter((_, idx) => idx !== index);

    try {
      const { error } = await supabase
        .from('sites')
        .update({ rate_cards: updatedList })
        .eq('id', siteId);

      if (error) throw error;

      setBillingCards(updatedList);
      setBillingSuccess(`Billing rate card for "${card.roleName}" removed.`);
      toast.success(`Billing rate card for "${card.roleName}" removed.`);
      if (editingBillingIndex === index) resetBillingForm();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Failed to remove billing rate card:', err);
      setBillingError(err.message || 'Failed to remove billing rate card.');
      toast.error(err.message || 'Failed to remove billing rate card.');
    } finally {
      setSavingBilling(false);
    }
  };

  // -------------------------------------------------------------
  // PAYROLL RATE CARD HANDLERS (public.rate_cards TABLE ONLY)
  // -------------------------------------------------------------
  const resetPayrollForm = () => {
    setEditingPayrollId(null);
    setPostName('');
    setIsCustomPost(false);
    setCustomPostName('');
    setGrossSalary('');
    setCommittedSalary('');
    setRemark('');
    setBasicDa('');
    setHra('');
    setOtherAllowance('');
    setConveyanceAllowance('');
    setIncentiveAmount('');
    setBonusAmount('');
    setPartBonusAmount('');
    setIsFlatWage(false);
    setPayrollError(null);
    setPayrollSuccess(null);
  };

  const handleStartEditPayroll = (rc: RateCardRecord) => {
    setEditingPayrollId(rc.id || null);
    setPayrollError(null);
    setPayrollSuccess(null);

    const isSiteRole = siteDesignations.some((d) => d.toLowerCase() === rc.post_name.toLowerCase());
    const isStandardRole = standardDesignations.some((d) => d.toLowerCase() === rc.post_name.toLowerCase());

    if (isSiteRole || isStandardRole) {
      setIsCustomPost(false);
      setPostName(rc.post_name);
      setCustomPostName('');
    } else {
      setIsCustomPost(true);
      setPostName('__custom__');
      setCustomPostName(rc.post_name);
    }

    setGrossSalary(rc.gross_salary && Number(rc.gross_salary) > 0 ? Number(rc.gross_salary) : '');
    setCommittedSalary(rc.committed_salary && Number(rc.committed_salary) > 0 ? Number(rc.committed_salary) : '');
    setRemark(rc.remark || '');
    setBasicDa(rc.basic_da && Number(rc.basic_da) > 0 ? Number(rc.basic_da) : '');
    setHra(rc.hra && Number(rc.hra) > 0 ? Number(rc.hra) : '');
    const otherVal = rc.other_allowance ?? rc.washing_allowance;
    setOtherAllowance(otherVal && Number(otherVal) > 0 ? Number(otherVal) : '');
    setConveyanceAllowance(rc.conveyance_allowance && Number(rc.conveyance_allowance) > 0 ? Number(rc.conveyance_allowance) : '');
    const incVal = rc.incentive_amount ?? rc.incentive;
    setIncentiveAmount(incVal && Number(incVal) > 0 ? Number(incVal) : '');
    setBonusAmount(rc.bonus_amount != null && Number(rc.bonus_amount) > 0 ? Number(rc.bonus_amount) : '');
    setPartBonusAmount(rc.part_bonus_amount != null && Number(rc.part_bonus_amount) > 0 ? Number(rc.part_bonus_amount) : '');
    setIsFlatWage(Boolean(rc.is_flat_wage));
  };

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

  const handleSavePayrollCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePostName = (isCustomPost ? customPostName : postName).trim();
    if (!effectivePostName || grossSalary === '') {
      setPayrollError('Post Name and Gross Salary are required.');
      return;
    }

    const duplicateExists = payrollCards.some(
      (rc) => rc.id !== editingPayrollId && rc.post_name.trim().toLowerCase() === effectivePostName.toLowerCase()
    );
    if (duplicateExists) {
      const proceed = window.confirm(
        `A payroll rate card for "${effectivePostName}" already exists for this site. Save another one?`
      );
      if (!proceed) return;
    }

    if (bonusAmount !== '' && partBonusAmount !== '') {
      if (Number(partBonusAmount) > Number(bonusAmount)) {
        setPayrollError('Part Bonus Amount (₹) cannot exceed Bonus Amount (₹).');
        toast.error('Part Bonus Amount (₹) cannot exceed Bonus Amount (₹).');
        return;
      }
    }

    setSavingPayroll(true);
    setPayrollError(null);
    setPayrollSuccess(null);

    const payload: Record<string, any> = {
      site_id: siteId || null,
      site_name: siteName,
      post_name: effectivePostName,
      gross_salary: Number(grossSalary) || 0,
      committed_salary: committedSalary === '' ? null : Number(committedSalary),
      remark: remark.trim(),
      basic_da: isFlatWage ? 0 : (basicDa === '' ? 0 : Number(basicDa)),
      hra: isFlatWage ? 0 : (hra === '' ? 0 : Number(hra)),
      other_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
      washing_allowance: isFlatWage ? 0 : (otherAllowance === '' ? 0 : Number(otherAllowance)),
      conveyance_allowance: isFlatWage ? 0 : (conveyanceAllowance === '' ? 0 : Number(conveyanceAllowance)),
      incentive_amount: incentiveAmount === '' ? 0 : Number(incentiveAmount),
      incentive: incentiveAmount === '' ? 0 : Number(incentiveAmount),
      bonus_amount: isFlatWage ? null : (bonusAmount === '' ? null : Number(bonusAmount)),
      part_bonus_amount: isFlatWage ? null : (partBonusAmount === '' ? null : Number(partBonusAmount)),
      is_flat_wage: isFlatWage,
    };

    try {
      if (editingPayrollId) {
        const { error } = await supabase
          .from('rate_cards')
          .update(payload)
          .eq('id', editingPayrollId);

        if (error) throw error;
        setPayrollSuccess(`Payroll rate card for "${effectivePostName}" updated successfully!`);
        toast.success(`Payroll rate card for "${effectivePostName}" updated!`);
      } else {
        const { error } = await supabase.from('rate_cards').insert([payload]);
        if (error) throw error;
        setPayrollSuccess(`Payroll rate card for "${effectivePostName}" created successfully!`);
        toast.success(`Payroll rate card for "${effectivePostName}" created!`);
      }

      resetPayrollForm();
      fetchPayrollCards();
      fetchSiteDesignations();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Save payroll rate card failed:', err);
      setPayrollError(err.message || 'Failed to save payroll rate card.');
      toast.error(err.message || 'Failed to save payroll rate card.');
    } finally {
      setSavingPayroll(false);
    }
  };

  const handleDeletePayrollCard = async (id?: string) => {
    if (!id) return;
    setPayrollError(null);
    setPayrollSuccess(null);

    try {
      const [{ count: staffCount, error: staffErr }, { count: payrollCount, error: payrollErr }] =
        await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }).eq('rate_card_id', id),
          supabase.from('payroll_records').select('id', { count: 'exact', head: true }).eq('rate_card_id', id),
        ]);

      if (staffErr) console.warn('Staff count error:', staffErr.message);
      if (payrollErr) console.warn('Payroll count error:', payrollErr.message);

      const assignedStaff = staffCount || 0;
      const linkedPayrolls = payrollCount || 0;

      if (assignedStaff > 0 || linkedPayrolls > 0) {
        const msg = `Can't delete this rate card — ${assignedStaff} staff assigned and/or ${linkedPayrolls} past payroll record(s) reference it. Reassign staff first.`;
        setPayrollError(msg);
        toast.error(msg);
        return;
      }
    } catch (checkErr: any) {
      console.error('FK pre-check error:', checkErr);
    }

    if (!confirm('Are you sure you want to delete this Payroll Rate Card?')) return;

    try {
      const { error } = await supabase.from('rate_cards').delete().eq('id', id);

      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
          const friendlyMsg = "Can't delete — active staff members or payroll records still reference it.";
          setPayrollError(friendlyMsg);
          toast.error(friendlyMsg);
        } else {
          setPayrollError(`Delete failed: ${error.message}`);
          toast.error(`Delete failed: ${error.message}`);
        }
        return;
      }

      setPayrollSuccess('Payroll rate card deleted successfully.');
      toast.success('Payroll rate card deleted.');
      fetchPayrollCards();
      fetchSiteStaff();
      if (onRateCardUpdated) onRateCardUpdated();
    } catch (err: any) {
      console.error('Delete payroll rate card error:', err);
      setPayrollError('Failed to delete payroll rate card.');
      toast.error('Failed to delete payroll rate card.');
    }
  };

  // -------------------------------------------------------------
  // ROSTER MANAGEMENT DRAWER
  // -------------------------------------------------------------
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

  const handleAddStaffToDraft = (staffId: string) => {
    setDraftAssignedStaffIds((prev) => {
      const next = new Set(prev);
      next.add(staffId);
      return next;
    });
  };

  const handleRemoveStaffFromDraft = (staffId: string) => {
    setDraftAssignedStaffIds((prev) => {
      const next = new Set(prev);
      next.delete(staffId);
      return next;
    });
  };

  const handleSaveRoster = async (rc: RateCardRecord) => {
    if (!rc.id) return;

    const originalAssigned = siteStaff
      .filter((s) => s.rate_card_id === rc.id)
      .map((s) => s.id);
    const originalSet = new Set(originalAssigned);

    const added = Array.from(draftAssignedStaffIds).filter((id) => !originalSet.has(id));
    const removed = originalAssigned.filter((id) => !draftAssignedStaffIds.has(id));

    if (added.length === 0 && removed.length === 0) {
      setExpandedRosterCardId(null);
      return;
    }

    setSavingRoster(true);
    setRosterErrorMsg(null);

    try {
      const response = await fetchWithRetry('/api/staff/bulk-assign-rate-card', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Error saving roster:', err);
      setRosterErrorMsg(err.message || 'Failed to save roster changes.');
      toast.error(err.message || 'Failed to save roster changes.');
    } finally {
      setSavingRoster(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
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

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-slate-100/80 px-6 pt-3 gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>Billing Rate Cards (Feeds Invoices)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono">
              {billingCards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'payroll'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Banknote className="w-4 h-4 text-teal-600" />
            <span>Payroll Rate Cards (Salary & Rosters)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono">
              {payrollCards.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* ========================================================= */}
          {/* TAB 1: BILLING RATE CARDS (sites.rate_cards)              */}
          {/* ========================================================= */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Alert / Info Banner */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-start gap-2.5">
                <Receipt className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold">Client Invoicing Rate Cards:</strong>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    These items are stored directly in <code className="font-mono bg-indigo-100 px-1 rounded text-indigo-900">sites.rate_cards</code>. They define the billing line items (Role, Location, Monthly Rate, Working Days, HSN Code, Headcount) used by the Smart Invoice Generator. They are separate from staff payroll structures.
                  </p>
                </div>
              </div>

              {billingError && (
                <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{billingError}</span>
                </div>
              )}

              {billingSuccess && (
                <div className="p-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{billingSuccess}</span>
                </div>
              )}

              {/* Form to Add / Edit Billing Rate Card */}
              <form
                onSubmit={handleSaveBillingCard}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  editingBillingIndex !== null
                    ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-400/20'
                    : 'bg-slate-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    {editingBillingIndex !== null ? (
                      <>
                        <Pencil className="w-4 h-4 text-indigo-600" />
                        <span>Editing Billing Card: <strong>{billingRole}</strong></span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>Add New Billing Rate Card</span>
                      </>
                    )}
                  </h4>
                  {editingBillingIndex !== null && (
                    <button
                      type="button"
                      onClick={resetBillingForm}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Role / Designation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Housekeeper, Supervisor"
                      value={billingRole}
                      onChange={(e) => setBillingRole(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Location Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. A & A1 Wing"
                      value={billingLocation}
                      onChange={(e) => setBillingLocation(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Monthly Rate (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="e.g. 15000"
                      value={billingMonthlyRate}
                      onChange={(e) => setBillingMonthlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Working Days</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="31"
                      value={billingWorkingDays}
                      onChange={(e) => setBillingWorkingDays(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">HSN Code</label>
                    <input
                      type="text"
                      placeholder="9985"
                      value={billingHsnCode}
                      onChange={(e) => setBillingHsnCode(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2 pt-1">
                  {editingBillingIndex !== null && (
                    <button
                      type="button"
                      onClick={resetBillingForm}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingBilling}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {savingBilling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingBillingIndex !== null ? (
                      <Pencil className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{editingBillingIndex !== null ? 'Update Billing Card' : 'Add to Billing'}</span>
                  </button>
                </div>
              </form>

              {/* Billing Rate Cards List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                    Active Billing Rate Cards ({billingCards.length})
                  </h4>
                </div>

                {loadingBilling ? (
                  <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span>Loading billing rate cards...</span>
                  </div>
                ) : billingCards.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No billing rate cards configured for this site yet. Add one above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {billingCards.map((card, idx) => (
                      <div
                        key={card.id || `bill-${idx}`}
                        className={`bg-white p-4 rounded-xl border transition-all shadow-2xs flex items-center justify-between ${
                          editingBillingIndex === idx
                            ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/30'
                            : 'border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span>{card.roleName}</span>
                            {card.location && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                {card.location}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-3">
                            <span>Rate: <strong className="text-indigo-700">₹{card.monthlyRate?.toLocaleString('en-IN')}</strong></span>
                            <span>HSN: <strong>{card.hsnCode || '9985'}</strong></span>
                            <span>Days: <strong>{card.workingDays || 31}</strong></span>
                            {card.persons && card.persons > 1 && (
                              <span>Persons: <strong>{card.persons}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditBilling(idx)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Billing Card"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBillingCard(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Billing Card"
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
          )}

          {/* ========================================================= */}
          {/* TAB 2: PAYROLL RATE CARDS (public.rate_cards)              */}
          {/* ========================================================= */}
          {activeTab === 'payroll' && (
            <div className="space-y-6">
              {/* Alert / Info Banner */}
              <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-xl text-teal-900 text-xs flex items-start gap-2.5">
                <Banknote className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold">Staff Salary & Roster Rate Cards:</strong>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    These items are stored in <code className="font-mono bg-teal-100 px-1 rounded text-teal-900">public.rate_cards</code>. They define the statutory salary breakdown (Basic+DA, HRA, Allowances, Bonus) and roster assignments for staff stationed at this site.
                  </p>
                </div>
              </div>

              {payrollError && (
                <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{payrollError}</span>
                </div>
              )}

              {payrollSuccess && (
                <div className="p-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{payrollSuccess}</span>
                </div>
              )}

              {/* Form to Add / Edit Payroll Rate Card */}
              <form
                onSubmit={handleSavePayrollCard}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  editingPayrollId
                    ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                    : 'bg-slate-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4
                    className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                      editingPayrollId ? 'text-amber-800' : 'text-teal-800'
                    }`}
                  >
                    {editingPayrollId ? (
                      <>
                        <Pencil className="w-4 h-4 text-amber-600" />
                        <span>
                          Editing Rate Card: <strong>{isCustomPost ? customPostName : postName}</strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-teal-600" />
                        <span>Add New Payroll Designation Rate Card</span>
                      </>
                    )}
                  </h4>
                  {editingPayrollId && (
                    <button
                      type="button"
                      onClick={resetPayrollForm}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* Row 1: Post Name, Gross Salary, Committed Salary, Remark */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-teal-500"
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
                      <option value="__custom__">+ Add Custom Designation...</option>
                    </select>
                    {isCustomPost && (
                      <input
                        type="text"
                        required
                        placeholder="Enter custom post name..."
                        value={customPostName}
                        onChange={(e) => setCustomPostName(e.target.value)}
                        className="mt-1.5 w-full bg-white border border-teal-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Gross Salary (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 15000"
                      value={grossSalary === '' ? '' : grossSalary}
                      onChange={(e) => handleGrossChange(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono font-bold focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-gray-700">Committed Salary (₹)</label>
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium border border-slate-200">
                        Ref Only
                      </span>
                    </div>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={committedSalary === '' || committedSalary === 0 ? '' : committedSalary}
                      onChange={(e) => setCommittedSalary(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-slate-400 placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Remark (optional)</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Female, Night Shift"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-teal-500 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Flat Wage Toggle */}
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFlatWage}
                      onChange={(e) => {
                        setIsFlatWage(e.target.checked);
                        if (e.target.checked) {
                          setBasicDa('');
                          setHra('');
                          setOtherAllowance('');
                          setConveyanceAllowance('');
                          setBonusAmount('');
                          setPartBonusAmount('');
                        } else if (grossSalary !== '' && Number(grossSalary) > 0) {
                          const val = Number(grossSalary);
                          setBasicDa(Math.round(val * 0.5));
                          setHra(Math.round(val * 0.2));
                          setOtherAllowance(Math.round(val * 0.15));
                          setConveyanceAllowance(Math.max(0, val - Math.round(val * 0.85)));
                        }
                      }}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                    <span>Non-Compliance / Flat Wage Setup</span>
                  </label>
                  {isFlatWage && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                      Bypasses EPF/ESIC/PT
                    </span>
                  )}
                </div>

                {/* Row 2: Breakups & Statutory Bonus */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Basic + DA (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={isFlatWage}
                      value={basicDa === '' || basicDa === 0 ? '' : basicDa}
                      onChange={(e) => setBasicDa(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">HRA (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={isFlatWage}
                      value={hra === '' || hra === 0 ? '' : hra}
                      onChange={(e) => setHra(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Other Allow (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={isFlatWage}
                      value={otherAllowance === '' || otherAllowance === 0 ? '' : otherAllowance}
                      onChange={(e) => setOtherAllowance(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Conveyance (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={isFlatWage}
                      value={conveyanceAllowance === '' || conveyanceAllowance === 0 ? '' : conveyanceAllowance}
                      onChange={(e) => setConveyanceAllowance(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Fixed Incentive (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={incentiveAmount === '' || incentiveAmount === 0 ? '' : incentiveAmount}
                      onChange={(e) => setIncentiveAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 font-mono focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 mb-1">Bonus Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Optional"
                      disabled={isFlatWage}
                      value={bonusAmount === '' || bonusAmount === 0 ? '' : bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs text-indigo-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 placeholder:text-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-teal-700 mb-1">Part Bonus (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Optional"
                      disabled={isFlatWage}
                      value={partBonusAmount === '' || partBonusAmount === 0 ? '' : partBonusAmount}
                      onChange={(e) => setPartBonusAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-teal-300 rounded-lg px-2.5 py-1.5 text-xs text-teal-900 font-mono font-bold focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100 placeholder:text-gray-300"
                    />
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2 pt-1">
                  {editingPayrollId && (
                    <button
                      type="button"
                      onClick={resetPayrollForm}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingPayroll}
                    className={`${
                      editingPayrollId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'
                    } text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer`}
                  >
                    {savingPayroll ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingPayrollId ? (
                      <Pencil className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{editingPayrollId ? 'Update Rate Card' : 'Save Rate Card'}</span>
                  </button>
                </div>
              </form>

              {/* Existing Payroll Rate Cards List & Roster Management */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                    Existing Payroll Cards & Assigned Rosters ({payrollCards.length})
                  </h4>
                  <span className="text-[11px] text-gray-400">
                    Click <strong>"N staff assigned"</strong> on any card to bulk manage employee rosters.
                  </span>
                </div>

                {loadingPayroll ? (
                  <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span>Loading payroll rate cards...</span>
                  </div>
                ) : payrollCards.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No payroll rate cards created for this site yet. Create one using the form above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payrollCards.map((rc) => {
                      const assignedStaffList = siteStaff.filter((s) => s.rate_card_id === rc.id);
                      const assignedCount = assignedStaffList.length;
                      const isRosterExpanded = expandedRosterCardId === rc.id;

                      const candidateStaff = siteStaff.filter(
                        (s) => !draftAssignedStaffIds.has(s.id)
                      );

                      const searchLower = rosterSearch.trim().toLowerCase();
                      const filteredCandidates = candidateStaff.filter((s) => {
                        if (!searchLower) return true;
                        const name = (s.employee_name || '').toLowerCase();
                        const bio = (s.biometric_code || '').toLowerCase();
                        const des = (s.designation || '').toLowerCase();
                        return name.includes(searchLower) || bio.includes(searchLower) || des.includes(searchLower);
                      });

                      const draftAssignedStaffObjects = siteStaff.filter((s) =>
                        draftAssignedStaffIds.has(s.id)
                      );

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
                              : editingPayrollId === rc.id
                              ? 'border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/30'
                              : 'border-gray-200 hover:border-teal-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-bold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                                <span>{rc.post_name}</span>
                                {rc.remark ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                    {rc.remark}
                                  </span>
                                ) : null}
                                {rc.is_flat_wage && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                                    Flat Wage
                                  </span>
                                )}
                                {editingPayrollId === rc.id && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                    Editing
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
                                {rc.bonus_amount != null && Number(rc.bonus_amount) > 0 ? (
                                  <span className="text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-sans">
                                    Bonus: <strong>₹{Number(rc.bonus_amount).toLocaleString('en-IN')}</strong>
                                  </span>
                                ) : null}
                                {rc.part_bonus_amount != null && Number(rc.part_bonus_amount) > 0 ? (
                                  <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 font-sans">
                                    Part Bonus: <strong>₹{Number(rc.part_bonus_amount).toLocaleString('en-IN')}</strong>
                                  </span>
                                ) : null}
                                {rc.committed_salary != null && Number(rc.committed_salary) > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-sans text-[10.5px] border border-slate-200">
                                    Ref Committed: <strong>₹{Number(rc.committed_salary).toLocaleString('en-IN')}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right font-mono pr-2">
                                <div className="text-[10px] text-gray-400 uppercase font-sans">Gross Salary</div>
                                <div className="text-sm font-bold text-emerald-700">₹{rc.gross_salary?.toLocaleString('en-IN')}</div>
                              </div>

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
                                onClick={() => handleStartEditPayroll(rc)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Payroll Rate Card"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePayrollCard(rc.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                title="Delete Payroll Rate Card"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Roster Drawer */}
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
                                      const currentCardName = staff.rate_card_id ? payrollRateCardMap.get(staff.rate_card_id) : null;

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
                                  </div>
                                </div>
                              )}

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
          )}

        </div>
      </div>
    </div>
  );
};
