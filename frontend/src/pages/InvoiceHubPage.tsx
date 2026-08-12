import React from 'react';
import { InvoiceHubTable } from '@/features/invoice-hub/components/InvoiceHubTable';

export const InvoiceHubPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <InvoiceHubTable />
    </div>
  );
};
