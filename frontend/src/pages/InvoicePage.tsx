import React, { useState } from 'react';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { InvoiceTemplate } from '@/features/invoices/components/InvoiceTemplate';
import { InvoiceForm } from '@/features/invoices/components/InvoiceForm';
import { Printer, Download, Eye, Edit3, ShieldCheck } from 'lucide-react';

const sampleJulyInvoice: InvoiceData = {
  company: {
    name: 'AMBE SERVICE FACILITIES PRIVATE LIMITED',
    addressLine1: 'Shop No - 49 A, Ground Floor, Pooja Enclave CHS Ltd,',
    addressLine2: 'Ganesh Nagar, Kandivali (West), Mumbai 400 067.',
    contactNo: '022 45066566 / 9619607537',
    emailWebsite: 'contact@ambeservice.com / Website : ambeservice.com',
    cinNo: 'U80200MH2023PTC412420',
    gstin: '27AAZCA5609F1ZA',
  },
  party: {
    name: 'Lokhandwala Minerva CHS LTD',
    address: 'J.R. Boricha Marg. Mahalaxmi, Mumbai- 400011.',
    gstin: '27AAEAL7350F1ZM',
    siteName: 'Minerva',
    workOrderRefNo: 'LMCHS/003/2026-27',
    workOrderPeriod: '01st April 2026 to 31st March 2027',
  },
  meta: {
    invoiceNo: 'ASF/26-27/061',
    invoiceDate: '10 August 2026',
    billingPeriod: '1st to 31th JULY 2026',
  },
  bank: {
    bankName: 'Axis bank',
    accountNo: '924020001871570',
    ifscCode: 'UTIB0001572',
    branch: 'kandivali west,Link Road.',
  },
  items: [
    {
      id: 'item-1',
      srNo: 1,
      description: 'HouseKeeping',
      hsnCode: '9985',
      rate: 20570,
      workingDays: 52,
      persons: 6,
      amount: 34504.52,
    },
    {
      id: 'item-2',
      srNo: 2,
      description: 'Overtime in hours (HK)',
      hsnCode: '9985',
      rate: 0,
      workingDays: 0,
      persons: 0,
      amount: 0.0,
    },
    {
      id: 'item-3',
      srNo: 3,
      description: 'HouseKeeping Supervisor',
      hsnCode: '9985',
      rate: 30360,
      workingDays: 31,
      persons: 1,
      amount: 30360.0,
    },
    {
      id: 'item-4',
      srNo: 4,
      description: 'Overtime in hours (HK SUP)',
      hsnCode: '9985',
      rate: 0,
      workingDays: 0,
      persons: 0,
      amount: 0.0,
    },
  ],
  mgmtPercent: 5,
  cgstPercent: 9,
  sgstPercent: 9,
  terms: 'Payment can only be done in cheque/DD, NEFT, RTGS',
};

export const InvoicePage: React.FC = () => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(sampleJulyInvoice);
  const [viewMode, setViewMode] = useState<'both' | 'edit' | 'preview'>('both');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen text-zinc-100 p-4 sm:p-6 space-y-6">
      {/* Top Action Header (Hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/90 border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-wide">Strict Invoice Generator</h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Template Lock Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Fill billing details below. Layout strictly adheres to ASF format with automated tax &amp; total calculation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Toggles */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-white/10 flex text-xs">
            <button
              onClick={() => setViewMode('both')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'both' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Form
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>

          {/* Print / Save PDF button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div
        className={`grid gap-6 ${
          viewMode === 'both'
            ? 'grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1'
        }`}
      >
        {/* Editor Form Column */}
        {(viewMode === 'both' || viewMode === 'edit') && (
          <div className={`print:hidden ${viewMode === 'both' ? 'lg:col-span-5' : 'w-full'}`}>
            <InvoiceForm
              data={invoiceData}
              onChange={setInvoiceData}
              onResetSample={() => setInvoiceData(sampleJulyInvoice)}
            />
          </div>
        )}

        {/* Live Strict Template Preview Column */}
        {(viewMode === 'both' || viewMode === 'preview') && (
          <div className={`${viewMode === 'both' ? 'lg:col-span-7' : 'w-full'}`}>
            <InvoiceTemplate data={invoiceData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicePage;
