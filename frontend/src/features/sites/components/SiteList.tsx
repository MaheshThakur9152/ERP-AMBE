import React, { useState, useEffect } from 'react';
import { Site } from '../types';
import {
  Search,
  Plus,
  Building,
  Edit2,
  Trash2,
  ShieldCheck,
  MapPin,
  FileText,
  CreditCard,
  Upload,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { RateCardManager } from './RateCardManager';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { fetchSiteDocumentsApi } from '../api/siteApi';
import { toast } from '@/components/ui/toast';

interface SiteListProps {
  sites: Site[];
  onAddSite: () => void;
  onEditSite: (site: Site) => void;
  onDeleteSite: (id: string) => void;
}

export const SiteList: React.FC<SiteListProps> = ({
  sites,
  onAddSite,
  onEditSite,
  onDeleteSite,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [managingRateCardSite, setManagingRateCardSite] = useState<{ id: string; name: string } | null>(null);
  const [siteWorkOrders, setSiteWorkOrders] = useState<Record<string, string>>({});
  const [viewingDoc, setViewingDoc] = useState<{ id?: string; fileName: string; title: string; url?: string } | null>(null);
  const [uploadModalSite, setUploadModalSite] = useState<Site | null>(null);

  const loadWorkOrders = () => {
    if (sites.length === 0) return;

    // Load work order document links for visible sites
    Promise.allSettled(
      sites.map(async (s) => {
        try {
          const docs = await fetchSiteDocumentsApi(s.id);
          const wo = docs.find((d) => d.document_type === 'Work Order');
          const url = wo?.view_url || wo?.gcp_file_url || wo?.drive_web_view_link;
          return { siteId: s.id, url };
        } catch {
          return { siteId: s.id, url: undefined };
        }
      })
    ).then((results) => {
      const map: Record<string, string> = {};
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.url) {
          map[res.value.siteId] = res.value.url;
        }
      });
      setSiteWorkOrders(map);
    });
  };

  useEffect(() => {
    loadWorkOrders();
  }, [sites]);

  const filteredSites = sites.filter((site) => {
    const siteName = (site as any).siteName || (site as any).site_name || '';
    const clientName = (site as any).clientName || (site as any).client_name || '';
    const gstin = site.gstin || '';
    const matchesSearch =
      siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gstin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || site.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = sites.filter((s) => s.status === 'Active').length;
  const totalRateCards = sites.reduce((sum, s) => sum + (s.rateCards?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards matching old frontend visual DNA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Sites</h3>
            <span className="p-2.5 rounded-xl bg-teal-50 text-[#20B2AA]">
              <Building className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{sites.length}</div>
            <div className="text-xs text-gray-500 mt-1">Master facility locations</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-[#20B2AA]" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Active Clients</h3>
            <span className="p-2.5 rounded-xl bg-green-50 text-green-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
            <div className="text-xs text-green-600 mt-1">Active billing contracts</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-green-500" />
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Rate Cards</h3>
            <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{totalRateCards}</div>
            <div className="text-xs text-indigo-600 mt-1">Configured designation rates</div>
          </div>
          <div className="h-1 w-full mt-4 rounded-full bg-indigo-600" />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search site, client, or GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-sm"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onAddSite}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Site</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Site Name</th>
                <th className="py-3.5 px-4">Client Party Name</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Work Order Ref</th>
                <th className="py-3.5 px-4 text-center">Rate Cards</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No sites found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSites.map((site) => {
                  const name = (site as any).siteName || (site as any).site_name || 'Site';
                  return (
                    <tr key={site.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#20B2AA] flex-shrink-0" />
                          <div className="flex items-center gap-2">
                            <span>{name}</span>
                            {(site.codeName || site.code_name) && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-50 text-[#20B2AA] border border-teal-200 font-semibold">
                                {site.codeName || site.code_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-800 font-medium">{site.clientName}</td>
                      <td className="py-3.5 px-4 font-mono text-gray-600 text-xs">{site.gstin}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-indigo-700">
                            {site.workOrderRefNo || <span className="text-gray-400 font-normal italic">No Ref #</span>}
                          </span>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            {siteWorkOrders[site.id] ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingDoc({
                                    url: siteWorkOrders[site.id],
                                    fileName: `${site.siteName}_Work_Order.pdf`,
                                    title: `${site.siteName} - Work Order`,
                                  })
                                }
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 hover:bg-[#20B2AA]/10 flex items-center gap-1 transition-colors cursor-pointer"
                                title="View Stored Work Order Document"
                              >
                                <FileCheck className="w-3 h-3 text-[#20B2AA]" />
                                <span>View</span>
                              </button>
                            ) : (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 bg-gray-50 border border-gray-200 flex items-center gap-1 cursor-not-allowed select-none"
                                title="No Work Order document stored yet"
                              >
                                <FileText className="w-3 h-3 text-gray-300" />
                                <span>View</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setUploadModalSite(site)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold border text-[#20B2AA] border-[#20B2AA]/30 hover:bg-[#20B2AA]/10 flex items-center gap-1 transition-colors"
                              title="Upload Work Order Document"
                            >
                              <Upload className="w-3 h-3 text-[#20B2AA]" />
                              <span>+ Upload</span>
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const fullSiteName = (site.codeName || site.code_name)
                              ? `${name} - ${site.codeName || site.code_name}`
                              : name;
                            setManagingRateCardSite({ id: site.id, name: fullSiteName });
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Manage Rate Cards</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            site.status === 'Active'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {site.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditSite(site)}
                            className="p-1.5 text-gray-500 hover:text-[#20B2AA] hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Site"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSite(site.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Delete Site"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Rate Card Manager Modal */}
      {managingRateCardSite && (
        <RateCardManager
          isOpen={!!managingRateCardSite}
          onClose={() => setManagingRateCardSite(null)}
          siteId={managingRateCardSite.id}
          siteName={managingRateCardSite.name}
        />
      )}

      {/* Upload Document Modal */}
      {uploadModalSite && (
        <DocumentUploadModal
          isOpen={!!uploadModalSite}
          onClose={() => setUploadModalSite(null)}
          onSuccess={loadWorkOrders}
          initialSiteId={uploadModalSite.id}
          lockSite={true}
          initialDocumentType="Work Order"
          sites={sites}
        />
      )}

      {/* Inline Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        url={viewingDoc?.url}
        fileName={viewingDoc?.fileName}
        title={viewingDoc?.title}
      />
    </div>
  );
};

