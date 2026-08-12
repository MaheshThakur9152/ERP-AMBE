import React, { useState, useEffect } from 'react';
import { InvoiceRecord } from '../types';
import { fetchInvoicesApi, deleteInvoiceApi } from '../api/invoiceApi';
import { toast, ToastContainer } from '@/components/ui/toast';
import {
  RotateCcw,
  Plus,
  Eye,
  Download,
  Edit2,
  Trash2,
  X,
  Printer,
  Palette,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/features/invoices/utils/invoiceCalculator';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { InvoiceTemplate } from '@/features/invoices/components/InvoiceTemplate';
import { MaterialInvoiceTemplate } from '@/features/invoices/components/MaterialInvoiceTemplate';
import { SmartGeneratorForm } from '@/features/smart-generator/components/SmartGeneratorForm';
import { pdfService } from '@/services/pdfService';

interface InvoiceHubTableProps {
  invoices?: InvoiceRecord[];
  onSelectInvoice?: (invoice: InvoiceRecord) => void;
  onDeleteInvoice?: (id: string) => void;
  onSaveInvoice?: (updatedInvoice: InvoiceData) => void;
}

const convertRecordToInvoiceData = (inv: InvoiceRecord): InvoiceData => {
  if (inv.payload && inv.payload.company && inv.payload.company.name) {
    return {
      ...inv.payload,
      isMaterial: inv.is_material || inv.payload?.isMaterial || false,
      delivery: inv.payload?.delivery || {},
    };
  }
  const saved = localStorage.getItem('asf_active_invoice');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.meta?.invoiceNo === inv.invoiceNo && parsed.company?.name) {
        return {
          ...parsed,
          isMaterial: inv.is_material || parsed.isMaterial || false,
          delivery: parsed.delivery || {},
        };
      }
    } catch (e) {
      console.error(e);
    }
  }

  const comp = inv.companies;
  const site = inv.sites;

  const companyName =
    comp?.legal_name ||
    comp?.name ||
    (inv as any).companyName ||
    (inv as any).company_name ||
    '';

  const clientName =
    site?.client_name ||
    inv.clientName ||
    (inv as any).client_name ||
    '';

  const siteName =
    site?.site_name ||
    inv.siteName ||
    (inv as any).site_name ||
    '';

  const termsText = comp?.terms_and_conditions || comp?.default_terms;
  const formattedTerms = Array.isArray(termsText)
    ? termsText.join(' | ')
    : String(termsText || '');

  return {
    company: {
      name: companyName,
      addressLine1: comp?.address_line1 || '',
      addressLine2: comp?.address_line2 || `${comp?.city || ''} ${comp?.pincode || ''}`.trim(),
      contactNo: comp?.phone || comp?.contact_no || '',
      emailWebsite: comp?.email || comp?.email_website || '',
      cinNo: comp?.cin || comp?.cin_no || '',
      gstin: comp?.gstin || '',
    },
    party: {
      name: clientName,
      siteName: siteName,
      address: site?.address || '',
      gstin: site?.gstin || '',
      workOrderRefNo: site?.work_order_ref || '',
      workOrderPeriod: site?.work_order_period || '',
    },
    isMaterial: inv.is_material || inv.payload?.isMaterial || false,
    delivery: inv.payload?.delivery || {
      challanNo: (inv as any).challan_no || '',
      challanDate: (inv as any).challan_date || '',
      buyerOrderNo: (inv as any).buyer_order_no || '',
      dispatchDocNo: (inv as any).dispatch_doc_no || '',
      dispatchedThrough: (inv as any).dispatched_through || '',
      destination: (inv as any).destination || '',
      termsOfDelivery: (inv as any).terms_of_delivery || '',
    },
    meta: {
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.date,
      billingPeriod: inv.monthYear || inv.billing_period || '',
      invoiceType: inv.type,
    },
    type: inv.type,
    bank: {
      bankName: comp?.bank_name || '',
      accountNo: comp?.bank_account_no || comp?.account_no || '',
      ifscCode: comp?.bank_ifsc || comp?.ifsc_code || '',
      branch: comp?.bank_branch || comp?.branch_name || '',
    },
    items: inv.line_items && inv.line_items.length > 0 ? inv.line_items : [
      {
        id: 'item-1',
        srNo: 1,
        description: 'Services',
        hsnCode: '9985',
        rate: inv.amount,
        workingDays: 31,
        persons: 1,
        amount: inv.amount,
      },
    ],
    mgmtPercent: 5,
    cgstPercent: 9,
    sgstPercent: 9,
    terms: formattedTerms,
  };
};

