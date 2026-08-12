import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileCheck,
  Building,
  Phone,
  ShieldCheck,
  X,
  User,
  MapPin,
  Briefcase,
  Calendar,
  CreditCard,
} from 'lucide-react';

interface StaffDocument {
  name: string;
  url: string;
  type: 'Aadhar' | 'PAN' | 'Bank Passbook' | 'Other';
  uploadedAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  biometricCode: string;
  phone: string;
  role: string;
  siteName: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  joiningDate: string;
  photoUrl?: string;
  aadharNo?: string;
  panNo?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
  documents: StaffDocument[];
}

const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Rahul Sharma',
    biometricCode: '3765',
    phone: '9876543210',
    role: 'Supervisor',
    siteName: 'Lokhandwala Minerva CHS LTD',
    status: 'Active',
    joiningDate: '2024-01-15',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    aadharNo: '4839-2938-1928',
    panNo: 'ABCDE1234F',
    bankAccountNo: '924020001871570',
    bankIfsc: 'UTIB0001572',
    bankName: 'Axis Bank',
    documents: [
      { name: 'Aadhar_Rahul.pdf', url: '#', type: 'Aadhar', uploadedAt: '2024-01-15' },
      { name: 'PAN_Rahul.jpg', url: '#', type: 'PAN', uploadedAt: '2024-01-15' },
    ],
  },
  {
    id: 'staff-2',
    name: 'Suman Kumar',
    biometricCode: '1092',
    phone: '9819203948',
    role: 'Janitor',
    siteName: 'Acme Metal Industries Pvt Ltd',
    status: 'Active',
    joiningDate: '2023-08-01',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    aadharNo: '8821-9920-1123',
    bankAccountNo: '029310029381',
    bankIfsc: 'SBIN0001928',
    bankName: 'State Bank of India',
    documents: [
      { name: 'Aadhar_Suman.pdf', url: '#', type: 'Aadhar', uploadedAt: '2023-08-01' },
    ],
  },
  {
    id: 'staff-3',
    name: 'Fareenbano Khan',
    biometricCode: '2048',
    phone: '9769201928',
    role: 'Housekeeping',
    siteName: 'Ajmera Enclave',
    status: 'Active',
    joiningDate: '2023-11-10',
    aadharNo: '1102-9930-4491',
    panNo: 'XYZP9876Q',
    documents: [],
  },
  {
    id: 'staff-4',
    name: 'Manish Verma',
    biometricCode: '4920',
    phone: '9128392019',
    role: 'Security Guard',
    siteName: 'Ruparel Optima',
    status: 'Active',
    joiningDate: '2024-03-01',
    documents: [],
  },
  {
    id: 'staff-5',
    name: 'Aarti Patil',
    biometricCode: '5821',
    phone: '9867512340',
    role: 'Janitor',
    siteName: 'Minerva Ho',
    status: 'Active',
    joiningDate: '2024-04-12',
    documents: [],
  },
];

