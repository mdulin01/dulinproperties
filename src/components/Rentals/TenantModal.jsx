import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, Loader } from 'lucide-react';
import { tenantStatuses } from '../../constants';

const TenantModal = ({ property, properties = [], tenant, onSave, onClose, onUploadPhoto }) => {
  // If property has no id (e.g. _pickProperty mode), show property picker
  const needsPropertyPicker = !property?.id;

  const [selectedPropertyId, setSelectedPropertyId] = useState(
    property?.id ? String(property.id) : ''
  );

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    leaseStart: '',
    leaseEnd: '',
    monthlyRent: '',
    securityDeposit: '',
    status: 'pending',
    licensePhotoUrl: '',
  });

  const [uploadingLicense, setUploadingLicense] = useState(false);
  const licenseInputRef = useRef(null);

  // Pre-fill if editing
  useEffect(() => {
    if (tenant) {
      let firstName = tenant.firstName || '';
      let lastName = tenant.lastName || '';
      if (!firstName && !lastName && tenant.name) {
        const parts = tenant.name.trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }
      setFormData({
        firstName,
        lastName,
        email: tenant.email || '',
        phone: tenant.phone || '',
        leaseStart: tenant.leaseStart || '',
        leaseEnd: tenant.leaseEnd || '',
        monthlyRent: tenant.monthlyRent || '',
        securityDeposit: tenant.securityDeposit || '',
        status: tenant.status || 'pending',
        licensePhotoUrl: tenant.licensePhotoUrl || '',
      });
    } else {
      resetForm();
    }
  }, [tenant]);

  useEffect(() => {
    if (property?.id) setSelectedPropertyId(String(property.id));
  }, [property]);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      leaseStart: '',
      leaseEnd: '',
      monthlyRent: '',
      securityDeposit: '',
      status: 'pending',
      licensePhotoUrl: '',
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLicenseUpload = async (file) => {
    if (!file || !onUploadPhoto) return;
    setUploadingLicense(true);
    try {
      const url = await onUploadPhoto(file, 'tenant-licenses');
      setFormData(prev => ({ ...prev, licensePhotoUrl: url }));
    } catch (err) {
      console.error('License upload failed:', err);
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleSave = () => {
    if (!formData.firstName.trim()) {
      alert('First name is required');
      return;
    }
    if (needsPropertyPicker && !selectedPropertyId) {
      alert('Please select a property');
      return;
    }
    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    onSave({
      ...formData,
      name: fullName,
    }, needsPropertyPicker ? selectedPropertyId : null);
  };

  const resolvedProperty = needsPropertyPicker
    ? properties.find(p => String(p.id) === selectedPropertyId)
    : property;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800/95 border border-white/15 rounded-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-slate-800 border-b border-white/15">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {tenant?.name || tenant?.firstName ? 'Edit Tenant' : 'Add Tenant'}
            </h2>
            {resolvedProperty?.name && (
              <p className="text-sm text-white/40 mt-0.5">{resolvedProperty.emoji || '🏠'} {resolvedProperty.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[calc(90vh-150px)] overflow-y-auto">
          {/* Property Picker (when adding from Tenants page) */}
          {needsPropertyPicker && (
            <div>
              <label className="block text-slate-400 text-sm mb-2">Property *</label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
              >
                <option value="" className="bg-slate-800">Select a property...</option>
                {properties.map(p => (
                  <option key={p.id} value={String(p.id)} className="bg-slate-800">
                    {p.emoji || '🏠'} {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Personal Information */}
          <div>
            <h3 className="text-white font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  autoFocus={!needsPropertyPicker}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tenant@example.com"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                >
                  {tenantStatuses.map(status => (
                    <option key={status.value} value={status.value} className="bg-slate-800">
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Driver's License Photo */}
          <div>
            <h3 className="text-white font-semibold mb-4">Driver's License</h3>
            <div className="flex items-start gap-4">
              {formData.licensePhotoUrl ? (
                <div className="relative group">
                  <img
                    src={formData.licensePhotoUrl}
                    alt="Driver's License"
                    className="w-48 h-28 object-cover rounded-xl border border-white/15"
                  />
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, licensePhotoUrl: '' }))}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => licenseInputRef.current?.click()}
                  disabled={uploadingLicense}
                  className="w-48 h-28 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/5 hover:border-white/30 transition text-white/40 disabled:opacity-50"
                >
                  {uploadingLicense ? (
                    <Loader className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">Upload License</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={licenseInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLicenseUpload(file);
                  e.target.value = '';
                }}
              />
              <div className="flex-1">
                <p className="text-xs text-white/30">
                  Upload a photo of the tenant's driver's license for your records. The image is stored securely.
                </p>
              </div>
            </div>
          </div>

          {/* Lease Information */}
          <div>
            <h3 className="text-white font-semibold mb-4">Lease Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Lease Start Date</label>
                <input
                  type="date"
                  name="leaseStart"
                  value={formData.leaseStart}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Lease End Date</label>
                <input
                  type="date"
                  name="leaseEnd"
                  value={formData.leaseEnd}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                />
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div>
            <h3 className="text-white font-semibold mb-4">Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Monthly Rent</label>
                <input
                  type="number"
                  name="monthlyRent"
                  value={formData.monthlyRent}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Security Deposit</label>
                <input
                  type="number"
                  name="securityDeposit"
                  value={formData.securityDeposit}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-800/50 border-t border-white/15">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={uploadingLicense}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            Save Tenant
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantModal;
