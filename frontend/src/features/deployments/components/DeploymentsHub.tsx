import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Calendar,
  Building2,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  Users,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface SiteOption {
  id: string;
  site_name: string;
  code_name?: string;
}

export interface StaffOption {
  id: string;
  biometric_code?: string;
  biometricCode?: string;
  name?: string;
  employee_name?: string;
  designation?: string;
  site_id?: string;
}

export interface DeploymentRecord {
  id?: string;
  month_year: string;
  site_id: string;
  site_name?: string;
  staff_id: string;
  emp_id?: string;
  employee_name?: string;
  shift?: string;
  role?: string;
  rate_card_id?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = [2026, 2025, 2024];

const SHIFTS = [
  { id: 'Day', label: 'Day Shift (08:00 - 20:00)' },
  { id: 'Night', label: 'Night Shift (20:00 - 08:00)' },
  { id: 'General', label: 'General (09:00 - 18:00)' },
  { id: '24hr', label: '24 Hours Duty' },
];

export const DeploymentsHub: React.FC = () => {
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
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [rateCards, setRateCards] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Assignment Modal Target
  const [activeModal, setActiveModal] = useState<{
    staff: StaffOption;
    site: SiteOption;
    existingDeployment?: DeploymentRecord;
    selectedRateCardId: string;
  } | null>(null);

  // Sync filters to localStorage
  useEffect(() => {
    localStorage.setItem('payroll_filter_month', selectedMonth);
    localStorage.setItem('payroll_filter_year', selectedYear.toString());
    localStorage.setItem('payroll_filter_site', selectedSiteId);
  }, [selectedMonth, selectedYear, selectedSiteId]);

  // Load Sites & Staff Data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const { data: sData, error: sErr } = await supabase.from('sites').select('id, site_name, code_name');
        if (sErr) console.warn('sites query error:', sErr);
        if (sData) setSites(sData);

        const { data: stData, error: stErr } = await supabase.from('staff').select('*');
        if (stErr) {
          console.error('Error fetching staff:', stErr);
        } else if (stData) {
          setStaffList(stData);
        }

        const { data: rcData, error: rcErr } = await supabase.from('rate_cards').select('*');
        if (rcErr) {
          console.warn('Error fetching rate cards:', rcErr);
        } else if (rcData) {
          setRateCards(rcData);
        }
      } catch (err) {
        console.error('Failed to load master sites/staff/rate_cards:', err);
      }
    };
    fetchMasterData();
  }, []);

  // Fetch Existing Roster Deployments for selected Month & Year
  const loadDeploymentsData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const monthYearStr = `${selectedMonth} ${selectedYear}`;
      const { data, error } = await supabase
        .from('site_deployments')
        .select('*')
        .eq('month_year', monthYearStr);

      if (error) {
        console.warn('site_deployments query notice:', error.message);
        setDeployments([]);
      } else {
        setDeployments(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching deployments:', err);
      setDeployments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeploymentsData();
  }, [selectedMonth, selectedYear]);

  // Fast Lookup Map for active deployment matrix: `${staffId}_${siteId}` -> DeploymentRecord
  const deploymentMap = useMemo(() => {
    const map = new Map<string, DeploymentRecord>();
    deployments.forEach((d) => {
      map.set(`${d.staff_id}_${d.site_id}`, d);
    });
    return map;
  }, [deployments]);

  // Filter staff by search and site filter
  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (selectedSiteId !== 'all') {
      // Filter staff deployed to this site or default site
      list = list.filter((s) => {
        const isDeployed = deploymentMap.has(`${s.id}_${selectedSiteId}`);
        return isDeployed || s.site_id === selectedSiteId;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => {
        const name = (s.employee_name || s.name || '').toLowerCase();
        const code = (s.biometric_code || s.biometricCode || '').toLowerCase();
        const desig = (s.designation || '').toLowerCase();
        return name.includes(q) || code.includes(q) || desig.includes(q);
      });
    }

    return list;
  }, [staffList, selectedSiteId, searchQuery, deploymentMap]);

  // Open Assign / Edit Modal for Cell
  const handleOpenAssignModal = (staff: StaffOption, site: SiteOption) => {
    const key = `${staff.id}_${site.id}`;
    const existing = deploymentMap.get(key);

    const siteRateCards = rateCards.filter(
      (rc) => rc.site_id === site.id || rc.site_name === site.site_name
    );
    const desig = (staff.designation || '').toLowerCase().trim();
    const matchingCard = siteRateCards.find(
      (rc) => (rc.post_name || rc.designation || '').toLowerCase().trim() === desig
    );
    const defaultRateCardId = existing?.rate_card_id || matchingCard?.id || siteRateCards[0]?.id || '';

    setActiveModal({
      staff,
      site,
      existingDeployment: existing,
      selectedRateCardId: defaultRateCardId,
    });
  };

  // Save / Update Deployment from Modal
  const handleSaveDeployment = async () => {
    if (!activeModal) return;
    const { staff, site, existingDeployment, selectedRateCardId } = activeModal;
    const monthYearStr = `${selectedMonth} ${selectedYear}`;
    const empName = staff.employee_name || staff.name || 'Worker';
    const empId = staff.biometric_code || staff.biometricCode || staff.id.substring(0, 6);

    try {
      const record: DeploymentRecord = {
        ...(existingDeployment || {}),
        month_year: monthYearStr,
        site_id: site.id,
        site_name: site.site_name,
        staff_id: staff.id,
        emp_id: empId,
        employee_name: empName,
        shift: existingDeployment?.shift || 'Day',
        role: staff.designation || 'Staff',
        rate_card_id: selectedRateCardId || undefined,
      };

      const { error } = await supabase.from('site_deployments').upsert([record], {
        onConflict: 'month_year,site_id,staff_id',
      });

      if (error) {
        console.error('Failed to assign deployment:', error);
        alert(`Failed to deploy! ${error.message}`);
      } else {
        setDeployments((prev) => {
          const filtered = prev.filter((d) => !(d.staff_id === staff.id && d.site_id === site.id));
          return [...filtered, record];
        });
        setStatusMessage({
          type: 'success',
          text: `Deployed ${empName} to ${site.code_name || site.site_name}`,
        });
        setActiveModal(null);
      }
    } catch (err: any) {
      console.error('Deployment save error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Remove Deployment from Modal or List
  const handleRemoveDeployment = async () => {
    if (!activeModal) return;
    const { staff, site } = activeModal;
    const monthYearStr = `${selectedMonth} ${selectedYear}`;
    const empName = staff.employee_name || staff.name || 'Worker';

    try {
      const { error } = await supabase
        .from('site_deployments')
        .delete()
        .eq('month_year', monthYearStr)
        .eq('staff_id', staff.id)
        .eq('site_id', site.id);

      if (error) {
        console.error('Failed to remove deployment:', error);
        alert(`Error removing deployment: ${error.message}`);
      } else {
        setDeployments((prev) => prev.filter((d) => !(d.staff_id === staff.id && d.site_id === site.id)));
        setStatusMessage({
          type: 'success',
          text: `Removed ${empName} from ${site.code_name || site.site_name}`,
        });
        setActiveModal(null);
      }
    } catch (err: any) {
      console.error('Deployment delete error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Count active deployments for staff in current month
  const deploymentCountForStaff = (staffId: string) => {
    return deployments.filter((d) => d.staff_id === staffId).length;
  };

  // Active Site List for columns
  const activeSites = useMemo(() => {
    if (selectedSiteId === 'all') return sites;
    return sites.filter((s) => s.id === selectedSiteId);
  }, [sites, selectedSiteId]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Multi-Site Roster &amp; Deployments</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Instant monthly staff-to-site roster matrix &amp; shift schedules ({selectedMonth} {selectedYear}).
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'matrix' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Matrix Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Roster List
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs text-gray-800 shadow-xs gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff..."
              className="bg-transparent outline-none w-36 sm:w-44 text-xs"
            />
          </div>

          {/* Month Dropdown */}
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

          {/* Site Dropdown */}
          <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-800 shadow-xs gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="all">All Sites Matrix</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code_name || s.site_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Staff Members</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1 font-mono">{filteredStaff.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#20B2AA] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Client Sites</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1 font-mono">{activeSites.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Roster Deployments</p>
            <p className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">{deployments.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
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

      {/* Main Roster Matrix Grid Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-20">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Loading roster matrix data...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-500 space-y-2">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">No staff members match selected filters.</p>
          </div>
        ) : viewMode === 'matrix' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse min-w-[1000px]">
              <thead className="bg-slate-100/80 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                <tr>
                  <th className="p-3.5 min-w-[220px]">Employee / Role</th>
                  {activeSites.map((site) => (
                    <th key={site.id} className="p-3 text-center border-l border-gray-200 min-w-[160px]">
                      <div className="truncate max-w-[150px] font-bold text-gray-900">
                        {site.code_name || site.site_name}
                      </div>
                      <div className="text-[9px] text-gray-400 font-normal truncate max-w-[150px]">
                        {site.site_name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[11px]">
                {filteredStaff.map((staff) => {
                  const empName = staff.employee_name || staff.name || 'Worker';
                  const empId = staff.biometric_code || staff.biometricCode || staff.id.substring(0, 6);
                  const splitCount = deploymentCountForStaff(staff.id);

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-sans">
                        <div className="font-bold text-gray-900 flex items-center flex-wrap gap-1">
                          <span>{empName}</span>
                          {splitCount >= 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Split — {splitCount} sites
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {empId} • <span className="text-gray-500 font-semibold">{staff.designation || 'Staff'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(staff, activeSites[0] || sites[0])}
                          className="mt-1 px-2 py-0.5 text-[9.5px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Assign to Site
                        </button>
                      </td>

                      {activeSites.map((site) => {
                        const key = `${staff.id}_${site.id}`;
                        const isDeployed = deploymentMap.has(key);
                        const rec = deploymentMap.get(key);
                        const assignedRateCard = rec?.rate_card_id ? rateCards.find((rc) => rc.id === rec.rate_card_id) : null;
                        const label = assignedRateCard?.post_name || assignedRateCard?.designation || rec?.role || 'Assigned';

                        return (
                          <td
                            key={site.id}
                            className={`p-2.5 text-center border-l border-gray-200 transition-colors ${
                              isDeployed ? 'bg-teal-50/40' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center">
                              {isDeployed ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignModal(staff, site)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1 justify-center max-w-[130px] truncate cursor-pointer"
                                  title={`Assigned to ${site.site_name} - Click to edit or remove`}
                                >
                                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{label}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignModal(staff, site)}
                                  className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:text-teal-700 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-lg transition-all shadow-2xs cursor-pointer"
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* List View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 border-collapse min-w-[800px]">
              <thead className="bg-slate-100/80 border-b border-gray-200 font-bold uppercase text-[10px] text-gray-600 tracking-wider">
                <tr>
                  <th className="p-3">Deployed Worker</th>
                  <th className="p-3">Assigned Site</th>
                  <th className="p-3">Shift Schedule</th>
                  <th className="p-3">Month / Period</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {deployments.map((d) => (
                  <tr key={d.id || `${d.staff_id}_${d.site_id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-sans">
                      <div className="font-bold text-gray-900">{d.employee_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{d.emp_id}</div>
                    </td>

                    <td className="p-3 font-sans">
                      <div className="font-bold text-teal-900">{d.site_name}</div>
                      <div className="text-[10px] text-gray-400">{d.role || 'Staff'}</div>
                    </td>

                    <td className="p-3 font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                        {d.shift || 'Day'} Shift
                      </span>
                    </td>

                    <td className="p-3 text-gray-600 font-bold">{d.month_year}</td>

                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('site_deployments')
                              .delete()
                              .eq('month_year', d.month_year)
                              .eq('staff_id', d.staff_id)
                              .eq('site_id', d.site_id);

                            if (error) {
                              alert(`Failed to remove: ${error.message}`);
                            } else {
                              setDeployments((prev) =>
                                prev.filter((dep) => !(dep.staff_id === d.staff_id && dep.site_id === d.site_id))
                              );
                              setStatusMessage({
                                type: 'success',
                                text: `Removed ${d.employee_name} from ${d.site_name}`,
                              });
                            }
                          } catch (err: any) {
                            alert(`Error: ${err.message}`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                        title="Remove Deployment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 leading-tight">
                    {activeModal.staff.employee_name || activeModal.staff.name || 'Worker'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                    → {activeModal.site.code_name || activeModal.site.site_name} ({selectedMonth} {selectedYear})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Site
                </label>
                <select
                  value={activeModal.site.id}
                  onChange={(e) => {
                    const newSite = sites.find((s) => s.id === e.target.value);
                    if (!newSite) return;
                    const key = `${activeModal.staff.id}_${newSite.id}`;
                    const existing = deploymentMap.get(key);
                    const siteRateCards = rateCards.filter(
                      (rc) => rc.site_id === newSite.id || rc.site_name === newSite.site_name
                    );
                    const desig = (activeModal.staff.designation || '').toLowerCase().trim();
                    const matchingCard = siteRateCards.find(
                      (rc) => (rc.post_name || rc.designation || '').toLowerCase().trim() === desig
                    );
                    setActiveModal({
                      ...activeModal,
                      site: newSite,
                      existingDeployment: existing,
                      selectedRateCardId: existing?.rate_card_id || matchingCard?.id || siteRateCards[0]?.id || '',
                    });
                  }}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 shadow-2xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code_name || s.site_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Rate Card
                </label>
                <select
                  value={activeModal.selectedRateCardId}
                  onChange={(e) =>
                    setActiveModal((prev) =>
                      prev ? { ...prev, selectedRateCardId: e.target.value } : null
                    )
                  }
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 shadow-2xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">Default Site Rate Card</option>
                  {rateCards
                    .filter(
                      (rc) =>
                        rc.site_id === activeModal.site.id ||
                        rc.site_name === activeModal.site.site_name
                    )
                    .map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.post_name || rc.designation || 'Rate'} (Gross: ₹{(rc.gross_salary || rc.basic_da || 0).toLocaleString('en-IN')})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-gray-100">
              {activeModal.existingDeployment ? (
                <button
                  type="button"
                  onClick={handleRemoveDeployment}
                  className="text-red-600 hover:text-red-700 text-xs font-bold hover:underline transition-all cursor-pointer"
                >
                  Remove Deployment
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDeployment}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer"
                >
                  {activeModal.existingDeployment ? 'Update' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
