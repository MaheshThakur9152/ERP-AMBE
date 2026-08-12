import React, { useState } from 'react';
import { DollarSign, Download, Filter, Edit2 } from 'lucide-react';
import { formatCurrency } from '@/features/invoices/utils/invoiceCalculator';

interface PayrollEmployee {
  id: string;
  name: string;
  isOffice?: boolean;
  designation: string;
  siteName: string;
  baseMonthlyRate: number;
  perDayRate: number;
  paidDays: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  status: 'Unpaid' | 'Paid';
}

const MOCK_PAYROLL_EMPLOYEES: PayrollEmployee[] = [
  {
    id: 'emp-1',
    name: 'Suman',
    isOffice: true,
    designation: 'Janitor',
    siteName: 'Acme Metal Industries Pvt Ltd',
    baseMonthlyRate: 14000,
    perDayRate: 451.61,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-2',
    name: 'Fareenbano',
    designation: 'Housekeeping',
    siteName: 'Ajmera',
    baseMonthlyRate: 0,
    perDayRate: 0.0,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-3',
    name: 'Gajarabai',
    designation: 'Janitor',
    siteName: 'Acme Metal Industries Pvt Ltd',
    baseMonthlyRate: 0,
    perDayRate: 0.0,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-4',
    name: 'Manish',
    designation: 'Janitor',
    siteName: 'Ruparel Optima',
    baseMonthlyRate: 0,
    perDayRate: 0.0,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-5',
    name: 'Maruti',
    designation: 'Janitor',
    siteName: 'Acme Metal Industries Pvt Ltd',
    baseMonthlyRate: 0,
    perDayRate: 0.0,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-6',
    name: 'Renu',
    designation: 'Janitor',
    siteName: 'Acme Metal Industries Pvt Ltd',
    baseMonthlyRate: 0,
    perDayRate: 0.0,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-7',
    name: 'Aalim',
    designation: 'Janitor',
    siteName: 'Minerva Ho',
    baseMonthlyRate: 15000,
    perDayRate: 483.87,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
  {
    id: 'emp-8',
    name: 'Aarti',
    designation: 'Janitor',
    siteName: 'Minerva Ho',
    baseMonthlyRate: 11000,
    perDayRate: 354.84,
    paidDays: 0,
    grossSalary: 0,
    deductions: 0,
    netSalary: 0,
    status: 'Unpaid',
  },
];

export const PayrollPage: React.FC = () => {
  const [employees, setEmployees] = useState<PayrollEmployee[]>(MOCK_PAYROLL_EMPLOYEES);
  const [selectedMonth, setSelectedMonth] = useState<string>('Aug');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(employees.map((e) => e.id));
    }
  };

  const toggleSelectEmp = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handlePaidDaysChange = (id: string, days: number) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== id) return emp;
        const gross = Math.round(emp.perDayRate * days);
        const net = Math.max(0, gross - emp.deductions);
        return {
          ...emp,
          paidDays: days,
          grossSalary: gross,
          netSalary: net,
        };
      })
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header Bar matching old frontend Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-[#20B2AA]" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll Management</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month/Year selector */}
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-xs text-gray-800 font-medium shadow-sm">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="Aug">Aug</option>
              <option value="Jul">Jul</option>
              <option value="Jun">Jun</option>
            </select>
            <span className="mx-1.5 text-gray-400">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          {/* Site Filter */}
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-xs text-gray-800 font-medium shadow-sm gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="all">All Sites</option>
              <option value="Acme">Acme Metal Industries</option>
              <option value="Ajmera">Ajmera</option>
              <option value="Ruparel">Ruparel Optima</option>
              <option value="Minerva">Minerva Ho</option>
            </select>
          </div>

          {/* Export Payroll Button */}
          <button
            type="button"
            className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export Payroll</span>
          </button>
        </div>
      </div>

      {/* Main Payroll Table matching old frontend Screenshot 4 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-700 border-collapse min-w-[800px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={selectedEmpIds.length === employees.length && employees.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-[#20B2AA] focus:ring-[#20B2AA]"
                />
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">EMPLOYEE</th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                BASE / RATE
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                PAID DAYS
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                GROSS SALARY
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                DEDUCTIONS
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                NET SALARY
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                STATUS
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono text-xs">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedEmpIds.includes(emp.id)}
                    onChange={() => toggleSelectEmp(emp.id)}
                    className="rounded border-gray-300 text-[#20B2AA] focus:ring-[#20B2AA]"
                  />
                </td>

                <td className="p-4 font-sans">
                  <div className="font-bold text-gray-900 text-sm">
                    {emp.isOffice ? `(Office) - ${emp.name}` : emp.name}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">{emp.designation}</div>
                  <div className="text-[11px] text-gray-400">{emp.siteName}</div>
                </td>

                <td className="p-4 text-center">
                  <div className="font-bold text-gray-800">
                    ₹{formatCurrency(emp.baseMonthlyRate)}/mo
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Rate: {emp.perDayRate.toFixed(2)}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <input
                    type="number"
                    value={emp.paidDays}
                    onChange={(e) => handlePaidDaysChange(emp.id, Number(e.target.value))}
                    className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-center font-bold text-gray-800 shadow-2xs"
                  />
                </td>

                <td className="p-4 text-center font-bold text-gray-800">
                  ₹{formatCurrency(emp.grossSalary)}
                </td>

                <td className="p-4 text-center text-red-500 font-bold">
                  -₹{formatCurrency(emp.deductions)}
                </td>

                <td className="p-4 text-center font-bold text-green-700">
                  ₹{formatCurrency(emp.netSalary)}
                </td>

                <td className="p-4 text-center font-sans">
                  <span className="bg-red-100 text-red-700 font-semibold px-3 py-1 rounded-full text-[11px] inline-block">
                    {emp.status}
                  </span>
                </td>

                <td className="p-4 text-right font-sans">
                  <button
                    type="button"
                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Salary / Deductions"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
