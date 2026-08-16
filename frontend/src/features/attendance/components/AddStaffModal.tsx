import React, { useState, useEffect } from 'react';
import { X, UserPlus, Building, Calendar, IdCard, Briefcase, Phone, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSiteId?: string;
  sites?: any[];
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultSiteId = '',
}) => {
  const [employeeName, setEmployeeName] = useState('');
  const [biometricCode, setBiometricCode] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Janitor');
  const [weeklyOff, setWeeklyOff] = useState('Sunday');
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [rateCardId, setRateCardId] = useState('');
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [availableRateCards, setAvailableRateCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch sites for dropdown
  useEffect(() => {
    async function fetchSites() {
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('id, site_name, code_name, companies(name)')
          .order('site_name', { ascending: true });

        if (!error && data) {
          setAvailableSites(data);
        }
      } catch (err) {
        console.warn('Could not fetch sites for AddStaffModal:', err);
      }
    }

    if (isOpen) {
      fetchSites();
      if (defaultSiteId) {
        setSiteId(defaultSiteId);
      }
    }
  }, [isOpen, defaultSiteId]);

  // Fetch rate cards when siteId changes
  useEffect(() => {
    async function fetchRateCards() {
      if (!siteId) {
        setAvailableRateCards([]);
        setRateCardId('');
        return;
      }
      try {
        const selectedSite = availableSites.find((s) => s.id === siteId);
        const siteName = selectedSite?.site_name || '';

        let query = supabase.from('rate_cards').select('*');
        if (siteId && siteName) {
          query = query.or(`site_id.eq.${siteId},site_name.eq.${siteName}`);
        } else if (siteId) {
          query = query.eq('site_id', siteId);
        } else if (siteName) {
          query = query.eq('site_name', siteName);
        }

        const { data, error } = await query;
        if (!error && data) {
          setAvailableRateCards(data);
          if (data.length > 0) setRateCardId(data[0].id);
        } else {
          setAvailableRateCards([]);
        }
      } catch (err) {
        console.warn('Error fetching rate cards:', err);
      }
    }

    fetchRateCards();
  }, [siteId, availableSites]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim()) {
      setErrorMsg('Employee Name is required');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        site_id: siteId || null,
        rate_card_id: rateCardId || null,
        employee_name: employeeName.trim(),
        biometric_code: biometricCode.trim(),
        phone: phone.trim(),
        designation: designation,
        weekly_off: weeklyOff,
        status: 'Active',
      };

      const { error } = await supabase.from('staff').insert([payload]);

      if (error) {
        console.error('❌ Error inserting staff:', error);
        setErrorMsg(`Failed to add staff: ${error.message}`);
      } else {
        setEmployeeName('');
        setBiometricCode('');
        setPhone('');
        setDesignation('Janitor');
        setWeeklyOff('Sunday');
        setRateCardId('');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Unexpected error adding staff:', err);
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-[#ffffff] rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <UserPlus className="text-[#FF5722]" size={20} />
            <h3 className="text-lg font-bold">Add New Staff Member</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Employee Name & Phone Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Employee Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] focus:border-transparent outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone size={13} />
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] outline-none font-mono"
              />
            </div>
          </div>

          {/* Biometric Code & Designation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <IdCard size={13} />
                Biometric Code
              </label>
              <input
                type="text"
                value={biometricCode}
                onChange={(e) => setBiometricCode(e.target.value)}
                placeholder="e.g. 1042"
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Briefcase size={13} />
                Designation
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] outline-none font-medium bg-white"
              >
                <option value="Janitor">Janitor</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Keyman">Keyman</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Site Assignment & Assigned Rate Card */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building size={13} />
                Assign Site
              </label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] outline-none font-medium bg-white truncate"
              >
                <option value="">Select a Site...</option>
                {availableSites.map((site) => {
                  const displayName = site.code_name || site.codeName || site.site_name;
                  return (
                    <option key={site.id} value={site.id}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <CreditCard size={13} />
                Assigned Rate Card
              </label>
              <select
                value={rateCardId}
                onChange={(e) => setRateCardId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5722] outline-none font-medium bg-white truncate"
              >
                <option value="">Select Rate Card...</option>
                {availableRateCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.post_name} (₹{card.gross_salary})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#FF5722] hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