export const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    name: '',
    biometricCode: '',
    phone: '',
    role: 'Janitor',
    siteName: 'Lokhandwala Minerva CHS LTD',
    status: 'Active',
    joiningDate: new Date().toISOString().split('T')[0],
    aadharNo: '',
    panNo: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankName: '',
    documents: [],
  });

  // Filtered staff list by search name, biometric code, phone, role
  const filteredStaff = staffList.filter((staff) => {
    const matchesSearch =
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.biometricCode.includes(searchTerm) ||
      staff.phone.includes(searchTerm) ||
      staff.siteName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || staff.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || staff.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setFormData({
      name: '',
      biometricCode: '',
      phone: '',
      role: 'Janitor',
      siteName: 'Lokhandwala Minerva CHS LTD',
      status: 'Active',
      joiningDate: new Date().toISOString().split('T')[0],
      aadharNo: '',
      panNo: '',
      bankAccountNo: '',
      bankIfsc: '',
      bankName: '',
      documents: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData(staff);
    setIsModalOpen(true);
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      setStaffList((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'Aadhar' | 'PAN' | 'Bank Passbook' | 'Other'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc: StaffDocument = {
      name: file.name,
      url: URL.createObjectURL(file),
      type: docType,
      uploadedAt: new Date().toISOString().split('T')[0],
    };

    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), newDoc],
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.biometricCode) {
      alert('Employee Name and Biometric Code are required.');
      return;
    }

    if (editingStaff) {
      setStaffList((prev) =>
        prev.map((s) => (s.id === editingStaff.id ? ({ ...s, ...formData } as StaffMember) : s))
      );
    } else {
      const newStaff: StaffMember = {
        ...(formData as StaffMember),
        id: `staff-${Date.now()}`,
        documents: formData.documents || [],
      };
      setStaffList((prev) => [newStaff, ...prev]);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#20B2AA] border border-[#20B2AA]/30 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Staff &amp; Employee Directory
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage workforce records, biometric codes, salary details &amp; document KYC vault.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* Main Staff Container (Extended Full Height & Search) */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Search & Filter Control Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input for Employee Names */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Employee Name, Code, Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 focus:border-[#20B2AA] shadow-sm font-medium"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-sm font-medium"
            >
              <option value="All">All Roles</option>
              <option value="Janitor">Janitor</option>
              <option value="Housekeeping">Housekeeping</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Security Guard">Security Guard</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/20 shadow-sm font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="text-xs text-gray-500 font-mono">
            Showing <strong className="text-gray-900">{filteredStaff.length}</strong> of{' '}
            {staffList.length} staff records
          </div>
        </div>

        {/* Extended Staff Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm text-gray-700 min-w-[900px]">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4 text-center">Bio Code</th>
                <th className="py-3.5 px-4">Role / Site</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4 text-center">KYC Documents</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No staff found matching query "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Employee Profile */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                          {staff.photoUrl ? (
                            <img
                              src={staff.photoUrl}
                              alt={staff.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#20B2AA]/10 text-[#20B2AA] flex items-center justify-center font-bold text-sm">
                              {staff.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{staff.name}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            Joined: {staff.joiningDate}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Biometric Code */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 font-mono font-bold text-xs text-gray-800">
                        {staff.biometricCode}
                      </span>
                    </td>

                    {/* Role & Site */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-800 text-xs">{staff.role}</div>
                      <div className="text-xs text-gray-500 font-medium">{staff.siteName}</div>
                    </td>

                    {/* Phone */}
                    <td className="py-4 px-4 font-mono text-xs text-gray-700">
                      {staff.phone || 'N/A'}
                    </td>

                    {/* KYC Documents Badge */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {staff.aadharNo ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            Aadhar ✓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-200">
                            No Aadhar
                          </span>
                        )}
                        {staff.panNo ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            PAN ✓
                          </span>
                        ) : null}
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          {staff.documents?.length || 0} Docs
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          staff.status === 'Active'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {staff.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(staff)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#20B2AA] bg-teal-50 hover:bg-teal-100 border border-[#20B2AA]/30 rounded-lg flex items-center gap-1 transition-colors"
                          title="Edit Staff & Documents"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit / KYC</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Delete Staff Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Add / Edit Modal with Document Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#34495E] px-6 py-4 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base">
                  {editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Add New Staff Member'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveStaff} className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50 text-xs">
              {/* Photo & Basic Details */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>Personal Details &amp; Profile Picture</span>
                </h3>

                <div className="flex items-center gap-5">
                  {/* Photo Upload Avatar */}
                  <div className="relative group w-20 h-20 flex-shrink-0">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 border-2 border-[#20B2AA]/30 relative flex items-center justify-center">
                      {formData.photoUrl ? (
                        <img
                          src={formData.photoUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 text-white">
                        <Upload className="w-4 h-4 mb-1" />
                        <span className="text-[9px] font-bold uppercase">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:border-[#20B2AA]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Biometric Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. 3765"
                        value={formData.biometricCode || ''}
                        onChange={(e) => setFormData({ ...formData, biometricCode: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-[#20B2AA]"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="9876543210"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Role / Designation</label>
                    <select
                      value={formData.role || 'Janitor'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium"
                    >
                      <option value="Janitor">Janitor</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Security Guard">Security Guard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Assigned Site</label>
                    <input
                      type="text"
                      value={formData.siteName || ''}
                      onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* KYC Document Upload Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#20B2AA] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>KYC Vault &amp; Employee Document Upload</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Aadhar Card Number</label>
                    <input
                      type="text"
                      placeholder="4839-2938-1928"
                      value={formData.aadharNo || ''}
                      onChange={(e) => setFormData({ ...formData, aadharNo: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">PAN Card Number</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={formData.panNo || ''}
                      onChange={(e) => setFormData({ ...formData, panNo: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-gray-800"
                    />
                  </div>
                </div>

                {/* Upload Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <label className="border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-[#20B2AA] hover:bg-teal-50/50 transition-colors">
                    <Upload className="w-5 h-5 text-[#20B2AA] mb-1" />
                    <span className="text-[11px] font-bold text-gray-700">Upload Aadhar PDF</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'Aadhar')}
                    />
                  </label>

                  <label className="border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-[#20B2AA] hover:bg-teal-50/50 transition-colors">
                    <Upload className="w-5 h-5 text-indigo-600 mb-1" />
                    <span className="text-[11px] font-bold text-gray-700">Upload PAN Image</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'PAN')}
                    />
                  </label>

                  <label className="border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-[#20B2AA] hover:bg-teal-50/50 transition-colors">
                    <Upload className="w-5 h-5 text-purple-600 mb-1" />
                    <span className="text-[11px] font-bold text-gray-700">Upload Bank Passbook</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'Bank Passbook')}
                    />
                  </label>
                </div>

                {/* Uploaded Documents List */}
                {formData.documents && formData.documents.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Uploaded Files:</span>
                    <div className="space-y-1">
                      {formData.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-gray-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-[#20B2AA]" />
                            <span className="font-semibold text-gray-800">{doc.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-[#20B2AA] font-mono">
                              {doc.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">{doc.uploadedAt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#20B2AA] hover:bg-[#1ca19a] text-white font-bold transition-all shadow-sm"
                >
                  {editingStaff ? 'Update Staff Record' : 'Save Staff Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
