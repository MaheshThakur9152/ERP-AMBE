import React, { useState, useEffect } from 'react';
import { getApiUrl, fetchWithRetry } from '@/lib/apiClient';
import { InvoiceRecord } from '../types';
import { fetchInvoicesApi, deleteInvoiceApi, createInvoiceApi } from '../api/invoiceApi';
import { lockInvoiceApi } from '@/features/auth/api/authApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast, ToastContainer } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
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
  Paperclip,
  UploadCloud,
  FileCheck,
  GitMerge,
  FileCode,
  Lock,
  Unlock,
} from 'lucide-react';
import { formatCurrency, computeInvoiceCalculations } from '@/features/invoices/utils/invoiceCalculator';
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
  const comp = inv.companies;
  const site = inv.sites;

  const mgmtPercent = Number(
    inv.payload?.mgmtPercent ??
    (inv as any).mgmt_percent ??
    (inv as any).mgmtPercent ??
    (inv as any).management_fee_percent ??
    site?.management_fee_percent ??
    site?.mgmt_percent ??
    5
  );

  let machineryCharges = Number(
    inv.payload?.machineryCharges ||
    (inv as any).machinery_charges ||
    (inv as any).machineryCharges ||
    site?.default_machinery_charges ||
    site?.defaultMachineryCharges ||
    0
  );

  let materialCharges = Number(
    inv.payload?.materialCharges ||
    (inv as any).material_charges ||
    (inv as any).materialCharges ||
    site?.default_material_charges ||
    site?.defaultMaterialCharges ||
    0
  );

  const itemsList = inv.payload?.items || inv.line_items || [];
  const targetAmount = Number(inv.amount || (inv as any).grand_total || inv.payload?.meta?.amount || 0);

  if (machineryCharges === 0 && materialCharges === 0 && targetAmount > 0 && itemsList.length > 0) {
    const basicCalc = computeInvoiceCalculations(itemsList, mgmtPercent, 9, 9, 0, 0);
    const diff = targetAmount - basicCalc.grandTotal;
    if (diff > 5) {
      materialCharges = Math.round(diff / 1.18);
    }
  }

  const additionalCharges = inv.payload?.additionalCharges || inv.payload?.additional_charges || (inv as any).additionalCharges || (inv as any).additional_charges || (
    (machineryCharges > 0 || materialCharges > 0)
      ? [
          { name: 'Machinery Charges', amount: machineryCharges },
          { name: 'Material Charges', amount: materialCharges },
        ].filter(c => c.amount > 0)
      : []
  );

  if (inv.payload && inv.payload.company && inv.payload.company.name) {
    const resPayload = {
      ...inv.payload,
      party: {
        ...inv.payload.party,
        contactNo: inv.payload.party?.contactNo || site?.contact_no || (site as any)?.contactNo || (site as any)?.contact_phone || (site as any)?.phone || '',
        email: inv.payload.party?.email || site?.email || (site as any)?.email_address || '',
      },
      isMaterial: inv.is_material || inv.payload?.isMaterial || false,
      mgmtPercent,
      additionalCharges,
      machineryCharges: inv.payload.machineryCharges ?? (inv as any).machinery_charges ?? (inv as any).machineryCharges ?? machineryCharges,
      materialCharges: inv.payload.materialCharges ?? (inv as any).material_charges ?? (inv as any).materialCharges ?? materialCharges,
      delivery: inv.payload?.delivery || {},
    };
    console.log('🟣 STEP 6 - Final InvoiceData.additionalCharges:', resPayload.additionalCharges);
    return resPayload;
  }
  const saved = localStorage.getItem('asf_active_invoice');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.meta?.invoiceNo === inv.invoiceNo && parsed.company?.name) {
        const resParsed = {
          ...parsed,
          isMaterial: inv.is_material || parsed.isMaterial || false,
          mgmtPercent: Number(parsed.mgmtPercent ?? mgmtPercent),
          additionalCharges: parsed.additionalCharges || additionalCharges,
          machineryCharges: Number(parsed.machineryCharges ?? machineryCharges),
          materialCharges: Number(parsed.materialCharges ?? materialCharges),
          delivery: parsed.delivery || {},
        };
        console.log('🟣 STEP 6 - Final InvoiceData.additionalCharges:', resParsed.additionalCharges);
        return resParsed;
      }
    } catch (e) {
      console.error(e);
    }
  }

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

  const finalResult = {
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
      contactNo: site?.contact_no || (site as any)?.contactNo || inv.payload?.party?.contactNo || '',
      email: site?.email || inv.payload?.party?.email || '',
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
    mgmtPercent: Number((inv as any).mgmt_percent ?? (inv as any).mgmtPercent ?? (inv as any).management_fee_percent ?? site?.management_fee_percent ?? site?.mgmt_percent ?? 5),
    additionalCharges,
    machineryCharges,
    materialCharges,
    cgstPercent: 9,
    sgstPercent: 9,
    terms: formattedTerms,
  };
  console.log('🟣 STEP 6 - Final InvoiceData.additionalCharges:', finalResult.additionalCharges);
  return finalResult;
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
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Multi-select bulk state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Preview Modal state
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<{ id?: string; fileName: string; title: string; url?: string } | null>(null);
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('color');

  // Stealth Print state
  const [stealthPrintData, setStealthPrintData] = useState<InvoiceData | null>(null);

  // Inline Edit / Create Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<InvoiceRecord | null>(null);

  // Inline Attachment Upload state
  const [selectedInvoiceForAttachment, setSelectedInvoiceForAttachment] = useState<InvoiceRecord | null>(null);
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState<string | null>(null);
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  // Master database reference state for Real Sites and Companies
  const [dbSites, setDbSites] = useState<Array<{ id: string; site_name: string; client_name?: string; code_name?: string; company_id?: string }>>([]);
  const [dbCompanies, setDbCompanies] = useState<Array<{ id: string; name: string; entity_code?: string; tax_prefix?: string; proforma_prefix?: string }>>([]);

  // Log Legacy Bill Modal State
  const [isLegacyModalOpen, setIsLegacyModalOpen] = useState(false);
  const [editingLegacyId, setEditingLegacyId] = useState<string | null>(null);
  const [legacyExistingDocUrl, setLegacyExistingDocUrl] = useState<string | null>(null);
  const [legacyInvoiceType, setLegacyInvoiceType] = useState<'Tax Invoice' | 'Proforma Invoice'>('Tax Invoice');
  const [legacyCompanyId, setLegacyCompanyId] = useState<string>('');
  const [legacyEntity, setLegacyEntity] = useState<'Ambe' | 'ASF'>('Ambe');
  const [legacySiteId, setLegacySiteId] = useState<string>('');
  const [legacySiteName, setLegacySiteName] = useState<string>('');
  const [legacyMonth, setLegacyMonth] = useState<string>('June');
  const [legacyYear, setLegacyYear] = useState<string>('2026');
  const [legacyBillNumber, setLegacyBillNumber] = useState<string>('');
  const [legacyAmount, setLegacyAmount] = useState<string>('');
  const [legacyFile, setLegacyFile] = useState<File | null>(null);
  const [isSubmittingLegacy, setIsSubmittingLegacy] = useState(false);
  const [isLegacyDragging, setIsLegacyDragging] = useState(false);
  const legacyFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLegacyDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegacyDragging(true);
  };

  const handleLegacyDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegacyDragging(false);
  };

  const handleLegacyDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLegacyDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validExts = /\.(pdf|png|jpe?g|webp)$/i;
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

      if (validTypes.includes(file.type) || validExts.test(file.name)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error('File size exceeds 10MB limit');
          return;
        }
        setLegacyFile(file);
      } else {
        toast.error('Please upload a PDF, PNG, or JPG document');
      }
    }
  };

  const selectedCompany = dbCompanies.find((c) => c.id === legacyCompanyId) || dbCompanies[0];
  const currentPrefix = legacyInvoiceType === 'Proforma Invoice'
    ? (selectedCompany?.proforma_prefix || (selectedCompany?.entity_code === 'ASF' || selectedCompany?.name?.includes('ASF') ? 'ASF/P/26-27/' : 'AS/P/26-27/'))
    : (selectedCompany?.tax_prefix || (selectedCompany?.entity_code === 'ASF' || selectedCompany?.name?.includes('ASF') ? 'ASF/26-27/' : 'AS/26-27/'));

  const handleAttachmentClick = (inv: InvoiceRecord) => {
    setSelectedInvoiceForAttachment(inv);
    setTimeout(() => {
      attachmentInputRef.current?.click();
    }, 50);
  };

  const handleAttachmentFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInvoiceForAttachment) return;

    const inv = selectedInvoiceForAttachment;
    setUploadingAttachmentId(inv.id);

    try {
      const entity = inv.companies?.name?.includes('ASF') ? 'ASF' : (inv.companies?.name ? inv.companies.name.replace(/[^a-zA-Z0-9]/g, '') : 'Ambe');
      const type = inv.type === 'Proforma Invoice' ? 'ProformaInvoice' : 'TaxInvoice';
      const siteRaw = inv.sites?.site_name || inv.siteName || (inv as any).site_name || 'Site';
      const cleanSite = siteRaw.replace(/[^a-zA-Z0-9]/g, '');
      const rawPeriod = inv.monthYear || inv.billing_period || (inv as any).month_year || 'June2026';
      const monthYear = rawPeriod.replace(/\s+/g, '');
      const billNo = inv.invoiceNo || inv.id;
      const ext = file.name.split('.').pop() || 'pdf';

      const generatedName = `${entity}_${type}_${cleanSite}_${monthYear}_Bill-${billNo}.${ext}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', generatedName);
      formData.append('invoiceId', inv.id);

      const response = await fetchWithRetry('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errJson.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      const docUrl = result.view_url || result.webViewLink || result.gcp_file_url || result.certified_doc_url;

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id
            ? { ...item, certified_doc_url: docUrl, certifiedDocUrl: docUrl, certified_doc_view_url: docUrl }
            : item
        )
      );

      // Refresh table data
      await loadInvoicesFromApi();
      toast.success('Certified attachment uploaded & linked successfully!');
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingAttachmentId(null);
      setSelectedInvoiceForAttachment(null);
      e.target.value = '';
    }
  };

  const handleOpenLegacyCreate = () => {
    setEditingLegacyId(null);
    setLegacyExistingDocUrl(null);
    setLegacyInvoiceType('Tax Invoice');
    setLegacyCompanyId(dbCompanies[0]?.id || '');
    setLegacyEntity(dbCompanies[0]?.entity_code === 'ASF' || dbCompanies[0]?.name?.includes('ASF') ? 'ASF' : 'Ambe');
    setLegacySiteId('');
    setLegacySiteName('');
    setLegacyMonth('June');
    setLegacyYear('2026');
    setLegacyBillNumber('');
    setLegacyAmount('');
    setLegacyFile(null);
    if (legacyFileInputRef.current) legacyFileInputRef.current.value = '';
    setIsLegacyModalOpen(true);
  };

  const handleOpenLegacyEdit = (inv: InvoiceRecord) => {
    setEditingLegacyId(inv.id);
    setLegacyInvoiceType(inv.type === 'Proforma Invoice' ? 'Proforma Invoice' : 'Tax Invoice');
    const compId = inv.company_id || inv.companyId || dbCompanies.find((c) => c.name === inv.companies?.name)?.id || dbCompanies[0]?.id || '';
    setLegacyCompanyId(compId);
    const comp = dbCompanies.find((c) => c.id === compId);
    setLegacyEntity(comp?.entity_code === 'ASF' || comp?.name?.includes('ASF') || inv.companies?.name?.includes('ASF') ? 'ASF' : 'Ambe');
    setLegacySiteId(inv.site_id || inv.siteId || '');
    setLegacySiteName(inv.siteName || inv.sites?.site_name || '');

    const rawPeriod = inv.billing_period || inv.monthYear || 'June 2026';
    const parts = rawPeriod.trim().split(/\s+/);
    if (parts.length >= 2) {
      setLegacyMonth(parts[0]);
      setLegacyYear(parts[1]);
    } else {
      setLegacyMonth('June');
      setLegacyYear('2026');
    }

    const pfx = inv.type === 'Proforma Invoice'
      ? (comp?.proforma_prefix || (comp?.entity_code === 'ASF' || comp?.name?.includes('ASF') ? 'ASF/P/26-27/' : 'AS/P/26-27/'))
      : (comp?.tax_prefix || (comp?.entity_code === 'ASF' || comp?.name?.includes('ASF') ? 'ASF/26-27/' : 'AS/26-27/'));
    const rawNum = inv.invoiceNo.startsWith(pfx) ? inv.invoiceNo.slice(pfx.length) : inv.invoiceNo;
    setLegacyBillNumber(rawNum);
    setLegacyAmount(String(inv.grand_total || inv.amount || ''));
    setLegacyFile(null);
    setLegacyExistingDocUrl(inv.certified_doc_view_url || inv.certified_doc_url || inv.certifiedDocUrl || (inv as any).view_url || null);
    if (legacyFileInputRef.current) legacyFileInputRef.current.value = '';
    setIsLegacyModalOpen(true);
  };

  const handleSaveLegacyBill = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingLegacyId && !legacyFile) {
      toast.error('Please select a document file (PDF, PNG, JPG) to upload');
      return;
    }
    if (!legacySiteName && !legacySiteId) {
      toast.error('Please select a site');
      return;
    }
    if (!legacyBillNumber.trim()) {
      toast.error('Please enter the bill sequence number');
      return;
    }
    if (!legacyAmount || isNaN(Number(legacyAmount)) || Number(legacyAmount) <= 0) {
      toast.error('Please enter a valid bill amount');
      return;
    }

    setIsSubmittingLegacy(true);

    try {
      const fullInvoiceNo = legacyBillNumber.trim().startsWith(currentPrefix)
        ? legacyBillNumber.trim()
        : `${currentPrefix}${legacyBillNumber.trim()}`;

      const formData = new FormData();
      if (legacyFile) formData.append('file', legacyFile);
      formData.append('invoiceType', legacyInvoiceType);
      if (legacyCompanyId) formData.append('entityId', legacyCompanyId);
      formData.append('entity', legacyEntity);
      if (legacySiteId) formData.append('siteId', legacySiteId);
      formData.append('siteName', legacySiteName);
      formData.append('month', legacyMonth);
      formData.append('year', legacyYear);
      formData.append('amount', String(legacyAmount));
      formData.append('billNumber', fullInvoiceNo);

      const endpoint = editingLegacyId ? `/api/invoices/legacy/${editingLegacyId}` : '/api/invoices/legacy';
      const method = editingLegacyId ? 'PUT' : 'POST';

      const res = await fetchWithRetry(endpoint, {
        method,
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Save failed (HTTP ${res.status})`);
      }

      const resData = await res.json();
      const updatedNo = resData.data?.invoice_no || fullInvoiceNo || 'Record';
      toast.success(editingLegacyId ? `Legacy Bill #${updatedNo} updated successfully!` : `Legacy Bill #${updatedNo} logged and uploaded successfully!`);

      // UI Cleanup
      setIsLegacyModalOpen(false);
      setEditingLegacyId(null);
      setLegacyExistingDocUrl(null);
      setLegacyBillNumber('');
      setLegacyAmount('');
      setLegacyFile(null);
      if (legacyFileInputRef.current) {
        legacyFileInputRef.current.value = '';
      }

      // Reload Invoices Table
      await loadInvoicesFromApi();
    } catch (err: any) {
      console.error('Save legacy bill error:', err);
      toast.error(err.message || 'Failed to save legacy bill');
    } finally {
      setIsSubmittingLegacy(false);
    }
  };

  // Load master sites and companies from real database
  const loadMasterData = async () => {
    try {
      const [sitesRes, compRes] = await Promise.all([
        supabase.from('sites').select('id, site_name, client_name, code_name, company_id').order('site_name'),
        supabase.from('companies').select('id, name, entity_code, tax_prefix, proforma_prefix').order('name'),
      ]);
      if (sitesRes.data && sitesRes.data.length > 0) {
        setDbSites(sitesRes.data);
      }
      if (compRes.data && compRes.data.length > 0) {
        setDbCompanies(compRes.data);
        setLegacyCompanyId((prev) => prev || compRes.data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load master sites/companies:', err);
    }
  };

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
    loadMasterData();
  }, []);

  const siteList = Array.from(
    new Set([
      ...dbSites.map((s) => s.site_name).filter(Boolean),
      ...invoices
        .map((inv) => inv.sites?.site_name || inv.siteName || (inv as any).site_name || inv.payload?.party?.siteName || '')
        .filter(Boolean),
    ])
  );

  const filteredInvoices = invoices.filter((inv) => {
    const isProforma = inv.type === 'Proforma Invoice';
    const isMaterial = inv.type === 'Material Invoice' || (inv as any).is_material === true;

    // 1. Tab filter check
    let matchesTab = true;
    if (activeTab === 'Material') matchesTab = isMaterial;
    else if (activeTab === 'Proforma') matchesTab = isProforma && !isMaterial;
    else if (activeTab === 'Tax') matchesTab = !isProforma && !isMaterial;

    if (!matchesTab) return false;

    // 2. Site filter check
    const siteName = inv.sites?.site_name || inv.siteName || (inv as any).site_name || inv.payload?.party?.siteName || '';
    const codeName = inv.sites?.code_name || inv.sites?.codeName || (inv as any).code_name || (inv as any).codeName || '';
    const matchesSite =
      filterSite === 'all' ||
      siteName.toLowerCase() === filterSite.toLowerCase() ||
      codeName.toLowerCase() === filterSite.toLowerCase();

    if (!matchesSite) return false;

    // 3. Status filter check
    const status = inv.status || 'Unpaid';
    const matchesStatus =
      filterStatus === 'all' || status.toLowerCase() === filterStatus.toLowerCase();

    if (!matchesStatus) return false;

    // 4. Month & Year filter check
    const rawPeriod = (inv.monthYear || inv.billing_period || (inv as any).month_year || inv.payload?.meta?.billingPeriod || (inv as any).date || (inv as any).created_at || '').toUpperCase();

    let matchesMonth = true;
    if (filterMonth !== 'all') {
      matchesMonth = rawPeriod.includes(filterMonth.toUpperCase());
    }

    let matchesYear = true;
    if (filterYear !== 'all') {
      matchesYear = rawPeriod.includes(String(filterYear));
    }

    return matchesMonth && matchesYear;
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

  const { isSuperAdmin } = useAuth();

  // Handle locking / unlocking invoices via RBAC backend API (SuperAdmin only)
  const handleToggleLock = async (inv: InvoiceRecord) => {
    if (!isSuperAdmin) {
      toast.error('Only SuperAdmin can lock or unlock invoices.');
      return;
    }
    const newStatus = !inv.is_locked;
    try {
      await lockInvoiceApi(inv.id, newStatus);
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, is_locked: newStatus } : i))
      );
      toast.success(`Invoice ${newStatus ? 'locked' : 'unlocked'} successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lock status');
    }
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

  // Action Handler: Create Revision for Proforma Invoice
  const handleCreateRevision = async (inv: InvoiceRecord) => {
    try {
      const data = convertRecordToInvoiceData(inv);
      // Generate revision number e.g. "AS/P/26-27/001-R1"
      let baseNo = inv.invoiceNo;
      let revNum = 1;
      const match = baseNo.match(/^(.*)-R(\d+)$/);
      if (match) {
        baseNo = match[1];
        revNum = Number(match[2]) + 1;
      }
      const newInvoiceNo = `${baseNo}-R${revNum}`;

      const updatedMeta = { ...data.meta, invoiceNo: newInvoiceNo };
      const updatedData = { ...data, meta: updatedMeta };

      const payload = {
        company_id: inv.company_id || inv.companyId,
        site_id: inv.site_id || inv.siteId,
        invoice_no: newInvoiceNo,
        type: 'Proforma Invoice' as const,
        status: 'Draft' as const,
        invoice_date: inv.invoice_date || inv.date,
        billing_period: inv.billing_period || inv.monthYear,
        line_items: inv.line_items || [],
        sub_total: inv.sub_total || 0,
        tax_total: inv.tax_total || 0,
        grand_total: inv.grand_total || inv.amount || 0,
        management_fee_percent: (inv as any).management_fee_percent ?? (inv as any).mgmt_percent ?? 0,
        mgmt_percent: (inv as any).management_fee_percent ?? (inv as any).mgmt_percent ?? 0,
        machinery_charges: (inv as any).machinery_charges || 0,
        material_charges: (inv as any).material_charges || 0,
        additional_charges: (inv as any).additional_charges || [],
        is_material: (inv as any).is_material || false,
        previous_version_id: inv.id,
        certified_doc_url: inv.certified_doc_url || null,
        certified_attendance_url: inv.certified_attendance_url || null,
      };

      // 1. Create cloned revision invoice
      await createInvoiceApi(payload as any);

      // 2. Mark previous proforma as "Revised" in Supabase
      const { error: updateErr } = await supabase
        .from('invoices')
        .update({ status: 'Revised' })
        .eq('id', inv.id);

      if (updateErr) {
        console.warn('Failed to update old proforma status to Revised:', updateErr.message);
      }

      toast.success(`Created revision ${newInvoiceNo}`);
      await loadInvoicesFromApi();
    } catch (err: any) {
      console.error('Create revision error:', err);
      toast.error(err.message || 'Failed to create revision');
    }
  };

  // Action Handler: Convert Proforma to Tax Invoice
  const handleConvertToTax = async (inv: InvoiceRecord) => {
    try {
      const data = convertRecordToInvoiceData(inv);
      // Fetch company to get tax prefix & sequence
      const compId = inv.company_id || inv.companyId;
      let taxSeq = 1;
      let taxPrefix = 'AS/26-27/';

      if (compId) {
        const { data: comp } = await supabase.from('companies').select('tax_prefix, tax_sequence').eq('id', compId).maybeSingle();
        if (comp) {
          taxPrefix = comp.tax_prefix || 'AS/26-27/';
          taxSeq = comp.tax_sequence ?? 1;
        }
      }

      const formattedSeq = String(taxSeq).padStart(3, '0');
      const newTaxInvoiceNo = `${taxPrefix}${formattedSeq}`;

      const now = new Date().toISOString().split('T')[0];
      const payload = {
        company_id: inv.company_id || inv.companyId,
        site_id: inv.site_id || inv.siteId,
        invoice_no: newTaxInvoiceNo,
        type: 'Tax Invoice' as const,
        status: 'Pending' as const,
        invoice_date: now,
        billing_period: inv.billing_period || inv.monthYear,
        line_items: inv.line_items || [],
        sub_total: inv.sub_total || 0,
        tax_total: inv.tax_total || 0,
        grand_total: inv.grand_total || inv.amount || 0,
        management_fee_percent: (inv as any).management_fee_percent ?? (inv as any).mgmt_percent ?? 0,
        mgmt_percent: (inv as any).management_fee_percent ?? (inv as any).mgmt_percent ?? 0,
        machinery_charges: (inv as any).machinery_charges || 0,
        material_charges: (inv as any).material_charges || 0,
        additional_charges: (inv as any).additional_charges || [],
        is_material: (inv as any).is_material || false,
        previous_version_id: inv.id,
        certified_doc_url: inv.certified_doc_url || null,
        certified_attendance_url: inv.certified_attendance_url || null,
      };

      // 1. Create Tax Invoice record
      await createInvoiceApi(payload as any);

      // 2. Mark old Proforma status as "Approved"
      await supabase.from('invoices').update({ status: 'Approved' }).eq('id', inv.id);

      // 3. Increment company tax_sequence in database
      if (compId) {
        await supabase.from('companies').update({ tax_sequence: taxSeq + 1 }).eq('id', compId);
      }

      toast.success(`Converted to Tax Invoice ${newTaxInvoiceNo}`);
      setActiveTab('Tax');
      await loadInvoicesFromApi();
    } catch (err: any) {
      console.error('Convert to tax error:', err);
      toast.error(err.message || 'Failed to convert to Tax Invoice');
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
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-[#20B2AA]/20 font-medium"
            >
              <option value="all">All Years</option>
              {[2024, 2025, 2026, 2027, 2028].map((year) => (
                <option key={year} value={String(year)}>
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

            {/* + Log Legacy Bill Button */}
            <button
              type="button"
              onClick={handleOpenLegacyCreate}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={15} /> <span>+ Log Legacy Bill</span>
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

        {/* Hidden File Input for Certified Invoice Attachment */}
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleAttachmentFileSelected}
        />

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
                  const codeName =
                    inv.sites?.code_name ||
                    inv.sites?.codeName ||
                    (inv as any).code_name ||
                    (inv as any).codeName ||
                    '';
                  const siteDisplayName =
                    inv.sites?.site_name ||
                    inv.siteName ||
                    (inv as any).site_name ||
                    inv.payload?.party?.siteName ||
                    '';
                  const clientDisplayName =
                    inv.sites?.client_name ||
                    inv.clientName ||
                    (inv as any).client_name ||
                    inv.payload?.party?.name ||
                    '';

                  const displayTitle = codeName
                    ? codeName
                    : (siteDisplayName || clientDisplayName);
                  const subTitle = codeName ? (siteDisplayName || clientDisplayName) : '';

                  const rawPeriod =
                    inv.monthYear ||
                    inv.billing_period ||
                    (inv as any).month_year ||
                    inv.payload?.meta?.billingPeriod ||
                    '';
                  const monthMatch = rawPeriod.match(
                    /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}/i
                  );
                  const displayMonthYear = monthMatch ? monthMatch[0].toUpperCase() : rawPeriod;
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
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span>{displayTitle}</span>
                          {subTitle && (
                            <span className="text-xs text-gray-500 font-normal border-l border-gray-300 pl-2">
                              {subTitle}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-mono">{inv.invoiceNo}</span>
                          {(inv.is_legacy || (inv as any).isLegacy) && (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-semibold px-1.5 py-0.5">
                              Legacy
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#20B2AA] font-semibold mt-0.5">{displayMonthYear}</div>
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
                        <div className="flex items-center justify-end gap-2 text-teal-600">
                          {/* Proforma Actions: Create Revision & Convert to Tax */}
                          {inv.type === 'Proforma Invoice' && !(inv.is_legacy || (inv as any).isLegacy) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCreateRevision(inv)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="Create Revision (Clone & Increment version)"
                              >
                                <GitMerge size={13} />
                                <span>Revision</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConvertToTax(inv)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="Convert Proforma to Tax Invoice"
                              >
                                <FileCheck size={13} />
                                <span>Convert</span>
                              </button>
                            </>
                          )}
                          {/* Certified Invoice Attachment UI (Paperclip vs Eye) */}
                          {inv.certified_doc_view_url || inv.certified_doc_url || inv.certifiedDocUrl || (inv as any).view_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingDoc({
                                  id: inv.id,
                                  url: inv.certified_doc_view_url || inv.certified_doc_url || inv.certifiedDocUrl || (inv as any).view_url,
                                  fileName: `${inv.invoiceNo}_Certified.pdf`,
                                  title: `Invoice ${inv.invoiceNo} - Certified Attachment`,
                                })
                              }
                              className="text-teal-600 hover:text-teal-800 transition-colors p-1 cursor-pointer"
                              title="View Certified Invoice Attachment"
                            >
                              <Eye size={17} />
                            </button>
                          ) : uploadingAttachmentId === inv.id ? (
                            <span className="p-1" title="Uploading Attachment...">
                              <Loader2 size={17} className="animate-spin text-teal-600" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAttachmentClick(inv)}
                              className="text-gray-400 hover:text-teal-600 transition-colors p-1"
                              title="Upload Certified Invoice Attachment"
                            >
                              <Paperclip size={17} />
                            </button>
                          )}

                          {!(inv.is_legacy || (inv as any).isLegacy) && (
                            <>
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
                            </>
                          )}
                          {/* Lock / Unlock Toggle Button for SuperAdmin or Indicator */}
                          {isSuperAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleToggleLock(inv)}
                              className={`p-1 transition-colors ${
                                inv.is_locked ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-teal-600'
                              }`}
                              title={inv.is_locked ? 'Unlock Invoice (SuperAdmin)' : 'Lock Invoice (SuperAdmin)'}
                            >
                              {inv.is_locked ? <Lock size={17} /> : <Unlock size={17} />}
                            </button>
                          ) : inv.is_locked ? (
                            <span className="p-1 text-red-400" title="Locked by SuperAdmin">
                              <Lock size={17} />
                            </span>
                          ) : null}

                          {(inv.is_legacy || (inv as any).isLegacy) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenLegacyEdit(inv)}
                              className="text-gray-400 hover:text-teal-800 transition-colors p-1"
                              title="Edit Legacy Historical Bill"
                            >
                              <Edit2 size={17} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={inv.is_locked && !isSuperAdmin}
                              onClick={() => handleEdit(inv)}
                              className={`p-1 transition-colors ${
                                inv.is_locked && !isSuperAdmin
                                  ? 'opacity-30 cursor-not-allowed text-gray-300'
                                  : 'hover:text-teal-800'
                              }`}
                              title={inv.is_locked && !isSuperAdmin ? 'Invoice is locked by SuperAdmin' : 'Edit Invoice'}
                            >
                              <Edit2 size={17} />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={inv.is_locked && !isSuperAdmin}
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className={`p-1 transition-colors ${
                              inv.is_locked && !isSuperAdmin
                                ? 'opacity-30 cursor-not-allowed text-gray-300'
                                : 'text-gray-400 hover:text-red-600'
                            }`}
                            title={inv.is_locked && !isSuperAdmin ? 'Invoice is locked by SuperAdmin' : 'Delete Invoice'}
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

      {/* Log Legacy Bill Modal */}
      {isLegacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#34495E] px-6 py-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                {editingLegacyId ? <Edit2 className="w-5 h-5 text-[#20B2AA]" /> : <Plus className="w-5 h-5 text-[#20B2AA]" />}
                <span>{editingLegacyId ? 'Edit Legacy Historical Bill' : 'Log Legacy Historical Bill'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLegacyModalOpen(false)}
                className="text-gray-300 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLegacyBill} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Invoice Type *</label>
                  <select
                    value={legacyInvoiceType}
                    onChange={(e) => setLegacyInvoiceType(e.target.value as any)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold"
                  >
                    <option value="Tax Invoice">Tax Invoice</option>
                    <option value="Proforma Invoice">Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Entity *</label>
                  <select
                    value={legacyCompanyId}
                    onChange={(e) => {
                      setLegacyCompanyId(e.target.value);
                      const comp = dbCompanies.find((c) => c.id === e.target.value);
                      if (comp) {
                        setLegacyEntity(comp.entity_code === 'ASF' || comp.name.includes('ASF') ? 'ASF' : 'Ambe');
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold"
                  >
                    {dbCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.entity_code ? `(${c.entity_code})` : ''}
                      </option>
                    ))}
                    {dbCompanies.length === 0 && (
                      <>
                        <option value="Ambe">Ambe</option>
                        <option value="ASF">ASF</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Site Name *</label>
                  <select
                    value={legacySiteId}
                    onChange={(e) => {
                      const siteId = e.target.value;
                      setLegacySiteId(siteId);
                      const st = dbSites.find((s) => s.id === siteId);
                      if (st) {
                        setLegacySiteName(st.site_name);
                        if (st.company_id) {
                          setLegacyCompanyId(st.company_id);
                          const comp = dbCompanies.find((c) => c.id === st.company_id);
                          if (comp) {
                            setLegacyEntity(comp.entity_code === 'ASF' || comp.name.includes('ASF') ? 'ASF' : 'Ambe');
                          }
                        }
                      }
                    }}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold"
                    required
                  >
                    <option value="">Select a Site</option>
                    {dbSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code_name || s.site_name}
                      </option>
                    ))}
                    {dbSites.length === 0 &&
                      siteList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Month &amp; Year *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={legacyMonth}
                      onChange={(e) => setLegacyMonth(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-800 font-semibold"
                      required
                    >
                      {[
                        'January',
                        'February',
                        'March',
                        'April',
                        'May',
                        'June',
                        'July',
                        'August',
                        'September',
                        'October',
                        'November',
                        'December',
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={legacyYear}
                      onChange={(e) => setLegacyYear(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-800 font-semibold"
                      required
                    >
                      {['2027', '2026', '2025', '2024', '2023', '2022'].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Bill Number *</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#20B2AA]/30 focus-within:border-[#20B2AA]">
                    <span className="bg-slate-100 px-2.5 py-2 text-xs font-mono font-bold text-slate-700 border-r border-gray-200 select-none flex items-center shrink-0">
                      {currentPrefix}
                    </span>
                    <input
                      type="text"
                      placeholder="052"
                      value={legacyBillNumber}
                      onChange={(e) => setLegacyBillNumber(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))}
                      className="w-full bg-white px-3 py-2 text-xs font-mono text-gray-800 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 45000"
                    value={legacyAmount}
                    onChange={(e) => setLegacyAmount(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800"
                    required
                  />
                </div>
              </div>

              {/* Dashed Drag & Drop File Upload Zone */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  {editingLegacyId ? 'Bill Document (Optional to replace)' : 'Upload Bill Document *'}
                </label>
                <div
                  onClick={() => legacyFileInputRef.current?.click()}
                  onDragOver={handleLegacyDragOver}
                  onDragEnter={handleLegacyDragOver}
                  onDragLeave={handleLegacyDragLeave}
                  onDrop={handleLegacyDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    isLegacyDragging
                      ? 'border-[#20B2AA] bg-teal-50/80 scale-[1.01] shadow-inner ring-2 ring-[#20B2AA]/20'
                      : legacyFile
                      ? 'border-green-400 bg-green-50/40 hover:bg-green-50/60'
                      : editingLegacyId && legacyExistingDocUrl
                      ? 'border-teal-300 bg-teal-50/30 hover:bg-teal-50/50'
                      : 'border-gray-300 bg-slate-50 hover:border-[#20B2AA] hover:bg-slate-100/60'
                  }`}
                >
                  <input
                    ref={legacyFileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setLegacyFile(e.target.files[0])}
                  />
                  {legacyFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileCheck className="w-6 h-6 text-green-600" />
                      <span className="font-bold text-gray-800 text-xs">{legacyFile.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {(legacyFile.size / 1024).toFixed(1)} KB • Click or drop new file to change
                      </span>
                    </div>
                  ) : editingLegacyId && legacyExistingDocUrl ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileCheck className="w-6 h-6 text-teal-600" />
                      <span className="text-xs font-bold text-teal-800">
                        Existing document attached
                      </span>
                      <span className="text-[10px] text-gray-500">
                        Click or drop new PDF/image to replace current file
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <UploadCloud className={`w-6 h-6 ${isLegacyDragging ? 'text-[#20B2AA] animate-bounce' : 'text-[#20B2AA]'}`} />
                      <span className="text-xs font-bold text-gray-700">
                        {isLegacyDragging ? 'Drop file here' : 'Drag & drop PDF/image or browse'}
                      </span>
                      <span className="text-[10px] text-gray-400">PDF, PNG, JPG (Max 10MB)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLegacyModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLegacy || (!editingLegacyId && !legacyFile)}
                  className="px-5 py-2 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingLegacy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingLegacyId ? 'Saving Changes...' : 'Uploading & Saving...'}</span>
                    </>
                  ) : (
                    <span>{editingLegacyId ? 'Update Legacy Bill' : 'Save & Upload'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        documentId={viewingDoc?.id}
        url={viewingDoc?.url}
        fileName={viewingDoc?.fileName}
        title={viewingDoc?.title}
      />
    </>
  );
};
