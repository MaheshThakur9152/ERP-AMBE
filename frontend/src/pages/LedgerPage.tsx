import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUpDown, Check, ChevronDown, ChevronRight, Download, Eye, FileSpreadsheet,
  Pencil, Plus, Printer, Search, Trash2, X,
} from 'lucide-react';
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
const SETTLE_TOLERANCE = 1; // keep in sync with backend ledgerService

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
  unpaid_bills: number;
  billed: number;
  received: number;
  tds: number;
  due: number;
  age_0_30: number;
  age_31_60: number;
  age_61_90: number;
  age_90_plus: number;
  oldest_days: number | null;
  last_paid: string | null;
  opening: number;
  outstanding: number;
}

type Status = 'Paid' | 'Partial' | 'Unpaid' | 'Cancelled';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Billing periods are free text ("January-26", "1st to 31st AUGUST 2026", "Novmber 2025"); pull out "Aug 2026".
const billMonth = (period: string | null): string | null => {
  const m = (period || '').match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,'-]*(\d{4}|\d{2}(?!\d))?/i);
  if (!m) return null;
  const mon = MONTHS.find((x) => x.toLowerCase() === m[1].toLowerCase());
  const yr = m[2] ? (m[2].length === 2 ? `20${m[2]}` : m[2]) : '';
  return `${mon} ${yr}`.trim();
};

const inr = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const inr2 = (n: number) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
const daysSince = (d: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);
const isProforma = (r: LedgerRow) => /proforma/i.test(r.type);

function totals(r: LedgerRow) {
  const paid = r.payments.reduce((s, p) => s + p.amount, 0);
  const tds = r.payments.reduce((s, p) => s + p.tds_amount, 0);
  const balance = Math.round((r.grand_total - paid - tds) * 100) / 100;
  const status: Status = r.excluded ? 'Cancelled' : balance <= SETTLE_TOLERANCE ? 'Paid' : paid + tds > 0 ? 'Partial' : 'Unpaid';
  return { paid, tds, balance: r.excluded || balance <= SETTLE_TOLERANCE ? 0 : balance, status };
}

