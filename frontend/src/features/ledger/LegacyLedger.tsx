import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { fetchWithRetry } from '@/lib/apiClient';
import { toast } from '@/components/ui/toast';

/** Old xlsx outstanding ledger, stored as-is per site. ERP bills take over from the month after the last legacy bill. */

const inr = (n: number) => (n ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const monthLabel = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

async function call<T = any>(url: string, init: RequestInit & { skipErrorToast?: boolean } = {}): Promise<T> {
  const res = await fetchWithRetry(url, { skipErrorToast: true, ...init } as any);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

interface PreviewTab {
  tab: string;
  rows: number;
  billed: number;
  due: number;
  lastMonth: string | null;
  siteId: string | null;
  existingRows: number;
}
interface SiteOpt {
  id: string;
  client_name: string;
  site_name: string;
  code_name: string | null;
}

export const LegacyUploadModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [tabs, setTabs] = useState<PreviewTab[] | null>(null);
  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const preview = async (f: File) => {
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const d = await call<{ tabs: PreviewTab[]; sites: SiteOpt[] }>('/api/ledger/legacy/preview', { method: 'POST', body: fd, retries: 0, timeoutMs: 120000 } as any);
      setTabs(d.tabs);
      setSites(d.sites);
      setMapping(Object.fromEntries(d.tabs.map((t) => [t.tab, t.siteId || ''])));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!file) return;
    const chosen = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
    if (!Object.keys(chosen).length) return toast.error('Pick a site for at least one tab');
    const replacing = tabs!.filter((t) => chosen[t.tab] && t.existingRows).length;
    if (replacing && !window.confirm(`${replacing} site(s) already have legacy rows. Replace them with this file?`)) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(chosen));
      const r = await call<{ sites: number; rows: number }>('/api/ledger/legacy/import', { method: 'POST', body: fd, retries: 0, timeoutMs: 120000 } as any);
      toast.success(`Imported ${r.rows} legacy rows for ${r.sites} sites`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const siteLabel = (s: SiteOpt) => s.code_name || `${s.client_name} · ${s.site_name}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Upload legacy ledger (xlsx)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-auto">
          <p className="text-sm text-slate-600">
            Each tab is stored exactly as written and matched to a site by its code name. For every site, ERP bills show from the
            month after the last legacy bill; unpaid legacy rows become the opening balance.
          </p>
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-50">
            {busy && !tabs ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {file ? file.name : 'Choose 0.ALL OUTSTANDING .xlsx'}
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && preview(e.target.files[0])} />
          </label>

          {tabs && (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left">Tab</th>
                  <th className="px-2 py-2 text-left">Site</th>
                  <th className="px-2 py-2 text-right">Rows</th>
                  <th className="px-2 py-2 text-right">Billed</th>
                  <th className="px-2 py-2 text-right">Unpaid</th>
                  <th className="px-2 py-2 text-left">Last bill</th>
                  <th className="px-2 py-2 text-left">ERP from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabs.map((t) => {
                  const next = t.lastMonth ? new Date(`${t.lastMonth}T00:00:00`) : null;
                  next?.setMonth(next.getMonth() + 1);
                  return (
                    <tr key={t.tab}>
                      <td className="px-2 py-1.5 font-medium text-slate-800">{t.tab}</td>
                      <td className="px-2 py-1.5">
                        <select
                          value={mapping[t.tab] || ''}
                          onChange={(e) => setMapping({ ...mapping, [t.tab]: e.target.value })}
                          className={`border rounded px-2 py-1 text-xs max-w-[240px] ${mapping[t.tab] ? 'border-slate-300' : 'border-amber-400 bg-amber-50'}`}
                        >
                          <option value="">Skip this tab</option>
                          {sites.map((s) => <option key={s.id} value={s.id}>{siteLabel(s)}</option>)}
                        </select>
                        {t.existingRows > 0 && mapping[t.tab] === t.siteId && <span className="ml-1 text-[10px] text-amber-700">replaces {t.existingRows}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.rows}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(t.billed)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{inr(t.due)}</td>
                      <td className="px-2 py-1.5">{monthLabel(t.lastMonth)}</td>
                      <td className="px-2 py-1.5 font-semibold text-teal-700">{next ? monthLabel(next.toISOString().slice(0, 10)) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button onClick={onClose} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
          <button
            disabled={!tabs || busy}
            onClick={doImport}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#20B2AA] hover:bg-[#1a9d96] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {busy && tabs && <Loader2 size={15} className="animate-spin" />} Import
          </button>
        </div>
      </div>
    </div>
  );
};

interface LegacyPayment { id: string; paid_date: string; amount: number; tds_amount: number; mode: string; ref_no: string | null; remark: string | null }
interface LegacyRow {
  id: string;
  billing_period: string | null;
  invoice_no: string;
  invoice_period: string | null;
  nature: string | null;
  invoice_date: string | null;
  sub_total: number;
  gst: number;
  amount: number;
  status: string | null;
  mode: string | null;
  paid_date: string | null;
  paid_amt: number;
  remark: string | null;
  rem_to_pay: number;
  tds: number;
  tds_amt: number;
  is_proforma: boolean;
  due: number;
  payments: LegacyPayment[];
}

/** The site's xlsx rows, columns as in the workbook, plus payments received after the cut-off. */
export const LegacyTab: React.FC<{ siteId: string; onChanged: () => void }> = ({ siteId, onChanged }) => {
  const [rows, setRows] = useState<LegacyRow[] | null>(null);
  const [payFor, setPayFor] = useState<LegacyRow | null>(null);
  const [form, setForm] = useState({ paid_date: new Date().toISOString().slice(0, 10), amount: '', tds_amount: '0', mode: 'NEFT', ref_no: '', remark: '' });

  const load = useCallback(() => {
    call<LegacyRow[]>(`/api/ledger/sites/${siteId}/legacy`).then(setRows).catch((e) => toast.error(e.message));
  }, [siteId]);
  useEffect(load, [load]);

  const savePayment = async () => {
    if (!payFor) return;
    try {
      await call(`/api/ledger/legacy/rows/${payFor.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ref_no: form.ref_no.trim() || null, remark: form.remark.trim() || null }),
      });
      setPayFor(null);
      load();
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const deletePayment = async (id: string) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await call(`/api/ledger/legacy/payments/${id}`, { method: 'DELETE' });
      load();
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!rows) return <div className="py-10 text-center text-slate-400">Loading…</div>;
  if (!rows.length) return <div className="py-10 text-center text-slate-400">No legacy rows for this site. Upload the xlsx from the ledger list.</div>;

  const td = 'px-2 py-1.5 whitespace-nowrap';
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase sticky top-0">
            <tr>
              {['Billing period', 'Invoice no', 'Invoice period', 'Nature', 'Invoice date', 'Sub total', 'GST', 'Amount', 'Paid / Unpaid', 'Mode', 'Paid date', 'Paid amt', 'Remark', 'Rem to pay', 'TDS', 'TDS amt', 'Due now', ''].map((h) => (
                <th key={h} className={`${td} text-left font-semibold`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr className={r.is_proforma ? 'bg-amber-50/50' : ''}>
                  <td className={td}>{r.billing_period}</td>
                  <td className={`${td} font-semibold text-slate-800`}>{r.invoice_no}</td>
                  <td className={td}>{r.invoice_period}</td>
                  <td className={td}>{r.nature}</td>
                  <td className={td}>{r.invoice_date}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.sub_total)}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.gst)}</td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>{inr(r.amount)}</td>
                  <td className={`${td} ${/unpaid|not\s*full/i.test(r.status || '') ? 'text-rose-600 font-semibold' : ''}`}>{r.status}</td>
                  <td className={td}>{r.mode}</td>
                  <td className={td}>{r.paid_date}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.paid_amt)}</td>
                  <td className="px-2 py-1.5 max-w-[220px] truncate" title={r.remark || ''}>{r.remark}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.rem_to_pay)}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.tds)}</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(r.tds_amt)}</td>
                  <td className={`${td} text-right tabular-nums font-bold ${r.due > 1 ? 'text-rose-600' : 'text-slate-300'}`}>{r.due > 1 ? inr(r.due) : '—'}</td>
                  <td className={td}>
                    {r.due > 1 && (
                      <button
                        onClick={() => { setPayFor(r); setForm({ ...form, amount: String(r.due), tds_amount: '0' }); }}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-teal-300 text-teal-700 rounded text-[11px] font-semibold hover:bg-teal-50"
                      >
                        <Plus size={11} /> Payment
                      </button>
                    )}
                  </td>
                </tr>
                {r.payments.map((p) => (
                  <tr key={p.id} className="bg-emerald-50/50 text-emerald-800">
                    <td className={td} colSpan={10}>↳ Received in ERP {p.paid_date} · {p.mode}{p.ref_no ? ` · ${p.ref_no}` : ''}{p.remark ? ` · ${p.remark}` : ''}</td>
                    <td className={`${td} text-right tabular-nums`} colSpan={2}>{inr(p.amount)}</td>
                    <td className={td} colSpan={3}>{p.tds_amount ? `TDS ${inr(p.tds_amount)}` : ''}</td>
                    <td colSpan={2} />
                    <td className={td}>
                      <button onClick={() => deletePayment(p.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className={td} colSpan={16}>Legacy unpaid (carried into the opening balance)</td>
              <td className={`${td} text-right tabular-nums text-rose-600`}>{inr(totalDue) || '0.00'}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {payFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">Payment for {payFor.invoice_no} <span className="text-slate-400 font-normal">· due ₹{inr(payFor.due)}</span></h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label>Date<input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} className="block w-full border rounded px-2 py-1.5" /></label>
              <label>Mode
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="block w-full border rounded px-2 py-1.5">
                  {['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label>Amount<input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="block w-full border rounded px-2 py-1.5" /></label>
              <label>TDS<input type="number" value={form.tds_amount} onChange={(e) => setForm({ ...form, tds_amount: e.target.value })} className="block w-full border rounded px-2 py-1.5" /></label>
              <label className="col-span-2">UTR / Cheque no (optional)<input value={form.ref_no} onChange={(e) => setForm({ ...form, ref_no: e.target.value })} className="block w-full border rounded px-2 py-1.5" /></label>
              <label className="col-span-2">Remark<input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="block w-full border rounded px-2 py-1.5" /></label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPayFor(null)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
              <button onClick={savePayment} className="px-3 py-2 bg-[#20B2AA] text-white rounded-lg text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
