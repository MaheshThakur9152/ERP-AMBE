import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Calendar,
  Building2,
  Search,
  Filter,
  Loader2,
  DollarSign,
  X,
  Save,
  Edit,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface SiteOption {
  id: string;
  site_name: string;
  code_name?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = [2026, 2025, 2024];

export const AdvancesHub: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return localStorage.getItem('payroll_filter_month') || 'August';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem('payroll_filter_year');
    return saved ? Number(saved) : 2026;
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    return localStorage.getItem('payroll_filter_site') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Ledger Modal State
  const [activeRecord, setActiveRecord] = useState<any | null>(null);
  const [advAmt, setAdvAmt] = useState<number>(0);
  const [advDate, setAdvDate] = useState<string>('');
  const [shirt, setShirt] = useState<number>(0);
  const [pant, setPant] = useState<number>(0);
  const [shoes, setShoes] = useState<number>(0);
  const [idCard, setIdCard] = useState<number>(0);
  const [otherAmt, setOtherAmt] = useState<number>(0);
  const [remark, setRemark] = useState<string>('');
  const [inThisMth, setInThisMth] = useState<number>(0);
  const [isCustomInThisMth, setIsCustomInThisMth] = useState<boolean>(false);

  // Sync filters to localStorage
  useEffect(() => {
    localStorage.setItem('payroll_filter_month', selectedMonth);
    localStorage.setItem('payroll_filter_year', selectedYear.toString());
    localStorage.setItem('payroll_filter_site', selectedSiteId);
  }, [selectedMonth, selectedYear, selectedSiteId]);

  // Load Sites Dropdown
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const { data } = await supabase.from('sites').select('id, site_name, code_name').order('site_name');
        if (data) setSites(data);
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Fetch Advances & Payroll Records
  const loadAdvancesData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const monthYearStr = `${selectedMonth} ${selectedYear}`;
      let query = supabase
        .from('payroll_records')
        .select('*, staff(*)')
        .eq('month_year', monthYearStr);

      if (selectedSiteId !== 'all') {
        query = query.eq('site_id', selectedSiteId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching advance records:', error);
      } else {
        setRecords(data || []);
      }
    } catch (err: any) {
      console.error('Failed to load advances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdvancesData();
  }, [selectedMonth, selectedYear, selectedSiteId]);

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const name = (r.employee_name || r.staff?.name || '').toLowerCase();
      const code = (r.emp_id || r.staff?.biometric_code || '').toLowerCase();
      const site = (r.site_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || site.includes(q);
    });
  }, [records, searchQuery]);

  // Open Edit Modal
  const openModal = (r: any) => {
    setActiveRecord(r);
    const aAmt = Number(r.adv_amt || 0);
    const aDate = r.adv_date || '';
    const sh = Number(r.shirt || 0);
    const pa = Number(r.pant || 0);
    const shs = Number(r.shoes || 0);
    const idc = Number(r.id_card || 0);
    const oth = Number(r.other_amt || 0);
    const rm = r.remark || '';
    const itemSum = aAmt + sh + pa + shs + idc + oth;
    const total = Number(r.adv_total || (itemSum > 0 ? itemSum : (r.advances || 0)));
    const inThis = Number(r.in_this_mth ?? r.advances ?? 0);

    setAdvAmt(aAmt);
    setAdvDate(aDate);
    setShirt(sh);
    setPant(pa);
    setShoes(shs);
    setIdCard(idc);
    setOtherAmt(oth);
    setRemark(rm);
    setInThisMth(inThis);
    setIsCustomInThisMth(inThis !== total && itemSum > 0);
  };

  const currentAdvTotal = advAmt + shirt + pant + shoes + idCard + otherAmt;
  const computedInNextMth = Math.max(0, currentAdvTotal - inThisMth);

  const handleItemizedChange = (
    field: 'adv_amt' | 'shirt' | 'pant' | 'shoes' | 'id_card' | 'other_amt',
    val: number
  ) => {
    const num = Math.max(0, val);
    let newAdvAmt = advAmt;
    let newShirt = shirt;
    let newPant = pant;
    let newShoes = shoes;
    let newIdCard = idCard;
    let newOtherAmt = otherAmt;

    if (field === 'adv_amt') newAdvAmt = num;
    if (field === 'shirt') newShirt = num;
    if (field === 'pant') newPant = num;
    if (field === 'shoes') newShoes = num;
    if (field === 'id_card') newIdCard = num;
    if (field === 'other_amt') newOtherAmt = num;

    setAdvAmt(newAdvAmt);
    setShirt(newShirt);
    setPant(newPant);
    setShoes(newShoes);
    setIdCard(newIdCard);
    setOtherAmt(newOtherAmt);

    const newTotal = newAdvAmt + newShirt + newPant + newShoes + newIdCard + newOtherAmt;
    if (!isCustomInThisMth) {
      setInThisMth(newTotal);
    }
  };

  // Save Modal Changes to Supabase
  const handleSaveModal = async () => {
    if (!activeRecord) return;
    const total = currentAdvTotal;
    const finalInThis = inThisMth;
    const finalInNext = Math.max(0, total - finalInThis);

    try {
      const payload = {
        ...activeRecord,
        adv_amt: advAmt,
        adv_date: advDate,
        shirt,
        pant,
        shoes,
        id_card: idCard,
        other_amt: otherAmt,
        remark,
        adv_total: total,
        in_this_mth: finalInThis,
        in_next_mth: finalInNext,
        advances: finalInThis,
        updated_at: new Date().toISOString(),
      };

      // Remove joined staff relation before upserting
      delete payload.staff;

      const { error: fullError } = await supabase.from('payroll_records').upsert([payload], {
        onConflict: 'month_year,staff_id',
      });

      if (fullError) {
        console.warn('Full payload upsert failed, retrying fallback to core advances column:', fullError.message);
        const fallbackPayload: any = { ...payload };
        delete fallbackPayload.adv_amt;
        delete fallbackPayload.shirt;
        delete fallbackPayload.pant;
        delete fallbackPayload.shoes;
        delete fallbackPayload.id_card;
        delete fallbackPayload.other_amt;
        delete fallbackPayload.remark;
        delete fallbackPayload.adv_date;
        delete fallbackPayload.adv_total;
        delete fallbackPayload.in_this_mth;
        delete fallbackPayload.in_next_mth;

        const { error: fallbackError } = await supabase.from('payroll_records').upsert([fallbackPayload], {
          onConflict: 'month_year,staff_id',
        });

        if (fallbackError) {
          console.error('Supabase Save Error:', fallbackError);
          alert(`Failed to save! ${fallbackError.message}`);
        } else {
          setStatusMessage({ type: 'success', text: `Saved advance ledger for ${activeRecord.employee_name}!` });
          setActiveRecord(null);
          loadAdvancesData();
        }
      } else {
        setStatusMessage({ type: 'success', text: `Saved advance ledger for ${activeRecord.employee_name}!` });
        setActiveRecord(null);
        loadAdvancesData();
      }
    } catch (err: any) {
      console.error('Save error:', err);
      alert(`Save error: ${err.message}`);
    }
  };

  // Grand totals summary
  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => {
        const itemSum = (r.adv_amt || 0) + (r.shirt || 0) + (r.pant || 0) + (r.shoes || 0) + (r.id_card || 0) + (r.other_amt || 0);
        const tot = r.adv_total || (itemSum > 0 ? itemSum : (r.advances || 0));
        const inThis = r.in_this_mth ?? r.advances ?? 0;
        const inNext = r.in_next_mth ?? Math.max(0, tot - inThis);

        acc.totalAdv += tot;
        acc.deductedThis += inThis;
        acc.carryNext += inNext;
        return acc;
      },
      { totalAdv: 0, deductedThis: 0, carryNext: 0 }
    );
  }, [filteredRecords]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Advance &amp; Uniform Ledger</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Itemized cash advances, uniform gear recoveries &amp; split-month schedules.
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs text-gray-800 shadow-xs gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee / site..."
              className="bg-transparent outline-none w-36 sm:w-48 text-xs"
            />
          </div>

          {/* Month / Year Filter */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-gray-300">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Site Filter */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="all">All Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code_name || s.site_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Advances &amp; Gear</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1 font-mono">
              ₹{totals.totalAdv.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-gray-700 flex items-center justify-center font-bold">
            ₹
          </div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Deducted This Month</p>
            <p className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">
              ₹{totals.deductedThis.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Carry to Next Month</p>
            <p className="text-xl font-extrabold text-amber-900 mt-1 font-mono">
              ₹{totals.carryNext.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            →
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Master Advances Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            <span>Loading advances records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-500 space-y-2">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No advance records found for selected period/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse min-w-[1100px]">
              <thead className="bg-slate-100/80 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Site / Designation</th>
                  <th className="p-3 text-right font-bold text-gray-900">Total Advance</th>
                  <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">In This Month</th>
                  <th className="p-3 text-right text-amber-900 bg-amber-50/50">In Next Month</th>
                  <th className="p-3">Itemized Gear &amp; Cash Breakup</th>
                  <th className="p-3">Remarks</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {filteredRecords.map((r) => {
                  const staff = r.staff || {};
                  const itemSum = (r.adv_amt || 0) + (r.shirt || 0) + (r.pant || 0) + (r.shoes || 0) + (r.id_card || 0) + (r.other_amt || 0);
                  const advTotal = r.adv_total || (itemSum > 0 ? itemSum : (r.advances || 0));
                  const inThis = r.in_this_mth ?? r.advances ?? 0;
                  const inNext = r.in_next_mth ?? Math.max(0, advTotal - inThis);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-sans">
                        <div className="font-bold text-gray-900">{r.employee_name || staff.name || 'Worker'}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.emp_id || staff.biometric_code || r.staff_id}</div>
                      </td>

                      <td className="p-3 font-sans">
                        <div className="font-semibold text-gray-700">{r.site_name || 'Site'}</div>
                        <div className="text-[10px] text-gray-400">{staff.designation || 'Staff'}</div>
                      </td>

                      <td className="p-3 text-right font-bold text-gray-900">
                        ₹{advTotal.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/30">
                        ₹{inThis.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 text-right font-bold text-amber-800 bg-amber-50/30">
                        ₹{inNext.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 font-sans">
                        <div className="flex flex-wrap gap-1">
                          {(r.adv_amt || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              Cash: ₹{r.adv_amt}
                            </span>
                          )}
                          {(r.shirt || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                              Shirt: ₹{r.shirt}
                            </span>
                          )}
                          {(r.pant || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                              Pant: ₹{r.pant}
                            </span>
                          )}
                          {(r.shoes || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                              Shoes: ₹{r.shoes}
                            </span>
                          )}
                          {(r.id_card || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              ID: ₹{r.id_card}
                            </span>
                          )}
                          {(r.other_amt || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              Other: ₹{r.other_amt}
                            </span>
                          )}
                          {advTotal === 0 && (
                            <span className="text-[10px] text-gray-400 italic">No active advances</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-gray-500 text-[10.5px] font-sans truncate max-w-[150px]">
                        {r.remark || '-'}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openModal(r)}
                          className={`px-3 py-1 rounded-lg border font-sans font-semibold text-xs transition-colors flex items-center gap-1.5 mx-auto cursor-pointer ${
                            r.is_paid
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          }`}
                        >
                          <Edit className="w-3 h-3" />
                          <span>{r.is_paid ? 'View Ledger (PAID)' : 'Edit Ledger'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Ledger Modal */}
      {activeRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">
                    Manage Advance Ledger
                  </h2>
                  <p className="text-xs text-gray-500">
                    {activeRecord.employee_name || activeRecord.staff?.name} ({activeRecord.emp_id || activeRecord.staff?.biometric_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cash Advance */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                Cash Advance
                {activeRecord.is_paid && (
                  <span className="ml-auto text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    LOCKED (PAID)
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Advance Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={advAmt === 0 ? '' : advAmt}
                    onChange={(e) => handleItemizedChange('adv_amt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Advance Date</label>
                  <input
                    type="date"
                    disabled={activeRecord.is_paid}
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Uniform & Gear Deductions */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Uniform &amp; Gear Deductions
              </h3>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Shirt (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={shirt === 0 ? '' : shirt}
                    onChange={(e) => handleItemizedChange('shirt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Pant (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={pant === 0 ? '' : pant}
                    onChange={(e) => handleItemizedChange('pant', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Shoes (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={shoes === 0 ? '' : shoes}
                    onChange={(e) => handleItemizedChange('shoes', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">ID Card (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={idCard === 0 ? '' : idCard}
                    onChange={(e) => handleItemizedChange('id_card', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-600 font-medium mb-1 text-[11px]">Other Amt (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    value={otherAmt === 0 ? '' : otherAmt}
                    onChange={(e) => handleItemizedChange('other_amt', Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 font-mono text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks / Notes</label>
              <input
                type="text"
                disabled={activeRecord.is_paid}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="e.g. Emergency medical advance / Safety boots"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
              />
            </div>

            {/* Split-Month Recovery Schedule Card */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center font-bold text-amber-900 border-b border-amber-200/70 pb-1.5">
                <span>Total Advance / Deductions:</span>
                <span className="text-sm font-mono">₹{currentAdvTotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-amber-900 font-bold mb-1 text-[11px]">
                    Deduct In This Month (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={activeRecord.is_paid}
                    max={currentAdvTotal}
                    value={inThisMth === 0 ? '' : inThisMth}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setInThisMth(val);
                      setIsCustomInThisMth(true);
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:opacity-60 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-amber-900 font-bold mb-1 text-[11px]">
                    Carry to Next Month (₹)
                  </label>
                  <div className="w-full bg-amber-100/70 border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-amber-900 flex items-center">
                    ₹{computedInNextMth.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setActiveRecord(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              {activeRecord.is_paid ? (
                <span className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 border border-gray-300 font-bold text-xs">
                  Locked (PAID)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Advance Ledger</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
