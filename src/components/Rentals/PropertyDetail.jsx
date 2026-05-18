import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit3, MapPin, User, DollarSign, Calendar, Phone, Mail, FileText, Image, Trash2, Plus, Lightbulb, X, Globe, Building2, TrendingUp, TrendingDown, Wrench, AlertTriangle } from 'lucide-react';
import { tenantStatuses, capitalConditions } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const PropertyDetail = ({ property, onBack, onEdit, onDelete, onEditTenant, onAddTenant, onRemoveTenant, onUpdateProperty, expenses = [], rentPayments = [] }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: '', description: '', priority: 'medium' });
  const [showAddCapital, setShowAddCapital] = useState(false);
  const [editingCapitalId, setEditingCapitalId] = useState(null);
  const [capitalForm, setCapitalForm] = useState({ name: '', installDate: '', expectedLifespan: '', estimatedReplacementCost: '', condition: 'good', notes: '' });

  if (!property) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Select a property to view details</p>
      </div>
    );
  }

  const tenants = getPropertyTenants(property);

  const getTenantStatusInfo = (status) => {
    return tenantStatuses.find(s => s.value === status);
  };

  const getDaysUntilExpiration = (leaseEnd) => {
    if (!leaseEnd) return null;
    const end = new Date(leaseEnd);
    const today = new Date();
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Financial calculations
  const currentYear = new Date().getFullYear();
  const propId = String(property.id);

  const ytdRent = (rentPayments || [])
    .filter(p => String(p.propertyId) === propId && ['paid', 'partial'].includes(p.status))
    .filter(p => { const d = p.datePaid || p.month; return d && d.startsWith(String(currentYear)); })
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const ytdExpenses = (expenses || [])
    .filter(e => String(e.propertyId) === propId && e.isTemplate !== true)
    .filter(e => e.date && e.date.startsWith(String(currentYear)))
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const ytdProfit = ytdRent - ytdExpenses;
  const monthlyRent = parseFloat(property.monthlyRent) || 0;

  // Average monthly expenses (based on months elapsed this year)
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
  const avgMonthlyExpenses = ytdExpenses / monthsElapsed;
  const monthlyNet = monthlyRent - avgMonthlyExpenses;

  // Capital items helpers
  const capitalItems = property.capitalItems || [];
  const getRemainingLife = (item) => {
    if (!item.installDate || !item.expectedLifespan) return null;
    const installed = new Date(item.installDate + 'T00:00:00');
    const lifespanMs = item.expectedLifespan * 365.25 * 24 * 60 * 60 * 1000;
    const endDate = new Date(installed.getTime() + lifespanMs);
    const now = new Date();
    const totalMs = lifespanMs;
    const usedMs = now - installed;
    const pct = Math.max(0, Math.min(100, ((totalMs - usedMs) / totalMs) * 100));
    const yearsLeft = Math.max(0, (endDate - now) / (365.25 * 24 * 60 * 60 * 1000));
    return { pct, yearsLeft, endDate };
  };

  const sortedCapitalItems = [...capitalItems].sort((a, b) => {
    const aLife = getRemainingLife(a);
    const bLife = getRemainingLife(b);
    if (!aLife && !bLife) return 0;
    if (!aLife) return 1;
    if (!bLife) return -1;
    return aLife.pct - bLife.pct;
  });

  const resetCapitalForm = () => {
    setCapitalForm({ name: '', installDate: '', expectedLifespan: '', estimatedReplacementCost: '', condition: 'good', notes: '' });
    setEditingCapitalId(null);
    setShowAddCapital(false);
  };

  const saveCapitalItem = () => {
    if (!capitalForm.name.trim()) return;
    let items;
    if (editingCapitalId) {
      items = capitalItems.map(i => i.id === editingCapitalId ? { ...i, ...capitalForm, expectedLifespan: parseFloat(capitalForm.expectedLifespan) || 0, estimatedReplacementCost: parseFloat(capitalForm.estimatedReplacementCost) || 0 } : i);
    } else {
      items = [...capitalItems, {
        ...capitalForm,
        id: Date.now().toString(),
        expectedLifespan: parseFloat(capitalForm.expectedLifespan) || 0,
        estimatedReplacementCost: parseFloat(capitalForm.estimatedReplacementCost) || 0,
        createdAt: new Date().toISOString(),
      }];
    }
    onUpdateProperty(property.id, { capitalItems: items });
    resetCapitalForm();
  };

  const deleteCapitalItem = (itemId) => {
    const items = capitalItems.filter(i => i.id !== itemId);
    onUpdateProperty(property.id, { capitalItems: items });
  };

  const getConditionInfo = (cond) => capitalConditions.find(c => c.value === cond) || capitalConditions[0];

  const getLifeBarColor = (pct) => {
    if (pct > 50) return 'bg-emerald-500';
    if (pct > 25) return 'bg-yellow-500';
    if (pct > 10) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/95 border-b border-white/15">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{property.name}</h1>
              <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                <MapPin className="w-4 h-4" />
                <span>{property.street}, {property.city}, {property.state} {property.zip}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(property)} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
              <Edit3 className="w-6 h-6" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 hover:bg-red-500/10 rounded-lg transition text-slate-400 hover:text-red-400">
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-6 border-t border-white/10 overflow-x-auto">
          {['overview', 'capital', 'photos', 'notes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 transition capitalize ${
                activeTab === tab ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Photo */}
            {property.photo && (
              <div className="aspect-video rounded-xl overflow-hidden">
                <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Financial Performance Card */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Financial Performance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-1">Monthly Rent</p>
                  <p className="text-emerald-400 font-bold text-lg">{formatCurrency(monthlyRent)}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-1">Avg Monthly Expenses</p>
                  <p className="text-red-400 font-bold text-lg">{formatCurrency(avgMonthlyExpenses)}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <p className="text-white/40 text-xs mb-1">Monthly Net</p>
                  <p className={`font-bold text-lg ${monthlyNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {monthlyNet >= 0 ? '' : '-'}{formatCurrency(Math.abs(monthlyNet))}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-white/40 text-xs">YTD Rent</p>
                    <p className="text-emerald-400 font-semibold">{formatCurrency(ytdRent)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-xs">YTD Expenses</p>
                    <p className="text-red-400 font-semibold">{formatCurrency(ytdExpenses)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-xs">YTD Profit/Loss</p>
                    <p className={`font-semibold ${ytdProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(ytdProfit)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Information */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Property Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Property Type</p>
                  <p className="text-white font-medium">{property.type}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Number of Units</p>
                  <p className="text-white font-medium">{property.units}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Purchase Date</p>
                  <p className="text-white font-medium">{property.purchaseDate || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Purchase Price</p>
                  <p className="text-white font-medium">${property.purchasePrice ? parseFloat(property.purchasePrice).toLocaleString() : '0'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Current Value</p>
                  <p className="text-white font-medium">${property.currentValue ? parseFloat(property.currentValue).toLocaleString() : '0'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Monthly Rent</p>
                  <p className="text-white font-medium">${property.monthlyRent ? parseFloat(property.monthlyRent).toLocaleString() : '0'}/month</p>
                </div>
              </div>
            </div>

            {/* Tenants Section */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Tenants ({tenants.length})</h2>
                <button
                  onClick={() => onAddTenant()}
                  className="text-sm px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Tenant
                </button>
              </div>

              {tenants.length > 0 ? (
                <div className="space-y-4">
                  {tenants.map((tenant, idx) => {
                    const daysLeft = getDaysUntilExpiration(tenant.leaseEnd);
                    return (
                      <div key={tenant.id || idx} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-slate-400" />
                            <h3 className="text-white font-semibold">{tenant.name}</h3>
                            <span className={`text-xs font-medium ${getTenantStatusInfo(tenant.status)?.color || 'text-slate-400'}`}>
                              {getTenantStatusInfo(tenant.status)?.label || tenant.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onEditTenant(tenant)}
                              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onRemoveTenant(tenant.id)}
                              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {tenant.email && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Mail className="w-3.5 h-3.5" /> {tenant.email}
                            </div>
                          )}
                          {tenant.phone && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Phone className="w-3.5 h-3.5" /> {tenant.phone}
                            </div>
                          )}
                          {tenant.leaseStart && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Calendar className="w-3.5 h-3.5" /> Start: {tenant.leaseStart}
                            </div>
                          )}
                          {tenant.leaseEnd && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Calendar className="w-3.5 h-3.5" /> End: {tenant.leaseEnd}
                              {daysLeft !== null && daysLeft <= 60 && (
                                <span className={`text-xs ml-1 ${daysLeft <= 30 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                  ({daysLeft}d left)
                                </span>
                              )}
                            </div>
                          )}
                          {tenant.monthlyRent && (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <DollarSign className="w-3.5 h-3.5" /> ${parseFloat(tenant.monthlyRent).toLocaleString()}/mo
                            </div>
                          )}
                          {tenant.securityDeposit && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <DollarSign className="w-3.5 h-3.5" /> Deposit: ${parseFloat(tenant.securityDeposit).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-400 mb-4">No tenants assigned to this property</p>
                  <button
                    onClick={() => onAddTenant()}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tenant
                  </button>
                </div>
              )}
            </div>

            {/* HOA Information */}
            {property.hasHoa && (property.hoaName || property.hoaWebsite || property.hoaPhone || property.hoaEmail) && (
              <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  HOA
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {property.hoaName && (
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Name</p>
                      <p className="text-white font-medium">{property.hoaName}</p>
                    </div>
                  )}
                  {property.hoaWebsite && (
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Website</p>
                      <a
                        href={property.hoaWebsite.startsWith('http') ? property.hoaWebsite : `https://${property.hoaWebsite}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition font-medium"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        {property.hoaWebsite.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {property.hoaPhone && (
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Phone</p>
                      <a href={`tel:${property.hoaPhone}`} className="flex items-center gap-1.5 text-white/70 hover:text-white transition">
                        <Phone className="w-3.5 h-3.5" />
                        {property.hoaPhone}
                      </a>
                    </div>
                  )}
                  {property.hoaEmail && (
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Email</p>
                      <a href={`mailto:${property.hoaEmail}`} className="flex items-center gap-1.5 text-white/70 hover:text-white transition">
                        <Mail className="w-3.5 h-3.5" />
                        {property.hoaEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {property.notes && (
              <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </h2>
                <p className="text-slate-300 whitespace-pre-wrap">{property.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'capital' && (
          <div className="space-y-6">
            {/* Capital Items Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-teal-400" />
                  Capital Items
                </h2>
                <button
                  onClick={() => { setShowAddCapital(true); resetCapitalForm(); setShowAddCapital(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 text-teal-300 rounded-lg text-sm font-medium hover:bg-teal-500/30 transition"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              {/* Add/Edit Capital Form */}
              {showAddCapital && (
                <div className="bg-slate-800/80 border border-white/15 rounded-xl p-4 space-y-3 mb-4">
                  <input type="text" value={capitalForm.name} onChange={e => setCapitalForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Item name (e.g., HVAC System, Water Heater, Roof)"
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" autoFocus />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Install Date</label>
                      <input type="date" value={capitalForm.installDate} onChange={e => setCapitalForm(f => ({ ...f, installDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Expected Lifespan (years)</label>
                      <input type="number" value={capitalForm.expectedLifespan} onChange={e => setCapitalForm(f => ({ ...f, expectedLifespan: e.target.value }))}
                        placeholder="e.g., 15"
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Replacement Cost</label>
                      <input type="number" value={capitalForm.estimatedReplacementCost} onChange={e => setCapitalForm(f => ({ ...f, estimatedReplacementCost: e.target.value }))}
                        placeholder="e.g., 8000"
                        className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Condition</label>
                      <div className="flex gap-1.5">
                        {capitalConditions.map(c => (
                          <button key={c.value} onClick={() => setCapitalForm(f => ({ ...f, condition: c.value }))}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                              capitalForm.condition === c.value
                                ? `${c.bg} ${c.color} ${c.border} border`
                                : 'bg-white/[0.05] text-white/40 border border-transparent hover:bg-white/10'
                            }`}>{c.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <textarea value={capitalForm.notes} onChange={e => setCapitalForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes (brand, model, warranty info...)" rows={2}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={resetCapitalForm} className="px-3 py-1.5 text-white/50 hover:text-white text-sm transition">Cancel</button>
                    <button onClick={saveCapitalItem} disabled={!capitalForm.name.trim()}
                      className="px-4 py-1.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition disabled:opacity-50">
                      {editingCapitalId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Capital Items List */}
              {sortedCapitalItems.length === 0 && !showAddCapital && (
                <div className="py-12 text-center text-slate-400">
                  <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No capital items tracked</p>
                  <p className="text-xs text-white/30 mt-1">Track HVAC, roof, water heater, appliances and their remaining useful life</p>
                </div>
              )}

              {sortedCapitalItems.map(item => {
                const life = getRemainingLife(item);
                const condInfo = getConditionInfo(item.condition);
                return (
                  <div key={item.id} className="bg-slate-800/50 border border-white/15 rounded-xl p-4 mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{item.name}</h3>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${condInfo.bg} ${condInfo.color} border ${condInfo.border}`}>
                            {condInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-white/40">
                          {item.installDate && <span>Installed: {item.installDate}</span>}
                          {item.expectedLifespan > 0 && <span>{item.expectedLifespan}yr lifespan</span>}
                          {item.estimatedReplacementCost > 0 && (
                            <span className="text-orange-400">Replace: {formatCurrency(item.estimatedReplacementCost)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={() => {
                          setCapitalForm({
                            name: item.name, installDate: item.installDate || '', expectedLifespan: item.expectedLifespan || '',
                            estimatedReplacementCost: item.estimatedReplacementCost || '', condition: item.condition || 'good', notes: item.notes || '',
                          });
                          setEditingCapitalId(item.id);
                          setShowAddCapital(true);
                        }} className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/40 hover:text-white">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteCapitalItem(item.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-white/40 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Remaining life progress bar */}
                    {life && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/40">Remaining Life</span>
                          <span className={`font-medium ${life.yearsLeft < 2 ? 'text-red-400' : life.yearsLeft < 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {life.yearsLeft < 1 ? `${Math.round(life.yearsLeft * 12)}mo` : `${life.yearsLeft.toFixed(1)}yr`}
                            {life.yearsLeft <= 0 && (
                              <span className="ml-1 text-red-400 flex items-center gap-0.5 inline-flex">
                                <AlertTriangle className="w-3 h-3" /> Past due
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${getLifeBarColor(life.pct)}`}
                            style={{ width: `${Math.max(2, life.pct)}%` }} />
                        </div>
                      </div>
                    )}

                    {item.notes && <p className="text-xs text-white/30 mt-2">{item.notes}</p>}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            {(capitalItems.length > 0 || showAddCapital) && (
              <div className="border-t border-white/10 pt-6" />
            )}

            {/* Upgrade Ideas (preserved from old Ideas tab) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  Upgrade Ideas
                </h2>
                <button
                  onClick={() => { setShowAddIdea(true); setIdeaForm({ title: '', description: '', priority: 'medium' }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition"
                >
                  <Plus className="w-4 h-4" /> Add Idea
                </button>
              </div>

              {showAddIdea && (
                <div className="bg-slate-800/80 border border-white/15 rounded-xl p-4 space-y-3 mb-4">
                  <input type="text" value={ideaForm.title} onChange={e => setIdeaForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Idea title (e.g., New kitchen countertops)"
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50" autoFocus />
                  <textarea value={ideaForm.description} onChange={e => setIdeaForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Details, estimated cost, notes..." rows={2}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Priority:</label>
                    {['high', 'medium', 'low'].map(p => (
                      <button key={p} onClick={() => setIdeaForm(f => ({ ...f, priority: p }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
                          ideaForm.priority === p
                            ? p === 'high' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : p === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-white/10 text-white/60 border border-white/20'
                            : 'bg-white/[0.05] text-white/40 border border-transparent hover:bg-white/10'
                        }`}>{p}</button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddIdea(false)} className="px-3 py-1.5 text-white/50 hover:text-white text-sm transition">Cancel</button>
                    <button
                      onClick={() => {
                        if (!ideaForm.title.trim()) return;
                        const ideas = [...(property.ideas || []), {
                          id: Date.now().toString(), title: ideaForm.title, description: ideaForm.description,
                          priority: ideaForm.priority, status: 'idea', createdAt: new Date().toISOString(),
                        }];
                        onUpdateProperty(property.id, { ideas });
                        setShowAddIdea(false);
                        setIdeaForm({ title: '', description: '', priority: 'medium' });
                      }}
                      disabled={!ideaForm.title.trim()}
                      className="px-4 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition disabled:opacity-50"
                    >Save</button>
                  </div>
                </div>
              )}

              {(property.ideas || []).length === 0 && !showAddIdea && (
                <div className="py-8 text-center text-slate-400">
                  <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No upgrade ideas yet</p>
                </div>
              )}

              {(property.ideas || []).map(idea => (
                <div key={idea.id} className="bg-slate-800/50 border border-white/15 rounded-xl p-4 mb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          idea.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                          idea.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/50'
                        }`}>{idea.priority}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          idea.status === 'done' ? 'bg-green-500/20 text-green-300' :
                          idea.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white/50'
                        }`}>{idea.status || 'idea'}</span>
                      </div>
                      <h3 className="text-white font-medium">{idea.title}</h3>
                      {idea.description && <p className="text-sm text-white/50 mt-1">{idea.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {idea.status !== 'done' && (
                        <button onClick={() => {
                          const ideas = (property.ideas || []).map(i => i.id === idea.id ? { ...i, status: i.status === 'in-progress' ? 'done' : 'in-progress' } : i);
                          onUpdateProperty(property.id, { ideas });
                        }} className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/40 hover:text-green-400 text-xs"
                          title={idea.status === 'in-progress' ? 'Mark done' : 'Start'}>
                          {idea.status === 'in-progress' ? '✅' : '▶️'}
                        </button>
                      )}
                      <button onClick={() => {
                        const ideas = (property.ideas || []).filter(i => i.id !== idea.id);
                        onUpdateProperty(property.id, { ideas });
                      }} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-white/40 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="py-8">
            {property.photo ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-xl overflow-hidden">
                  <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No photos yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {property.notes ? (
              <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
                <p className="text-slate-300 whitespace-pre-wrap">{property.notes}</p>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notes yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/95 border border-white/15 rounded-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Delete Property?</h3>
            <p className="text-slate-400 mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">Cancel</button>
              <button onClick={() => { onDelete(property.id); setShowDeleteConfirm(false); }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
