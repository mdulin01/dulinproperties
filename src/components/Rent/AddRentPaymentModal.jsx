import React, { useState, useEffect } from 'react';
import { X, Trash2, Split, Plus } from 'lucide-react';
import { rentStatuses, incomeCategories } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';

export default function AddRentPaymentModal({ payment, properties, onSave, onDelete, onClose }) {
  const isEditing = payment && payment.id;

  const [form, setForm] = useState({
    propertyId: '',
    tenantName: '',
    propertyName: '',
    category: 'rent',
    month: '',
    amount: '',
    datePaid: '',
    status: 'paid',
    notes: '',
  });

  // Split mode — one bank deposit (e.g. an Absolute/B&H lump sum) divided across
  // several properties. Each row gets its own amount; they must sum to the total.
  const [splitMode, setSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { propertyId: '', amount: '' },
    { propertyId: '', amount: '' },
  ]);

  useEffect(() => {
    if (isEditing) {
      setForm({
        propertyId: payment.propertyId || '',
        tenantName: payment.tenantName || '',
        propertyName: payment.propertyName || '',
        category: payment.category || 'rent',
        month: payment.month || '',
        amount: payment.amount || '',
        datePaid: payment.datePaid || '',
        status: payment.status || 'paid',
        notes: payment.notes || '',
      });
    } else {
      // Default month to current
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setForm(f => ({ ...f, month: currentMonth, datePaid: now.toISOString().split('T')[0] }));
    }
  }, [payment, isEditing]);

  // Auto-fill tenant/property name when property selected
  const handlePropertyChange = (propertyId) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    const tenants = prop ? getPropertyTenants(prop) : [];
    const tenantNames = tenants.map(t => t.name).filter(Boolean).join(', ');
    // Use property-level monthlyRent (total for the property, not per-tenant)
    setForm(f => ({
      ...f,
      propertyId,
      propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
      tenantName: tenantNames || '',
      amount: f.amount || (prop?.monthlyRent || ''),
    }));
  };

  // ---- Split helpers ----
  const splitTotal = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const splitRemainder = (parseFloat(form.amount) || 0) - splitTotal;
  const splitValid = splitMode &&
    splitRows.filter(r => r.propertyId && parseFloat(r.amount) > 0).length >= 2 &&
    Math.abs(splitRemainder) < 0.01;
  const updateSplitRow = (i, field, value) =>
    setSplitRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addSplitRow = () => setSplitRows(rows => [...rows, { propertyId: '', amount: '' }]);
  const removeSplitRow = (i) => setSplitRows(rows => rows.length > 2 ? rows.filter((_, idx) => idx !== i) : rows);

  const handleSave = () => {
    // Split deposit → one income record per property, sharing month/date/category.
    if (splitMode && !isEditing) {
      if (!splitValid) return;
      const splitGroupId = `split-${Date.now()}`;
      const rows = splitRows
        .filter(r => r.propertyId && parseFloat(r.amount) > 0)
        .map(r => {
          const prop = properties.find(p => String(p.id) === String(r.propertyId));
          const tenants = prop ? getPropertyTenants(prop) : [];
          return {
            propertyId: r.propertyId,
            propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
            tenantName: tenants.map(t => t.name).filter(Boolean).join(', ') || '',
            category: form.category,
            month: form.month,
            amount: parseFloat(r.amount) || 0,
            datePaid: form.datePaid,
            status: form.status,
            notes: `${form.notes ? form.notes + ' · ' : ''}Split of $${(parseFloat(form.amount) || 0).toFixed(2)} deposit across ${splitRows.filter(x => x.propertyId).length} properties`.trim(),
            splitGroupId,
          };
        });
      onSave(rows);
      return;
    }

    if (!form.propertyId) return;
    onSave({
      ...form,
      amount: parseFloat(form.amount) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Income' : 'Record Income'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Split toggle (creation only) */}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setSplitMode(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition border ${
                splitMode
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                  : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              Split deposit across properties
            </button>
          )}

          {/* Property — single select (hidden in split mode) */}
          {!splitMode && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Property</label>
              <select
                value={form.propertyId}
                onChange={e => handlePropertyChange(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Select property...</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              {incomeCategories.map(c => (
                <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Tenant */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Tenant</label>
            <input
              type="text"
              value={form.tenantName}
              onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
              placeholder="Tenant name"
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Month */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Rent Month</label>
            <input
              type="month"
              value={form.month}
              onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Amount (the deposit total when splitting) */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">{splitMode ? 'Total Deposit' : 'Amount'}</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Split rows */}
          {splitMode && (
            <div className="bg-purple-500/[0.06] border border-purple-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-200">Divide the deposit across properties</span>
                <span className={`text-xs font-medium ${Math.abs(splitRemainder) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {Math.abs(splitRemainder) < 0.01 ? 'Balanced ✓' : `${splitRemainder > 0 ? 'Unallocated' : 'Over by'} $${Math.abs(splitRemainder).toFixed(2)}`}
                </span>
              </div>
              {splitRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={r.propertyId}
                    onChange={e => updateSplitRow(i, 'propertyId', e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">Select property…</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={r.amount}
                    onChange={e => updateSplitRow(i, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="w-24 px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplitRow(i)}
                    disabled={splitRows.length <= 2}
                    className="p-1.5 text-white/30 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSplitRow}
                className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
              >
                <Plus className="w-3.5 h-3.5" /> Add property
              </button>
            </div>
          )}

          {/* Date Paid */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Date Paid</label>
            <input
              type="date"
              value={form.datePaid}
              onChange={e => setForm(f => ({ ...f, datePaid: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Status</label>
            <div className="flex gap-2">
              {rentStatuses.map(s => (
                <button
                  key={s.value}
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition border ${
                    form.status === s.value
                      ? `${s.bg} ${s.border} ${s.color}`
                      : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          {isEditing && onDelete ? (
            <button
              onClick={() => onDelete(payment.id)}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition"
            >
              <Trash2 className="w-4 h-4 inline mr-1" /> Delete
            </button>
          ) : <div />}
          <button
            onClick={handleSave}
            disabled={splitMode ? !splitValid : !form.propertyId}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update' : splitMode ? `Save Split (${splitRows.filter(r => r.propertyId && parseFloat(r.amount) > 0).length})` : 'Record Income'}
          </button>
        </div>
      </div>
    </div>
  );
}
