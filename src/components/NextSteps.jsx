import React, { useState, useMemo } from 'react';
import { Zap, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

/**
 * NextSteps — plain-English action list, auto-generated from the data.
 *
 * Categories (in order of urgency):
 *   1. Cleanup — mis-tagged income still sitting in the expenses ledger
 *      (SIGONFILE / APTS / ANNUITY patterns). Highest priority because they
 *      distort dashboard math.
 *   2. Imports — months where a management statement hasn't been imported yet
 *      (FFB, Absolute, Barnett & Hill).
 *   3. Validate — imported transactions that still say "needs review."
 *   4. Owner items — months where mom usually enters Insurance / HOA but
 *      hasn't yet (catches the apr/feb gap).
 *
 * Each item has a one-line label and a button that jumps to the right page.
 */
export default function NextSteps({
  properties = [],
  expenses = [],
  rentPayments = [],
  onJumpToImport,        // (sourceLabel, monthYM) => void
  onJumpToValidate,      // (sourceLabel, monthYM) => void
  onJumpToExpenseSearch, // (query) => void
  title = "What's next",
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const items = useMemo(() => {
    const out = [];
    const yearStr = String(new Date().getFullYear());
    const currentMonthIdx = new Date().getMonth();

    const getManager = (color) => {
      if (!color) return 'Absolute';
      if (color.includes('purple') || color.includes('violet') || color.includes('indigo')) return 'Barnett & Hill';
      if (color.includes('rose') || color.includes('pink')) return 'Dianne Dulin';
      return 'Absolute';
    };

    // --- 1. CLEANUP: mis-tagged income still in expenses ---
    // Pattern matches the things we saw in March: SIGONFILE / APTS / ANNUITY,
    // plus any expense whose category is still an income category.
    const INCOME_CATS = new Set(['rent', 'late-fee', 'prepaid-rent', 'deposit']);
    const cleanupRegex = /sigonfile|apts\.com|apartments\.com|annuity/i;
    const cleanupRows = (expenses || []).filter(e => {
      if (e.isTemplate) return false;
      if (INCOME_CATS.has(e.category)) return true;
      return cleanupRegex.test(`${e.description || ''} ${e.vendor || ''}`);
    });
    if (cleanupRows.length > 0) {
      // Group by description-keyword for friendlier labels
      const sig = cleanupRows.filter(e => /sigonfile/i.test(e.description || ''));
      const apts = cleanupRows.filter(e => /apts\.com|apartments\.com/i.test(`${e.description || ''} ${e.vendor || ''}`));
      const ann = cleanupRows.filter(e => /annuity/i.test(e.description || ''));
      const rent = cleanupRows.filter(e => INCOME_CATS.has(e.category));

      if (sig.length > 0) out.push({
        category: 'Cleanup',
        priority: 1,
        title: `Delete ${sig.length} SIGONFILE bank deposit${sig.length === 1 ? '' : 's'} mis-tagged as expense`,
        sub: 'These are net deposits from B&H / Absolute — already counted via the owner-packet imports.',
        actionLabel: 'Show me',
        onClick: () => onJumpToExpenseSearch?.('SIGONFILE'),
      });
      if (apts.length > 0) out.push({
        category: 'Cleanup',
        priority: 1,
        title: `Review ${apts.length} apts.com entr${apts.length === 1 ? 'y' : 'ies'} tagged as expense`,
        sub: 'Each one likely duplicates a rent payment you already have on the Income page.',
        actionLabel: 'Show me',
        onClick: () => onJumpToExpenseSearch?.('APTS'),
      });
      if (ann.length > 0) out.push({
        category: 'Cleanup',
        priority: 1,
        title: `Move ${ann.length} ANNUITY entr${ann.length === 1 ? 'y' : 'ies'} to Interest income`,
        sub: "These are dividends from your annuity — they're income, not expenses.",
        actionLabel: 'Show me',
        onClick: () => onJumpToExpenseSearch?.('ANNUITY'),
      });
      if (rent.length > 0) out.push({
        category: 'Cleanup',
        priority: 1,
        title: `Reclassify ${rent.length} rent entr${rent.length === 1 ? 'y' : 'ies'} currently filed as expense`,
        sub: 'Open them and change Type from Expense → Income, or delete if a rent payment already exists.',
        actionLabel: 'Show me',
        onClick: () => onJumpToExpenseSearch?.(''),
      });
    }

    // --- 2. IMPORTS: missing or partial monthly statements ---
    // Build "expected" counts per source for past months of the current year.
    const SOURCES = [
      { id: 'absolute', label: 'Absolute', expected: 12, key: 'Absolute' },
      { id: 'barnett',  label: 'Barnett & Hill', expected: 8, key: 'Barnett & Hill' },
      { id: 'ffb',      label: 'FFB Bank', expected: 2, key: 'FFB Bank' },
      { id: 'citi',     label: 'Citi Card', expected: 3, key: 'Citi Card' },
    ];
    for (let m = 0; m <= currentMonthIdx; m++) {
      const ms = `${yearStr}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = new Date(parseInt(yearStr), m).toLocaleString('en-US', { month: 'long' });
      for (const src of SOURCES) {
        const hasAny = (expenses || []).some(e => e.sourceDocument === src.key && (e.date || '').startsWith(ms))
                    || (rentPayments || []).some(r => r.sourceDocument === src.key && ((r.month || r.datePaid || '').startsWith(ms)));
        if (!hasAny) {
          out.push({
            category: 'Imports',
            priority: 2,
            title: `Import ${monthLabel} ${src.label} statement`,
            sub: 'No entries from this source for this month yet.',
            actionLabel: 'Open import',
            onClick: () => onJumpToImport?.(src.id, ms),
          });
        }
      }
    }

    // --- 3. VALIDATE: imported rows still flagged "needs review" ---
    // Group by (source, month). Cap to the most-recent / largest groups so the
    // panel doesn't get overwhelming.
    const pending = new Map(); // `${source}|${ym}` -> count
    const bump = (source, ym) => {
      if (!source || !ym) return;
      const k = `${source}|${ym}`;
      pending.set(k, (pending.get(k) || 0) + 1);
    };
    (expenses || []).forEach(e => { if (e.sourceDocument && !e.validated) bump(e.sourceDocument, (e.date || '').slice(0, 7)); });
    (rentPayments || []).forEach(r => { if (r.sourceDocument && !r.validated) bump(r.sourceDocument, (r.month || (r.datePaid || '').slice(0, 7))); });
    const validateGroups = [...pending.entries()]
      .map(([k, count]) => { const [source, ym] = k.split('|'); return { source, ym, count }; })
      .filter(g => g.count >= 1)
      .sort((a, b) => (a.ym < b.ym ? 1 : -1));
    validateGroups.slice(0, 8).forEach(g => {
      const [y, mo] = g.ym.split('-');
      const monthLabel = mo ? new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('en-US', { month: 'long' }) : g.ym;
      out.push({
        category: 'Validate',
        priority: 3,
        title: `Review and validate ${g.count} ${monthLabel} ${g.source} transaction${g.count === 1 ? '' : 's'}`,
        sub: 'Imported but waiting for you to confirm or edit.',
        actionLabel: 'Open Data Validation',
        onClick: () => onJumpToValidate?.(g.source, g.ym),
      });
    });

    // --- 4. OWNER ITEMS: months with no insurance / hoa entered ---
    // Skip the current month (she hasn't finished it yet). Only flag past months.
    for (let m = 0; m < currentMonthIdx; m++) {
      const ms = `${yearStr}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = new Date(parseInt(yearStr), m).toLocaleString('en-US', { month: 'long' });
      const hasInsurance = (expenses || []).some(e => e.category === 'insurance' && (e.date || '').startsWith(ms));
      const hasHoa = (expenses || []).some(e => e.category === 'hoa' && (e.date || '').startsWith(ms));
      const hasAnyForMonth = (expenses || []).some(e => (e.date || '').startsWith(ms));
      if (hasAnyForMonth && !hasInsurance && !hasHoa) {
        out.push({
          category: 'Owner items',
          priority: 4,
          title: `Add ${monthLabel} insurance / HOA / utilities you paid out of pocket`,
          sub: "Other months have these — looks like this one wasn't entered yet.",
          actionLabel: 'Record expense',
          onClick: () => onJumpToExpenseSearch?.(''),
        });
      }
    }

    out.sort((a, b) => a.priority - b.priority);
    return out;
  }, [properties, expenses, rentPayments, onJumpToImport, onJumpToValidate, onJumpToExpenseSearch]);

  if (items.length === 0) {
    return (
      <div className="mb-4 border border-emerald-500/30 bg-emerald-500/[0.05] rounded-2xl px-4 py-3 flex items-center gap-2">
        <span aria-hidden="true">✅</span>
        <span className="text-sm text-emerald-200 font-medium">All caught up — nothing flagged right now.</span>
      </div>
    );
  }

  // Bucket by category for grouped display
  const buckets = {};
  items.forEach(it => { (buckets[it.category] = buckets[it.category] || []).push(it); });
  const categoryOrder = ['Cleanup', 'Imports', 'Validate', 'Owner items'];
  const categoryColor = {
    Cleanup:      'text-rose-300 border-rose-500/30 bg-rose-500/[0.04]',
    Imports:      'text-amber-300 border-amber-500/30 bg-amber-500/[0.04]',
    Validate:     'text-sky-300 border-sky-500/30 bg-sky-500/[0.04]',
    'Owner items':'text-purple-300 border-purple-500/30 bg-purple-500/[0.04]',
  };

  return (
    <div className="mb-4 border border-amber-500/30 bg-amber-500/[0.04] rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.02] transition"
      >
        <Zap className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-100">
          {title} — {items.length} suggestion{items.length === 1 ? '' : 's'}
        </span>
        <span className="text-xs text-amber-300/70 ml-auto hidden md:inline">Click items to jump to the right page</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-amber-300" />}
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
          {categoryOrder.filter(c => buckets[c]?.length).map(cat => (
            <div key={cat} className={`px-4 py-3 ${categoryColor[cat] || ''}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${(categoryColor[cat] || '').split(' ')[0]}`}>
                {cat}
              </p>
              <ul className="space-y-2">
                {buckets[cat].map((it, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85">{it.title}</p>
                      {it.sub && <p className="text-[11px] text-white/45 mt-0.5">{it.sub}</p>}
                    </div>
                    {it.onClick && (
                      <button
                        onClick={it.onClick}
                        className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 transition flex items-center gap-1"
                      >
                        {it.actionLabel || 'Open'} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
