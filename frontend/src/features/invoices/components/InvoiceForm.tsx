import React from 'react';
import { InvoiceData, InvoiceLineItem } from '../types/invoice';
import { calculateLineItemAmount } from '../utils/invoiceCalculator';
import { Plus, Trash2, RotateCcw, FileSpreadsheet } from 'lucide-react';

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (updated: InvoiceData) => void;
  onResetSample: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  data,
  onChange,
  onResetSample,
}) => {
  const handleMetaChange = (field: keyof typeof data.meta, value: string) => {
    onChange({
      ...data,
      meta: { ...data.meta, [field]: value },
    });
  };

  const handlePartyChange = (field: keyof typeof data.party, value: string) => {
    onChange({
      ...data,
      party: { ...data.party, [field]: value },
    });
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const updatedItems = [...data.items];
    const item = { ...updatedItems[index], [field]: value };

    // Auto calculate amount when rate or workingDays change
    if (field === 'rate' || field === 'workingDays' || field === 'persons') {
      const rateNum = Number(field === 'rate' ? value : item.rate) || 0;
      const daysNum = Number(field === 'workingDays' ? value : item.workingDays) || 0;
      item.amount = calculateLineItemAmount(rateNum, daysNum, 31);
    } else if (field === 'amount') {
      item.amount = Number(value) || 0;
    } else if (field === 'description') {
      const newDesc = String(value);
      item.description = newDesc;
      // Live Sync: If next item is overtime row, auto-update its description
      if (
        updatedItems[index + 1] &&
        updatedItems[index + 1].description.toLowerCase().includes('overtime')
      ) {
        updatedItems[index + 1] = {
          ...updatedItems[index + 1],
          description: `Overtime in hours (${newDesc})`,
        };
      }
    }

    updatedItems[index] = item;
    onChange({ ...data, items: updatedItems });
  };

  const addItem = () => {
    const timestamp = Date.now();
    const mainItem: InvoiceLineItem = {
      id: `item-${timestamp}`,
      srNo: data.items.length + 1,
      description: 'New Service Line',
      hsnCode: '9985',
      rate: 20000,
      workingDays: 31,
      persons: 1,
      amount: 20000,
    };

    const overtimeItem: InvoiceLineItem = {
      id: `ot-${timestamp}`,
      srNo: data.items.length + 2,
      description: 'Overtime in hours (New Service Line)',
      hsnCode: '9985',
      rate: 0,
      workingDays: 0,
      persons: 0,
      amount: 0,
    };

    onChange({ ...data, items: [...data.items, mainItem, overtimeItem] });
  };

  const removeItem = (index: number) => {
    const updatedItems = data.items.filter((_, i) => i !== index);
    onChange({ ...data, items: updatedItems });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 text-gray-800 shadow-sm">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#20B2AA]" />
            <span>Invoice Data Editor</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Fill billing items &amp; metadata. Math summary is computed automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetSample}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Load July 2026 Sample</span>
        </button>
      </div>

      {/* Invoice Meta & Party Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Meta Section */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-[#20B2AA] text-xs uppercase tracking-wider">
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Invoice No</label>
              <input
                type="text"
                value={data.meta.invoiceNo}
                onChange={(e) => handleMetaChange('invoiceNo', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-mono text-xs focus:outline-none focus:border-[#20B2AA]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Date</label>
              <input
                type="text"
                value={data.meta.invoiceDate}
                onChange={(e) => handleMetaChange('invoiceDate', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#20B2AA]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Billing Period</label>
            <input
              type="text"
              value={data.meta.billingPeriod}
              onChange={(e) => handleMetaChange('billingPeriod', e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#20B2AA]"
            />
          </div>
        </div>

        {/* Client Party Section */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-[#20B2AA] text-xs uppercase tracking-wider">
            Billed Party Details
          </h3>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Party Name</label>
            <input
              type="text"
              value={data.party.name}
              onChange={(e) => handlePartyChange('name', e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#20B2AA] font-semibold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 font-semibold">SITE</label>
              <input
                type="text"
                value={data.party.siteName}
                onChange={(e) => handlePartyChange('siteName', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#20B2AA]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Work Order Ref</label>
              <input
                type="text"
                value={data.party.workOrderRefNo}
                onChange={(e) => handlePartyChange('workOrderRefNo', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#20B2AA]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Line Items Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">
            Line Items Table ({data.items.length})
          </h3>
          <button
            type="button"
            onClick={addItem}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white flex items-center gap-1 font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="space-y-2">
          {data.items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="grid grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-gray-200 items-center text-xs"
            >
              <div className="col-span-4">
                <label className="block text-[10px] text-gray-600 mb-0.5 font-medium">Description</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 text-xs font-semibold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-600 mb-0.5 font-medium">Rate (₹)</label>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => handleItemChange(idx, 'rate', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-600 mb-0.5 font-medium">Working Days</label>
                <input
                  type="number"
                  value={item.workingDays}
                  onChange={(e) => handleItemChange(idx, 'workingDays', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 text-xs font-mono"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] text-gray-600 mb-0.5 font-medium">Persons</label>
                <input
                  type="number"
                  value={item.persons}
                  onChange={(e) => handleItemChange(idx, 'persons', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-600 mb-0.5 font-medium">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) => handleItemChange(idx, 'amount', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-green-700 text-xs font-mono font-bold"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove Row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax & Rate Settings */}
      <div className="pt-3 border-t border-gray-200 grid grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-[11px] text-gray-600 mb-1 font-semibold">Mgmt Charges (%)</label>
          <input
            type="number"
            value={data.mgmtPercent}
            onChange={(e) => onChange({ ...data, mgmtPercent: Number(e.target.value) })}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-600 mb-1 font-semibold">CGST (%)</label>
          <input
            type="number"
            value={data.cgstPercent}
            onChange={(e) => onChange({ ...data, cgstPercent: Number(e.target.value) })}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-600 mb-1 font-semibold">SGST (%)</label>
          <input
            type="number"
            value={data.sgstPercent}
            onChange={(e) => onChange({ ...data, sgstPercent: Number(e.target.value) })}
            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-mono text-xs"
          />
        </div>
      </div>

      {/* Dynamic Additional Charges */}
      <div className="pt-3 border-t border-gray-200 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] text-gray-700 font-semibold">Additional Charges</label>
          <button
            type="button"
            onClick={() => {
              const current = data.additionalCharges || [];
              onChange({
                ...data,
                additionalCharges: [...current, { name: '', amount: 0 }],
              });
            }}
            className="text-[11px] text-teal-600 hover:text-teal-800 font-bold"
          >
            + Add Charge Field
          </button>
        </div>
        {(data.additionalCharges || []).map((ch, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Charge Name (e.g. Machinery Charges)"
              value={ch.name}
              onChange={(e) => {
                const current = [...(data.additionalCharges || [])];
                current[idx] = { ...current[idx], name: e.target.value };
                onChange({ ...data, additionalCharges: current });
              }}
              className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900"
            />
            <input
              type="number"
              step="0.01"
              placeholder="0"
              value={ch.amount === 0 ? '' : ch.amount}
              onChange={(e) => {
                const current = [...(data.additionalCharges || [])];
                current[idx] = { ...current[idx], amount: e.target.value === '' ? 0 : Number(e.target.value) };
                onChange({ ...data, additionalCharges: current });
              }}
              className="w-28 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono text-right"
            />
            <button
              type="button"
              onClick={() => {
                const current = (data.additionalCharges || []).filter((_, i) => i !== idx);
                onChange({ ...data, additionalCharges: current });
              }}
              className="text-gray-400 hover:text-red-600 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
