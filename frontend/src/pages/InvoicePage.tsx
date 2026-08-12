import React, { useState } from 'react';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { InvoiceTemplate } from '@/features/invoices/components/InvoiceTemplate';
import { InvoiceForm } from '@/features/invoices/components/InvoiceForm';
import { Printer, Download, Eye, Edit3, ShieldCheck } from 'lucide-react';
import { pdfService } from '@/services/pdfService';

const blankInvoice: InvoiceData = {
  company: {
    name: '',
    addressLine1: '',
    addressLine2: '',
    contactNo: '',
    emailWebsite: '',
    cinNo: '',
    gstin: '',
  },
  party: {
    name: '',
    address: '',
    gstin: '',
    siteName: '',
    workOrderRefNo: '',
    workOrderPeriod: '',
  },
  meta: {
    invoiceNo: '',
    invoiceDate: '',
    billingPeriod: '',
  },
  bank: {
    bankName: '',
    accountNo: '',
    ifscCode: '',
    branch: '',
  },
  items: [],
  mgmtPercent: 5,
  cgstPercent: 9,
  sgstPercent: 9,
  terms: 'Payment can only be done in cheque/DD, NEFT, RTGS',
};

export const InvoicePage: React.FC = () => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(() => {
    const saved = localStorage.getItem('asf_active_invoice');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse saved invoice', err);
      }
    }
    return blankInvoice;
  });
  const [viewMode, setViewMode] = useState<'both' | 'edit' | 'preview'>('both');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    pdfService.exportInvoicePdf(invoiceData);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header (Hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-wide">Strict Invoice Generator</h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              Template Lock Active
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Fill billing details below. Layout strictly adheres to ASF format with automated tax &amp; total calculation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Toggles */}
          <div className="bg-slate-50 p-1 rounded-lg border border-gray-200 flex text-xs font-semibold">
            <button
              onClick={() => setViewMode('both')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'both' ? 'bg-[#20B2AA] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'edit' ? 'bg-[#20B2AA] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Form
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'preview' ? 'bg-[#20B2AA] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all border border-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          {/* Download PDF button */}
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
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
              onResetSample={() => setInvoiceData(blankInvoice)}
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
