import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Download, Eye, Plus, Trash2, Pencil, Printer, X } from 'lucide-react';
import { fetchWithRetry } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { fetchInvoicesApi } from '@/features/invoice-hub/api/invoiceApi';
import { convertRecordToInvoiceData } from '@/features/invoice-hub/components/InvoiceHubTable';
import { InvoiceRecord } from '@/features/invoice-hub/types';
import { InvoiceData } from '@/features/invoices/types/invoice';
import { InvoiceTemplate } from '@/features/invoices/components/InvoiceTemplate';
import { MaterialInvoiceTemplate } from '@/features/invoices/components/MaterialInvoiceTemplate';

type Mode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'Cheque' | 'Cash' | 'Other';
const MODES: Mode[] = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other'];
const TDS_RATE = 0.02;

interface Payment {
  id: string;
  paid_date: string;
  amount: number;
  tds_amount: number;
  mode: Mode;
  ref_no: string | null;
  remark: string | null;
}

interface LedgerRow {
  id: string;
  invoice_no: string;
  type: string;
  status: string;
  invoice_date: string | null;
  billing_period: string | null;
  is_material: boolean;
  is_legacy: boolean;
  legacy_notes: string | null;
  cancelled_reason: string | null;
  sub_total: number;
  tax_total: number;
  grand_total: number;
  has_bill: boolean;
  has_generated: boolean;
  excluded: boolean;
  closed: boolean; // cancelled, revised, or proforma already converted
  payments: Payment[];
}

interface SiteInfo {
  id: string;
  client_name: string;
  site_name: string;
  work_order_ref: string | null;
  work_order_period: string | null;
  opening: number;
  opening_note: string | null;
}

interface SummaryRow {
  site_id: string;
  client_name: string;
  site_name: string;
  work_order_ref: string | null;
  bills: number;
  billed: number;
  received: number;
  tds: number;
  opening: number;
  outstanding: number;
}

const inr = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const isoDate = (d: string) => d.slice(0, 10);
const isProforma = (r: LedgerRow) => /proforma/i.test(r.type);

function totals(r: LedgerRow) {
  const paid = r.payments.reduce((s, p) => s + p.amount, 0);
  const tds = r.payments.reduce((s, p) => s + p.tds_amount, 0);
  const remaining = Math.round((r.grand_total - paid - tds) * 100) / 100;
  // Within ₹1 counts as settled: clients round off.
  const status = r.excluded ? 'Cancelled' : remaining <= 1 ? 'Paid' : paid + tds > 0 ? 'Partial' : 'Unpaid';
  return { paid, tds, remaining: r.excluded ? 0 : Math.max(remaining, 0), status };
}

