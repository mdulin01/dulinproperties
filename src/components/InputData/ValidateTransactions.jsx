import React, { useMemo, useState } from 'react';
import { Check, Edit3, Trash2, AlertCircle, ChevronDown, ChevronRight, FileText, CheckCheck, Filter } from 'lucide-react';
import HelpTip from '../HelpTip';
import { formatCurrency } from '../../utils';

const SOURCES = ['Barnett & Hill', 'Absolute', 'FFB Bank', 'Citi Card', 'Costco Card'];

/**
 * Single tab button used in the source + month filter strips. Shows a needs-review
 * badge so Dianne can see at a glance which statement still has work in it.
 */
function TabBtn({ active, onClick, label, badge, small }) {
  const size = small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  const activeCls = active
    ? 'bg-white/15 text-white border-white/20'
    : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white/90 hover:bg-white/[0.08]';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition ${size} ${activeCls}`}
    >
      <span>{label}</span>
      {badge > 0 && (
        <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${active ? 'bg-amber-400/30 text-amber-200' : 'bg-amber-500/20 text-amber-300'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * ValidateTransactions — Dianne reviews every imported transaction and marks it validated,
 * edits it, or discards it. Grouped by month (newest first); filterable by status + source.
 *
 * A transaction (expense or rent payment) is considered imported if it has a sourceDocument.
 * Its validation state lives on the record itself as `validated: true|false` — we persist it
 * by calling updateExpense / updateRentPayment.
 */
export default function ValidateTransactions({
  expenses,
  rentPayments,
  properties,
  updateExpense,
  deleteExpense,
  updateRentPayment,
  deleteRentPayment,
  onEditExpense,
  onEditRent,
  showToast,
}) {
  const [filterStatus, setFilterStatus] = useState('needs-review'); // needs-review | validated | all
  const [filterSource, setFilterSource] = useState('all'); // 'all' | <source label>
  const [filterMonth, setFilterMonth] = useState('all');   // 'all' | 'YYYY-MM'
  // Group key is `${source}|${ym}` so Dianne can review one statement at a time.
  const [expandedGroups, setExpandedGroups] = useState({});
  const [confirmDiscard, setConfirmDiscard] = useState(null); // {kind, id, label}

  // Build a combined list of imported transactions (both income and expense)
  const allRows = useMemo(() => {
    const rows = [];
    for (const e of expenses || []) {
      if (!e.sourceDocument) continue;
      const ym = (e.date || '').slice(0, 7);
      rows.push({
        kind: 'expense',
        id: e.id,
        date: e.date || '',
        ym,
        amount: parseFloat(e.amount) || 0,
        description: e.description || e.category || 'Expense',
        vendor: e.vendor || '',
        category: e.category || 'other',
        source: e.sourceDocument,
        propertyId: e.propertyId,
        propertyName: e.propertyName,
        notes: e.notes,
        validated: !!e.validated,
        raw: e,
      });
    }
    for (const r of rentPayments || []) {
      if (!r.sourceDocument) continue;
      const ym = r.month || (r.datePaid || '').slice(0, 7);
      rows.push({
        kind: 'rent',
        id: r.id,
        date: r.datePaid || (ym ? `${ym}-01` : ''),
        ym,
        amount: parseFloat(r.amount) || 0,
        description: r.tenantName ? `Rent — ${r.tenantName}` : 'Rent payment',
        vendor: r.tenantName || '',
        category: r.category || 'rent',
        source: r.sourceDocument,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        notes: r.notes,
        validated: !!r.validated,
        raw: r,
      });
    }
    // Sort descending by date
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    return rows;
  }, [expenses, rentPayments]);

  // Tab options — only show source/month values that have data. That way Dianne
  // never sees a tab with nothing behind it.
  const availableSources = useMemo(() => {
    const seen = new Set(allRows.map(r => r.source).filter(Boolean));
    return SOURCES.filter(s => seen.has(s)).concat([...seen].filter(s => !SOURCES.includes(s)));
  }, [allRows]);
  const availableMonths = useMemo(() => {
    const seen = new Set(allRows.map(r => r.ym).filter(Boolean));
    return [...seen].sort((a, b) => (a < b ? 1 : -1)); // newest first
  }, [allRows]);

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (filterStatus === 'needs-review' && r.validated) return false;
      if (filterStatus === 'validated' && !r.validated) return false;
      if (filterSource !== 'all' && r.source !== filterSource) return false;
      if (filterMonth !== 'all' && r.ym !== filterMonth) return false;
      return true;
    });
  }, [allRows, filterStatus, filterSource, filterMonth]);

  // Per-tab counts so the tab labels can show a needs-review badge.
  const needsReviewBySource = useMemo(() => {
    const out = {};
    for (const r of allRows) {
      if (r.validated) continue;
      out[r.source || ''] = (out[r.source || ''] || 0) + 1;
    }
    return out;
  }, [allRows]);
  const needsReviewByMonth = useMemo(() => {
    const out = {};
    for (const r of allRows) {
      if (r.validated) continue;
      if (filterSource !== 'all' && r.source !== filterSource) continue; // month badges honor source filter
      out[r.ym || ''] = (out[r.ym || ''] || 0) + 1;
    }
    return out;
  }, [allRows, filterSource]);

  // Group by (source, month) so each group corresponds to exactly one statement.
  // Source goes first to match the "review one statement at a time" workflow.
  // Sort: SOURCES order first (B&H, Absolute, FFB, Citi, Costco, then anything else),
  // then newest month first within a source.
  const bySourceMonth = useMemo(() => {
    const groups = new Map();
    for (const r of filtered) {
      const key = `${r.source || 'Other'}|${r.ym || 'unknown'}`;
      if (!groups.has(key)) groups.set(key, { source: r.source || 'Other', ym: r.ym || 'unknown', rows: [] });
      groups.get(key).rows.push(r);
    }
    const sourceOrder = new Map(SOURCES.map((s, i) => [s, i]));
    return [...groups.entries()].sort(([, a], [, b]) => {
      const ai = sourceOrder.has(a.source) ? sourceOrder.get(a.source) : 999;
      const bi = sourceOrder.has(b.source) ? sourceOrder.get(b.source) : 999;
      if (ai !== bi) return ai - bi;
      // Newest month first within the same source
      return a.ym < b.ym ? 1 : -1;
    });
  }, [filtered]);

  const monthLabel = (ym) => {
    if (!ym || ym === 'unknown') return 'No date';
    const [y, m] = ym.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const totals = useMemo(() => {
    const needsReview = allRows.filter(r => !r.validated).length;
    const validated = allRows.filter(r => r.validated).length;
    return { needsReview, validated, total: allRows.length };
  }, [allRows]);

  const isExpanded = (key) => expandedGroups[key] !== false; // default open
  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === false }));

  const setValidated = (row, value) => {
    if (row.kind === 'expense') {
      updateExpense(row.id, { validated: value });
    } else {
      updateRentPayment(row.id, { validated: value });
    }
    if (value && showToast) showToast('Marked validated', 'success');
  };

  const validateAllInGroup = (rows, groupLabel) => {
    const unvalidated = rows.filter(r => !r.validated);
    for (const row of unvalidated) setValidated(row, true);
    if (showToast) showToast(`Validated ${unvalidated.length} entries — ${groupLabel}`, 'success');
  };

  const discardRow = (row) => {
    if (row.kind === 'expense') deleteExpense(row.id);
    else deleteRentPayment(row.id);
    setConfirmDiscard(null);
    if (showToast) showToast('Discarded', 'info');
  };

  const formatDate = (s) => {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return s;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Header + explanation */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-1.5">
          Review and validate imported entries
          <HelpTip label="What is this">
            After you import a statement the entries sit here waiting for you to look them over.
            Click <strong>✓ Validate</strong> if the line looks right, <strong>✏️ Edit</strong> to fix something,
            or <strong>🗑️ Discard</strong> to delete an entry that shouldn&rsquo;t have been imported.
            Validated entries still count in the dashboard and Schedule E — the checkmark just marks that
            you&rsquo;ve personally reviewed them.
          </HelpTip>
        </h3>
        <p className="text-xs text-white/50">
          Imported entries start as &ldquo;needs review.&rdquo; Go through them one at a time, or click the
          &ldquo;Validate all&rdquo; button in a month&rsquo;s header if you trust the whole batch.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-white/[0.03] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            {totals.needsReview} needs review
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
            <Check className="w-3.5 h-3.5" />
            {totals.validated} validated
          </span>
          <span className="text-xs text-white/40 ml-1">of {totals.total} total</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="w-3.5 h-3.5 text-white/40" />
          <div className="flex gap-1 bg-white/[0.05] rounded-lg p-0.5">
            {[
              { id: 'needs-review', label: 'Needs review' },
              { id: 'validated', label: 'Validated' },
              { id: 'all', label: 'All' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterStatus(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filterStatus === opt.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Source tabs — top level so Dianne can jump to one management company at a time. */}
      {availableSources.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 border-b border-white/10 pb-0.5">
          <TabBtn active={filterSource === 'all'} onClick={() => setFilterSource('all')} label="All sources" badge={totals.needsReview} />
          {availableSources.map(s => (
            <TabBtn
              key={s}
              active={filterSource === s}
              onClick={() => setFilterSource(s)}
              label={s}
              badge={needsReviewBySource[s] || 0}
            />
          ))}
        </div>
      )}

      {/* Month tabs — second level, scoped by the active source tab. */}
      {availableMonths.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          <TabBtn
            small
            active={filterMonth === 'all'}
            onClick={() => setFilterMonth('all')}
            label="All months"
            badge={Object.values(needsReviewByMonth).reduce((s, n) => s + n, 0)}
          />
          {availableMonths.map(m => (
            <TabBtn
              small
              key={m}
              active={filterMonth === m}
              onClick={() => setFilterMonth(m)}
              label={monthLabel(m)}
              badge={needsReviewByMonth[m] || 0}
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {allRows.length === 0 && (
        <div className="text-center py-10 border border-white/10 rounded-2xl bg-white/[0.02]">
          <FileText className="w-10 h-10 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/50">Nothing imported yet.</p>
          <p className="text-xs text-white/40 mt-1">Once you add statements in the previous tab, their entries will appear here for review.</p>
        </div>
      )}
      {allRows.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 border border-white/10 rounded-2xl bg-white/[0.02]">
          <CheckCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-white/70">Nothing to review with the current filter.</p>
          {filterStatus === 'needs-review' && totals.needsReview === 0 && (
            <p className="text-xs text-emerald-400 mt-1">Everything has been validated — great work.</p>
          )}
        </div>
      )}

      {/* Source + month groups. Each group corresponds to one statement so Dianne
          can work through them one at a time. */}
      <div className="space-y-3">
        {bySourceMonth.map(([groupKey, { source, ym, rows }]) => {
          const expanded = isExpanded(groupKey);
          const unvalidatedCount = rows.filter(r => !r.validated).length;
          const totalAmt = rows.reduce((s, r) => s + (r.kind === 'rent' ? r.amount : -r.amount), 0);
          const groupLabel = `${source} — ${monthLabel(ym)}`;
          return (
            <div key={groupKey} className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
              {/* Group header (one statement = one source+month) */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-white transition"
                >
                  {expanded ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
                  <h4 className="text-base font-semibold text-white">{source}</h4>
                  <span className="text-sm text-white/60">· {monthLabel(ym)}</span>
                  <span className="text-xs text-white/40">
                    {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                  </span>
                  {unvalidatedCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      {unvalidatedCount} to review
                    </span>
                  )}
                </button>
                <span className={`text-sm font-semibold ${totalAmt >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  net {formatCurrency(totalAmt)}
                </span>
                {unvalidatedCount > 0 && (
                  <button
                    onClick={() => validateAllInGroup(rows, groupLabel)}
                    className="inline-flex items-center gap-1 ml-3 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition"
                    title={`Mark every unreviewed entry in ${groupLabel} as validated`}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Validate all
                  </button>
                )}
              </div>

              {/* Rows */}
              {expanded && (
                <div>
                  {rows.map(row => {
                    const isIncome = row.kind === 'rent';
                    const edgeCls = row.validated
                      ? 'border-l-4 border-l-emerald-500/60 bg-emerald-500/[0.03]'
                      : 'border-l-4 border-l-amber-500/60';
                    return (
                      <div
                        key={`${row.kind}-${row.id}`}
                        className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition ${edgeCls}`}
                      >
                        {/* Validation status icon */}
                        <div className="flex-shrink-0">
                          {row.validated ? (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300"
                              title="Validated"
                            >
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-300"
                              title="Needs review"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </span>
                          )}
                        </div>

                        {/* Core info — date + description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xs font-mono text-white/50">{formatDate(row.date)}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              isIncome ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                            }`}>
                              {isIncome ? 'Income' : 'Expense'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/60">
                              {row.source}
                            </span>
                            {row.category && row.category !== 'rent' && (
                              <span className="text-[10px] text-white/40">· {row.category}</span>
                            )}
                          </div>
                          <div className="text-sm text-white mt-0.5">
                            {row.description}
                          </div>
                          {row.propertyName && (
                            <div className="text-xs text-white/50 mt-0.5">
                              {row.propertyName}
                              {row.notes && <span className="text-white/30"> · {row.notes}</span>}
                            </div>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="flex-shrink-0 text-right md:min-w-[100px]">
                          <div className={`text-base font-bold ${isIncome ? 'text-emerald-300' : 'text-red-300'}`}>
                            {isIncome ? '+' : '−'}{formatCurrency(Math.abs(row.amount))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {row.validated ? (
                            <button
                              onClick={() => setValidated(row, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/[0.08] text-xs transition"
                              title="Undo validation"
                            >
                              Unvalidate
                            </button>
                          ) : (
                            <button
                              onClick={() => setValidated(row, true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-medium transition"
                              title="Mark this entry as reviewed and correct"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Validate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (row.kind === 'expense') onEditExpense?.(row.raw);
                              else onEditRent?.(row.raw);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs font-medium transition"
                            title="Edit this entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDiscard({ row, label: row.description })}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition"
                            title="Discard this entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Discard confirm */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDiscard(null)} />
          <div className="relative w-full max-w-sm bg-slate-800 border border-white/15 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Discard this entry?</h3>
            <p className="text-sm text-white/70 mb-4">
              &ldquo;{confirmDiscard.label}&rdquo; will be removed. You can always re-import it later.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmDiscard(null)}
                className="px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => discardRow(confirmDiscard.row)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition"
              >
                <Trash2 className="w-4 h-4" /> Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