async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetchWithRetry(url, {
    method,
    skipErrorToast: true,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function download(url: string, fallbackName: string) {
  const res = await fetchWithRetry(url, { timeoutMs: 120000, retries: 0, skipErrorToast: true });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Export failed (${res.status})`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const STATUS_STYLE: Record<Status, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Partial: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Unpaid: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Cancelled: 'bg-slate-100 text-slate-500 ring-slate-400/20',
};

const StatusPill: React.FC<{ s: Status }> = ({ s }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[s]}`}>{s}</span>
);

const AgeBadge: React.FC<{ days: number | null }> = ({ days }) => {
  if (days == null) return <span className="text-slate-300">—</span>;
  const tone = days > 90 ? 'text-rose-700 bg-rose-50' : days > 60 ? 'text-orange-700 bg-orange-50' : days > 30 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${tone}`}>{days}d</span>;
};

const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: 'red' | 'green' | 'default' }> = ({ label, value, sub, tone = 'default' }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`mt-1 text-xl font-bold tabular-nums ${tone === 'red' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

const AGING = [
  { key: 'age_0_30', label: '0–30 days', color: 'bg-teal-500' },
  { key: 'age_31_60', label: '31–60 days', color: 'bg-amber-400' },
  { key: 'age_61_90', label: '61–90 days', color: 'bg-orange-500' },
  { key: 'age_90_plus', label: '90+ days', color: 'bg-rose-600' },
] as const;

const btnPrimary = 'inline-flex items-center gap-1.5 px-3 py-2 bg-[#20B2AA] hover:bg-[#1a9d96] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors';
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors';

export const LedgerPage: React.FC = () => {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadSummary = useCallback(() => {
    api<SummaryRow[]>('/api/ledger/summary').then(setSummary).catch((e) => toast.error(e.message));
  }, []);
  useEffect(loadSummary, [loadSummary]);

  const exportUrl = async (url: string, name: string) => {
    setExporting(true);
    try {
      await download(url, name);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  return siteId ? (
    <SiteLedger
      siteId={siteId}
      exporting={exporting}
      onExport={exportUrl}
      onBack={() => { setSiteId(null); loadSummary(); }}
    />
  ) : (
    <Summary rows={summary} exporting={exporting} onExport={exportUrl} onOpen={setSiteId} />
  );
};

// ---------------------------------------------------------------- Summary ("ALL" sheet)

type SortKey = 'client_name' | 'billed' | 'received' | 'outstanding' | 'oldest_days';

const Summary: React.FC<{
  rows: SummaryRow[];
  exporting: boolean;
  onExport: (url: string, name: string) => void;
  onOpen: (siteId: string) => void;
}> = ({ rows, exporting, onExport, onOpen }) => {
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'outstanding', dir: -1 });

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((s) => `${s.client_name} ${s.site_name} ${s.work_order_ref || ''}`.toLowerCase().includes(q))
      .filter((s) => !hideEmpty || s.outstanding > SETTLE_TOLERANCE || s.bills > 0)
      .sort((a, b) => {
        const x = a[sort.key] ?? -1;
        const y = b[sort.key] ?? -1;
        return (typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number)) * sort.dir;
      });
  }, [rows, search, hideEmpty, sort]);

  const k = useMemo(() => {
    const s = (f: keyof SummaryRow) => list.reduce((t, r) => t + (r[f] as number), 0);
    const billed = s('billed');
    const collected = s('received') + s('tds');
    return {
      outstanding: s('outstanding'),
      billed,
      received: s('received'),
      tds: s('tds'),
      rate: billed ? Math.round((collected / billed) * 100) : 0,
      withDues: list.filter((r) => r.outstanding > SETTLE_TOLERANCE).length,
      aging: AGING.map((a) => ({ ...a, value: s(a.key) })),
    };
  }, [list]);
  const agingTotal = k.aging.reduce((t, a) => t + a.value, 0);

  const Th: React.FC<{ label: string; k?: SortKey; right?: boolean }> = ({ label, k: key, right }) => (
    <th className={`px-3 py-2.5 font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {key ? (
        <button
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}
          className={`inline-flex items-center gap-1 hover:text-slate-900 ${sort.key === key ? 'text-slate-900' : ''}`}
        >
          {label} <ArrowUpDown size={11} className="opacity-50" />
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outstanding Ledger</h1>
          <p className="text-sm text-slate-500">
            {k.withDues} of {list.length} sites with dues · as of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          disabled={exporting}
          onClick={() => onExport('/api/ledger/export', 'ALL_OUTSTANDING.xlsx')}
          className={btnPrimary}
          title="ALL sheet + one sheet per site"
        >
          <FileSpreadsheet size={16} /> {exporting ? 'Preparing…' : 'Export workbook'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total outstanding" value={`₹${inr(k.outstanding)}`} sub={`${k.withDues} sites`} tone="red" />
        <Stat label="Billed" value={`₹${inr(k.billed)}`} />
        <Stat label="Received" value={`₹${inr(k.received)}`} sub={`+ ₹${inr(k.tds)} TDS`} tone="green" />
        <Stat label="Collection rate" value={`${k.rate}%`} sub="received + TDS ÷ billed" />
      </div>

      {agingTotal > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Aging of unpaid bills</span>
            <span className="text-xs text-slate-500 tabular-nums">₹{inr(agingTotal)}</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
            {k.aging.map((a) => a.value > 0 && (
              <div key={a.key} className={a.color} style={{ width: `${(a.value / agingTotal) * 100}%` }} title={`${a.label}: ₹${inr(a.value)}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
            {k.aging.map((a) => (
              <span key={a.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`w-2 h-2 rounded-full ${a.color}`} /> {a.label}
                <span className="font-semibold tabular-nums text-slate-900">₹{inr(a.value)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, site or work order"
            className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/30 focus:border-[#20B2AA]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="accent-[#20B2AA]" />
          Hide sites with no bills
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide border-b border-slate-200">
            <tr>
              <Th label="Client / Site" k="client_name" />
              <Th label="Bills" right />
              <Th label="Billed" k="billed" right />
              <Th label="Received" k="received" right />
              <Th label="Collected" />
              <Th label="Oldest due" k="oldest_days" right />
              <Th label="Last payment" right />
              <Th label="Outstanding" k="outstanding" right />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((s) => {
              const pct = s.billed ? Math.min(100, Math.round(((s.received + s.tds) / s.billed) * 100)) : 0;
              return (
                <tr key={s.site_id} onClick={() => onOpen(s.site_id)} className="hover:bg-teal-50/50 cursor-pointer group">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900 group-hover:text-teal-700">{s.client_name}</div>
                    <div className="text-xs text-slate-500">
                      {s.site_name}{s.work_order_ref && <span className="text-slate-400"> · {s.work_order_ref}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {s.unpaid_bills > 0 ? <><span className="font-semibold text-rose-600">{s.unpaid_bills}</span> / </> : null}{s.bills}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{inr(s.billed)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{inr(s.received)}</td>
                  <td className="px-3 py-2.5 w-32">
                    {s.billed > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right"><AgeBadge days={s.oldest_days} /></td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">{fmtDate(s.last_paid) || '—'}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${s.outstanding > SETTLE_TOLERANCE ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {s.outstanding > SETTLE_TOLERANCE ? `₹${inr(s.outstanding)}` : <span className="inline-flex items-center gap-1"><Check size={14} /> Clear</span>}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">No sites match.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
            <tr>
              <td className="px-3 py-2.5">Total</td>
              <td />
              <td className="px-3 py-2.5 text-right tabular-nums">{inr(k.billed)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{inr(k.received)}</td>
              <td colSpan={3} />
              <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">₹{inr(k.outstanding)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Site ledger

const SiteLedger: React.FC<{
  siteId: string;
  exporting: boolean;
  onExport: (url: string, name: string) => void;
  onBack: () => void;
}> = ({ siteId, exporting, onExport, onBack }) => {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filter, setFilter] = useState<'All' | Status>('All');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payFor, setPayFor] = useState<{ row: LedgerRow; payment?: Payment } | null>(null);
  const [viewing, setViewing] = useState<{ id: string; type: string; url: string; fileName: string; title: string } | null>(null);
  const [templatePreview, setTemplatePreview] = useState<InvoiceData | null>(null);
  const [editingOpening, setEditingOpening] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const invoiceCache = useRef<InvoiceRecord[] | null>(null);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return q.toString();
  }, [from, to]);

  const load = useCallback(() => {
    setLoading(true);
    api<{ site: SiteInfo; rows: LedgerRow[] }>(`/api/ledger/sites/${siteId}?${qs}`)
      .then((d) => { setSite(d.site); setRows(d.rows); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [siteId, qs]);
  useEffect(load, [load]);

  const bills = useMemo(() => rows.filter((r) => !isProforma(r)), [rows]);
  const proformas = useMemo(() => rows.filter(isProforma), [rows]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: bills.length, Unpaid: 0, Partial: 0, Paid: 0, Cancelled: 0 };
    bills.forEach((r) => c[totals(r).status]++);
    return c;
  }, [bills]);
  const visible = useMemo(() => (filter === 'All' ? bills : bills.filter((r) => totals(r).status === filter)), [bills, filter]);

  const sum = useMemo(() => {
    const active = bills.filter((r) => !r.excluded);
    const t = active.map(totals);
    const unpaid = t.reduce((s, x) => s + x.balance, 0);
    const opening = site?.opening || 0;
    const proforma = proformas.filter((r) => !r.closed).reduce((s, r) => s + r.grand_total, 0);
    return {
      billed: active.reduce((s, r) => s + r.grand_total, 0),
      received: t.reduce((s, x) => s + x.paid, 0),
      tds: t.reduce((s, x) => s + x.tds, 0),
      unpaid,
      opening,
      proforma,
      outstanding: opening + unpaid,
      total: opening + unpaid + proforma,
    };
  }, [bills, proformas, site]);

  const canPreview = (r: LedgerRow) => r.has_bill || r.has_generated || !r.is_legacy;

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
      fileName: `${r.invoice_no.trim()}.pdf`,
      title: `Invoice ${r.invoice_no.trim()}`,
    });
  };

  const deletePayment = async (p: Payment) => {
    if (!window.confirm(`Delete payment of ₹${inr2(p.amount)} dated ${fmtDate(p.paid_date)}?`)) return;
    try {
      await api(`/api/ledger/payments/${p.id}`, 'DELETE');
      toast.success('Payment deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const saveOpening = async () => {
    if (!site || editingOpening === null) return;
    const amount = Number(editingOpening);
    if (Number.isNaN(amount)) return toast.error('Enter a valid amount');
    try {
      await api(`/api/ledger/sites/${site.id}/opening`, 'PUT', { amount, note: site.opening_note });
      setEditingOpening(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const td = 'px-3 py-2.5';

  return (
    <div className="p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mb-1.5">
            <ArrowLeft size={15} /> All clients
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{site?.client_name || '…'}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-0.5">
            <span>{site?.site_name}</span>
            {site?.work_order_ref && <span>WO <span className="font-medium text-slate-700">{site.work_order_ref}</span></span>}
            {site?.work_order_period && <span>Period {site.work_order_period}</span>}
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-slate-500">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700" />
          </label>
          <label className="text-xs text-slate-500">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700" />
          </label>
          {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className={btnGhost} title="Clear dates"><X size={14} /></button>}
          <button
            disabled={exporting || !site}
            onClick={() => onExport(`/api/ledger/sites/${siteId}/export?${qs}`, 'Ledger.xlsx')}
            className={btnPrimary}
          >
            <Download size={15} /> {exporting ? 'Preparing…' : 'Excel'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Outstanding" value={`₹${inr(sum.outstanding)}`} sub={sum.opening ? `incl. ₹${inr(sum.opening)} previous year` : `${counts.Unpaid + counts.Partial} bills due`} tone={sum.outstanding > SETTLE_TOLERANCE ? 'red' : 'green'} />
        <Stat label="Unpaid" value={`₹${inr(sum.unpaid)}`} sub={`${counts.Unpaid + counts.Partial} unpaid bills`} tone={sum.unpaid > SETTLE_TOLERANCE ? 'red' : 'green'} />
        <Stat label="Billed" value={`₹${inr(sum.billed)}`} sub={`${bills.length - counts.Cancelled} bills`} />
        <Stat label="Received" value={`₹${inr(sum.received)}`} tone="green" />
        <Stat label="TDS deducted" value={`₹${inr(sum.tds)}`} />
        <Stat label="Proforma pending" value={`₹${inr(sum.proforma)}`} sub={`Grand total ₹${inr(sum.total)}`} />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['All', 'Unpaid', 'Partial', 'Paid', 'Cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f} <span className={filter === f ? 'text-slate-300' : 'text-slate-400'}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th className="w-8" />
              <th className={`${td} text-left font-semibold`}>Invoice</th>
              <th className={`${td} text-left font-semibold`}>Month</th>
              <th className={`${td} text-left font-semibold`}>Date</th>
              <th className={`${td} text-right font-semibold`}>Sub total</th>
              <th className={`${td} text-right font-semibold`}>GST</th>
              <th className={`${td} text-right font-semibold`}>Amount</th>
              <th className={`${td} text-right font-semibold`}>Received</th>
              <th className={`${td} text-right font-semibold`}>Balance</th>
              <th className={`${td} text-left font-semibold`}>Status</th>
              <th className={`${td} text-left font-semibold`}>Last payment</th>
              <th className={`${td} text-right font-semibold`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-amber-50/60">
              <td />
              <td className={`${td} font-semibold text-slate-700`} colSpan={5}>Previous year pending</td>
              <td className={`${td} text-right tabular-nums font-semibold`}>
                {editingOpening !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      value={editingOpening}
                      onChange={(e) => setEditingOpening(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveOpening(); if (e.key === 'Escape') setEditingOpening(null); }}
                      className="w-28 border border-slate-300 rounded px-2 py-1 text-right text-sm"
                    />
                    <button onClick={saveOpening} className="text-emerald-600 p-1"><Check size={15} /></button>
                    <button onClick={() => setEditingOpening(null)} className="text-slate-400 p-1"><X size={15} /></button>
                  </span>
                ) : (
                  <button onClick={() => setEditingOpening(String(site?.opening || 0))} className="inline-flex items-center gap-1.5 hover:text-teal-700 group">
                    {inr2(site?.opening || 0)} <Pencil size={12} className="opacity-0 group-hover:opacity-100" />
                  </button>
                )}
              </td>
              <td colSpan={5} />
            </tr>

            {loading && <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!loading && !visible.length && <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-400">No bills.</td></tr>}

            {!loading && visible.map((r) => {
              const t = totals(r);
              const last = r.payments[r.payments.length - 1];
              const open = expanded.has(r.id);
              const note = [r.cancelled_reason, r.legacy_notes].filter(Boolean).join(' · ');
              const month = billMonth(r.billing_period);
              const dim = r.excluded ? 'text-slate-400 line-through' : '';
              return (
                <React.Fragment key={r.id}>
                  <tr className={`hover:bg-slate-50/80 ${open ? 'bg-slate-50/80' : ''}`}>
                    <td className="pl-2">
                      {r.payments.length > 0 && (
                        <button onClick={() => toggle(r.id)} className="p-1 text-slate-400 hover:text-slate-700" title="Payment history">
                          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      )}
                    </td>
                    <td className={td}>
                      <div className={`font-semibold text-slate-900 whitespace-nowrap ${dim}`}>
                        {r.invoice_no.trim()}
                        <span className="ml-1.5 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 no-underline">{r.is_material ? 'Goods' : 'HK'}</span>
                        {r.is_legacy && <span className="ml-1 align-middle text-[10px] text-slate-400">legacy</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[220px]" title={note || r.billing_period || ''}>
                        {r.billing_period}{note && <span className="text-amber-600"> · {note}</span>}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {month
                        ? <span className="inline-block px-2 py-1 rounded-md bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-600/20 text-xs font-bold">{month}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="text-slate-700">{fmtDate(r.invoice_date)}</div>
                      {t.balance > 0 && <AgeBadge days={daysSince(r.invoice_date)} />}
                    </td>
                    <td className={`${td} text-right tabular-nums text-slate-600 ${dim}`}>{inr2(r.sub_total)}</td>
                    <td className={`${td} text-right tabular-nums text-slate-600 ${dim}`}>{inr2(r.tax_total)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold text-slate-900 ${dim}`}>{inr2(r.grand_total)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {t.paid + t.tds > 0 ? (
                        <>
                          <div className="text-emerald-700">{inr2(t.paid)}</div>
                          {t.tds > 0 && <div className="text-[11px] text-slate-500">TDS {inr2(t.tds)}</div>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${td} text-right tabular-nums font-bold ${t.balance ? 'text-rose-600' : 'text-slate-300'}`}>
                      {t.balance ? inr2(t.balance) : '—'}
                    </td>
                    <td className={td}><StatusPill s={t.status} /></td>
                    <td className={`${td} text-xs whitespace-nowrap`}>
                      {last ? (
                        <>
                          <div className="text-slate-700">{fmtDate(last.paid_date)}</div>
                          <div className="text-slate-500">{last.mode}{r.payments.length > 1 && ` · ${r.payments.length} payments`}</div>
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1">
                        {canPreview(r) ? (
                          <button onClick={() => openPreview(r)} className="p-1.5 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-indigo-50" title="Preview bill">
                            <Eye size={16} />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-200" title="Legacy bill: no file uploaded"><Eye size={16} /></span>
                        )}
                        {!r.excluded && t.balance > 0 && (
                          <button
                            onClick={() => setPayFor({ row: r })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20 hover:bg-teal-100 text-xs font-semibold"
                          >
                            <Plus size={13} /> Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && r.payments.map((p, i) => (
                    <tr key={p.id} className="bg-slate-50/80 text-xs">
                      <td />
                      <td className="px-3 py-1.5 text-slate-500" colSpan={3}>
                        <span className="text-slate-400">Payment {i + 1}</span> · {fmtDate(p.paid_date)} · {p.mode}
                        {p.ref_no && <span className="text-slate-400"> · {p.ref_no}</span>}
                      </td>
                      <td colSpan={3} className="px-3 py-1.5 text-slate-500 truncate max-w-[260px]" title={p.remark || ''}>{p.remark}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <span className="text-emerald-700">{inr2(p.amount)}</span>
                        {p.tds_amount > 0 && <span className="text-slate-500"> + TDS {inr2(p.tds_amount)}</span>}
                      </td>
                      <td colSpan={3} />
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <button onClick={() => setPayFor({ row: r, payment: p })} className="p-1 text-slate-500 hover:text-slate-900" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => deletePayment(p)} className="p-1 text-slate-400 hover:text-rose-600" title="Delete"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold border-t-2 border-slate-200 sticky bottom-0">
            <tr>
              <td />
              <td className={td} colSpan={5}>Total</td>
              <td className={`${td} text-right tabular-nums`}>{inr2(sum.billed)}</td>
              <td className={`${td} text-right tabular-nums text-emerald-700`}>
                {inr2(sum.received)}
                {sum.tds > 0 && <div className="text-[11px] font-normal text-slate-500">TDS {inr2(sum.tds)}</div>}
              </td>
              <td className={`${td} text-right tabular-nums text-rose-600`}>{inr2(sum.unpaid)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Proforma invoices</h2>
          {proformas.length === 0 ? (
            <p className="text-sm text-slate-400">No proforma invoices.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="text-left pb-2">Prof No</th><th className="text-left pb-2">Period</th><th className="text-left pb-2">Status</th><th className="text-right pb-2">Amount</th><th className="w-10" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proformas.map((r) => (
                  <tr key={r.id} className={r.closed ? 'text-slate-400' : ''}>
                    <td className={`py-2 font-medium ${r.closed ? 'line-through' : ''}`}>{r.invoice_no.trim()}</td>
                    <td className="py-2 text-slate-600">{r.billing_period}</td>
                    <td className="py-2 text-xs">{r.status}</td>
                    <td className="py-2 text-right tabular-nums">{inr2(r.grand_total)}</td>
                    <td className="py-2 text-right">
                      {canPreview(r) && <button onClick={() => openPreview(r)} className="p-1 text-slate-500 hover:text-indigo-700"><Eye size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Summary</h2>
          {[
            ['Previous year pending', sum.opening, ''],
            ['Unpaid bills', sum.unpaid, 'text-rose-600'],
            ['Proforma pending', sum.proforma, ''],
          ].map(([l, v, c]) => (
            <div key={l as string} className="flex justify-between py-1.5">
              <span className="text-slate-600">{l}</span>
              <span className={`tabular-nums ${c}`}>₹{inr2(v as number)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2.5 mt-1.5 border-t border-slate-200 font-bold text-base">
            <span>Total</span><span className="tabular-nums">₹{inr2(sum.total)}</span>
          </div>
        </div>
      </div>

      {payFor && (
        <PaymentModal
          row={payFor.row}
          payment={payFor.payment}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); load(); }}
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
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-sm font-semibold">Invoice {templatePreview.meta.invoiceNo}</span>
              <div className="flex gap-1">
                <button onClick={() => window.print()} className="p-1.5 rounded hover:bg-white/10" title="Print"><Printer size={16} /></button>
                <button onClick={() => setTemplatePreview(null)} className="p-1.5 rounded hover:bg-white/10" title="Close"><X size={18} /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center print:p-0 print:bg-white">
              {templatePreview.isMaterial ? <MaterialInvoiceTemplate data={templatePreview} /> : <InvoiceTemplate data={templatePreview} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- Payment modal

const PaymentModal: React.FC<{ row: LedgerRow; payment?: Payment; onClose: () => void; onSaved: () => void }> = ({ row, payment, onClose, onSaved }) => {
  const t = totals(row);
  // Remaining before this payment (when editing, add the payment's own amounts back).
  const remaining = Math.max(0, row.grand_total - t.paid - t.tds + (payment ? payment.amount + payment.tds_amount : 0));
  const tdsAlready = t.tds - (payment?.tds_amount || 0);
  const suggestedTds = Math.round(row.sub_total * TDS_RATE);
  const defaultTds = tdsAlready > 0 ? 0 : Math.min(suggestedTds, remaining);
  const [form, setForm] = useState({
    paid_date: payment ? payment.paid_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    tds_amount: String(payment?.tds_amount ?? defaultTds),
    amount: String(payment?.amount ?? Math.max(remaining - defaultTds, 0)),
    mode: (payment?.mode || 'NEFT') as Mode,
    ref_no: payment?.ref_no || '',
    remark: payment?.remark || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const amount = Number(form.amount) || 0;
  const tds = Number(form.tds_amount) || 0;
  const after = Math.round((remaining - amount - tds) * 100) / 100;
  const over = after < -SETTLE_TOLERANCE;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (over) return;
    setSaving(true);
    try {
      const body = { ...form, amount, tds_amount: tds };
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

  const field = 'mt-1 border border-slate-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/30 focus:border-[#20B2AA]';
  const lbl = 'text-xs font-medium text-slate-600';
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{payment ? 'Edit payment' : 'Record payment'}</h3>
            <p className="text-sm text-slate-500">{row.invoice_no.trim()} · {row.billing_period}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-3">
            <div><div className="text-[11px] text-slate-500">Bill amount</div><div className="font-semibold tabular-nums">₹{inr2(row.grand_total)}</div></div>
            <div><div className="text-[11px] text-slate-500">Remaining</div><div className="font-semibold tabular-nums text-rose-600">₹{inr2(remaining)}</div></div>
            <div><div className="text-[11px] text-slate-500">After this</div><div className={`font-semibold tabular-nums ${over ? 'text-rose-600' : after <= SETTLE_TOLERANCE ? 'text-emerald-600' : 'text-amber-600'}`}>₹{inr2(after)}</div></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>Paid date<input type="date" required value={form.paid_date} onChange={set('paid_date')} className={field} /></label>
            <label className={lbl}>Mode
              <select value={form.mode} onChange={set('mode')} className={field}>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label className={lbl}>Amount received<input type="number" step="0.01" min="0" required value={form.amount} onChange={set('amount')} className={`${field} tabular-nums`} /></label>
            <label className={lbl}>
              <span className="flex justify-between">TDS deducted
                <button type="button" onClick={() => setForm({ ...form, tds_amount: String(suggestedTds) })} className="text-[#20B2AA] hover:underline">2% = {inr(suggestedTds)}</button>
              </span>
              <input type="number" step="0.01" min="0" value={form.tds_amount} onChange={set('tds_amount')} className={`${field} tabular-nums`} />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, amount: String(Math.max(remaining - tds, 0)) })}
            className="text-xs text-[#20B2AA] font-semibold hover:underline"
          >
            Settle in full (remaining − TDS)
          </button>
          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>UTR / Cheque no<input value={form.ref_no} onChange={set('ref_no')} className={field} /></label>
            <label className={lbl}>Remark<input value={form.remark} onChange={set('remark')} className={field} /></label>
          </div>
          {over && <p className="text-sm text-rose-600">Amount + TDS exceeds the remaining balance by ₹{inr2(-after)}.</p>}
        </div>

        <div className="px-5 py-3 bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={saving || over} className={btnPrimary}>{saving ? 'Saving…' : 'Save payment'}</button>
        </div>
      </form>
    </div>
  );
};
