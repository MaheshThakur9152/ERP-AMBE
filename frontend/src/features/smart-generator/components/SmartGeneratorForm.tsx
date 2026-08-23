import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Site } from '@/features/sites/types';
import { fetchSitesApi } from '@/features/sites/api/siteApi';
import { CompanyProfile } from '@/features/company-profiles/types';
import { fetchCompanies } from '@/features/company-profiles/api/companyApi';
import { createInvoiceApi, updateInvoiceApi } from '@/features/invoice-hub/api/invoiceApi';
import { toast } from '@/components/ui/toast';
import { InvoiceLineItem, InvoiceData } from '@/features/invoices/types/invoice';
import {
  computeInvoiceCalculations,
  formatCurrency,
  calculateLineItemAmount,
} from '@/features/invoices/utils/invoiceCalculator';
import {
  Sparkles,
  Building2,
  FileCheck,
  MapPin,
  Calendar,
  CheckCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { InvoiceRecord } from '@/features/invoice-hub/types';

export interface SmartGeneratorFormProps {
  initialRecord?: InvoiceRecord | null;
  onSuccess?: (data: InvoiceData, newRecord?: InvoiceRecord) => void;
  onClose?: () => void;
}

export const SmartGeneratorForm: React.FC<SmartGeneratorFormProps> = ({
  initialRecord,
  onSuccess,
  onClose,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [sites, setSites] = useState<Site[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState<boolean>(true);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(true);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch Companies from GET /api/companies
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
        console.error('[SmartGeneratorForm] Failed to load companies from API:', err);
        setCompanyError(err.message || 'Failed to load companies from GET /api/companies');
        toast.error('Failed to load company profiles from database');
      })
      .finally(() => {
        setIsLoadingCompanies(false);
      });
  }, []);

  // Fetch Sites from GET /api/sites
  useEffect(() => {
    setIsLoadingSites(true);
    setSiteError(null);
    fetchSitesApi()
      .then((data) => {
        setSites(data);
        if (data.length > 0 && !initialRecord) {
          setSelectedSiteId(data[0].id);
        }
      })
      .catch((err) => {
        console.error('[SmartGeneratorForm] Failed to load sites from API:', err);
        setSiteError(err.message || 'Failed to load sites from GET /api/sites');
        toast.error('Failed to load site masters from database');
      })
      .finally(() => {
        setIsLoadingSites(false);
      });
  }, []);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (monthIndex: number, year: number): number => {
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const formatBillingPeriodText = (monthIndex: number, year: number): string => {
    const monthName = MONTHS[monthIndex].toUpperCase();
    const daysCount = getDaysInMonth(monthIndex, year);
    const suffix = getOrdinalSuffix(daysCount);
    return `1st to ${daysCount}${suffix} ${monthName} ${year}`;
  };

  const now = new Date();
  const [invoiceType, setInvoiceType] = useState<'Tax Invoice' | 'Proforma Invoice'>('Tax Invoice');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(() => {
    const day = now.getDate();
    return `${day} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  });

  // Month & Year selection for dynamic billing period (defaults to current month/year)
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [billingPeriod, setBillingPeriod] = useState<string>(() =>
    formatBillingPeriodText(now.getMonth(), now.getFullYear())
  );

  // Auto-calculate & inject Next Invoice No based on selected Company sequence & Invoice Type
  useEffect(() => {
    if (initialRecord || editId) return; // Do not overwrite if editing an existing invoice
    if (!companies.length || !selectedCompanyId) return;

    const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
    if (!selectedCompany) return;

    if (invoiceType === 'Proforma Invoice') {
      const prefix = selectedCompany.proforma_prefix || 'AS/P/26-27/';
      const seq = selectedCompany.proforma_sequence ?? 1;
      const formattedSeq = String(seq).padStart(3, '0');
      setInvoiceNo(`${prefix}${formattedSeq}`);
    } else {
      const prefix = selectedCompany.tax_prefix || 'AS/26-27/';
      const seq = selectedCompany.tax_sequence ?? 1;
      const formattedSeq = String(seq).padStart(3, '0');
      setInvoiceNo(`${prefix}${formattedSeq}`);
    }
  }, [selectedCompanyId, invoiceType, companies, initialRecord, editId]);

  // Auto-populated line items & extra charges state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [additionalCharges, setAdditionalCharges] = useState<{ name: string; amount: number }[]>([]);
  const [isEditLoaded, setIsEditLoaded] = useState<boolean>(false);

  // Handle Edit Mode initialRecord populate
  useEffect(() => {
    if (!initialRecord || !sites.length) return;
    setInvoiceNo(initialRecord.invoiceNo);
    setInvoiceDate(initialRecord.date);
    if (initialRecord.monthYear) {
      const rawMonth = initialRecord.monthYear.toUpperCase();
      const matchedIdx = MONTHS.findIndex((m) => rawMonth.includes(m.toUpperCase()));
      if (matchedIdx !== -1) {
        setSelectedMonth(matchedIdx);
        setBillingPeriod(formatBillingPeriodText(matchedIdx, selectedYear));
      } else {
        setBillingPeriod(`1st to 31st ${rawMonth}`);
      }
    }

    // 1. Match Company
    const recCompanyId = initialRecord.companyId || (initialRecord as any).company_id;
    const recCompName = (initialRecord as any).companyName || (initialRecord as any).company_name || (initialRecord as any).company?.name;
    const matchingCompany = companies.find(
      (c) => (recCompanyId && c.id === recCompanyId) || (recCompName && (c.name?.trim().toLowerCase() === recCompName.trim().toLowerCase() || c.legal_name?.trim().toLowerCase() === recCompName.trim().toLowerCase()))
    );
    if (matchingCompany) {
      setSelectedCompanyId(matchingCompany.id);
    }

    // 2. Match Site (STRICTLY by siteId or siteName -- NEVER match on shared clientName!)
    const recSiteId = initialRecord.siteId || (initialRecord as any).site_id;
    const recSiteName = initialRecord.siteName || (initialRecord as any).site_name || (initialRecord as any).party?.siteName;

    const matchingSite = sites.find((s) => {
      if (recSiteId && s.id === recSiteId) return true;
      if (recSiteName && s.siteName && s.siteName.trim().toLowerCase() === recSiteName.trim().toLowerCase()) return true;
      if (recSiteName && (s as any).name && (s as any).name.trim().toLowerCase() === recSiteName.trim().toLowerCase()) return true;
      return false;
    });

    if (matchingSite) {
      setSelectedSiteId(matchingSite.id);
    }

    const loadedItems = initialRecord.line_items || (initialRecord as any).items || initialRecord.payload?.items || initialRecord.payload?.line_items || [];
    if (loadedItems.length > 0) {
      setLineItems(loadedItems);
    }

    const existingAdd =
      initialRecord.payload?.additionalCharges ||
      (initialRecord as any).additionalCharges ||
      (initialRecord as any).additional_charges ||
      matchingSite?.defaultAdditionalCharges ||
      matchingSite?.default_additional_charges;

    let finalAdditional: { name: string; amount: number }[] = [];

    if (existingAdd && Array.isArray(existingAdd) && existingAdd.length > 0) {
      finalAdditional = existingAdd;
    } else {
      let mach = Number(
        initialRecord.payload?.machineryCharges ||
        (initialRecord as any).machinery_charges ||
        (initialRecord as any).machineryCharges ||
        matchingSite?.default_machinery_charges ||
        matchingSite?.defaultMachineryCharges ||
        0
      );
      let mat = Number(
        initialRecord.payload?.materialCharges ||
        (initialRecord as any).material_charges ||
        (initialRecord as any).materialCharges ||
        matchingSite?.default_material_charges ||
        matchingSite?.defaultMaterialCharges ||
        0
      );

      finalAdditional = [
        { name: 'Machinery Charges', amount: mach },
        { name: 'Material Charges', amount: mat },
      ];
    }

    setAdditionalCharges(finalAdditional);
    setIsEditLoaded(true);
  }, [initialRecord, sites, companies]);

  // Selected site object
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  // Auto-populate Additional Charges when selected site changes
  useEffect(() => {
    if (!selectedSite) return;
    const defaultAdd =
      selectedSite.defaultAdditionalCharges ||
      selectedSite.default_additional_charges ||
      (selectedSite as any).additionalCharges ||
      (selectedSite as any).additional_charges;

    if (defaultAdd && Array.isArray(defaultAdd) && defaultAdd.length > 0) {
      setAdditionalCharges(
        defaultAdd.map((c: any) => ({
          name: c.name || 'Charge',
          amount: Number(c.amount || 0),
        }))
      );
    } else {
      const mach = Number(selectedSite.defaultMachineryCharges ?? selectedSite.default_machinery_charges ?? 0);
      const mat = Number(selectedSite.defaultMaterialCharges ?? selectedSite.default_material_charges ?? 0);
      setAdditionalCharges([
        { name: 'Machinery Charges', amount: mach },
        { name: 'Material Charges', amount: mat },
      ]);
    }
  }, [selectedSiteId, selectedSite, sites]);

  const handleMonthYearChange = (mIndex: number, yr: number) => {
    setSelectedMonth(mIndex);
    setSelectedYear(yr);
    const newPeriodText = formatBillingPeriodText(mIndex, yr);
    setBillingPeriod(newPeriodText);

    const daysInNewMonth = getDaysInMonth(mIndex, yr);
    setLineItems((prevItems) =>
      prevItems.map((item) => {
        const wDays = item.workingDays ?? 0;
        if (item.rate > 0 && wDays > 0) {
          const daysToUse = (wDays === 31 || wDays === 30 || wDays === 28 || wDays === 29) ? daysInNewMonth : wDays;
          const newAmount = calculateLineItemAmount(item.rate, daysToUse, daysInNewMonth);
          return { ...item, workingDays: daysToUse, amount: newAmount };
        }
        return item;
      })
    );
  };

  // Auto-sync Operating Company when selected site changes
  useEffect(() => {
    if (!selectedSite) return;
    const siteCompId = selectedSite.company_id || selectedSite.companyId;
    if (siteCompId && companies.some((c) => c.id === siteCompId)) {
      setSelectedCompanyId(siteCompId);
    }
  }, [selectedSiteId, selectedSite, companies]);

  // Populate line items dynamically when selected site changes
  useEffect(() => {
    if (isEditLoaded) return;
    if (!selectedSite || !selectedSite.rateCards) {
      setLineItems([]);
      return;
    }

    const currentDays = getDaysInMonth(selectedMonth, selectedYear);
    const items: InvoiceLineItem[] = [];
    let sr = 1;

    selectedSite.rateCards.forEach((rc) => {
      const defaultDays = rc.workingDays || currentDays;
      const defaultPersons = rc.persons || 1;
      const mainAmount = calculateLineItemAmount(rc.monthlyRate, defaultDays, currentDays);
      items.push({
        id: `sg-main-${sr}`,
        srNo: sr++,
        description: rc.roleName,
        hsnCode: rc.hsnCode || '9985',
        rate: rc.monthlyRate,
        workingDays: defaultDays,
        persons: defaultPersons,
        amount: mainAmount,
      });

      items.push({
        id: `sg-ot-${sr}`,
        srNo: sr++,
        description: `Overtime in hours (${rc.roleName})`,
        hsnCode: rc.hsnCode || '9985',
        rate: 0,
        workingDays: 0,
        persons: 0,
        amount: 0,
      });
    });

    setLineItems(items);
  }, [selectedSiteId, sites, isEditLoaded, selectedMonth, selectedYear]);

  // Live item change handler
  const handleItemChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };

    if (field === 'rate' || field === 'workingDays' || field === 'persons') {
      const r = Number(field === 'rate' ? value : item.rate) || 0;
      const d = Number(field === 'workingDays' ? value : item.workingDays) || 0;
      const currentDays = getDaysInMonth(selectedMonth, selectedYear);
      item.amount = calculateLineItemAmount(r, d, currentDays);
    } else if (field === 'amount') {
      item.amount = Number(value) || 0;
    }

    updated[index] = item;
    setLineItems(updated);
  };

  // Computations
  const selectedSiteObj = sites.find((s) => s.id === selectedSiteId);
  const dynamicMgmtPercent = selectedSiteObj?.management_fee_percent ?? selectedSiteObj?.mgmtPercent ?? 5;
  const calc = computeInvoiceCalculations(
    lineItems,
    dynamicMgmtPercent,
    9,
    9,
    additionalCharges
  );

  const handleGenerateInvoice = async () => {
    if (!selectedSite) {
      toast.error('Please select a valid site location');
      return;
    }

    const currentCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

    // Derive values dynamically from selected company and selected site master
    const compName = currentCompany?.legal_name || currentCompany?.name || '';
    const partyName = selectedSite?.clientName || (selectedSite as any)?.client_name || selectedSite?.siteName || '';
    const partySite = selectedSite?.siteName || (selectedSite as any)?.site_name || '';

    const generatedInvoice: InvoiceData = {
      company: currentCompany
        ? {
            name: compName,
            addressLine1: currentCompany.address_line1 || '',
            addressLine2: currentCompany.address_line2 || `${currentCompany.city || ''} ${currentCompany.pincode || ''}`.trim(),
            contactNo: currentCompany.phone || currentCompany.contact_no || '',
            emailWebsite: currentCompany.email || currentCompany.email_website || '',
            cinNo: currentCompany.cin || currentCompany.cin_no || '',
            gstin: currentCompany.gstin || '',
          }
        : {
            name: '',
            addressLine1: '',
            addressLine2: '',
            contactNo: '',
            emailWebsite: '',
            cinNo: '',
            gstin: '',
          },
      meta: {
        invoiceNo,
        invoiceDate,
        billingPeriod,
      },
      party: {
        name: partyName,
        siteName: partySite,
        address: selectedSite.address || '',
        contactNo: selectedSite.contactNo || (selectedSite as any).contact_no || '',
        email: selectedSite.email || '',
        gstin: selectedSite.gstin || '',
        workOrderRefNo: selectedSite.workOrderRefNo || (selectedSite as any).work_order_ref || '',
        workOrderPeriod: selectedSite.workOrderPeriod || (selectedSite as any).work_order_period || '',
      },
      bank: currentCompany
        ? {
            bankName: currentCompany.bank_name || '',
            accountNo: currentCompany.bank_account_no || currentCompany.account_no || '',
            ifscCode: currentCompany.bank_ifsc || currentCompany.ifsc_code || '',
            branch: currentCompany.bank_branch || currentCompany.branch_name || '',
          }
        : {
            bankName: '',
            accountNo: '',
            ifscCode: '',
            branch: '',
          },
      items: lineItems,
      mgmtPercent: selectedSite?.mgmtPercent ?? (selectedSite as any)?.management_fee_percent ?? 5,
      additionalCharges,
      cgstPercent: 9,
      sgstPercent: 9,
      terms: Array.isArray(currentCompany?.terms_and_conditions || currentCompany?.default_terms)
        ? (currentCompany?.terms_and_conditions || currentCompany?.default_terms || []).join(' | ')
        : String(currentCompany?.terms_and_conditions || currentCompany?.default_terms || 'Payment can only be done in cheque/DD, NEFT, RTGS'),
    };

    setIsSubmitting(true);
    try {
      const isProforma = invoiceType === 'Proforma Invoice';
      
      // 2. Explicitly bind root-level keys so DB / Table Maps / PDF Viewer never fail
      const recordPayload = {
        company_id: currentCompany?.id,
        site_id: selectedSite?.id,
        companyId: currentCompany?.id,
        siteId: selectedSite?.id,
        
        // Ensure PDF top-left company rendering always has a target
        companyName: compName,
        company_name: compName,
        
        invoiceNo: generatedInvoice.meta.invoiceNo,
        invoice_no: generatedInvoice.meta.invoiceNo,
        date: generatedInvoice.meta.invoiceDate,
        invoice_date: generatedInvoice.meta.invoiceDate,
        monthYear: generatedInvoice.meta.billingPeriod,
        billing_period: generatedInvoice.meta.billingPeriod,
        
        // Fix for "NAME & ADD OF PARTY"
        clientName: partyName,
        client_name: partyName,
        siteName: partySite,
        site_name: partySite,
        
        line_items: lineItems,
        sub_total: calc.subTotal,
        tax_total: calc.cgstAmount + calc.sgstAmount,
        grand_total: calc.grandTotal,
        amount: calc.grandTotal,
        mgmt_percent: dynamicMgmtPercent,
        mgmtPercent: dynamicMgmtPercent,
        management_fee_percent: dynamicMgmtPercent,
        additional_charges: additionalCharges,
        additionalCharges,
        type: isProforma ? ('Proforma Invoice' as const) : ('Tax Invoice' as const),
        status: isProforma ? ('Draft' as const) : ('Pending' as const),
        itemsCount: generatedInvoice.items.length,
        payload: {
          ...generatedInvoice,
          company_id: currentCompany?.id,
          site_id: selectedSite?.id,
          mgmtPercent: dynamicMgmtPercent,
          additionalCharges,
          additional_charges: additionalCharges,
          company: {
            ...generatedInvoice.company,
            id: currentCompany?.id,
            code: currentCompany?.code,
          },
        },
      };

      const targetId = initialRecord?.id || editId;
      const res = targetId
        ? await updateInvoiceApi(targetId, recordPayload)
        : await createInvoiceApi(recordPayload);

      if (res.status === 201 || res.status === 200) {
        toast.success(targetId ? 'Invoice updated successfully' : 'Invoice created successfully');
        localStorage.setItem('asf_active_invoice', JSON.stringify(generatedInvoice));

        if (onSuccess) {
          await onSuccess(generatedInvoice, res.data);
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
      console.error('[SmartGeneratorForm] Save invoice error:', err);
      toast.error(`API Error: ${err.message || 'Failed to save invoice'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart Generator Header */}
      <div className="bg-[#34495E] text-white rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#20B2AA]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Smart Invoice Generator</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Select client site to auto-populate designation rate cards and paired overtime rows instantly.
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

      {/* Step Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Step 1: Select Company & Type */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
              <Building2 className="w-4 h-4 text-[#20B2AA]" />
              <span>1. Company &amp; Document Type</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Operating Entity</label>
              {isLoadingCompanies ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                  <span>Loading companies...</span>
                </div>
              ) : (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 truncate"
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Invoice Type</label>
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
        </div>

        {/* Step 2: Select Site Master */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
              <MapPin className="w-4 h-4 text-[#20B2AA]" />
              <span>2. Select Site Location</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Site Location *</label>
              {isLoadingSites ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#20B2AA]" />
                  <span>Loading site masters...</span>
                </div>
              ) : sites.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">No site masters found in database.</p>
              ) : (
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setIsEditLoaded(false);
                    setSelectedSiteId(e.target.value);
                  }}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 truncate"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏢 {s.codeName || s.code_name ? `[${s.codeName || s.code_name}] ` : ''}{s.siteName} ({s.clientName})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedSite && (
              <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 space-y-1 text-xs">
                <div className="font-semibold text-gray-900 truncate">{selectedSite.clientName}</div>
                <div className="text-[11px] text-gray-500 font-mono">GSTIN: {selectedSite.gstin || 'N/A'}</div>
                <div className="text-[11px] text-[#20B2AA] font-semibold">
                  {(selectedSite.rateCards || []).length} Rate Card Roles Configured
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Meta & Dates */}
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
              <Calendar className="w-4 h-4 text-[#20B2AA]" />
              <span>3. Billing Meta &amp; Period</span>
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 font-mono transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="text"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Select Month &amp; Year</label>
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedYear)}
                    className="bg-white border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx}>{m.slice(0, 3)}</option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded-lg px-1 py-1.5 text-xs text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Billing Period</label>
                <input
                  type="text"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 truncate"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Populated Line Items Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#20B2AA]" />
            <span>Auto-Populated Line Items ({lineItems.length} rows)</span>
          </h2>
          <span className="text-xs text-gray-500">
            Auto-linked from <strong className="text-[#20B2AA]">{selectedSite?.siteName || 'Selected Site'}</strong> Rate Cards
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center">Sr</th>
                <th className="py-3 px-3">Description of Services</th>
                <th className="py-3 px-3 text-center w-24">HSN Code</th>
                <th className="py-3 px-3 text-right w-28">Rate (₹)</th>
                <th className="py-3 px-3 text-right w-24">Working Days</th>
                <th className="py-3 px-3 text-right w-20">Persons</th>
                <th className="py-3 px-3 text-right w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 text-xs font-medium">
                    No rate cards configured for this site.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-center text-gray-500">{item.srNo}</td>
                    <td className="py-2.5 px-3 font-sans text-gray-900 font-semibold">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full bg-transparent border-b border-gray-200 text-gray-900 py-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 rounded px-1.5"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{item.hsnCode}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        value={item.rate === 0 ? '' : item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value === '' ? 0 : e.target.value)}
                        placeholder="0"
                        className="w-24 bg-white border border-gray-200 rounded px-2.5 py-1 text-right text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        value={item.workingDays === 0 ? '' : item.workingDays}
                        onChange={(e) => handleItemChange(idx, 'workingDays', e.target.value === '' ? 0 : e.target.value)}
                        placeholder="0"
                        className="w-20 bg-white border border-gray-200 rounded px-2.5 py-1 text-right text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        value={item.persons === 0 ? '' : item.persons}
                        onChange={(e) => handleItemChange(idx, 'persons', e.target.value === '' ? 0 : e.target.value)}
                        placeholder="0"
                        className="w-16 bg-white border border-gray-200 rounded px-2.5 py-1 text-right text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-teal-700 font-mono">
                      ₹{formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Calculation Summary Footer */}
        <div className="flex flex-col md:flex-row justify-between gap-6 mt-6 border-t border-gray-200 pt-6">
          {/* Left Side: Summary Info */}
          <div className="flex-1 bg-gray-50 p-5 rounded-lg border border-gray-200 flex flex-col justify-center">
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-gray-900 block mb-1">Amount in Words:</span>
              {calc.amountInWords}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 font-medium">
                Breakdown Notes: Management charges @ {dynamicMgmtPercent}% | CGST @ 9% | SGST @ 9%
              </p>
            </div>
          </div>

          {/* Right Side: Totals */}
          <div className="w-full md:w-[350px] bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Sub Total</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">₹{formatCurrency(calc.subTotal)}</span>
            </div>
            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Mgmt Charges @ {dynamicMgmtPercent}%</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">₹{formatCurrency(calc.mgmtChargesAmount)}</span>
            </div>
            <div className="space-y-1.5 py-1 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">Additional Charges</span>
                <button
                  type="button"
                  onClick={() => setAdditionalCharges([...additionalCharges, { name: '', amount: 0 }])}
                  className="text-[11px] text-teal-600 hover:text-teal-800 font-bold"
                >
                  + Add Charge
                </button>
              </div>
              {additionalCharges.map((ch, idx) => (
                <div key={idx} className="flex justify-between items-center gap-1.5 py-0.5">
                  <input
                    type="text"
                    value={ch.name}
                    onChange={(e) => {
                      const updated = [...additionalCharges];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setAdditionalCharges(updated);
                    }}
                    placeholder="Charge Name"
                    className="flex-1 bg-white border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-800 focus:outline-none focus:border-teal-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={ch.amount === 0 ? '' : ch.amount}
                    onChange={(e) => {
                      const updated = [...additionalCharges];
                      updated[idx] = { ...updated[idx], amount: e.target.value === '' ? 0 : Number(e.target.value) };
                      setAdditionalCharges(updated);
                    }}
                    placeholder="0"
                    className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-right text-gray-800 font-mono text-xs focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = additionalCharges.filter((_, i) => i !== idx);
                      setAdditionalCharges(updated);
                    }}
                    className="text-gray-400 hover:text-red-500 p-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center py-1 text-slate-600 border-b border-slate-100">
              <span className="font-medium">Tax (CGST 9% + SGST 9%)</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">
                ₹{formatCurrency(calc.cgstAmount + calc.sgstAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2.5 text-base font-bold text-teal-700 border-t border-slate-200">
              <span>Grand Total</span>
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
                <span>Generate Bill</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
