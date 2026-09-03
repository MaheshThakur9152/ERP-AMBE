import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  Calculator,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Search,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  UserX,
  ExternalLink,
  MapPin,
  Calendar,
} from 'lucide-react';
import { getApiUrl, fetchWithRetry } from '@/lib/apiClient';

export interface EmployeeAttendancePreviewItem {
  code: string;
  name: string;
  dailyHours: number[];
  dailyStatus: ('P' | 'A')[];
  dailyInTime?: (string | null)[];
  dailyOutTime?: (string | null)[];
  presentDays: number;
  absentDays: number;
  staffId?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  matchedStaffName?: string;
  role?: string;
  weeklyOff?: string;
  isMatched?: boolean;
}

export const AttendanceCalculatorPreview: React.FC = () => {
  const navigate = useNavigate();

  // Period selectors (No manual site selector — resolved automatically per staff)
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Aug
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // File & Threshold
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thresholdHours, setThresholdHours] = useState<number>(8.0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Results state
  const [matchedEmployees, setMatchedEmployees] = useState<EmployeeAttendancePreviewItem[]>([]);
  const [unmatchedEmployees, setUnmatchedEmployees] = useState<EmployeeAttendancePreviewItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setErrorMessage('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setSaveSuccessMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setErrorMessage('Please drop a valid Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setSaveSuccessMessage(null);
    }
  };

  const handleCalculate = async () => {
    if (!selectedFile) {
      setErrorMessage('Please choose or drag an Excel file first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const queryParams = new URLSearchParams({
        thresholdHours: String(thresholdHours),
        month: String(selectedMonth),
        year: String(selectedYear),
      });

      const endpoint = getApiUrl(`/api/attendance-calculator/preview?${queryParams.toString()}`);

      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        body: formData,
      });

      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson.error || resJson.message || 'Failed to process Excel file');
      }

      const staffList = resJson.debugStaffList || [];
      console.log('[AttendanceCalculator:Frontend] Staff fetch raw response:', resJson);
      if (resJson.staffError) {
        console.error('[AttendanceCalculator:Frontend] Staff fetch error:', resJson.staffError);
      }
      console.log('[AttendanceCalculator:Frontend] Staff list fetched:', staffList.length, 'records');
      console.log(
        '[AttendanceCalculator:Frontend] Available staff biometric_codes:',
        staffList.map((s: any) => ({ id: s.id, name: s.employee_name, code: s.biometric_code }))
      );

      const matched: EmployeeAttendancePreviewItem[] = resJson.matched || resJson.data || [];
      const unmatched: EmployeeAttendancePreviewItem[] = resJson.unmatched || [];

      console.log(`[AttendanceCalculator:Frontend] Calculated: ${matched.length} matched, ${unmatched.length} unmatched`);
      if (unmatched.length > 0) {
        console.log('[AttendanceCalculator:Frontend] Unmatched Excel rows:', unmatched.map(u => ({ code: u.code, name: u.name })));
      }
      if (matched.length > 0) {
        console.log('[AttendanceCalculator:Frontend] Matched Staff:', matched.map(m => ({ code: m.code, staffId: m.staffId, name: m.matchedStaffName, site: m.siteName })));
      }

      setMatchedEmployees(matched);
      setUnmatchedEmployees(unmatched);

      if (matched.length === 0 && unmatched.length === 0) {
        setErrorMessage('No employee sheets or duration rows found in the uploaded workbook.');
      }
    } catch (err: any) {
      console.error('Calculation error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while calculating attendance.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveToGrid = async () => {
    if (matchedEmployees.length === 0) {
      setErrorMessage('No matched employees available to save.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const endpoint = getApiUrl('/api/attendance-calculator/save');
      const payload = {
        month: selectedMonth,
        year: selectedYear,
        thresholdHours,
        records: matchedEmployees,
      };

      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to save attendance records');
      }

      setSaveSuccessMessage(
        `✓ Saved attendance for ${matchedEmployees.length} employees (${data.savedDaysCount || matchedEmployees.length * 31} daily records across ${data.savedSitesCount || 1} site(s)) to Attendance Grid!`
      );
    } catch (err: any) {
      console.error('Error saving attendance records:', err);
      setErrorMessage(err.message || 'Failed to save attendance records to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setMatchedEmployees([]);
    setUnmatchedEmployees([]);
    setErrorMessage(null);
    setSaveSuccessMessage(null);
    setSearchTerm('');
    setExpandedRow(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered matched employees
  const filteredMatched = matchedEmployees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.matchedStaffName && emp.matchedStaffName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.siteName && emp.siteName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Aggregated totals
  const totalEmployees = matchedEmployees.length;
  const totalPresentCount = matchedEmployees.reduce((acc, curr) => acc + curr.presentDays, 0);
  const totalAbsentCount = matchedEmployees.reduce((acc, curr) => acc + curr.absentDays, 0);

  // Distinct resolved sites
  const distinctSites = Array.from(
    new Set(matchedEmployees.map((e) => e.siteName).filter(Boolean))
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#20B2AA]/10 text-[#20B2AA] rounded-xl">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Attendance Calculator
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload converted multi-sheet Excel file. Staff and sites are matched automatically via biometric code.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchedEmployees.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/attendance')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer"
          >
            <span>View Attendance Grid</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target Period & Status Bar (No manual site selector) */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        {/* Month & Year Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <Calendar size={15} className="text-teal-600" />
            <span>Attendance Period:</span>
          </div>
          <div className="flex items-center bg-slate-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
            <span className="text-gray-300 mx-2">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer font-bold"
            >
              {[2024, 2025, 2026, 2027].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Resolved Sites or Auto Info */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full font-bold">
            <MapPin size={13} />
            <span>Site Resolution: Automatic from Staff Directory</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-500 font-medium">
            <Clock size={13} className="text-gray-400" />
            <span>≥ {thresholdHours}h = P</span>
          </div>
        </div>
      </div>

      {/* Control Card: File Upload + Threshold + Action */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Dropzone Area */}
          <div className="lg:col-span-8">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                selectedFile
                  ? 'border-[#20B2AA] bg-[#20B2AA]/5'
                  : 'border-gray-300 hover:border-[#20B2AA] hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#20B2AA] text-white rounded-xl shadow-xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-gray-100 text-gray-500 rounded-full mb-2">
                    <UploadCloud className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    Upload converted Excel file (.xlsx)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Drag and drop your file here, or click to browse
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Threshold & Calculate Trigger */}
          <div className="lg:col-span-4 flex flex-col justify-center space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>Present-day threshold (hours)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={thresholdHours}
                  onChange={(e) => setThresholdHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent"
                  placeholder="8.0"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">
                  hrs/day
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCalculate}
              disabled={!selectedFile || isUploading}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                !selectedFile || isUploading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#20B2AA] hover:bg-teal-600 text-white shadow-teal-500/20'
              }`}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Matching Staff & Calculating...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>Calculate & Match Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Save Success Banner */}
        {saveSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex items-center justify-between gap-4 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/attendance')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <span>Go to Attendance Grid</span>
              <ExternalLink size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Unmatched Employees Warning Banner */}
      {unmatchedEmployees.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <UserX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                {unmatchedEmployees.length} Unmatched Employees Found in Excel
              </h3>
              <p className="text-xs text-amber-800">
                These employees have no matching <strong>Biometric Code</strong> on your staff list across any site.
                Add their code in <strong>Staff & Employee Directory</strong>, then re-calculate to include them in the grid.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {unmatchedEmployees.map((un, idx) => (
              <div
                key={un.code + '-' + idx}
                className="bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <span className="font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[11px] font-bold">
                  {un.code}
                </span>
                <span>{un.name}</span>
                <span className="text-gray-400 text-[10px]">({un.presentDays}P / {un.absentDays}A)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPI Cards & Save Action Header */}
      {matchedEmployees.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>Matched Employees ({matchedEmployees.length})</span>
                {distinctSites.length > 0 && (
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                    {distinctSites.length} Site(s): {distinctSites.join(', ')}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Ready to save directly to Attendance Grid for Month {selectedMonth}/{selectedYear}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveToGrid}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                isSaving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Attendance Grid...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save to Attendance Grid</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500">Matched Staff</p>
                <p className="text-lg font-bold text-gray-900">{totalEmployees}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-600">Total Present Days</p>
                <p className="text-lg font-bold text-emerald-900">{totalPresentCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600">Total Absent Days</p>
                <p className="text-lg font-bold text-red-900">{totalAbsentCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {matchedEmployees.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden space-y-4 p-5">
          {/* Table Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Matched Employees Preview</span>
              <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full border border-teal-200">
                {filteredMatched.length} records
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search code, name, or site..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#20B2AA] focus:bg-white"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-28">Biometric Code</th>
                  <th className="py-3 px-4 min-w-[180px]">Staff Name</th>
                  <th className="py-3 px-4 min-w-[150px]">Assigned Site</th>
                  <th className="py-3 px-4 text-center w-24">Present (P)</th>
                  <th className="py-3 px-4 text-center w-24">Absent (A)</th>
                  <th className="py-3 px-4 min-w-[580px]">Daily Status Strip (Days 1–31)</th>
                  <th className="py-3 px-4 text-center w-12">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMatched.map((emp, index) => {
                  const isExpanded = expandedRow === emp.code;
                  return (
                    <React.Fragment key={emp.code + '-' + index}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-mono text-gray-400 text-xs">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {emp.code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div>
                            <span>{emp.matchedStaffName || emp.name}</span>
                            {emp.role && (
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {emp.role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <MapPin size={11} className="text-teal-600" />
                            {emp.siteName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {emp.presentDays}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-200">
                            {emp.absentDays}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {/* Compact 31-day status strip */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {emp.dailyStatus.slice(0, 31).map((status, dIndex) => {
                              const dayNum = dIndex + 1;
                              const hours = emp.dailyHours[dIndex] ?? 0;
                              const isP = status === 'P';

                              return (
                                <div
                                  key={dayNum}
                                  title={`Day ${dayNum}: ${hours} hrs (${isP ? 'Present' : 'Absent'})`}
                                  className={`w-5 h-6 rounded flex items-center justify-center font-extrabold text-[10px] cursor-pointer transition-transform hover:scale-125 shadow-2xs ${
                                    isP
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                      : 'bg-red-400 text-white hover:bg-red-500'
                                  }`}
                                >
                                  {status}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedRow(isExpanded ? null : emp.code)}
                            className="p-1 text-gray-400 hover:text-teal-600 rounded transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row Detail with exact daily hours */}
                      {isExpanded && (
                        <tr className="bg-teal-50/40 border-b border-gray-200">
                          <td colSpan={8} className="p-4">
                            <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                                <span>Day-by-Day Hours Breakdown for {emp.matchedStaffName || emp.name} ({emp.code}) — Site: {emp.siteName}</span>
                                <span className="text-gray-500 font-normal text-[11px]">
                                  Threshold: ≥ {thresholdHours}h = Present (P)
                                </span>
                              </div>
                              <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-16 lg:grid-cols-31 gap-1.5 text-center">
                                {emp.dailyHours.slice(0, 31).map((hrs, dIdx) => {
                                  const isP = emp.dailyStatus[dIdx] === 'P';
                                  return (
                                    <div
                                      key={dIdx}
                                      className={`p-1.5 rounded-lg border text-[10px] ${
                                        isP
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                          : 'bg-red-50 border-red-200 text-red-900'
                                      }`}
                                    >
                                      <div className="font-bold text-gray-500">D{dIdx + 1}</div>
                                      <div className="font-extrabold">{hrs}h</div>
                                      <div
                                        className={`font-black text-[9px] mt-0.5 ${
                                          isP ? 'text-emerald-700' : 'text-red-700'
                                        }`}
                                      >
                                        {emp.dailyStatus[dIdx]}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalculatorPreview;
