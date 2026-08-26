import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Site } from '@/features/sites/types';
import { fetchSitesApi } from '@/features/sites/api/siteApi';
import { CompanyProfile } from '@/features/company-profiles/types';
import { fetchCompanies } from '@/features/company-profiles/api/companyApi';
import { createInvoiceApi } from '@/features/invoice-hub/api/invoiceApi';
import { toast, ToastContainer } from '@/components/ui/toast';
import { Material } from '@/features/materials/types';
import { fetchMaterialsApi } from '@/features/materials/api/materialApi';
import {
  MaterialLineItem,
  computeMaterialCalculations,
  calculateMaterialItemAmount,
} from '@/features/invoices/utils/materialCalculator';
import { formatCurrency } from '@/features/invoices/utils/invoiceCalculator';
import {
  Truck,
  Building2,
  FileCheck,
  MapPin,
  Calendar,
  CheckCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Package,
  FileText,
} from 'lucide-react';
import { InvoiceRecord } from '@/features/invoice-hub/types';
import { InvoiceData } from '@/features/invoices/types/invoice';

export interface MaterialGeneratorFormProps {
  initialRecord?: InvoiceRecord | null;
  onSuccess?: (data: InvoiceData, newRecord?: InvoiceRecord) => void;
  onClose?: () => void;
}

