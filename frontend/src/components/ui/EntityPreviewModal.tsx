import React from 'react';
import {
  FileCode,
  Paperclip,
  X,
  Lock,
  Loader2,
  Building2,
  FileText,
  Calendar,
  CreditCard,
  UserCheck,
  Layers,
  MapPin,
  Users,
  CheckCircle,
} from 'lucide-react';
import { InvoiceTemplate } from '@/features/invoices/components/InvoiceTemplate';
import { MaterialInvoiceTemplate } from '@/features/invoices/components/MaterialInvoiceTemplate';
import { InvoiceData } from '@/features/invoices/types/invoice';

export interface EntityPreviewData {
  id: string;
  entityType: 'companies' | 'sites' | 'invoices' | 'invoice' | 'attendance_sheets' | 'payroll_records' | 'staff' | string;
  title: string;
  subtitle?: string;
  createdAt?: string;
  hoursOld?: number;
  is_locked?: boolean;
  uploadedDocUrl?: string | null;
  details?: Record<string, any>;
  mode?: 'software' | 'uploaded';
}

export interface EntityPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityData: EntityPreviewData | null;
  onLockConfirm?: (entity: EntityPreviewData) => void | Promise<void>;
  isLocking?: boolean;
  mode?: 'software' | 'uploaded';
}

