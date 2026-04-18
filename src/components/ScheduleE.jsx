import React, { useMemo, useState } from 'react';
import { X, Download, Printer, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils';
import HelpTip from './HelpTip';

/**
 * ScheduleE — builds an IRS Form 1040 Schedule E summary per property from
 * the imported expenses + rent payments, with CSV export and browser-print
 * (save as PDF) support.
 *
 * Mapping of the app's expense categories → Schedule E line numbers:
 */
const CATEGORY_TO_LINE = {
  // Income
  'rent':              { line: 3,  label: 'Rents received' },
  'late-fee':          { line: 3,  label: 'Rents received' },           // treat as rent income
  'prepaid-rent':      { line: 3,  label: 'Rents received' },

  // Expense lines
  'advertising':       { line: 5,  label: 'Advertising' },
  'auto-travel':       { line: 6,  label: 'Auto and travel' },
  'cleaning':          { line: 7,  label: 'Cleaning and maintenance' },
  'pest-control':      { line: 7,  label: 'Cleaning and maintenance' },
  'landscaping':       { line: 7,  label: 'Cleaning and maintenance' },
  'commissions':       { line: 8,  label: 'Commissions' },
  'insurance':         { line: 9,  label: 'Insurance' },
  'legal':             { line: 10, label: 'Legal and other professional fees' },
  'management-fee':    { line: 11, label: 'Management fees' },
  'mortgage':          { line: 12, label: 'Mortgage interest paid to banks, etc.' },
  'mortgage-interest': { line: 12, label: 'Mortgage interest paid to banks, etc.' },
  'interest':          { line: 13, label: 'Other interest' },
  'repair':            { line: 14, label: 'Repairs' },
  'plumbing':          { line: 14, label: 'Repairs' },
  'electrical':        { line: 14, label: 'Repairs' },
  'hvac':              { line: 14, label: 'Repairs' },
  'appliance':         { line: 14, label: 'Repairs' },
  'make-ready':        { line: 14, label: 'Repairs' },
  'supplies':          { line: 15, label: 'Supplies' },
  'taxes':             { line: 16, label: 'Taxes' },
  'property-tax':      { line: 16, label: 'Taxes' },
  'utilities':         { line: 17, label: 'Utilities' },
  'internet':          { line: 17, label: 'Utilities' },
  'depreciation':      { line: 18, label: 'Depreciation expense or depletion' },
  'hoa':               { line: 19, label: 'Other (HOA)' },
  'software':          { line: 19, label: 'Other (Software)' },
  'other':             { line: 19, label: 'Other' },
};

// Lines 5–19 are expenses; Line 3 is income. This is the render order for the table.
const LINE_ORDER = [
  { line: 3,  label: 'Rents received' },
  { line: 5,  label: 'Advertising' },
  { line: 6,  label: 'Auto and travel' },
  { line: 7,  label: 'Cleaning and maintenance' },
  { line: 8,  label: 'Commissions' },
  { line: 9,  label: 'Insurance' },
  { line: 10, label: 'Legal and other professional fees' },
  { line: 11, label: 'Management fees' },
  { line: 12, label: 'Mortgage interest paid to banks, etc.' },
  { line: 13, label: 'Other interest' },
  { line: 14, label: 'Repairs' },
  { line: 15, label: 'Supplies' },
  { line: 16, label: 'Taxes' },
  { line: 17, label: 'Utilities' },
  { line: 18, label: 'Depreciation expense or depletion' },
  { line: 19, label: 'Other' },
];

function mapCategoryToLine(category) {
  return CATEGORY_TO_LINE[category] || { line: 19, label: `Other (${category || 'unclassified'})` };
}

function fmt(n) {
  return n ? formatCurrency(n) : '—';
}

function toCsv(rows) {
  return rows.map(row => row.map(cell => {
    const s = String(cell ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',')).join('\n');
}

export default function ScheduleE({ properties, expenses, rentPayments, onClose }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  // Build per-property totals. Keyed by propertyId → { propertyName, lines: {lineNum: total} }
  const byProperty = useMemo(() => {
    const yearStr = String(year);
    const acc = {};

    // Init with all properties (even ones with no activity that year, so the form shows them)
    for (const p of properties || []) {
      acc[p.id] = {
        propertyId: p.id,
        propertyName: p.name || 'Unnamed property',
        address: p.street || p.address || '',
        emoji: p.emoji || '🏠',
        lines: {},
        lineSources: {}, // line num → Set of category labels used
      };
    }
    const unassigned = {
      propertyId: 'unassigned',
      propertyName: '(No property)',
      address: '',
      emoji: '❓',
      lines: {},
      lineSources: {},
    };

    const bucket = (row, key) => (acc[row] || unassigned)[key];
    const ensure = (row) => acc[row] || (acc[row] === undefined ? (acc[row] = {
      propertyId: row,
      propertyName: row === 'unassigned' ? '(No property)' : row,
      address: '',
      emoji: '❓',
      lines: {},
      lineSources: {},
    }) : acc[row]);

    // Rent payments — each is income for line 3
    for (const rp of rentPayments || []) {
      if (rp.status !== 'paid') continue;
      const ym = rp.month || (rp.datePaid || '').slice(0, 7);
      if (!ym.startsWith(yearStr)) continue;
      const amt = parseFloat(rp.amount) || 0;
      if (!amt) continue;
      const row = ensure(String(rp.propertyId) || 'unassigned');
      row.lines[3] = (row.lines[3] || 0) + amt;
      if (!row.lineSources[3]) row.lineSources[3] = new Set();
      row.lineSources[3].add(rp.category || 'rent');
    }

    // Expenses
    for (const e of expenses || []) {
      if ((e.date || '').slice(0, 4) !== yearStr) continue;
      if (e.category === 'owner-distribution') continue; // distributions are not Schedule E expenses
      const amt = parseFloat(e.amount) || 0;
      if (!amt) continue;
      const { line } = mapCategoryToLine(e.category);
      const row = ensure(String(e.propertyId) || 'unassigned');
      row.lines[line] = (row.lines[line] || 0) + amt;
      if (!row.lineSources[line]) row.lineSources[line] = new Set();
      row.lineSources[line].add(e.category || 'other');
    }

    // Return array (only rows with any data + any property that has an address — keep all
    // properties listed so Dianne sees every rental even if activity was zero that year).
    const list = Object.values(acc).filter(r => r.propertyId !== undefined);
    // Append unassigned if it has data
    if (Object.keys(unassigned.lines).length > 0) list.push(unassigned);
    return list;
  }, [properties, expenses, rentPayments, year]);

  // Per-property summaries: income (line 3), total expenses (lines 5-19), net profit
  const summarize = (row) => {
    const income = row.lines[3] || 0;
    const expense = LINE_ORDER.filter(l => l.line >= 5).reduce((s, l) => s + (row.lines[l.line] || 0), 0);
    return { income, expense, net: income - expense };
  };

  const grandTotals = useMemo(() => {
    const totals = {};
    for (const row of byProperty) {
      for (const [line, val] of Object.entries(row.lines)) {
        totals[line] = (totals[line] || 0) + val;
      }
    }
    const income = totals[3] || 0;
    const expense = LINE_ORDER.filter(l => l.line >= 5).reduce((s, l) => s + (totals[l.line] || 0), 0);
    return { lines: totals, income, expense, net: income - expense };
  }, [byProperty]);

  const handleDownloadCsv = () => {
    const header = [
      'Property', 'Address', 'Line',
      'Schedule E Line Label', 'Amount (USD)', 'Source Categories',
    ];
    const rows = [header];
    for (const row of byProperty) {
      for (const l of LINE_ORDER) {
        const amt = row.lines[l.line];
        if (!amt) continue;
        const srcs = [...(row.lineSources[l.line] || [])].join('; ');
        rows.push([row.propertyName, row.address, l.line, l.label, amt.toFixed(2), srcs]);
      }
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-e-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    // The .print-schedule-e class on document.body makes the print stylesheet kick in.
    document.body.classList.add('print-schedule-e');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('print-schedule-e'), 1000);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sched-e-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl my-8 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl">
        {/* Header (hidden in print) */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-slate-900/95 backdrop-blur-md border-b border-white/10 rounded-t-2xl no-print">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🧾 Schedule E Summary
              <HelpTip label="About Schedule E">
                IRS Form 1040 Schedule E reports income and expenses from rental real estate.
                This view shows each property&rsquo;s totals mapped to the line numbers on the actual form.
                Hand the PDF or CSV to your tax preparer.
              </HelpTip>
            </h2>
            <p className="text-xs text-white/50">Tax year {year}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-white/10 border border-white/15 text-white text-sm rounded-lg px-3 py-2"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition"
              title="Download CSV for your accountant or tax software"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition"
              title="Open the print dialog — pick 'Save as PDF' as the destination"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div className="sched-e-print p-5">
          <div className="sched-e-print-header hidden">
            <h1 className="text-2xl font-bold">Schedule E Summary — Dianne Dulin</h1>
            <p>Tax Year {year}</p>
            <p className="text-xs">Generated from Dulin Properties app on {new Date().toLocaleDateString()}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5 no-print-bg">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
              <div className="text-xs text-white/50 mb-1">Total rent income</div>
              <div className="text-lg font-bold text-emerald-300">{formatCurrency(grandTotals.income)}</div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
              <div className="text-xs text-white/50 mb-1">Total expenses</div>
              <div className="text-lg font-bold text-red-300">{formatCurrency(grandTotals.expense)}</div>
            </div>
            <div className={`rounded-xl border p-3 ${
              grandTotals.net >= 0
                ? 'border-sky-500/20 bg-sky-500/[0.05]'
                : 'border-amber-500/20 bg-amber-500/[0.05]'
            }`}>
              <div className="text-xs text-white/50 mb-1">Net income (loss)</div>
              <div className={`text-lg font-bold ${grandTotals.net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
                {formatCurrency(grandTotals.net)}
              </div>
            </div>
          </div>

          {byProperty.length === 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
              <p className="text-sm text-amber-200">No property data yet. Import some statements first.</p>
            </div>
          )}

          {/* Per-property tables */}
          <div className="space-y-5">
            {byProperty.map(row => {
              const { income, expense, net } = summarize(row);
              if (income === 0 && expense === 0) return null;
              return (
                <div key={row.propertyId} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true">{row.emoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-white">{row.propertyName}</div>
                        {row.address && <div className="text-xs text-white/50">{row.address}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50">Net</div>
                      <div className={`text-base font-bold ${net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
                        {formatCurrency(net)}
                      </div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/50">
                        <th className="text-left px-4 py-2 w-16">Line</th>
                        <th className="text-left px-4 py-2">Schedule E label</th>
                        <th className="text-left px-4 py-2">Sources</th>
                        <th className="text-right px-4 py-2 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LINE_ORDER.map(l => {
                        const amt = row.lines[l.line];
                        if (!amt) return null;
                        const sources = [...(row.lineSources[l.line] || [])].join(', ');
                        return (
                          <tr key={l.line} className="border-b border-white/[0.04] last:border-0">
                            <td className="px-4 py-2 font-mono text-white/60">{l.line}</td>
                            <td className="px-4 py-2 text-white/80">{l.label}</td>
                            <td className="px-4 py-2 text-xs text-white/40">{sources}</td>
                            <td className={`px-4 py-2 text-right font-medium ${l.line === 3 ? 'text-emerald-300' : 'text-red-300'}`}>
                              {fmt(amt)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-white/[0.03]">
                        <td colSpan={3} className="px-4 py-2 text-right text-xs text-white/60">Subtotal income / expenses:</td>
                        <td className="px-4 py-2 text-right font-bold">
                          <div className="text-emerald-300">{fmt(income)}</div>
                          <div className="text-red-300">-{fmt(expense)}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-6 text-xs text-white/40 border-t border-white/10 pt-3">
            <p>
              This summary is built from the statements you imported. Owner distributions are not listed because they
              are transfers to you personally, not Schedule E expenses. Depreciation (line 18) is blank unless entered
              manually &mdash; your CPA will compute it from your property&rsquo;s cost basis and placed-in-service date.
            </p>
          </div>
        </div>
      </div>

      {/* Print styles — hide everything except the modal's printable block */}
      <style>{`
        @media print {
          body.print-schedule-e > *:not(.sched-e-modal) { display: none !important; }
          .sched-e-modal { position: static !important; background: white !important; color: black !important; }
          .sched-e-modal .no-print, .sched-e-modal .no-print-bg { display: none !important; }
          .sched-e-modal .sched-e-print-header { display: block !important; margin-bottom: 1rem; color: black !important; }
          .sched-e-modal .sched-e-print * { color: black !important; border-color: #ddd !important; background: transparent !important; }
          .sched-e-modal .sched-e-print table { page-break-inside: auto; }
          .sched-e-modal .sched-e-print tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}