export const MaterialGeneratorForm: React.FC<MaterialGeneratorFormProps> = ({
  initialRecord,
  onSuccess,
  onClose,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  // Materials master items from DB
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(true);

  // Companies & Sites state
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState<boolean>(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(true);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Invoice & Delivery Metadata state
  const [invoiceType, setInvoiceType] = useState<'Tax Invoice' | 'Proforma Invoice'>('Tax Invoice');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('05-May-2026');
  const [billingPeriod, setBillingPeriod] = useState<string>('April 2026');

  // Delivery & Logistics Header fields
  const [challanNo, setChallanNo] = useState<string>('01/26-27');
  const [challanDate, setChallanDate] = useState<string>('15/04/2026');
  const [buyerOrderNo, setBuyerOrderNo] = useState<string>('');
  const [dispatchDocNo, setDispatchDocNo] = useState<string>('');
  const [dispatchedThrough, setDispatchedThrough] = useState<string>('');
  const [destination, setDestination] = useState<string>('Minerva Tower');
  const [termsOfDelivery, setTermsOfDelivery] = useState<string>('');

  // Line items state
  const [lineItems, setLineItems] = useState<MaterialLineItem[]>([
    {
      id: 'mat-1',
      srNo: 1,
      description: 'plastic bucket 16L',
      hsnCode: '3924',
      gstRate: 18,
      rate: 195,
      quantity: 2,
      unit: 'Nos',
      amount: 390,
    },
  ]);

  // Load Materials DB
  useEffect(() => {
    setIsLoadingMaterials(true);
    fetchMaterialsApi()
      .then((data) => {
        setMaterialsList(data);
      })
      .catch((err) => {
        console.error('[MaterialGeneratorForm] Failed to fetch materials:', err);
      })
      .finally(() => {
        setIsLoadingMaterials(false);
      });
  }, []);

  // Fetch Companies
  useEffect(() => {
    setIsLoadingCompanies(true);
    setCompanyError(null);
    fetchCompanies()
      .then((data) => {
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompanyId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('[MaterialGeneratorForm] Failed to load companies:', err);
        setCompanyError(err.message || 'Failed to load companies');
        toast.error('Failed to load company profiles');
      })
      .finally(() => {
        setIsLoadingCompanies(false);
      });
  }, []);

  // Fetch Sites
  useEffect(() => {
    setIsLoadingSites(true);
    setSiteError(null);
    fetchSitesApi()
      .then((data) => {
        setSites(data);
        if (data.length > 0) {
          setSelectedSiteId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('[MaterialGeneratorForm] Failed to load sites:', err);
        setSiteError(err.message || 'Failed to load sites');
        toast.error('Failed to load site masters');
      })
      .finally(() => {
        setIsLoadingSites(false);
      });
  }, []);

  // Auto Invoice No sequence
  useEffect(() => {
    if (initialRecord || editId) return;
    if (!companies.length || !selectedCompanyId) return;

    const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
    if (!selectedCompany) return;

    if (invoiceType === 'Proforma Invoice') {
      const prefix = selectedCompany.proforma_prefix || 'BE/P/26-27/';
      const seq = selectedCompany.proforma_sequence ?? 1;
      setInvoiceNo(`${prefix}${String(seq).padStart(2, '0')}`);
    } else {
      const prefix = selectedCompany.tax_prefix || 'BE/26-27/';
      const seq = selectedCompany.tax_sequence ?? 1;
      setInvoiceNo(`${prefix}${String(seq).padStart(2, '0')}`);
    }
  }, [selectedCompanyId, invoiceType, companies, initialRecord, editId]);

  // Edit mode initial values
  useEffect(() => {
    if (!initialRecord) return;
    setInvoiceNo(initialRecord.invoiceNo);
    setInvoiceDate(initialRecord.date);
    setBillingPeriod(initialRecord.monthYear || '');
    if (initialRecord.challan_no) setChallanNo(initialRecord.challan_no);
    if (initialRecord.challan_date) setChallanDate(initialRecord.challan_date);
    if (initialRecord.buyer_order_no) setBuyerOrderNo(initialRecord.buyer_order_no);
    if (initialRecord.dispatch_doc_no) setDispatchDocNo(initialRecord.dispatch_doc_no);
    if (initialRecord.dispatched_through) setDispatchedThrough(initialRecord.dispatched_through);
    if (initialRecord.destination) setDestination(initialRecord.destination);
    if (initialRecord.terms_of_delivery) setTermsOfDelivery(initialRecord.terms_of_delivery);

    if (initialRecord.line_items && Array.isArray(initialRecord.line_items) && initialRecord.line_items.length > 0) {
      setLineItems(
        initialRecord.line_items.map((item: any, idx: number) => ({
          id: item.id || `mat-edit-${idx + 1}`,
          srNo: idx + 1,
          description: item.description || item.description_of_goods || item.name || '',
          hsnCode: item.hsnCode || item.hsn_code || '',
          gstRate: Number(item.gstRate ?? item.gst_rate ?? 18),
          rate: Number(item.rate ?? 0),
          quantity: Number(item.quantity ?? item.qty ?? 1),
          unit: item.unit || 'Nos',
          amount: Number(item.amount ?? 0),
        }))
      );
    }
  }, [initialRecord]);

  // Handle line item change
  const handleItemChange = (
    index: number,
    field: keyof MaterialLineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'rate' || field === 'quantity') {
      const r = Number(field === 'rate' ? value : item.rate) || 0;
      const q = Number(field === 'quantity' ? value : item.quantity) || 0;
      item.amount = calculateMaterialItemAmount(r, q);
    } else if (field === 'amount') {
      item.amount = Number(value) || 0;
    }

    updated[index] = item;
    setLineItems(updated);
  };

  // Auto-fill line item from selected material DB object
  const handleSelectMaterial = (index: number, materialId: string) => {
    const selectedMat = materialsList.find((m) => m.id === materialId);
    if (!selectedMat) return;

    const updated = [...lineItems];
    const current = updated[index];
    const newQty = current.quantity > 0 ? current.quantity : 1;
    const newRate = selectedMat.default_rate || 0;
    const newAmount = calculateMaterialItemAmount(newRate, newQty);

    updated[index] = {
      ...current,
      description: selectedMat.item_name,
      hsnCode: selectedMat.hsn_code || '',
      gstRate: selectedMat.gst_rate ?? 18,
      rate: newRate,
      unit: selectedMat.unit || 'Nos',
      quantity: newQty,
      amount: newAmount,
    };
    setLineItems(updated);
  };

  // Add blank row
  const handleAddItemRow = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `mat-${Date.now()}-${prev.length + 1}`,
        srNo: prev.length + 1,
        description: '',
        hsnCode: '',
        gstRate: 18,
        rate: 0,
        quantity: 1,
        unit: 'Nos',
        amount: 0,
      },
    ]);
  };

  // Delete row
  const handleDeleteItemRow = (index: number) => {
    if (lineItems.length <= 1) {
      toast.error('Invoice must contain at least 1 line item');
      return;
    }
    const updated = lineItems.filter((_, idx) => idx !== index).map((item, idx) => ({
      ...item,
      srNo: idx + 1,
    }));
    setLineItems(updated);
  };

  // Calculations
  const calc = computeMaterialCalculations(lineItems);

  // Selected site object
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  // Submit Handler
  const handleGenerateInvoice = async () => {
    if (!selectedSite) {
      toast.error('Please select a valid buyer/site location');
      return;
    }

    if (lineItems.some((item) => !item.description.trim())) {
      toast.error('Please complete item descriptions for all rows');
      return;
    }

    const currentCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
    const compName = currentCompany?.legal_name || currentCompany?.name || 'BHAGWATI ENTERPRISES';
    const partyName = selectedSite?.clientName || (selectedSite as any)?.client_name || selectedSite?.siteName || '';
    const partySite = selectedSite?.siteName || (selectedSite as any)?.site_name || '';

    const isProforma = invoiceType === 'Proforma Invoice';

    const recordPayload = {
      company_id: currentCompany?.id,
      site_id: selectedSite?.id,
      invoice_no: invoiceNo,
      type: isProforma ? 'Proforma Invoice' : 'Material Invoice',
      status: isProforma ? 'Draft' : 'Pending',
      invoice_date: invoiceDate,
      billing_period: billingPeriod,
      line_items: lineItems.map((item, index) => ({
        srNo: index + 1,
        description: item.description,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        rate: item.rate,
        quantity: item.quantity,
        unit: item.unit,
        amount: item.amount,
      })),
      sub_total: calc.goodsSubTotal,
      tax_total: calc.taxTotal,
      grand_total: calc.grandTotal,
      challan_no: challanNo || '',
      challan_date: challanDate || '',
      buyer_order_no: buyerOrderNo || '',
      dispatch_doc_no: dispatchDocNo || '',
      dispatched_through: dispatchedThrough || '',
      destination: destination || '',
      terms_of_delivery: termsOfDelivery || '',
      is_material: true,
      management_fee_percent: 0,
      mgmt_percent: 0,
      machinery_charges: 0,
      material_charges: 0,
      additional_charges: [],
    };

    setIsSubmitting(true);
    try {
      const res = await createInvoiceApi(recordPayload);
      if (res.status === 201 || res.status === 200) {
        toast.success('Material Bill created successfully');
        if (onSuccess) {
          await onSuccess(recordPayload as any, res.data);
        }
        if (onClose) {
          onClose();
        } else {
          navigate('/invoice-hub');
        }
      } else {
        throw new Error(`Unexpected server response status ${res.status}`);
      }
    } catch (err: any) {
      console.error('[MaterialGeneratorForm] Failed to create material bill:', err);
      toast.error(`API Error: ${err.message || 'Failed to create material bill'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Header Banner */}
      <div className="bg-[#34495E] text-white rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#20B2AA]">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Material Goods Bill Generator</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Itemized material delivery billing with automatic HSN codes, GST rate grouping, and challan tracking.
            </p>
          </div>
        </div>
      </div>

      {(companyError || siteError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{companyError || siteError}</span>
        </div>
      )}

      {/* Primary Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: Company & Invoice Type */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
            <Building2 className="w-4 h-4 text-[#20B2AA]" />
            <span>1. Seller Entity &amp; Invoice Type</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Seller (Company)</label>
            {isLoadingCompanies ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                <span>Fetching companies...</span>
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.legal_name || c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvoiceType('Tax Invoice')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  invoiceType === 'Tax Invoice'
                    ? 'bg-teal-50 border-[#20B2AA] text-[#20B2AA] shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CheckCircle className={`w-3.5 h-3.5 ${invoiceType === 'Tax Invoice' ? 'text-[#20B2AA]' : 'opacity-0'}`} />
                <span>Tax Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('Proforma Invoice')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  invoiceType === 'Proforma Invoice'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CheckCircle className={`w-3.5 h-3.5 ${invoiceType === 'Proforma Invoice' ? 'text-purple-600' : 'opacity-0'}`} />
                <span>Proforma</span>
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Buyer / Site Master */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
            <MapPin className="w-4 h-4 text-[#20B2AA]" />
            <span>2. Buyer (Bill To) &amp; Destination</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Buyer Location *</label>
            {isLoadingSites ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                <span>Fetching sites...</span>
              </div>
            ) : (
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.clientName} ({s.siteName})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedSite && (
            <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1 text-xs">
              <div className="font-semibold text-gray-900">{selectedSite.clientName}</div>
              <div className="text-xs text-gray-500">{selectedSite.address || selectedSite.siteName}</div>
              <div className="text-xs text-gray-600 font-mono">GSTIN: {selectedSite.gstin || 'N/A'}</div>
            </div>
          )}
        </div>

        {/* Step 3: Invoice Meta & Dates */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
            <Calendar className="w-4 h-4 text-[#20B2AA]" />
            <span>3. Invoice Meta</span>
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice No</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
              <input
                type="text"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Billing Period / Month</label>
            <input
              type="text"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Material Delivery Logistics Header Card */}
      <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
          <Truck className="w-4 h-4 text-[#20B2AA]" />
          <span>Material Delivery &amp; Challan Details</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Challan No</label>
            <input
              type="text"
              placeholder="e.g. 01/26-27"
              value={challanNo}
              onChange={(e) => setChallanNo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Challan Date</label>
            <input
              type="text"
              placeholder="e.g. 15/04/2026"
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Buyer's Order No</label>
            <input
              type="text"
              placeholder="PO/Ref No."
              value={buyerOrderNo}
              onChange={(e) => setBuyerOrderNo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Dispatch Doc No</label>
            <input
              type="text"
              placeholder="Dispatch Doc No"
              value={dispatchDocNo}
              onChange={(e) => setDispatchDocNo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Dispatched Through</label>
            <input
              type="text"
              placeholder="e.g. Self / Courier"
              value={dispatchedThrough}
              onChange={(e) => setDispatchedThrough(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Destination</label>
            <input
              type="text"
              placeholder="e.g. Minerva Tower"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-medium text-gray-700 mb-1">Terms of Delivery</label>
            <input
              type="text"
              placeholder="Terms of delivery info"
              value={termsOfDelivery}
              onChange={(e) => setTermsOfDelivery(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#20B2AA]" />
              <span>Material Goods Line Items ({lineItems.length} rows)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select item from Materials Master dropdown to auto-fill HSN code, GST rate, unit &amp; rate.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddItemRow}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-[#20B2AA]/40 font-bold text-xs rounded-xl transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center">Sr</th>
                <th className="py-3 px-3">Description of Goods</th>
                <th className="py-3 px-3 text-center w-24">HSN/SAC</th>
                <th className="py-3 px-3 text-center w-24">GST %</th>
                <th className="py-3 px-3 text-right w-24">Rate (₹)</th>
                <th className="py-3 px-3 text-right w-20">Quantity</th>
                <th className="py-3 px-3 text-center w-20">Unit</th>
                <th className="py-3 px-3 text-right w-28">Amount (₹)</th>
                <th className="py-3 px-3 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {lineItems.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-center text-gray-500 font-bold">{idx + 1}</td>
                  
                  {/* Item Select & Custom Input */}
                  <td className="py-2.5 px-3 font-sans">
                    <div className="space-y-1">
                      {materialsList.length > 0 && (
                        <select
                          onChange={(e) => handleSelectMaterial(idx, e.target.value)}
                          defaultValue=""
                          className="w-full text-xs bg-slate-50 border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#20B2AA]"
                        >
                          <option value="" disabled>
                            -- Pick from Materials Master --
                          </option>
                          {materialsList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.item_name} (HSN: {m.hsn_code || 'N/A'}, GST: {m.gst_rate}%, ₹{m.default_rate})
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Description of Goods"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full bg-white border border-gray-200 text-gray-900 py-1 px-2 rounded font-semibold text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                    </div>
                  </td>

                  {/* HSN Code */}
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="text"
                      placeholder="HSN"
                      value={item.hsnCode || ''}
                      onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                      className="w-20 bg-white border border-gray-200 rounded px-2 py-1 text-center font-mono text-xs text-gray-800 outline-none"
                    />
                  </td>

                  {/* GST Rate */}
                  <td className="py-2.5 px-3 text-center">
                    <select
                      value={item.gstRate}
                      onChange={(e) => handleItemChange(idx, 'gstRate', Number(e.target.value))}
                      className="w-20 bg-white border border-gray-200 rounded px-1 py-1 text-center font-mono text-xs text-gray-800 outline-none"
                    >
                      <option value={18}>18%</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>

                  {/* Rate */}
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', Number(e.target.value))}
                      className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-xs text-gray-800 outline-none"
                    />
                  </td>

                  {/* Quantity */}
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                      className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-xs font-bold text-gray-900 outline-none"
                    />
                  </td>

                  {/* Unit */}
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-16 bg-white border border-gray-200 rounded px-1.5 py-1 text-center font-sans text-xs text-gray-700 outline-none"
                    />
                  </td>

                  {/* Amount */}
                  <td className="py-2.5 px-3 text-right font-bold text-teal-700 font-mono text-xs">
                    ₹{formatCurrency(item.amount)}
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteItemRow(idx)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      title="Delete Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Math & Financial Summary */}
        <div className="flex flex-col md:flex-row justify-between gap-6 mt-6 border-t border-gray-200 pt-6">
          {/* Left Side: Summary Info */}
          <div className="flex-1 bg-gray-50 p-5 rounded-lg border border-gray-200 flex flex-col justify-center space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-gray-900 block mb-1">Amount in Words:</span>
              {calc.amountInWords}
            </p>

            {/* GST Groups Breakdown */}
            {calc.taxGroups.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-gray-200">
                <span className="font-bold text-gray-800 uppercase text-[11px]">GST Rate Breakdown:</span>
                {calc.taxGroups.map((tg) => (
                  <div key={tg.gstRate} className="bg-teal-50/50 p-2 rounded border border-teal-100 text-[11px] flex justify-between">
                    <span>GST @ {tg.gstRate}% (CGST {tg.cgstRate}% + SGST {tg.sgstRate}%) on ₹{formatCurrency(tg.taxableAmount)}</span>
                    <span className="font-mono font-bold text-teal-800">₹{formatCurrency(tg.taxAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Totals */}
          <div className="w-full md:w-[350px] bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Total Good's Amount (A)</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">₹{formatCurrency(calc.goodsSubTotal)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Total GST Amount of Good's (B)</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">₹{formatCurrency(calc.taxTotal)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">AMOUNT (A+B)</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">₹{formatCurrency(calc.grossTotal)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Round off (+-)</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">{calc.roundOff >= 0 ? `+${calc.roundOff}` : calc.roundOff}</span>
            </div>

            <div className="flex justify-between items-center pt-2.5 text-base font-bold text-teal-700 border-t border-slate-200">
              <span>TOTAL AMOUNT</span>
              <span className="font-mono text-lg text-teal-700">₹{formatCurrency(calc.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Submit Generator Button */}
        <div className="flex justify-end mt-6">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGenerateInvoice}
            className="px-6 py-3 rounded-xl bg-[#20B2AA] hover:bg-[#1ca19a] disabled:opacity-50 text-white text-sm font-bold shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Posting POST /api/invoices...</span>
              </>
            ) : (
              <>
                <span>Generate Material Bill</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
