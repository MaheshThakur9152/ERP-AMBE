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
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      } catch (err) {
        console.error('Failed to load master sites/staff:', err);
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

  // Instant Toggle Assignment Handler
  const handleToggleDeployment = async (staff: StaffOption, site: SiteOption) => {
    const key = `${staff.id}_${site.id}`;
    const existing = deploymentMap.get(key);
    const monthYearStr = `${selectedMonth} ${selectedYear}`;
    const empName = staff.employee_name || staff.name || 'Worker';
    const empId = staff.biometric_code || staff.biometricCode || staff.id.substring(0, 6);

    try {
      if (existing) {
        // Uncheck -> Remove Deployment
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
          setStatusMessage({ type: 'success', text: `Removed ${empName} from ${site.code_name || site.site_name}` });
        }
      } else {
        // Check -> Add Deployment
        const newRecord: DeploymentRecord = {
          month_year: monthYearStr,
          site_id: site.id,
          site_name: site.site_name,
          staff_id: staff.id,
          emp_id: empId,
          employee_name: empName,
          shift: 'Day',
          role: staff.designation || 'Staff',
        };

        const { error } = await supabase.from('site_deployments').upsert([newRecord], {
          onConflict: 'month_year,site_id,staff_id',
        });

        if (error) {
          console.error('Failed to add deployment:', error);
          alert(`Failed to deploy! ${error.message}`);
        } else {
          setDeployments((prev) => [...prev, newRecord]);
          setStatusMessage({ type: 'success', text: `Deployed ${empName} to ${site.code_name || site.site_name}` });
        }
      }
    } catch (err: any) {
      console.error('Deployment toggle error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Change Shift for deployed worker
  const handleChangeShift = async (staffId: string, siteId: string, shift: string) => {
    const key = `${staffId}_${siteId}`;
    const existing = deploymentMap.get(key);
    if (!existing) return;

    try {
      const updated = { ...existing, shift };
      const { error } = await supabase.from('site_deployments').upsert([updated], {
        onConflict: 'month_year,site_id,staff_id',
      });

      if (error) {
        console.error('Shift update error:', error);
      } else {
        setDeployments((prev) =>
          prev.map((d) => (d.staff_id === staffId && d.site_id === siteId ? updated : d))
        );
      }
    } catch (err: any) {
      console.error('Shift error:', err);
    }
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

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-sans">
                        <div className="font-bold text-gray-900">{empName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {empId} • <span className="text-gray-500 font-semibold">{staff.designation || 'Staff'}</span>
                        </div>
                      </td>

                      {activeSites.map((site) => {
                        const key = `${staff.id}_${site.id}`;
                        const isDeployed = deploymentMap.has(key);
                        const rec = deploymentMap.get(key);

                        return (
                          <td
                            key={site.id}
                            className={`p-2.5 text-center border-l border-gray-200 transition-colors ${
                              isDeployed ? 'bg-teal-50/40' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isDeployed}
                                  onChange={() => handleToggleDeployment(staff, site)}
                                  className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span className={`text-[10px] font-bold ${isDeployed ? 'text-teal-900' : 'text-gray-400'}`}>
                                  {isDeployed ? 'Deployed' : 'Off'}
                                </span>
                              </label>

                              {/* Shift Selector dropdown if deployed */}
                              {isDeployed && (
                                <select
                                  value={rec?.shift || 'Day'}
                                  onChange={(e) => handleChangeShift(staff.id, site.id, e.target.value)}
                                  className="text-[9.5px] font-semibold bg-white border border-teal-300 rounded px-1.5 py-0.5 text-teal-900 shadow-2xs outline-none cursor-pointer"
                                >
                                  {SHIFTS.map((s) => (
                                    <option key={s.id} value={s.id}>{s.id} Shift</option>
                                  ))}
                                </select>
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
                        onClick={() => {
                          const staff = staffList.find((s) => s.id === d.staff_id) || { id: d.staff_id, name: d.employee_name };
                          const site = sites.find((s) => s.id === d.site_id) || { id: d.site_id, site_name: d.site_name || 'Site' };
                          handleToggleDeployment(staff, site);
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
    </div>
  );
};
