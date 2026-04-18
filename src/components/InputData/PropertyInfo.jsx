import React, { useState } from 'react';
import { Check, Shield, Receipt, Save } from 'lucide-react';
import HelpTip from '../HelpTip';
import { formatCurrency } from '../../utils';

/**
 * PropertyInfo — inline-editable table of annual property tax + insurance for each property.
 * These values feed directly into the Schedule E "Taxes" and "Insurance" lines at year-end.
 */
export default function PropertyInfo({ properties, updateProperty, showToast }) {
  const [draft, setDraft] = useState({}); // { propertyId: { propertyTaxAnnual, insuranceAnnual } }
  const [saving, setSaving] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);

  const getVal = (p, field) => {
    if (draft[p.id] && draft[p.id][field] !== undefined) return draft[p.id][field];
    return p[field] !== undefined && p[field] !== null ? String(p[field]) : '';
  };

  const setDraftField = (id, field, value) => {
    setDraft(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSave = async (p) => {
    const d = draft[p.id];
    if (!d) return;
    const updates = {};
    if (d.propertyTaxAnnual !== undefined) {
      const num = parseFloat(d.propertyTaxAnnual);
      updates.propertyTaxAnnual = isNaN(num) ? '' : num;
    }
    if (d.insuranceAnnual !== undefined) {
      const num = parseFloat(d.insuranceAnnual);
      updates.insuranceAnnual = isNaN(num) ? '' : num;
    }
    setSaving(p.id);
    try {
      updateProperty(p.id, updates);
      setDraft(prev => { const next = { ...prev }; delete next[p.id]; return next; });
      setSavedFlash(p.id);
      setTimeout(() => setSavedFlash(null), 2000);
      showToast && showToast(`Saved ${p.name || 'property'}`, 'success');
    } finally {
      setSaving(null);
    }
  };

  const hasDraft = (id) => !!draft[id] && Object.keys(draft[id]).length > 0;

  const missingCount = properties.filter(p =>
    !(parseFloat(p.propertyTaxAnnual) > 0) || !(parseFloat(p.insuranceAnnual) > 0)
  ).length;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-1.5">
          Property taxes &amp; insurance
          <HelpTip label="Why this matters">
            Property tax and insurance are the two biggest expenses that don&rsquo;t show up on the monthly
            management statements. Enter them once here and the app will include them in Schedule E
            (lines 9 and 16) at tax time.
          </HelpTip>
        </h3>
        <p className="text-xs text-white/50">
          Enter the <em>annual</em> amounts for each property. Leave blank if unknown.
          {missingCount > 0 && (
            <> <span className="text-amber-400 font-semibold">{missingCount} {missingCount === 1 ? 'property is' : 'properties are'} missing info.</span></>
          )}
        </p>
      </div>

      <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-white/50">
              <th className="text-left px-4 py-2">Property</th>
              <th className="text-right px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" /> Property tax / yr
                </span>
              </th>
              <th className="text-right px-4 py-2">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Insurance / yr
                </span>
              </th>
              <th className="px-4 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {properties.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/40 text-sm">
                  No properties yet.
                </td>
              </tr>
            )}
            {properties.map(p => {
              const hasTax = parseFloat(p.propertyTaxAnnual) > 0;
              const hasIns = parseFloat(p.insuranceAnnual) > 0;
              const complete = hasTax && hasIns;
              return (
                <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" aria-hidden="true">{p.emoji || '🏠'}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{p.name || 'Unnamed property'}</div>
                        {p.street && <div className="text-xs text-white/40">{p.street}</div>}
                      </div>
                      {complete && <span className="text-emerald-400 text-sm" title="Both values set">✓</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-white/40 text-sm">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={getVal(p, 'propertyTaxAnnual')}
                        onChange={(e) => setDraftField(p.id, 'propertyTaxAnnual', e.target.value)}
                        className={`w-28 px-2 py-1.5 rounded-lg bg-white/5 border text-right text-white text-sm focus:outline-none focus:ring-1 ${
                          hasDraft(p.id) && draft[p.id].propertyTaxAnnual !== undefined
                            ? 'border-sky-400/50 focus:ring-sky-400/40'
                            : 'border-white/10 focus:ring-white/20'
                        }`}
                      />
                    </div>
                    {!hasTax && !hasDraft(p.id) && (
                      <div className="text-[10px] text-amber-400 mt-0.5">Missing</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-white/40 text-sm">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={getVal(p, 'insuranceAnnual')}
                        onChange={(e) => setDraftField(p.id, 'insuranceAnnual', e.target.value)}
                        className={`w-28 px-2 py-1.5 rounded-lg bg-white/5 border text-right text-white text-sm focus:outline-none focus:ring-1 ${
                          hasDraft(p.id) && draft[p.id].insuranceAnnual !== undefined
                            ? 'border-sky-400/50 focus:ring-sky-400/40'
                            : 'border-white/10 focus:ring-white/20'
                        }`}
                      />
                    </div>
                    {!hasIns && !hasDraft(p.id) && (
                      <div className="text-[10px] text-amber-400 mt-0.5">Missing</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {hasDraft(p.id) ? (
                      <button
                        onClick={() => handleSave(p)}
                        disabled={saving === p.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 transition disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving === p.id ? 'Saving…' : 'Save'}
                      </button>
                    ) : savedFlash === p.id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40 mt-3">
        Values change? Come back anytime — they&rsquo;re only used for year-end reporting, not per-month totals.
      </p>
    </div>
  );
}
