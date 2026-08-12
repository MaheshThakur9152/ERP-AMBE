import React, { useState, useEffect } from 'react';
import { Material } from '@/features/materials/types';
import {
  fetchMaterialsApi,
  createMaterialApi,
  updateMaterialApi,
  deleteMaterialApi,
} from '@/features/materials/api/materialApi';
import { toast, ToastContainer } from '@/components/ui/toast';
import { Package, RotateCcw, Loader2, Plus, Edit2, Trash2, Search, X } from 'lucide-react';

export const MaterialsMasterPage: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [itemName, setItemName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState<number>(18);
  const [defaultRate, setDefaultRate] = useState<number>(0);
  const [unit, setUnit] = useState('Nos');

  const loadMaterials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMaterialsApi();
      setMaterials(data);
    } catch (e: any) {
      console.error('[MaterialsMasterPage] Failed to fetch materials:', e);
      setError(e.message || 'Failed to load materials from GET /api/materials');
      toast.error('Failed to load materials inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleOpenAddModal = () => {
    setEditingMaterial(null);
    setItemName('');
    setHsnCode('');
    setGstRate(18);
    setDefaultRate(0);
    setUnit('Nos');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Material) => {
    setEditingMaterial(item);
    setItemName(item.item_name);
    setHsnCode(item.hsn_code || '');
    setGstRate(item.gst_rate ?? 18);
    setDefaultRate(item.default_rate ?? 0);
    setUnit(item.unit || 'Nos');
    setIsModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error('Item Name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMaterial) {
        await updateMaterialApi(editingMaterial.id, {
          item_name: itemName.trim(),
          hsn_code: hsnCode.trim(),
          gst_rate: Number(gstRate),
          default_rate: Number(defaultRate),
          unit: unit.trim() || 'Nos',
        });
        toast.success('Material item updated successfully');
      } else {
        await createMaterialApi({
          item_name: itemName.trim(),
          hsn_code: hsnCode.trim(),
          gst_rate: Number(gstRate),
          default_rate: Number(defaultRate),
          unit: unit.trim() || 'Nos',
        });
        toast.success('New material item added successfully');
      }
      setIsModalOpen(false);
      await loadMaterials();
    } catch (err: any) {
      console.error('[MaterialsMasterPage] Error saving material:', err);
      toast.error(err.message || 'Failed to save material');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteMaterialApi(id);
      toast.success('Material deleted successfully');
      await loadMaterials();
    } catch (err: any) {
      console.error(`[MaterialsMasterPage] Failed to delete material ${id}:`, err);
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.hsn_code && m.hsn_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <ToastContainer />

      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Materials Master Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage inventory goods, HSN codes, GST tax rates, units, and default unit rates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMaterials}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Refresh Materials"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#20B2AA] hover:bg-[#1a938c] text-white font-semibold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Material</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar & Stats */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item name or HSN code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Total Items: <span className="font-bold text-gray-900">{filteredMaterials.length}</span>
          </div>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-16">
            <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
            <span>Loading materials inventory from database...</span>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-800">No materials found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'No inventory items match your search query.'
                : 'Click "Add Material" above to add your first product line item to the database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">HSN Code</th>
                  <th className="py-3 px-4 text-center">GST Rate</th>
                  <th className="py-3 px-4 text-right">Default Rate (₹)</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterials.map((item, index) => (
                  <tr key={item.id} className="hover:bg-teal-50/30 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-gray-400">{index + 1}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{item.item_name}</td>
                    <td className="py-3 px-4 font-mono text-gray-600">{item.hsn_code || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${
                          item.gst_rate === 0
                            ? 'bg-gray-100 text-gray-700 border border-gray-200'
                            : 'bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30'
                        }`}
                      >
                        {item.gst_rate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-gray-800">
                      ₹{Number(item.default_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-gray-600">{item.unit}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(item.id, item.item_name)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-[#20B2AA]" />
                <span>{editingMaterial ? 'Edit Material Item' : 'Add New Material Item'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMaterial} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunny Phenyl 5 Ltr"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 3808"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">GST Rate (%) *</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none font-semibold"
                  >
                    <option value={18}>18% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={0}>0% (Exempted)</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Default Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nos, can, Roll, Pair"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-[#20B2AA] hover:bg-[#1a938c] text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingMaterial ? 'Update Material' : 'Save Material'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
