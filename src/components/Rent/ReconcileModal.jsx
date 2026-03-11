import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils';

/**
 * ReconcileModal — Monthly report reconciliation dialog.
 *
 * For each management company it shows:
 *   1. Dashboard subtotals (rent, mgmt fee, repairs, supplies, utilities, owner dist)
 *   2. Input fields for the management company statement totals
 *   3. Auto-match indicator (green check or red warning)
 *   4. Manual "Confirmed" checkbox for mom to sign off
 *
 * Props:
 *   month          – "YYYY-MM" string
 *   monthLabel     – display label like "February 2026"
 *   reportData     – array of { manager, totals: { rent, mgmtFee, repairs, supplies, utilities, dist } }
 *   mgrEmoji       – { "Absolute": "🏠", ... }
 *   mgrColors      – { "Absolute": "text-teal-400 ...", ... }
 *   existing       – current reconciliation data for this month (from Firestore)
 *   onSave         – (monthData) => void — saves the full month reconciliation object
 *   onClose        – () => void
 */
export default function ReconcileModal({ month, monthLabel, reportData, mgrEmoji, mgrColors, existing, onSave, onClose }) {
  // Local state: per-manager form data
  // Shape: { "Absolute": { statementTotal: number|"", confirmed: bool }, ... }
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const init = {};
    reportData.forEach(group => {
      const prev = existing?.[group.manager];
      init[group.manager] = {
        statementTotal: prev?.statementTotal ?? '',
        confirmed: prev?.confirmed ?? false,
      };
    });
    setFormData(init);
  }, [reportData, existing]);

  const updateManager = (mgr, field, value) => {
    setFormData(prev => ({
      ...prev,
      [mgr]: { ...prev[mgr], [field]: value },
    }));
  };

  const handleSave = () => {
    const result = {};
    reportData.forEach(group => {
      const mgr = group.manager;
      const fd = formData[mgr] || {};
      const dashboardTotal = group.totals.rent - group.totals.mgmtFee - group.totals.repairs - group.totals.supplies - group.totals.utilities;
      const statementVal = fd.statementTotal === '' ? null : parseFloat(fd.statementTotal);
      const autoMatch = statementVal !== null ? Math.abs(statementVal - dashboardTotal) < 0.01 : null;

      result[mgr] = {
        confirmed: fd.confirmed || false,
        statementTotal: statementVal,
        dashboardTotal: Math.round(dashboardTotal * 100) / 100,
        autoMatch,
        reconciledAt: (fd.confirmed || autoMatch) ? new Date().toISOString() : (existing?.[mgr]?.reconciledAt || null),
      };
    });
    onSave(result);
  };

  // Check if all managers are reconciled (confirmed or auto-match)
  const allReconciled = reportData.every(group => {
    const fd = formData[group.manager] || {};
    const dashboardTotal = group.totals.rent - group.totals.mgmtFee - group.totals.repairs - group.totals.supplies - group.totals.utilities;
    const statementVal = fd.statementTotal === '' ? null : parseFloat(fd.statementTotal);
    const autoMatch = statementVal !== null ? Math.abs(statementVal - dashboardTotal) < 0.01 : false;
    return fd.confirmed || autoMatch;
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Reconcile Data</h2>
            <p className="text-xs text-white/40">{monthLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <p className="text-xs text-white/40 mb-4">
          Compare management company statement totals with imported data. Owner-paid expenses (FFB bank, manual) are excluded from these totals.
        </p>

        {/* Per-manager sections */}
        <div className="space-y-4">
          {reportData.map(group => {
            const mgr = group.manager;
            const fd = formData[mgr] || { statementTotal: '', confirmed: false };
            const gc = mgrColors[mgr] || 'text-white/50';
            const colorClass = gc.split(' ')[0];

            // Net income = rent - expenses (what the owner should receive before dist)
            const dashboardTotal = group.totals.rent - group.totals.mgmtFee - group.totals.repairs - group.totals.supplies - group.totals.utilities;
            const statementVal = fd.statementTotal === '' ? null : parseFloat(fd.statementTotal);
            const autoMatch = statementVal !== null ? Math.abs(statementVal - dashboardTotal) < 0.01 : null;
            const isReconciled = fd.confirmed || autoMatch === true;
            const hasMismatch = autoMatch === false && !fd.confirmed;

            return (
              <div
                key={mgr}
                className={`border rounded-2xl p-4 transition ${
                  isReconciled
                    ? 'border-green-500/30 bg-green-500/[0.04]'
                    : hasMismatch
                    ? 'border-red-500/20 bg-red-500/[0.03]'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                {/* Manager name */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-bold ${colorClass}`}>
                    {mgrEmoji[mgr] || '📋'} {mgr}
                  </span>
                  {isReconciled && (
                    <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Reconciled
                    </span>
                  )}
                  {hasMismatch && (
                    <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Mismatch
                    </span>
                  )}
                </div>

                {/* Dashboard breakdown */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Rent</span>
                    <span className="text-emerald-400/80">{formatCurrency(group.totals.rent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Mgmt Fee</span>
                    <span className="text-yellow-400/60">-{formatCurrency(group.totals.mgmtFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Repairs</span>
                    <span className="text-red-400/60">-{formatCurrency(group.totals.repairs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Supplies</span>
                    <span className="text-amber-400/60">-{formatCurrency(group.totals.supplies)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Utilities</span>
                    <span className="text-orange-400/60">-{formatCurrency(group.totals.utilities)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Owner Dist</span>
                    <span className="text-blue-400/60">{formatCurrency(group.totals.dist)}</span>
                  </div>
                </div>

                {/* Managed net total (statement data only) */}
                <div className="flex items-center justify-between py-2 px-3 mb-3 bg-white/[0.04] rounded-xl">
                  <span className="text-xs font-semibold text-white/60">Statement Data Total</span>
                  <span className="text-sm font-bold text-white">{formatCurrency(dashboardTotal)}</span>
                </div>

                {/* Statement total input + comparison */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40 mb-1 block uppercase tracking-wider">Statement Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fd.statementTotal}
                      onChange={e => updateManager(mgr, 'statementTotal', e.target.value)}
                      placeholder="Enter amount from statement..."
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  {statementVal !== null && (
                    <div className="pt-4">
                      {autoMatch ? (
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-[10px] text-green-400 font-medium">Match</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-[9px] text-red-400 font-medium">
                            {formatCurrency(statementVal - dashboardTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual confirmation checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fd.confirmed}
                    onChange={e => updateManager(mgr, 'confirmed', e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className={`text-xs ${fd.confirmed ? 'text-green-400 font-medium' : 'text-white/40'}`}>
                    I confirm this management company's data is correct
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-xs text-white/30">
            {allReconciled
              ? <span className="text-green-400 font-medium">All management companies reconciled</span>
              : 'Review and confirm each management company'
            }
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