const buildInvoiceData = (entityData: EntityPreviewData): InvoiceData => {
  if (entityData.details?.invoiceData) {
    return entityData.details.invoiceData;
  }

  const grandTotal = Number(entityData.details?.grand_total || entityData.details?.amount || 30975);
  const taxable = entityData.details?.taxable_amount || Math.round(grandTotal / 1.18);
  const isMaterial = Boolean(entityData.details?.is_material || entityData.details?.isMaterial);

  return {
    company: {
      name: entityData.details?.company_name || 'M/S. AMBE SERVICES & FACILITY MANAGEMENT',
      addressLine1: entityData.details?.company_address1 || 'Shop No. 5, Plot No. 42, Sector 11, CBD Belapur',
      addressLine2: entityData.details?.company_address2 || 'Navi Mumbai, Maharashtra 400614',
      contactNo: entityData.details?.company_phone || '+91 98200 00000',
      emailWebsite: entityData.details?.company_email || 'info@ambeservices.in',
      cinNo: entityData.details?.company_cin || 'U74999MH2018PTC305882',
      gstin: entityData.details?.company_gstin || '27AKEPT3788G1ZU',
    },
    party: {
      name: entityData.details?.client_name || 'M/S. AJMERA REALTY & INFRA INDIA LTD',
      siteName: entityData.details?.site_name || 'Ajmera Greenfinity',
      address: entityData.details?.address || 'Plot 42, Industrial Zone, Goregaon East, Mumbai',
      gstin: entityData.details?.gstin || '27AKEPT3788G1ZU',
      workOrderRefNo: entityData.details?.work_order_ref || 'WO-2026-992',
      workOrderPeriod: entityData.details?.work_order_period || 'July 2026',
    },
    meta: {
      invoiceNo: entityData.details?.invoice_no || entityData.title || 'AS/26-27/70074',
      invoiceDate: entityData.createdAt ? new Date(entityData.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      billingPeriod: entityData.details?.month_year || entityData.details?.billing_period || 'July 2026',
      invoiceType: entityData.details?.type || 'Tax Invoice',
    },
    bank: {
      bankName: entityData.details?.bank_name || 'ICICI BANK LTD',
      accountNo: entityData.details?.account_no || '001205012345',
      ifscCode: entityData.details?.ifsc_code || 'ICIC0000012',
      branch: entityData.details?.branch_name || 'CBD Belapur Branch',
    },
    items: entityData.details?.items || [
      {
        id: 'item-1',
        srNo: 1,
        description: 'Facility Management & Housekeeping Services',
        hsnCode: '9985',
        dutyHrs: '8 Hrs Shift',
        rate: taxable,
        workingDays: 31,
        persons: 1,
        amount: taxable,
      },
    ],
    isMaterial,
    mgmtPercent: entityData.details?.mgmt_percent || 5,
    additionalCharges: entityData.details?.additionalCharges || entityData.details?.additional_charges || entityData.details?.payload?.additionalCharges || entityData.details?.payload?.additional_charges || (
      (Number(entityData.details?.machinery_charges || 0) > 0 || Number(entityData.details?.material_charges || 0) > 0)
        ? [
            { name: 'Machinery Charges', amount: Number(entityData.details?.machinery_charges || 0) },
            { name: 'Material Charges', amount: Number(entityData.details?.material_charges || 0) },
          ].filter(c => c.amount > 0)
        : []
    ),
    cgstPercent: entityData.details?.cgst_percent || 9,
    sgstPercent: entityData.details?.sgst_percent || 9,
    terms: entityData.details?.terms || 'Payment can only be done in cheque/DD, NEFT, RTGS',
  };
};

export const EntityPreviewModal: React.FC<EntityPreviewModalProps> = ({
  isOpen,
  onClose,
  entityData,
  onLockConfirm,
  isLocking = false,
  mode: propMode,
}) => {
  if (!isOpen || !entityData) return null;

  const activeMode = propMode || entityData.mode || 'software';
  const type = entityData.entityType;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#20B2AA] text-white">
              {activeMode === 'software' ? <FileCode size={18} /> : <Paperclip size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  {activeMode === 'software' ? 'Software Generated Copy Preview' : 'Uploaded Physical Copy'}
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-500/30 text-teal-200 border border-teal-400/30 font-mono">
                  {type}
                </span>
                {entityData.is_locked ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-400/30">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono">
                    Unlocked ({entityData.hoursOld ?? 0}h old)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Review parameters before SuperAdmin immutability lock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Rich Component Body Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          {activeMode === 'software' ? (
            (() => {
              switch (type) {
                case 'invoices':
                case 'invoice': {
                  const invData = buildInvoiceData(entityData);
                  return (
                    <div className="flex justify-center bg-gray-100 p-2 print:p-0">
                      {invData.isMaterial ? (
                        <MaterialInvoiceTemplate data={invData} colorMode="color" />
                      ) : (
                        <InvoiceTemplate data={invData} colorMode="color" />
                      )}
                    </div>
                  );
                }

                case 'sites':
                  return (
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 font-mono flex items-center gap-1">
                            <Building2 size={13} />
                            SITE MASTER PROFILE
                          </span>
                          <h4 className="text-xl font-black text-gray-900 mt-1">{entityData.details?.site_name || entityData.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{entityData.subtitle}</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold font-mono">
                          {entityData.details?.status || 'Active Site'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px] font-mono font-bold">CLIENT PARTY</span>
                          <span className="font-bold text-gray-900 text-sm">{entityData.details?.client_name || 'M/S. AJMERA REALTY'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px] font-mono font-bold">GSTIN COMPLIANCE</span>
                          <span className="font-bold text-gray-800 font-mono text-sm">{entityData.details?.gstin || '27AKEPT3788G1ZU'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px] font-mono font-bold">WORK ORDER REF</span>
                          <span className="font-bold text-gray-800 font-mono text-sm">{entityData.details?.work_order_ref || 'WO-2026-992'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 col-span-2">
                          <span className="text-gray-400 block text-[10px] font-mono font-bold">LOCATION ADDRESS</span>
                          <span className="font-semibold text-gray-800">{entityData.details?.address || 'Plot 42, Industrial Zone, Goregaon East, Mumbai'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px] font-mono font-bold">ASSIGNED RATE CARDS</span>
                          <span className="font-bold text-teal-700 text-sm font-mono">{entityData.details?.rate_cards_count || 3} Active Cards</span>
                        </div>
                      </div>
                    </div>
                  );

                case 'companies':
                  return (
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 font-mono flex items-center gap-1">
                            <Building2 size={13} />
                            COMPANY ENTITY PROFILE
                          </span>
                          <h4 className="text-xl font-black text-gray-900 mt-1">{entityData.details?.company_name || entityData.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{entityData.subtitle}</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold font-mono">
                          Code: {entityData.details?.entity_code || 'COMP'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px]">GSTIN</span>
                          <span className="font-bold text-gray-900 text-sm">{entityData.details?.gstin || '27AKEPT3788G1ZU'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px]">CIN NUMBER</span>
                          <span className="font-bold text-gray-800 text-sm">{entityData.details?.cin || 'U74999MH2018PTC305882'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                          <span className="text-gray-400 block text-[10px]">TAX PREFIX</span>
                          <span className="font-bold text-teal-700 text-sm">{entityData.details?.tax_prefix || 'AS/26-27/'}</span>
                        </div>
                      </div>
                    </div>
                  );

                case 'attendance_sheets':
                  return (
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 font-mono flex items-center gap-1">
                            <Calendar size={13} />
                            CERTIFIED ATTENDANCE SHEET
                          </span>
                          <h4 className="text-xl font-black text-gray-900 mt-1">{entityData.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{entityData.subtitle}</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                          Certified
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                          <span className="text-blue-500 block text-[10px] font-bold">TOTAL STAFF</span>
                          <span className="font-black text-blue-900 text-lg">{entityData.details?.total_staff || 34}</span>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                          <span className="text-emerald-500 block text-[10px] font-bold">TOTAL SHIFTS</span>
                          <span className="font-black text-emerald-900 text-lg">{entityData.details?.total_shifts || 980}</span>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                          <span className="text-purple-500 block text-[10px] font-bold">PERIOD</span>
                          <span className="font-black text-purple-900 text-lg">{entityData.details?.month_year || 'July 2026'}</span>
                        </div>
                      </div>
                    </div>
                  );

                case 'payroll_records':
                  return (
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 font-mono flex items-center gap-1">
                            <CreditCard size={13} />
                            FACILITY PAYROLL BREAKDOWN
                          </span>
                          <h4 className="text-xl font-black text-gray-900 mt-1">{entityData.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{entityData.subtitle}</p>
                        </div>
                        <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold font-mono">
                          NEFT Generated
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                          <span className="text-purple-600 block text-[10px] font-bold">TOTAL PAYOUT</span>
                          <span className="font-black text-purple-900 text-xl">
                            ₹{entityData.details?.total_payout ? entityData.details.total_payout.toLocaleString() : '8,45,000'}
                          </span>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                          <span className="text-indigo-600 block text-[10px] font-bold">STAFF COUNT</span>
                          <span className="font-black text-indigo-900 text-xl">{entityData.details?.staff_count || 42}</span>
                        </div>
                        <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
                          <span className="text-teal-600 block text-[10px] font-bold">PERIOD</span>
                          <span className="font-black text-teal-900 text-xl">{entityData.details?.month_year || 'June 2026'}</span>
                        </div>
                      </div>
                    </div>
                  );

                default:
                  return (
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-3 text-xs font-mono">
                      <div className="font-bold text-gray-800 border-b pb-2">Record Reference: {entityData.title}</div>
                      {entityData.subtitle && <p className="text-gray-600">{entityData.subtitle}</p>}
                      {entityData.details && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {Object.entries(entityData.details).map(([k, v]) => (
                            <div key={k} className="p-2 bg-slate-50 rounded-lg">
                              <span className="text-gray-400 block text-[10px] uppercase">{k}</span>
                              <span className="font-bold text-gray-800">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
              }
            })()
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-3">
              <Paperclip size={36} className="text-purple-500 mx-auto" />
              <h5 className="font-bold text-gray-900 text-sm">Physical Uploaded Document Attachment</h5>
              {entityData.uploadedDocUrl ? (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <a
                    href={entityData.uploadedDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-700 font-mono font-bold underline break-all"
                  >
                    {entityData.uploadedDocUrl}
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  No physical document attachment linked to this database record.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky Pinned Modal Actions Footer */}
        <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Close Preview
          </button>

          {onLockConfirm && (
            <button
              type="button"
              disabled={isLocking || entityData.is_locked}
              onClick={() => onLockConfirm(entityData)}
              className="px-6 py-2.5 bg-[#20B2AA] hover:bg-[#1ca19a] active:bg-[#188e88] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isLocking ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Lock size={15} />
              )}
              <span>{entityData.is_locked ? 'Entity Locked' : 'Lock Record Now'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityPreviewModal;
