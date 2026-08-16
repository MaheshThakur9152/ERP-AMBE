import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { CompanyProfilesPage } from '@/pages/CompanyProfilesPage';
import { InvoicePage } from '@/pages/InvoicePage';
import { SitesMasterPage } from '@/pages/SitesMasterPage';
import { InvoiceHubPage } from '@/pages/InvoiceHubPage';
import { SmartGeneratorPage } from '@/pages/SmartGeneratorPage';
import { PayrollPage } from '@/pages/PayrollPage';
import { PayslipPage } from '@/pages/PayslipPage';
import { AdvancesPage } from '@/pages/AdvancesPage';
import { StaffPage } from '@/pages/StaffPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { EmployeeDocuments } from '@/pages/EmployeeDocuments';
import { InvoiceVault } from '@/pages/InvoiceVault';
import { MaterialsMasterPage } from '@/pages/MaterialsMasterPage';
import { MaterialGeneratorPage } from '@/pages/MaterialGeneratorPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Enterprise Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Navigate to="/invoice-hub" replace />} />
              <Route path="/dashboard" element={<InvoiceHubPage />} />
              <Route path="/companies" element={<CompanyProfilesPage />} />
              <Route path="/sites" element={<SitesMasterPage />} />
              <Route path="/materials" element={<MaterialsMasterPage />} />
              <Route path="/invoice-hub" element={<InvoiceHubPage />} />
              <Route path="/smart-generator" element={<SmartGeneratorPage />} />
              <Route path="/material-generator" element={<MaterialGeneratorPage />} />
              <Route path="/invoices" element={<InvoicePage />} />
              <Route path="/invoice-vault" element={<InvoiceVault />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/payslips" element={<PayslipPage />} />
              <Route path="/advances" element={<AdvancesPage />} />
              <Route path="/employees" element={<StaffPage />} />
              <Route path="/photos" element={<CompanyProfilesPage />} />
              <Route path="/settings" element={<CompanyProfilesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/invoice-hub" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