async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetchWithRetry(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const STATUS_STYLE: Record<string, string> = {
  Paid: 'bg-green-50 text-green-700 border-green-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Unpaid: 'bg-red-50 text-red-700 border-red-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const LedgerPage: React.FC = () => {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payFor, setPayFor] = useState<{ row: LedgerRow; payment?: Payment } | null>(null);
  const [viewing, setViewing] = useState<{ id: string; type: string; url: string; fileName: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<InvoiceData | null>(null);
  const invoiceCache = useRef<InvoiceRecord[] | null>(null);

  const loadSummary = useCallback(() => {
    api<SummaryRow[]>('/api/ledger/summary').then(setSummary).catch((e) => toast.error(e.message));
  }, []);

  const loadSite = useCallback(() => {
    if (!siteId) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    api<{ site: SiteInfo; rows: LedgerRow[] }>(`/api/ledger/sites/${siteId}?${qs}`)
      .then((d) => {
        setSite(d.site);
        setRows(d.rows);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [siteId, from, to]);

  useEffect(loadSummary, [loadSummary]);
  useEffect(loadSite, [loadSite]);

  const bills = useMemo(() => rows.filter((r) => !isProforma(r)), [rows]);
  const proformas = useMemo(() => rows.filter(isProforma), [rows]);

  const sum = useMemo(() => {
    const active = bills.filter((r) => !r.excluded);
    const t = active.map(totals);
    return {
      billed: active.reduce((s, r) => s + r.grand_total, 0),
      received: t.reduce((s, x) => s + x.paid, 0),
      tds: t.reduce((s, x) => s + x.tds, 0),
      unpaid: t.reduce((s, x) => s + x.remaining, 0),
      proforma: proformas.filter((r) => !r.closed).reduce((s, r) => s + r.grand_total, 0),
    };
  }, [bills, proformas]);

  const openPreview = async (r: LedgerRow) => {
    if (!r.has_bill && !r.has_generated) {
      // App-made bill with no stored PDF: render the same template Invoice Hub uses.
      try {
        invoiceCache.current ??= await fetchInvoicesApi();
        const rec = invoiceCache.current.find((i) => i.id === r.id);
        if (!rec) throw new Error('Invoice not found');
        setTemplatePreview(convertRecordToInvoiceData(rec));
      } catch (e: any) {
        toast.error(e.message);
      }
      return;
    }
    const kind = r.has_bill ? 'bill' : 'generated';
    setViewing({
      id: r.id,
      type: kind === 'bill' ? 'certified' : 'generated',
      url: `/api/invoices/${r.id}/document/${kind}/view`,
      fileName: `${r.invoice_no}.pdf`,
      title: `Invoice ${r.invoice_no}`,
    });
  };

  const deletePayment = async (p: Payment) => {
    if (!window.confirm(`Delete payment of ₹${inr(p.amount)} on ${fmtDate(p.paid_date)}?`)) return;
    try {
      await api(`/api/ledger/payments/${p.id}`, 'DELETE');
      loadSite();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const editOpening = async () => {
    if (!site) return;
    const v = window.prompt('Previous year pending (₹)', String(site.opening));
    if (v === null || Number.isNaN(Number(v))) return;
    try {
      await api(`/api/ledger/sites/${site.id}/opening`, 'PUT', { amount: Number(v), note: site.opening_note });
      loadSite();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportXlsx = async () => {
    if (!site) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(site.site_name.slice(0, 31));
    ws.addRow(['AMBE SERVICE', '', `Work Order Ref No. : ${site.work_order_ref || ''}`, '', '', `Work Order Period : ${site.work_order_period || ''}`]);
    ws.addRow([`Client Name : ${site.client_name}`]);
    const head = ws.addRow(['Billing Period', 'Invoice No', 'Nature of Invoice', 'Invoice Date', 'Sub Total', 'GST', 'Amount', 'Paid/Unpaid', 'Mode of Payment', 'Paid Date', 'Paid amt', 'TDS AMT', 'Rem to Pay', 'Remark']);
    head.font = { bold: true };
    ws.addRow(['Previous Year pending =', '', '', '', '', '', site.opening]);
    for (const r of bills) {
      const t = totals(r);
      const last = r.payments[r.payments.length - 1];
      ws.addRow([
        r.billing_period || '', r.invoice_no, r.is_material ? 'Goods' : 'Hk', r.invoice_date ? new Date(r.invoice_date) : '',
        r.sub_total, r.tax_total, r.grand_total, t.status, last?.mode || '', last ? new Date(last.paid_date) : '',
        t.paid, t.tds, t.remaining, [r.cancelled_reason, ...r.payments.map((p) => p.remark)].filter(Boolean).join('; '),
      ]);
    }
    ws.addRow([]);
    ws.addRow(['', '', '', '', '', 'Unpaid', sum.unpaid + site.opening]);
    ws.addRow(['', '', '', '', '', 'Proforma', sum.proforma]);
    ws.addRow(['', '', '', '', '', 'Total', sum.unpaid + site.opening + sum.proforma]).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 16));
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf]));
    a.download = `Ledger_${site.client_name}_${site.site_name}.xlsx`.replace(/[^\w.-]+/g, '_');
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---------- Summary ("ALL" sheet) ----------
  if (!siteId) {
    const q = search.toLowerCase();
    const list = summary.filter((s) => `${s.client_name} ${s.site_name} ${s.work_order_ref || ''}`.toLowerCase().includes(q));
    const grand = list.reduce((s, r) => s + r.outstanding, 0);
    const exportSummary = async () => {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('ALL');
      ws.addRow(['Client', 'Site', 'WO Ref', 'Bills', 'Opening', 'Billed', 'Received', 'TDS', 'Outstanding']).font = { bold: true };
      list.forEach((s) => ws.addRow([s.client_name, s.site_name, s.work_order_ref || '', s.bills, s.opening, s.billed, s.received, s.tds, s.outstanding]));
      ws.addRow(['Total Outstanding', '', '', '', '', '', '', '', grand]).font = { bold: true };
      ws.columns.forEach((c) => (c.width = 18));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()]));
      a.download = `ALL_OUTSTANDING_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800">Outstanding Ledger</h1>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client / site / WO"
              className="border rounded-lg px-3 py-1.5 text-sm w-72"
            />
            <button onClick={exportSummary} className="px-3 py-1.5 bg-[#20B2AA] text-white rounded-lg text-sm font-semibold flex items-center gap-1">
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Client', 'Site', 'WO Ref', 'Bills', 'Opening', 'Billed', 'Received', 'TDS', 'Outstanding'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.site_id} onClick={() => setSiteId(s.site_id)} className="border-t hover:bg-teal-50 cursor-pointer">
                  <td className="px-3 py-2 font-medium">{s.client_name}</td>
                  <td className="px-3 py-2">{s.site_name}</td>
                  <td className="px-3 py-2 text-gray-500">{s.work_order_ref}</td>
                  <td className="px-3 py-2">{s.bills}</td>
                  <td className="px-3 py-2 text-right">{inr(s.opening)}</td>
                  <td className="px-3 py-2 text-right">{inr(s.billed)}</td>
                  <td className="px-3 py-2 text-right">{inr(s.received)}</td>
                  <td className="px-3 py-2 text-right">{inr(s.tds)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${s.outstanding > 1 ? 'text-red-600' : 'text-green-700'}`}>{inr(s.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr className="border-t">
                <td className="px-3 py-2" colSpan={8}>Total Outstanding</td>
                <td className="px-3 py-2 text-right text-red-600">{inr(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  // ---------- Site ledger ----------
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => { setSiteId(null); setSite(null); setRows([]); loadSummary(); }}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-1"
          >
            <ArrowLeft size={14} /> All clients
          </button>
          <h1 className="text-xl font-bold text-gray-800">{site?.client_name} — {site?.site_name}</h1>
          <p className="text-xs text-gray-500">
            Work Order Ref: {site?.work_order_ref || '—'} · Period: {site?.work_order_period || '—'}
          </p>
        </div>
        <div className="flex items-end gap-2 text-xs">
          <label className="flex flex-col">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1" /></label>
          <label className="flex flex-col">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1" /></label>
          <button onClick={exportXlsx} className="px-3 py-1.5 bg-[#20B2AA] text-white rounded-lg font-semibold flex items-center gap-1">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600 uppercase sticky top-0">
            <tr>
              {['', 'Billing Period', 'Invoice No', 'Nature', 'Invoice Date', 'Sub Total', 'GST', 'Amount', 'Status', 'Mode', 'Paid Date', 'Paid Amt', 'TDS', 'Rem to Pay', 'Remark', 'Bill', ''].map((h, i) => (
                <th key={i} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t bg-yellow-50/50">
              <td />
              <td className="px-2 py-2 font-semibold" colSpan={6}>Previous Year pending</td>
              <td className="px-2 py-2 text-right font-semibold">
                <button onClick={editOpening} className="hover:underline" title="Edit">{inr(site?.opening || 0)}</button>
              </td>
              <td colSpan={9} />
            </tr>
            {loading && (
              <tr><td colSpan={17} className="px-2 py-6 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && bills.map((r) => {
              const t = totals(r);
              const last = r.payments[r.payments.length - 1];
              const open = expanded.has(r.id);
              const toggle = () => setExpanded((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; });
              return (
                <React.Fragment key={r.id}>
                  <tr className={`border-t hover:bg-gray-50 ${r.excluded ? 'text-gray-400 line-through' : ''}`}>
                    <td className="px-2 py-2">
                      {r.payments.length > 1 && (
                        <button onClick={toggle}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.billing_period}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{r.invoice_no}{r.is_legacy && <span className="ml-1 text-[9px] text-gray-400 no-underline">(legacy)</span>}</td>
                    <td className="px-2 py-2">{r.is_material ? 'Goods' : 'Hk'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                    <td className="px-2 py-2 text-right">{inr(r.sub_total)}</td>
                    <td className="px-2 py-2 text-right">{inr(r.tax_total)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{inr(r.grand_total)}</td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold no-underline inline-block ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-2 py-2">{last?.mode}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{last && fmtDate(last.paid_date)}</td>
                    <td className="px-2 py-2 text-right">{t.paid ? inr(t.paid) : ''}</td>
                    <td className="px-2 py-2 text-right">{t.tds ? inr(t.tds) : ''}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${t.remaining > 1 ? 'text-red-600' : ''}`}>{t.remaining ? inr(t.remaining) : ''}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate" title={[r.cancelled_reason, r.legacy_notes, last?.remark].filter(Boolean).join(' · ')}>
                      {r.cancelled_reason || last?.remark || r.legacy_notes}
                    </td>
                    <td className="px-2 py-2">
                      {r.has_bill || r.has_generated || !r.is_legacy ? (
                        <button onClick={() => openPreview(r)} className="text-indigo-600 hover:text-indigo-800" title="Preview bill"><Eye size={15} /></button>
                      ) : (
                        <span className="text-gray-300" title="Legacy bill: no file uploaded">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {!r.excluded && t.remaining > 1 && (
                        <button onClick={() => setPayFor({ row: r })} className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[10px] font-semibold flex items-center gap-0.5">
                          <Plus size={11} /> Payment
                        </button>
                      )}
                      {r.payments.length === 1 && (
                        <span className="inline-flex gap-1 ml-1">
                          <button onClick={() => setPayFor({ row: r, payment: r.payments[0] })} title="Edit payment"><Pencil size={12} /></button>
                          <button onClick={() => deletePayment(r.payments[0])} title="Delete payment"><Trash2 size={12} className="text-red-500" /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && r.payments.map((p) => (
                    <tr key={p.id} className="bg-gray-50/70 text-gray-600">
                      <td colSpan={9} />
                      <td className="px-2 py-1">{p.mode}</td>
                      <td className="px-2 py-1">{fmtDate(p.paid_date)}</td>
                      <td className="px-2 py-1 text-right">{inr(p.amount)}</td>
                      <td className="px-2 py-1 text-right">{inr(p.tds_amount)}</td>
                      <td />
                      <td className="px-2 py-1 truncate">{[p.ref_no, p.remark].filter(Boolean).join(' · ')}</td>
                      <td />
                      <td className="px-2 py-1 whitespace-nowrap">
                        <button onClick={() => setPayFor({ row: r, payment: p })} className="mr-1"><Pencil size={12} /></button>
                        <button onClick={() => deletePayment(p)}><Trash2 size={12} className="text-red-500" /></button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold border-t-2">
            <tr>
              <td colSpan={7} className="px-2 py-2 text-right">Billed</td>
              <td className="px-2 py-2 text-right">{inr(sum.billed)}</td>
              <td colSpan={3} className="px-2 py-2 text-right">Received</td>
              <td className="px-2 py-2 text-right">{inr(sum.received)}</td>
              <td className="px-2 py-2 text-right">{inr(sum.tds)}</td>
              <td className="px-2 py-2 text-right text-red-600">{inr(sum.unpaid)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Proforma</h2>
          {proformas.length === 0 ? (
            <p className="text-xs text-gray-400">No proforma invoices.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-gray-500"><tr><th className="text-left">Prof No</th><th className="text-left">Period</th><th className="text-right">Amt</th><th /></tr></thead>
              <tbody>
                {proformas.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.invoice_no}</td>
                    <td>{r.billing_period}</td>
                    <td className="text-right">{inr(r.grand_total)}</td>
                    <td className="text-right">
                      {(r.has_bill || r.has_generated || !r.is_legacy) && <button onClick={() => openPreview(r)} className="text-indigo-600"><Eye size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white border rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between"><span>Previous year pending</span><span>{inr(site?.opening || 0)}</span></div>
          <div className="flex justify-between"><span>Unpaid</span><span className="text-red-600">{inr(sum.unpaid)}</span></div>
          <div className="flex justify-between"><span>Proforma</span><span>{inr(sum.proforma)}</span></div>
          <div className="flex justify-between font-bold border-t pt-1">
            <span>Total</span><span>{inr((site?.opening || 0) + sum.unpaid + sum.proforma)}</span>
          </div>
        </div>
      </div>

      {payFor && (
        <PaymentModal
          row={payFor.row}
          payment={payFor.payment}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); loadSite(); }}
        />
      )}

      <DocumentViewerModal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        documentId={viewing?.id}
        documentType={viewing?.type}
        url={viewing?.url}
        fileName={viewing?.fileName}
        title={viewing?.title}
      />

      {templatePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 print:p-0 print:bg-transparent" onClick={() => setTemplatePreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:rounded-none">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-sm font-semibold">Invoice {templatePreview.meta.invoiceNo}</span>
              <div className="flex gap-2">
                <button onClick={() => window.print()} title="Print"><Printer size={16} /></button>
                <button onClick={() => setTemplatePreview(null)} title="Close"><X size={18} /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-100 flex justify-center print:p-0 print:bg-white">
              {templatePreview.isMaterial ? <MaterialInvoiceTemplate data={templatePreview} /> : <InvoiceTemplate data={templatePreview} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentModal: React.FC<{ row: LedgerRow; payment?: Payment; onClose: () => void; onSaved: () => void }> = ({ row, payment, onClose, onSaved }) => {
  const t = totals(row);
  const tdsAlready = t.tds - (payment?.tds_amount || 0);
  const defaultTds = tdsAlready > 0 ? 0 : Math.round(row.sub_total * TDS_RATE);
  const [form, setForm] = useState({
    paid_date: payment ? isoDate(payment.paid_date) : new Date().toISOString().slice(0, 10),
    tds_amount: String(payment?.tds_amount ?? defaultTds),
    amount: String(payment?.amount ?? Math.max(t.remaining - defaultTds, 0)),
    mode: (payment?.mode || 'NEFT') as Mode,
    ref_no: payment?.ref_no || '',
    remark: payment?.remark || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount), tds_amount: Number(form.tds_amount) };
      if (payment) await api(`/api/ledger/payments/${payment.id}`, 'PATCH', body);
      else await api(`/api/ledger/invoices/${row.id}/payments`, 'POST', body);
      toast.success('Payment saved');
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = 'border rounded-lg px-2 py-1.5 w-full text-sm';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-5 w-full max-w-md space-y-3 text-sm">
        <h3 className="font-bold text-gray-800">{payment ? 'Edit' : 'Record'} payment — {row.invoice_no}</h3>
        <p className="text-xs text-gray-500">Amount ₹{inr(row.grand_total)} · Remaining ₹{inr(t.remaining)} · TDS 2% of sub total = ₹{inr(Math.round(row.sub_total * TDS_RATE))}</p>
        <div className="grid grid-cols-2 gap-3">
          <label>Paid date<input type="date" required value={form.paid_date} onChange={set('paid_date')} className={field} /></label>
          <label>Mode
            <select value={form.mode} onChange={set('mode')} className={field}>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label>Paid amount<input type="number" step="0.01" min="0" required value={form.amount} onChange={set('amount')} className={field} /></label>
          <label>TDS amount<input type="number" step="0.01" min="0" value={form.tds_amount} onChange={set('tds_amount')} className={field} /></label>
          <label className="col-span-2">UTR / Cheque no<input value={form.ref_no} onChange={set('ref_no')} className={field} /></label>
          <label className="col-span-2">Remark<input value={form.remark} onChange={set('remark')} className={field} /></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded-lg">Cancel</button>
          <button disabled={saving} className="px-3 py-1.5 bg-[#20B2AA] text-white rounded-lg font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};
