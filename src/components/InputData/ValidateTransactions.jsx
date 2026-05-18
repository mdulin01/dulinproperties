import React, { useMemo, useState } from 'react';
import { Check, Edit3, Trash2, AlertCircle, ChevronDown, ChevronRight, FileText, CheckCheck, Filter, Search, X, Plus, ArrowRightLeft } from 'lucide-react';
import HelpTip from '../HelpTip';
import { formatCurrency, parseAmountQuery, matchesAmountQuery } from '../../utils';

const SOURCES = ['Barnett & Hill', 'Absolute', 'FFB Bank', 'Citi Card', 'Costco Card'];

// Expense rows that got stored with an income category because of an old
// owner-packet parser bug. The migration banner below this surfaces them and
// lets Dianne convert them to rent payments in one click.
const INCOME_CATEGORIES = new Set(['rent', 'late-fee', 'prepaid-rent', 'deposit']);

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
  bulkAddRentPayments,
  bulkDeleteExpenses,
  bulkUpdateExpenses,
  bulkUpdateRentPayments,
  updateExpense,
  deleteExpense,
  updateRentPayment,
  deleteRentPayment,
  onEditExpense,
  onEditRent,
  onAddExpense,
  onAddRent,
  showToast,
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState('needs-review'); // needs-review | validated | all
  const [filterSource, setFilterSource] = useState('all'); // 'all' | <source label>
  const [filterMonth, setFilterMonth] = useState('all');   // 'all' | 'YYYY-MM'
  const [filterProperty, setFilterProperty] = useState('all'); // 'all' | propertyName
  const [search, setSearch] = useState('');
  // Group key is `${source}|${ym}` so Dianne can review one statement at a time.
  const [expandedGroups, setExpandedGroups] = useState({});
  const [confirmDiscard, setConfirmDiscard] = useState(null); // {kind, id, label}
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  // Detect expense rows with an income category — these are rent rows that
  // were filed into the expenses collection by the old parser. The migration
  // banner converts them to rent payments in one click.
  const misTaggedRows = useMemo(() => {
    return (expenses || []).filter(e =>
      !e.isTemplate &&
      INCOME_CATEGORIES.has(e.category)
    );
  }, [expenses]);

  // Detect transactions whose propertyName field doesn't match the canonical
  // name on the linked property record. Surfaces in filter dropdowns as phantom
  // duplicates (e.g. "1329 S 11th B" + "1329 S 11th St B"). The canonical name
  // is `${emoji} ${name}` from the property record.
  const propertyNameById = useMemo(() => {
    const m = new Map();
    (properties || []).forEach(p => {
      m.set(String(p.id), `${p.emoji || '🏠'} ${p.name || ''}`.trim());
    });
    return m;
  }, [properties]);

  const misNamedExpenses = useMemo(() =>
    (expenses || []).filter(e => {
      if (!e.propertyId) return false;
      const expected = propertyNameById.get(String(e.propertyId));
      return expected && e.propertyName && e.propertyName !== expected;
    }),
  [expenses, propertyNameById]);

  const misNamedRents = useMemo(() =>
    (rentPayments || []).filter(r => {
      if (!r.propertyId) return false;
      const expected = propertyNameById.get(String(r.propertyId));
      return expected && r.propertyName && r.propertyName !== expected;
    }),
  [rentPayments, propertyNameById]);

  const totalMisNamed = misNamedExpenses.length + misNamedRents.length;

  const runMigration = async () => {
    if (!bulkAddRentPayments || !bulkDeleteExpenses) {
      showToast?.('Migration not available — bulk write APIs not connected.', 'error');
      return;
    }
    if (migrating) return;
    setMigrating(true);
    try {
      // 1. Build rent-payment payloads from each mis-tagged expense.
      const newPayments = misTaggedRows.map((e) => ({
        propertyId: e.propertyId || '',
        propertyName: e.propertyName || '',
        tenantName: e.vendor || (e.description || '').replace(/\s*-?\s*rent income.*$/i, '').trim() || '',
        amount: parseFloat(e.amount) || 0,
        month: (e.date || '').slice(0, 7),
        datePaid: e.date || '',
        status: 'paid',
        category: e.category, // 'rent', 'late-fee', etc.
        sourceDocument: e.sourceDocument || 'Migrated',
        notes: `Migrated from mis-tagged expense (${e.description || ''}). ${e.notes || ''}`.trim(),
        validated: !!e.validated,
        fingerprint: e.fingerprint,
      }));

      // 2. Write rent payments first. If this fails, nothing is lost — the
      //    original expense rows are still there for a retry.
      const addRes = await bulkAddRentPayments(newPayments);
      if (!addRes?.ok) {
        showToast?.('Migration failed at rent-payment step. Nothing changed.', 'error');
        setMigrating(false);
        return;
      }

      // 3. Now delete the original expense rows.
      const ids = misTaggedRows.map(e => e.id).filter(Boolean);
      const delRes = await bulkDeleteExpenses(ids);
      if (!delRes?.ok) {
        showToast?.('Rent payments created, but deleting the old expense rows failed. You may have duplicates — check and re-run.', 'error');
        setMigrating(false);
        return;
      }

      showToast?.(`Migrated ${newPayments.length} rent rows from expenses → rent payments.`, 'success');
      setMigrateOpen(false);
    } catch (err) {
      console.error('[migrate-rent-income] failed:', err);
      showToast?.(`Migration error: ${err.message || 'unknown'}`, 'error');
    } finally {
      setMigrating(false);
    }
  };

  // Bulk rename: walk through misnamed transactions and update each one's
  // propertyName to match the canonical name from the property record.
  const runRename = async () => {
    if (!bulkUpdateExpenses || !bulkUpdateRentPayments) {
      showToast?.('Rename not available — bulk update APIs not connected.', 'error');
      return;
    }
    if (renaming) return;
    setRenaming(true);
    try {
      const expUpdates = {};
      misNamedExpenses.forEach(e => {
        const expected = propertyNameById.get(String(e.propertyId));
        if (expected) expUpdates[String(e.id)] = { propertyName: expected };
      });
      const rentUpdates = {};
      misNamedRents.forEach(r => {
        const expected = propertyNameById.get(String(r.propertyId));
        if (expected) rentUpdates[String(r.id)] = { propertyName: expected };
      });

      const [expRes, rentRes] = await Promise.all([
        Object.keys(expUpdates).length ? bulkUpdateExpenses(expUpdates) : Promise.resolve({ ok: true, count: 0 }),
        Object.keys(rentUpdates).length ? bulkUpdateRentPayments(rentUpdates) : Promise.resolve({ ok: true, count: 0 }),
      ]);
      if (!expRes.ok || !rentRes.ok) {
        showToast?.('Rename partially failed — re-run the cleanup.', 'error');
        setRenaming(false);
        return;
      }
      showToast?.(`Renamed ${expRes.count} expense rows and ${rentRes.count} rent rows.`, 'success');
      setRenameOpen(false);
    } catch (err) {
      console.error('[rename-properties] failed:', err);
      showToast?.(`Rename error: ${err.message || 'unknown'}`, 'error');
    } finally {
      setRenaming(false);
    }
  };

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
  // Property list — scoped by the active source + month filters so Dianne only
  // sees properties that actually have entries in her current view. Sorted with
  // unmatched (⚠️) addresses at the bottom.
  const availableProperties = useMemo(() => {
    const seen = new Set();
    for (const r of allRows) {
      if (filterSource !== 'all' && r.source !== filterSource) continue;
      if (filterMonth !== 'all' && r.ym !== filterMonth) continue;
      if (r.propertyName) seen.add(r.propertyName);
    }
    const arr = [...seen];
    arr.sort((a, b) => {
      const aUnm = a.startsWith('⚠️');
      const bUnm = b.startsWith('⚠️');
      if (aUnm !== bUnm) return aUnm ? 1 : -1;
      return a.localeCompare(b);
    });
    return arr;
  }, [allRows, filterSource, filterMonth]);

  // Per-dropdown-option counts so option labels can show "(N)" needs-review badges.
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
      if (filterSource !== 'all' && r.source !== filterSource) continue;
      out[r.ym || ''] = (out[r.ym || ''] || 0) + 1;
    }
    return out;
  }, [allRows, filterSource]);

  // Apply filters. Search is a case-insensitive substring match against
  // description, vendor, property name, category, source, or the amount.
  // Amount matching is robust: "$1,234.56" → 1234.56; "1234" matches any
  // amount whose dollar part is 1234; "1234.56" requires an exact-cents match.
  const searchTerm = search.trim().toLowerCase();
  const searchAmount = parseAmountQuery(search);
  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (filterStatus === 'needs-review' && r.validated) return false;
      if (filterStatus === 'validated' && !r.validated) return false;
      if (filterSource !== 'all' && r.source !== filterSource) return false;
      if (filterMonth !== 'all' && r.ym !== filterMonth) return false;
      if (filterProperty !== 'all' && r.propertyName !== filterProperty) return false;
      if (searchTerm) {
        const hay = [
          r.description, r.vendor, r.propertyName, r.category, r.source, r.notes, r.date,
        ].filter(Boolean).join(' ').toLowerCase();
        const textMatches = hay.includes(searchTerm);
        const amtMatches = searchAmount !== null && matchesAmountQuery(r.amount, searchAmount, search);
        if (!textMatches && !amtMatches) return false;
      }
      return true;
    });
  }, [allRows, filterStatus, filterSource, filterMonth, filterProperty, searchTerm, searchAmount, search]);

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
      {/* Property-rename banner — surfaces transactions whose denormalized
          propertyName is out of sync with the canonical property record. */}
      {totalMisNamed > 0 && bulkUpdateExpenses && bulkUpdateRentPayments && (
        <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ArrowRightLeft className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-100">
                {totalMisNamed} transactions have an outdated property name
              </p>
              <p className="text-xs text-blue-200/70 mt-0.5">
                Filters show phantom duplicates (e.g. "1329 S 11th B" + "1329 S 11th St B"). Re-syncs the
                stored propertyName to the canonical name on each property record.
              </p>
              <button
                onClick={() => setRenameOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-blue-950 text-xs font-semibold transition"
              >
                Review &amp; clean up →
              </button>
            </div>
          </div>
        </div>
      )}

      {renameOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !renaming && setRenameOpen(false)} />
          <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Sync Property Names</h2>
                <p className="text-xs text-white/40">{totalMisNamed} transactions will have their propertyName updated.</p>
              </div>
              <button onClick={() => !renaming && setRenameOpen(false)} disabled={renaming} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-50">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="border border-white/10 rounded-lg overflow-hidden mb-4 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Type</th>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Stored Name</th>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">→ Canonical</th>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {misNamedExpenses.map(e => (
                    <tr key={`e-${e.id}`} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-red-300/80">expense</td>
                      <td className="px-3 py-1.5 text-white/60 truncate max-w-[180px]">{e.propertyName}</td>
                      <td className="px-3 py-1.5 text-emerald-300/80 truncate max-w-[180px]">{propertyNameById.get(String(e.propertyId))}</td>
                      <td className="px-3 py-1.5 text-white/40 whitespace-nowrap">{e.date}</td>
                    </tr>
                  ))}
                  {misNamedRents.map(r => (
                    <tr key={`r-${r.id}`} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-emerald-300/80">rent</td>
                      <td className="px-3 py-1.5 text-white/60 truncate max-w-[180px]">{r.propertyName}</td>
                      <td className="px-3 py-1.5 text-emerald-300/80 truncate max-w-[180px]">{propertyNameById.get(String(r.propertyId))}</td>
                      <td className="px-3 py-1.5 text-white/40 whitespace-nowrap">{r.datePaid || r.month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameOpen(false)} disabled={renaming} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium disabled:opacity-50">Cancel</button>
              <button onClick={runRename} disabled={renaming} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-blue-950 text-sm font-bold disabled:opacity-50">
                {renaming ? 'Updating…' : `Sync ${totalMisNamed} rows`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration banner — only shows while mis-tagged income rows are still
          sitting in the expenses collection. Auto-disappears after migration. */}
      {misTaggedRows.length > 0 && bulkAddRentPayments && bulkDeleteExpenses && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ArrowRightLeft className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-100">
                {misTaggedRows.length} rent rows are filed as expenses
              </p>
              <p className="text-xs text-amber-200/70 mt-0.5">
                Old parser bug — rent collected by management companies got stored in the wrong place.
                Convert them to rent payments so income/expense totals match the statements.
              </p>
              <button
                onClick={() => setMigrateOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-semibold transition"
              >
                Review &amp; migrate →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration preview modal */}
      {migrateOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !migrating && setMigrateOpen(false)} />
          <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Migrate Mis-tagged Rent Rows</h2>
                <p className="text-xs text-white/40">
                  {misTaggedRows.length} expense rows will become rent payments.
                </p>
              </div>
              <button
                onClick={() => !migrating && setMigrateOpen(false)}
                disabled={migrating}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-50"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="text-xs text-white/60 mb-4 p-3 bg-white/[0.04] rounded-lg border border-white/[0.06]">
              <strong className="text-white/80">What will happen:</strong>
              <ol className="mt-1 ml-4 list-decimal space-y-0.5">
                <li>Create {misTaggedRows.length} new entries in the rent-payments ledger.</li>
                <li>Delete the original entries from the expenses ledger.</li>
                <li>Dashboard YTD numbers will reflect actual reality (this is already true visually via the display fix, but now the underlying data matches too).</li>
              </ol>
              <p className="mt-2 text-amber-200/80">
                If step 2 fails after step 1 succeeds, you may see duplicates. Re-running the migration will clean them up.
              </p>
            </div>

            <div className="border border-white/10 rounded-lg overflow-hidden mb-4 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Date</th>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Description</th>
                    <th className="text-left px-3 py-2 text-white/50 font-medium">Property</th>
                    <th className="text-right px-3 py-2 text-white/50 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {misTaggedRows.map(e => (
                    <tr key={e.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-white/70 whitespace-nowrap">{e.date}</td>
                      <td className="px-3 py-1.5 text-white/80 truncate max-w-xs">{e.description}</td>
                      <td className="px-3 py-1.5 text-white/60 truncate max-w-xs">{e.propertyName || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-emerald-300">+{formatCurrency(Math.abs(parseFloat(e.amount) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMigrateOpen(false)}
                disabled={migrating}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={runMigration}
                disabled={migrating}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-sm font-bold disabled:opacity-50"
              >
                {migrating ? 'Migrating…' : `Migrate ${misTaggedRows.length} rows`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + explanation + manual-add control */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
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
        {(onAddExpense || onAddRent) && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-white hover:bg-white/[0.12] text-sm font-medium transition"
              title="Add a transaction that wasn't in a statement"
            >
              <Plus className="w-4 h-4" />
              Add transaction
              <ChevronDown className="w-3.5 h-3.5 text-white/60" />
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-slate-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                  {onAddExpense && (
                    <button
                      onClick={() => { setShowAddMenu(false); onAddExpense(); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.08] transition flex items-center gap-2"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-500/15 text-red-300 text-xs">−</span>
                      <div>
                        <div className="text-sm text-white">Add expense</div>
                        <div className="text-[10px] text-white/40">Repair, utility, fee paid</div>
                      </div>
                    </button>
                  )}
                  {onAddRent && (
                    <button
                      onClick={() => { setShowAddMenu(false); onAddRent(); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.08] transition flex items-center gap-2 border-t border-white/[0.06]"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-300 text-xs">+</span>
                      <div>
                        <div className="text-sm text-white">Add rent payment</div>
                        <div className="text-[10px] text-white/40">Rent received from tenant</div>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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

      {/* Compact filter row: source + month dropdowns, search, and clear. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-white/40 font-semibold">Source</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-white/30 min-w-[140px]"
          >
            <option value="all">All sources{totals.needsReview > 0 ? ` (${totals.needsReview})` : ''}</option>
            {availableSources.map(s => (
              <option key={s} value={s}>
                {s}{(needsReviewBySource[s] || 0) > 0 ? ` (${needsReviewBySource[s]})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-white/40 font-semibold">Month</label>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-white/30 min-w-[140px]"
          >
            <option value="all">
              All months{Object.values(needsReviewByMonth).reduce((s, n) => s + n, 0) > 0
                ? ` (${Object.values(needsReviewByMonth).reduce((s, n) => s + n, 0)})` : ''}
            </option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {monthLabel(m)}{(needsReviewByMonth[m] || 0) > 0 ? ` (${needsReviewByMonth[m]})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-white/40 font-semibold">Property</label>
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-white/30 min-w-[160px] max-w-[240px]"
          >
            <option value="all">All properties</option>
            {availableProperties.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, vendor, property, amount…"
            className="w-full bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-white/30 placeholder-white/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {(filterSource !== 'all' || filterMonth !== 'all' || filterProperty !== 'all' || search) && (
          <button
            onClick={() => { setFilterSource('all'); setFilterMonth('all'); setFilterProperty('all'); setSearch(''); }}
            className="text-xs text-white/50 hover:text-white/90 underline-offset-4 hover:underline px-2 py-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

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
