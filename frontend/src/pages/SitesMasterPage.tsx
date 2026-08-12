import React, { useState, useEffect } from 'react';
import { SiteList } from '@/features/sites/components/SiteList';
import { SiteFormSheet } from '@/features/sites/components/SiteFormSheet';
import { Site, SiteFormData } from '@/features/sites/types';
import { fetchSitesApi, deleteSiteApi } from '@/features/sites/api/siteApi';
import { toast, ToastContainer } from '@/components/ui/toast';
import { Building2, RotateCcw, Loader2 } from 'lucide-react';

export const SitesMasterPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const loadSites = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSitesApi();
      setSites(data);
    } catch (e: any) {
      console.error('[SitesMasterPage] Failed to fetch sites:', e);
      setError(e.message || 'Failed to load sites from GET /api/sites');
      toast.error('Failed to load sites from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleAddSite = () => {
    setEditingSite(null);
    setIsSheetOpen(true);
  };

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setIsSheetOpen(true);
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this site master?')) {
      return;
    }

    try {
      const res = await deleteSiteApi(id);
      if (res.status === 200) {
        toast.success('Site deleted successfully from database');
        await loadSites();
      }
    } catch (err: any) {
      console.error(`[SitesMasterPage] Failed to delete site ${id}:`, err);
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Sites &amp; Rate Cards Master</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage client facility locations, GSTIN details, work order contracts, and designation rate cards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSites}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="Refresh Sites"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 text-xs text-gray-500 py-16 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 text-[#20B2AA] animate-spin" />
          <span className="font-semibold text-gray-700">Loading site masters from GET /api/sites...</span>
        </div>
      ) : (
        /* Sites List Component */
        <SiteList
          sites={sites}
          onAddSite={handleAddSite}
          onEditSite={handleEditSite}
          onDeleteSite={handleDeleteSite}
        />
      )}

      {/* Sheet Modal Form with onSuccess re-fetch callback */}
      <SiteFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSuccess={loadSites}
        editingSite={editingSite}
      />
    </div>
  );
};
