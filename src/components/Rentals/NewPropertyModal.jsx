import React, { useState, useEffect } from 'react';
import { X, Upload, Loader } from 'lucide-react';
import { propertyTypes, propertyColors, propertyStatuses } from '../../constants';

const NewPropertyModal = ({ property, onSave, onClose, showToast }) => {
  const [formData, setFormData] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    type: 'single-family',
    units: 1,
    purchaseDate: '',
    purchasePrice: '',
    currentValue: '',
    monthlyRent: '',
    hasMortgage: false,
    mortgageBalance: '',
    mortgageAPR: '',
    mortgageMonthlyPayment: '',
    escrowMonthly: '',
    mortgageLender: '',
    mortgageStartDate: '',
    notes: '',
    color: 'from-teal-400 to-cyan-500',
    emoji: '🏠',
    photo: null,
    propertyStatus: '',
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Pre-fill if editing
  useEffect(() => {
    if (property && typeof property === 'object' && property.id) {
      setFormData(property);
      if (property.photo) {
        setPhotoPreview(property.photo);
      }
    } else {
      resetForm();
    }
  }, [property]);

  const resetForm = () => {
    setFormData({
      name: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      type: 'single-family',
      units: 1,
      purchaseDate: '',
      purchasePrice: '',
      currentValue: '',
      monthlyRent: '',
      hasMortgage: false,
      mortgageBalance: '',
      mortgageAPR: '',
      mortgageMonthlyPayment: '',
      escrowMonthly: '',
      mortgageLender: '',
      mortgageStartDate: '',
      notes: '',
      color: 'from-teal-400 to-cyan-500',
      emoji: '🏠',
      photo: null,
    });
    setPhotoPreview(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photo: reader.result,
        }));
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          photo: reader.result,
        }));
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      if (showToast) showToast('Property name is required', 'error');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800/95 border border-white/15 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-5 bg-slate-800 border-b border-white/15 z-10">
          <h2 className="text-2xl font-bold text-white">
            {property && typeof property === 'object' && property.id ? 'Edit Property' : 'Add New Property'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-white font-semibold mb-3">Property Photo</label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="relative border-2 border-dashed border-white/30 rounded-xl p-8 text-center hover:border-white/50 transition cursor-pointer bg-white/5"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {photoPreview ? (
                <div className="space-y-2">
                  <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
                  <p className="text-slate-400 text-sm">Click or drag to change photo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-white font-medium">Drop photo here or click to upload</p>
                  <p className="text-slate-400 text-sm">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-white font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Property Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Downtown Apartment Complex"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Property Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                >
                  {propertyTypes.map(type => (
                    <option key={type.value} value={type.value} className="bg-slate-800">
                      {type.emoji} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Status</label>
                <select
                  name="propertyStatus"
                  value={formData.propertyStatus}
                  onChange={handleChange}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                >
                  <option value="" className="bg-slate-800">Auto-detect</option>
                  {propertyStatuses.map(s => (
                    <option key={s.value} value={s.value} className="bg-slate-800">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-white font-semibold mb-4">Address</h3>
            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="Street address"
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                  maxLength="2"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
                <input
                  type="text"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  placeholder="Zip code"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div>
            <h3 className="text-white font-semibold mb-4">Property Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Number of Units</label>
                <input
                  type="number"
                  name="units"
                  value={formData.units}
                  onChange={handleChange}
                  min="1"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Purchase Date</label>
                <input
                  type="date"
                  name="purchaseDate"
                  value={formData.purchaseDate}
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
                <label className="block text-slate-400 text-sm mb-2">Purchase Price</label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Current Value</label>
                <input
                  type="number"
                  name="currentValue"
                  value={formData.currentValue}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                />
              </div>
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
            </div>
          </div>

          {/* Mortgage Information */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Mortgage Information</h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  hasMortgage: !prev.hasMortgage,
                  ...(!prev.hasMortgage ? {} : { mortgageBalance: '', mortgageAPR: '', mortgageMonthlyPayment: '', escrowMonthly: '', mortgageLender: '', mortgageStartDate: '' })
                }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  formData.hasMortgage
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                    : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
                }`}
              >
                {formData.hasMortgage ? 'Has Mortgage' : 'No Mortgage'}
              </button>
            </div>
            {formData.hasMortgage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Lender</label>
                  <input
                    type="text"
                    name="mortgageLender"
                    value={formData.mortgageLender || ''}
                    onChange={handleChange}
                    placeholder="e.g., Chase, Wells Fargo"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Loan Balance</label>
                  <input
                    type="number"
                    name="mortgageBalance"
                    value={formData.mortgageBalance || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">APR (%)</label>
                  <input
                    type="number"
                    name="mortgageAPR"
                    value={formData.mortgageAPR || ''}
                    onChange={handleChange}
                    placeholder="e.g., 6.5"
                    step="0.01"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Monthly P&I Payment</label>
                  <input
                    type="number"
                    name="mortgageMonthlyPayment"
                    value={formData.mortgageMonthlyPayment || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Monthly Escrow (Tax + Insurance)</label>
                  <input
                    type="number"
                    name="escrowMonthly"
                    value={formData.escrowMonthly || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Loan Start Date</label>
                  <input
                    type="date"
                    name="mortgageStartDate"
                    value={formData.mortgageStartDate || ''}
                    onChange={handleChange}
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Customization */}
          <div>
            <h3 className="text-white font-semibold mb-4">Customization</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Card Color</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'from-teal-400 to-cyan-500', label: 'Teal' },
                    { value: 'from-blue-400 to-indigo-500', label: 'Blue' },
                    { value: 'from-emerald-400 to-teal-500', label: 'Emerald' },
                    { value: 'from-purple-400 to-violet-500', label: 'Purple' },
                    { value: 'from-amber-400 to-orange-500', label: 'Amber' },
                    { value: 'from-rose-400 to-pink-500', label: 'Rose' },
                    { value: 'from-cyan-400 to-blue-500', label: 'Cyan' },
                    { value: 'from-green-400 to-emerald-500', label: 'Green' },
                  ].map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: c.value }))}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition ${
                        formData.color === c.value ? 'border-white' : 'border-transparent hover:border-white/30'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.value}`} />
                      <span className="text-[10px] text-white/60">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Emoji</label>
                <input
                  type="text"
                  name="emoji"
                  value={formData.emoji}
                  onChange={handleChange}
                  maxLength="2"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition text-center text-2xl"
                />
              </div>
            </div>
          </div>

          {/* HOA Information */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">HOA Information</h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  hasHoa: !prev.hasHoa,
                  ...(!prev.hasHoa ? {} : { hoaName: '', hoaWebsite: '', hoaPhone: '', hoaEmail: '' })
                }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  formData.hasHoa
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
                }`}
              >
                {formData.hasHoa ? 'Has HOA' : 'No HOA'}
              </button>
            </div>
            {formData.hasHoa && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">HOA Name</label>
                  <input
                    type="text"
                    name="hoaName"
                    value={formData.hoaName || ''}
                    onChange={handleChange}
                    placeholder="e.g., Sunset Hills HOA"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Website</label>
                  <input
                    type="url"
                    name="hoaWebsite"
                    value={formData.hoaWebsite || ''}
                    onChange={handleChange}
                    placeholder="https://example-hoa.com"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Phone</label>
                  <input
                    type="tel"
                    name="hoaPhone"
                    value={formData.hoaPhone || ''}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    name="hoaEmail"
                    value={formData.hoaEmail || ''}
                    onChange={handleChange}
                    placeholder="contact@hoa.com"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 text-sm mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional notes about this property..."
              rows="4"
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition"
            />
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
            disabled={uploading}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg transition flex items-center gap-2"
          >
            {uploading && <Loader className="w-4 h-4 animate-spin" />}
            Save Property
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewPropertyModal;