export const InvoiceHubTable: React.FC<InvoiceHubTableProps> = ({
  onSelectInvoice,
  onDeleteInvoice: parentDelete,
  onSaveInvoice: parentSave,
}) => {
  // Purged hardcoded mock state: initialize strictly to empty array
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'Tax' | 'Proforma' | 'Material'>('Tax');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<number>(2026);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Multi-select bulk state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Preview Modal state
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('color');

  // Stealth Print state
  const [stealthPrintData, setStealthPrintData] = useState<InvoiceData | null>(null);

  // Inline Edit / Create Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<InvoiceRecord | null>(null);

  // Load invoices on mount directly from database endpoint
  const loadInvoicesFromApi = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await fetchInvoicesApi();
      setInvoices(data);
    } catch (err: any) {
      const msg = err.message || 'GET /api/invoices database request failed';
      console.error('[InvoiceHubTable] GET /api/invoices error:', err);
      setApiError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoicesFromApi();
  }, []);

  const siteList = Array.from(new Set(invoices.map((inv) => inv.siteName)));

  const filteredInvoices = invoices.filter((inv) => {
    const isProforma = inv.type === 'Proforma Invoice';
    const isMaterial = inv.type === 'Material Invoice' || (inv as any).is_material === true;
    if (activeTab === 'Material') return isMaterial;
    if (activeTab === 'Proforma') return isProforma && !isMaterial;
    // Tax tab: exclude proforma & material
    if (activeTab === 'Tax') return !isProforma && !isMaterial;

    const matchesSite = filterSite === 'all' || inv.siteName === filterSite;
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;

    return matchesSite && matchesStatus;
  });

  // Master checkbox toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map((i) => i.id));
    }
  };

  // Single row checkbox toggle
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Delete Invoice action handler: strictly filters out record ONLY after receiving 200 OK
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice record from PostgreSQL database?')) {
      return;
    }

    try {
      const res = await deleteInvoiceApi(id);
      if (res.status === 200) {
        setInvoices((prev) => prev.filter((i) => i.id !== id));
        toast.success('Invoice deleted successfully from database');
        if (parentDelete) parentDelete(id);
      } else {
        throw new Error(`Delete failed with HTTP status ${res.status}`);
      }
    } catch (err: any) {
      const msg = err.message || `DELETE /api/invoices/${id} failed`;
      console.error(`[InvoiceHubTable] DELETE /api/invoices/${id} error:`, err);
      setApiError(msg);
      toast.error(msg);
    }
  };

  // Preview action handler
  const handlePreview = (inv: InvoiceRecord) => {
    const data = convertRecordToInvoiceData(inv);
    setPreviewInvoice(data);
    setIsPreviewModalOpen(true);
  };

  // Edit action handler (In-Page Modal)
  const handleEdit = (inv: InvoiceRecord) => {
    setEditingRecord(inv);
    setIsEditModalOpen(true);
  };

  // Add Invoice handler (In-Page Modal)
  const handleAddInvoice = () => {
    setEditingRecord(null);
    setIsEditModalOpen(true);
  };

  // Download action handler (Stealth print without opening preview modal)
  const handleDownload = (inv: InvoiceRecord) => {
    setStealthPrintData(convertRecordToInvoiceData(inv));
    setTimeout(() => {
      window.print();
    }, 300);
    window.addEventListener('afterprint', () => setStealthPrintData(null), { once: true });
  };

  // Bulk PDF ZIP Download handler
  const handleBulkDownloadZip = () => {
    const selectedInvoices = invoices
      .filter((inv) => selectedIds.includes(inv.id))
      .map((inv) => convertRecordToInvoiceData(inv));

    if (selectedInvoices.length > 0) {
      pdfService.exportBulkPdfZip(selectedInvoices);
    }
  };

  return (
    <>
      <ToastContainer />

      {/* Main UI (Header, Filters, Data Table) */}
      <div className="space-y-6 print:hidden">
        {/* Backend Proxy / API Error Badge Banner */}
        {apiError && (
          <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg border border-red-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 text-white animate-bounce" />
              <div>
                <h4 className="font-bold text-sm">Backend API Endpoint Error</h4>
                <p className="text-xs font-mono text-red-100">{apiError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadInvoicesFromApi}
              className="px-3 py-1.5 bg-white text-red-700 font-bold rounded-lg text-xs hover:bg-red-50 transition-colors shrink-0 shadow-sm"
            >
              Retry Database Connection
            </button>
          </div>
        )}

        {/* Top Header Bar & Action Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              {activeTab === 'Tax' ? 'Invoices' : activeTab === 'Material' ? 'Material Bills' : 'Proforma Invoices'}
            </h2>
            {/* Sub tab selector */}
            <div className="flex bg-gray-200 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('Tax')}
                className={`px-3 py-1 rounded-md transition-all ${activeTab === 'Tax'
                    ? 'bg-[#20B2AA] text-white shadow-sm'
                    : 'text-gray-700 hover:text-black'
                  }`}
              >
                Invoices
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Proforma')}
                className={`px-3 py-1 rounded-md transition-all ${activeTab === 'Proforma'
                    ? 'bg-[#20B2AA] text-white shadow-sm'
                    : 'text-gray-700 hover:text-black'
                  }`}
              >
                Proforma Invoices
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Material')}
                className={`px-3 py-1 rounded-md transition-all ${activeTab === 'Material'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-black'
                  }`}
              >
                Material Bills
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Filter Dropdowns */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-[#20B2AA]/20 font-medium"
            >
              <option value="all">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-[#20B2AA]/20 font-medium"
            >
              {[2024, 2025, 2026, 2027].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-[#20B2AA]/20 max-w-[140px] font-medium"
            >
              <option value="all">All Sites</option>
              {siteList.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-[#20B2AA]/20 font-medium"
            >
              <option value="all">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Approved">Approved</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadInvoicesFromApi}
              className="bg-[#4A5568] hover:bg-gray-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <RotateCcw size={15} className={isLoading ? 'animate-spin' : ''} /> <span>Refresh</span>
            </button>

            {/* + Add Invoices Button */}
            <button
              type="button"
              onClick={handleAddInvoice}
              className="bg-[#20B2AA] hover:bg-[#1ca19a] text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={16} /> <span>+ Add Invoices</span>
            </button>
          </div>
        </div>

        {/* Sticky Bulk-Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl flex items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <span className="bg-[#20B2AA] text-white font-bold px-2.5 py-0.5 rounded-full text-xs">
                {selectedIds.length}
              </span>
              <span>invoices selected for bulk PDF export</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleBulkDownloadZip}
                className="px-4 py-2 bg-[#20B2AA] hover:bg-[#1ca19a] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all"
              >
                <Download size={15} />
                <span>Bulk Download PDF (ZIP)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Main Data Table Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
          <table className="w-full text-left min-w-[700px] border-collapse">
            <thead className="bg-white border-b border-gray-300">
              <tr>
                <th className="p-4 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {selectedIds.length === filteredInvoices.length &&
                      filteredInvoices.length > 0 ? (
                      <CheckSquare size={17} className="text-[#20B2AA]" />
                    ) : (
                      <Square size={17} />
                    )}
                  </button>
                </th>
                <th className="p-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Details</th>
                <th className="p-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Amount</th>
                <th className="p-4 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">
                  Status
                </th>
                <th className="p-4 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
                      <span className="text-xs font-semibold text-gray-600">
                        Executing GET /api/invoices from database...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 text-xs font-medium">
                    No database invoices found for this selection.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const clientDisplayName =
                    inv.sites?.client_name ||
                    inv.clientName ||
                    (inv as any).client_name ||
                    inv.payload?.party?.name ||
                    'Unknown Client';
                  const siteDisplayName =
                    inv.sites?.site_name ||
                    inv.siteName ||
                    (inv as any).site_name ||
                    inv.payload?.party?.siteName ||
                    '';
                  const displayAmount = inv.grand_total || inv.amount || 0;

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-gray-50'
                        }`}
                    >
                      {/* Checkbox Column */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectRow(inv.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare size={17} className="text-[#20B2AA]" />
                          ) : (
                            <Square size={17} />
                          )}
                        </button>
                      </td>

                      {/* Details Column */}
                      <td className="p-4 py-3.5">
                        <div className="font-bold text-gray-900 text-sm">
                          {clientDisplayName}
                          {siteDisplayName && (
                            <span className="text-xs text-gray-500 font-normal border-l border-gray-300 ml-2 pl-2">
                              {siteDisplayName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{inv.invoiceNo}</div>
                        <div className="text-xs text-gray-400 font-medium">{inv.monthYear || inv.billing_period}</div>
                      </td>

                      {/* Amount Column */}
                      <td className="p-4 py-3.5 font-bold text-gray-900 text-sm font-sans">
                        ₹{formatCurrency(displayAmount)}
                      </td>

                      {/* Status Column */}
                      <td className="p-4 py-3.5 text-center">
                        {inv.type === 'Proforma Invoice' ? (
                          <span className="bg-red-50 text-red-600 border border-red-100 rounded-md text-[11px] font-semibold px-3 py-1 inline-block">
                            Submit for Approval
                          </span>
                        ) : inv.status === 'Paid' ? (
                          <span className="bg-green-100 text-green-700 rounded-full text-xs font-semibold px-3 py-1 inline-block">
                            Paid
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 rounded-full text-xs font-semibold px-3 py-1 inline-block">
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3 text-teal-600">
                          <button
                            type="button"
                            onClick={() => handlePreview(inv)}
                            className="hover:text-teal-800 transition-colors p-1"
                            title="Preview Invoice"
                          >
                            <Eye size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(inv)}
                            className="hover:text-teal-800 transition-colors p-1"
                            title="Download PDF"
                          >
                            <Download size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(inv)}
                            className="hover:text-teal-800 transition-colors p-1"
                            title="Edit Invoice (In-Page)"
                          >
                            <Edit2 size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete Invoice"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick View Dialog / Modal with Dual Color / B&W Mode */}
      {isPreviewModalOpen && previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-transparent">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 print:max-h-none print:shadow-none print:border-none print:rounded-none">
            {/* Modal Header Toolbar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm tracking-wide">
                  Invoice Preview — {previewInvoice.meta.invoiceNo}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Mode Selector Toggle: Full Color vs Black & White */}
                <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-semibold border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setColorMode('color')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${colorMode === 'color'
                        ? 'bg-[#20B2AA] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <Palette size={13} />
                    <span>Color</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorMode('bw')}
                    className={`px-2.5 py-1 rounded-md transition-all ${colorMode === 'bw'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>B&amp;W Mode</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer size={14} />
                  <span>Print / Save as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-gray-100 flex justify-center print:p-0 print:bg-white">
              {previewInvoice.isMaterial ? (
                <MaterialInvoiceTemplate data={previewInvoice} colorMode={colorMode} />
              ) : (
                <InvoiceTemplate data={previewInvoice} colorMode={colorMode} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Page Edit / Create Dialog Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  {editingRecord ? `Edit Invoice — ${editingRecord.invoiceNo}` : 'Create New Invoice'}
                </h3>
                <p className="text-xs text-slate-400">
                  Update invoice line items and details directly in-page without leaving Invoice Hub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body with SmartGeneratorForm */}
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <SmartGeneratorForm
                initialRecord={editingRecord}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={(generatedData, createdRecord) => {
                  if (createdRecord) {
                    setInvoices((prev) => [createdRecord, ...prev.filter((i) => i.id !== createdRecord.id)]);
                  } else {
                    loadInvoicesFromApi();
                  }
                  if (parentSave) {
                    parentSave(generatedData);
                  }
                  setIsEditModalOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stealth Print Container */}
      {stealthPrintData && (
        <div className="hidden print:block absolute inset-0 bg-white z-[9999]">
          {stealthPrintData.isMaterial
            ? <MaterialInvoiceTemplate data={stealthPrintData} colorMode="color" />
            : <InvoiceTemplate data={stealthPrintData} colorMode="color" />}
        </div>
      )}
    </>
  );
};
