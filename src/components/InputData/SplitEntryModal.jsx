import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Link2, Scissors, AlertCircle, Check } from 'lucide-react';
import {
  incomeCategories,
  propertyExpenseCategories,
  operatingExpenseCategories,
  OPERATING_CATEGORY_VALUES,
  BUSINESS_INCOME_CATEGORIES,
} from '../../constants';
import { formatCurrency } from '../../utils';

/**
 * SplitEntryModal — break one bank line into the several things it actually paid for.
 *
 * The bank shows a single number: one Lowe's charge covering three properties, one
 * HOA payment for three condos, one Costco card payment covering a dozen purchases,
 * one deposit from a management company that is really gross rent minus the
 * management fee minus repairs.
 *
 * How the math works — and why nothing has to be typed as a negative number:
 *   • Every part is entered as a POSITIVE amount, marked either Money in or Money out.
 *   • The split balances when (money in) − (money out) equals the bank line itself.
 *     A $1,000 deposit = $1,500 rent in − $150 management fee out − $350 repairs out.
 *     A $600 HOA payment = $200 out + $200 out + $200 out.
 *
 * Parts can also be entries Dianne already typed in from an owner packet. Linking
 * those just stamps the split ids onto the existing rows — nothing is retyped and
 * nothing is duplicated.
 *
 * Once saved, the bank line is flagged `splitParent: true` so it stays visible for
 * reconciliation but is excluded from every income/expense total — its parts carry
 * the accounting instead.
 */

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const EXPENSE_OPTIONS = [
  { label: 'Property expenses', options: propertyExpenseCategories },
  { label: 'Operating / business-wide', options: operatingExpenseCategories },
];

/** Categories that legitimately have no property attached. */
const needsNoProperty = (kind, category) =>
  kind === 'income'
    ? BUSINESS_INCOME_CATEGORIES.includes(category)
    : OPERATING_CATEGORY_VALUES.has(category);

const money = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;

export default function SplitEntryModal({
  row,               // { kind: 'expense'|'rent', id, date, amount, description, raw }
  properties = [],
  expenses = [],
  rentPayments = [],
  bulkAddExpenses,
  bulkAddRentPayments,
  bulkUpdateExpenses,
  bulkUpdateRentPayments,
  bulkDeleteExpenses,
  bulkDeleteRentPayments,
  onClose,
  showToast,
}) {
  const parentIsIncome = row.kind === 'rent';
  // The bank line as a signed number: money in is positive, money out negative.
  const parentSigned = parentIsIncome ? Math.abs(row.amount) : -Math.abs(row.amount);
  const parentDate = row.date || '';

  // Already split? Then this modal is in "review / undo" mode.
  const existingGroupId = row.raw?.splitGroupId || '';
  const alreadySplit = row.raw?.splitParent === true;

  const [parts, setParts] = useState(() => ([
    { key: uid(), kind: parentIsIncome ? 'income' : 'expense', propertyId: '', category: '', amount: '', note: '' },
  ]));
  const [linkedIds, setLinkedIds] = useState(() => new Set()); // `${kind}:${id}`
  const [candidateSearch, setCandidateSearch] = useState('');
  const [windowDays, setWindowDays] = useState(14);
  const [evenOpen, setEvenOpen] = useState(false);
  const [evenProps, setEvenProps] = useState(() => new Set());
  const [evenKind, setEvenKind] = useState(parentIsIncome ? 'income' : 'expense');
  const [evenCategory, setEvenCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmUnsplit, setConfirmUnsplit] = useState(false);

  const propertyById = useMemo(() => {
    const m = new Map();
    properties.forEach(p => m.set(String(p.id), `${p.emoji || '🏠'} ${p.name || ''}`.trim()));
    return m;
  }, [properties]);

  // Parts this bank line already has, when the split is being edited rather
  // than created. They count toward the balance below — otherwise adding one
  // more part would look unbalanced when in fact it's the last piece.
  const currentChildren = useMemo(() => {
    if (!existingGroupId) return { expenses: [], rents: [] };
    return {
      expenses: expenses.filter(e => e.splitGroupId === existingGroupId && String(e.id) !== String(row.id)),
      rents: rentPayments.filter(r => r.splitGroupId === existingGroupId && String(r.id) !== String(row.id)),
    };
  }, [expenses, rentPayments, existingGroupId, row.id]);

  // ---- Existing entries that could become parts of this split -------------
  // Matched on date proximity only. Descriptions are unreliable (the owner-packet
  // importer doesn't always carry one) and the amounts intentionally don't match
  // the bank line — that's the whole point of a split.
  const candidates = useMemo(() => {
    if (!parentDate) return [];
    const base = new Date(`${parentDate}T00:00:00`).getTime();
    const span = windowDays * 86400000;
    const out = [];
    const push = (kind, r, date, amount, description, propertyName) => {
      if (!date) return;
      const t = new Date(`${date}T00:00:00`).getTime();
      if (Number.isNaN(t) || Math.abs(t - base) > span) return;
      if (r.splitGroupId || r.splitParent) return;   // already part of a split
      if (String(r.id) === String(row.id)) return;   // never itself
      out.push({ key: `${kind}:${r.id}`, kind, id: r.id, date, amount: money(amount), description, propertyName, raw: r });
    };
    for (const e of expenses) {
      if (e.isTemplate) continue;
      push('expense', e, e.date, e.amount, e.description || e.category || 'Expense', e.propertyName || '');
    }
    for (const p of rentPayments) {
      push('rent', p, p.datePaid || (p.month ? `${p.month}-01` : ''), p.amount,
        p.tenantName ? `Rent — ${p.tenantName}` : (p.category || 'Rent payment'), p.propertyName || '');
    }
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  }, [expenses, rentPayments, parentDate, windowDays, row.id]);

  const visibleCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c =>
      [c.description, c.propertyName, c.date, String(c.amount)].join(' ').toLowerCase().includes(q)
    );
  }, [candidates, candidateSearch]);

  const linkedRows = useMemo(
    () => candidates.filter(c => linkedIds.has(c.key)),
    [candidates, linkedIds]
  );

  // ---- Running balance ----------------------------------------------------
  const newIn = parts.filter(p => p.kind === 'income').reduce((s, p) => s + money(p.amount), 0);
  const newOut = parts.filter(p => p.kind === 'expense').reduce((s, p) => s + money(p.amount), 0);
  const linkedIn = linkedRows.filter(r => r.kind === 'rent').reduce((s, r) => s + Math.abs(r.amount), 0);
  const linkedOut = linkedRows.filter(r => r.kind === 'expense').reduce((s, r) => s + Math.abs(r.amount), 0);
  // Parts saved on an earlier pass still count — they're already on the books.
  const existingIn = currentChildren.rents.reduce((s, r) => s + Math.abs(parseFloat(r.amount) || 0), 0);
  const existingOut = currentChildren.expenses.reduce((s, e) => s + Math.abs(parseFloat(e.amount) || 0), 0);
  const net = money(newIn + linkedIn + existingIn - newOut - linkedOut - existingOut);
  const diff = money(parentSigned - net);
  const balanced = Math.abs(diff) < 0.005;

  const filledParts = parts.filter(p => money(p.amount) > 0 || p.category);
  const partProblems = filledParts
    .map((p, i) => {
      if (!p.category) return `Part ${i + 1} needs a category.`;
      if (money(p.amount) <= 0) return `Part ${i + 1} needs an amount.`;
      if (!p.propertyId && !needsNoProperty(p.kind, p.category)) return `Part ${i + 1} needs a property.`;
      return null;
    })
    .filter(Boolean);

  const existingCount = currentChildren.expenses.length + currentChildren.rents.length;
  const newWork = filledParts.length + linkedRows.length;
  const totalParts = newWork + existingCount;
  const canSave =
    balanced && totalParts >= 2 && newWork >= 1 && partProblems.length === 0 && !saving;

  // ---- Row helpers -------------------------------------------------------
  const setPart = (key, patch) =>
    setParts(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)));
  const addPart = (kind) =>
    setParts(prev => [...prev, { key: uid(), kind: kind || (parentIsIncome ? 'income' : 'expense'), propertyId: '', category: '', amount: '', note: '' }]);
  const removePart = (key) => setParts(prev => prev.filter(p => p.key !== key));

  /** Fill the remaining unaccounted amount into a part. */
  const fillRemainder = (key) => {
    const p = parts.find(x => x.key === key);
    if (!p) return;
    const without = money(net - (p.kind === 'income' ? money(p.amount) : -money(p.amount)));
    const needSigned = money(parentSigned - without);
    // A part can only hold a positive amount, so it must point the right way.
    const wanted = p.kind === 'income' ? needSigned : -needSigned;
    if (wanted <= 0) {
      showToast?.(`That part would need to be ${p.kind === 'income' ? 'money out' : 'money in'} — switch its direction first.`, 'info');
      return;
    }
    setPart(key, { amount: wanted.toFixed(2) });
  };

  /** Divide whatever is still unaccounted for evenly across the checked properties. */
  const divideEvenly = () => {
    const ids = [...evenProps];
    if (ids.length === 0) { showToast?.('Pick at least two properties.', 'info'); return; }
    if (!evenCategory) { showToast?.('Pick a category for the even split.', 'info'); return; }
    const needSigned = money(parentSigned - net);
    const magnitude = evenKind === 'income' ? needSigned : -needSigned;
    if (magnitude <= 0.005) {
      showToast?.('Nothing left to divide — the parts already add up.', 'info');
      return;
    }
    const cents = Math.round(magnitude * 100);
    const base = Math.floor(cents / ids.length);
    const extra = cents - base * ids.length; // pennies land on the first parts
    const rows = ids.map((pid, i) => ({
      key: uid(),
      kind: evenKind,
      propertyId: pid,
      category: evenCategory,
      amount: ((base + (i < extra ? 1 : 0)) / 100).toFixed(2),
      note: '',
    }));
    setParts(prev => [...prev.filter(p => p.category || money(p.amount) > 0), ...rows]);
    setEvenOpen(false);
  };

  // ---- Save --------------------------------------------------------------
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const groupId = existingGroupId || `split-${uid()}`;
    const parentAccount = row.raw?.bankAccount || row.raw?.account || '';
    const parentSource = row.raw?.sourceDocument || '';
    const stamp = {
      splitGroupId: groupId,
      splitChildOf: String(row.id),
      splitCreated: true,
      sourceDocument: parentSource,
      bankAccount: parentAccount,
      validated: true,
      notes: '',
    };

    try {
      const newExpenses = [];
      const newRents = [];
      for (const p of filledParts) {
        const amount = money(p.amount);
        const propertyName = p.propertyId ? (propertyById.get(String(p.propertyId)) || '') : '';
        const note = [p.note, `Part of bank entry: ${row.description || ''}`].filter(Boolean).join(' · ');
        if (p.kind === 'income') {
          newRents.push({
            ...stamp,
            notes: note,
            propertyId: p.propertyId || '',
            propertyName,
            tenantName: '',
            category: p.category,
            amount,
            month: (parentDate || '').slice(0, 7),
            datePaid: parentDate,
            status: 'paid',
          });
        } else {
          newExpenses.push({
            ...stamp,
            notes: note,
            propertyId: p.propertyId || '',
            propertyName,
            category: p.category,
            description: p.note || `${row.description || 'Split'} — ${p.category}`,
            amount,
            date: parentDate,
            vendor: row.raw?.vendor || row.raw?.payee || '',
          });
        }
      }

      // 1. Create the brand-new parts.
      if (newExpenses.length && bulkAddExpenses) {
        const res = await bulkAddExpenses(newExpenses);
        if (!res?.ok) throw new Error(res?.error || 'could not save the expense parts');
      }
      if (newRents.length && bulkAddRentPayments) {
        const res = await bulkAddRentPayments(newRents);
        if (!res?.ok) throw new Error(res?.error || 'could not save the income parts');
      }

      // 2. Link the entries she had already typed in — stamp only, no retyping.
      const linkExp = {}; const linkRent = {};
      for (const c of linkedRows) {
        const patch = { splitGroupId: groupId, splitChildOf: String(row.id) };
        if (c.kind === 'expense') linkExp[String(c.id)] = patch;
        else linkRent[String(c.id)] = patch;
      }
      if (Object.keys(linkExp).length && bulkUpdateExpenses) {
        const res = await bulkUpdateExpenses(linkExp);
        if (!res?.ok) throw new Error(res?.error || 'could not link the existing expense entries');
      }
      if (Object.keys(linkRent).length && bulkUpdateRentPayments) {
        const res = await bulkUpdateRentPayments(linkRent);
        if (!res?.ok) throw new Error(res?.error || 'could not link the existing income entries');
      }

      // 3. Flag the bank line last. If anything above failed we never get here,
      //    so the bank line keeps counting and nothing silently disappears.
      const parentPatch = { splitParent: true, splitGroupId: groupId, splitPartCount: totalParts };
      const res = row.kind === 'expense'
        ? await bulkUpdateExpenses?.({ [String(row.id)]: parentPatch })
        : await bulkUpdateRentPayments?.({ [String(row.id)]: parentPatch });
      if (!res?.ok) throw new Error(res?.error || 'could not flag the bank entry as split');

      showToast?.(`Split into ${totalParts} parts.`, 'success');
      onClose?.();
    } catch (err) {
      console.error('[split] failed:', err);
      showToast?.(`Split failed: ${err.message || 'unknown error'}. Nothing was flagged as split — try again.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Undo an existing split -------------------------------------------

  const handleUnsplit = async () => {
    setSaving(true);
    try {
      // Parts this tool created get deleted. Parts that were already in the books
      // are only unlinked — her typing is never thrown away.
      const delExp = currentChildren.expenses.filter(e => e.splitCreated).map(e => e.id);
      const delRent = currentChildren.rents.filter(r => r.splitCreated).map(r => r.id);
      const unlinkExp = {}; const unlinkRent = {};
      currentChildren.expenses.filter(e => !e.splitCreated)
        .forEach(e => { unlinkExp[String(e.id)] = { splitGroupId: '', splitChildOf: '' }; });
      currentChildren.rents.filter(r => !r.splitCreated)
        .forEach(r => { unlinkRent[String(r.id)] = { splitGroupId: '', splitChildOf: '' }; });

      if (delExp.length && bulkDeleteExpenses) await bulkDeleteExpenses(delExp);
      if (delRent.length && bulkDeleteRentPayments) await bulkDeleteRentPayments(delRent);
      if (Object.keys(unlinkExp).length && bulkUpdateExpenses) await bulkUpdateExpenses(unlinkExp);
      if (Object.keys(unlinkRent).length && bulkUpdateRentPayments) await bulkUpdateRentPayments(unlinkRent);

      const parentPatch = { splitParent: false, splitGroupId: '', splitPartCount: 0 };
      if (row.kind === 'expense') await bulkUpdateExpenses?.({ [String(row.id)]: parentPatch });
      else await bulkUpdateRentPayments?.({ [String(row.id)]: parentPatch });

      showToast?.('Split removed — the bank entry counts on its own again.', 'info');
      onClose?.();
    } catch (err) {
      console.error('[unsplit] failed:', err);
      showToast?.(`Could not remove the split: ${err.message || 'unknown error'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedProperties = useMemo(
    () => [...properties].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [properties]
  );

  return (
    <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && onClose?.()} />
      <div className="relative w-full max-w-4xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-5 md:p-6 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-300" />
              Split this bank entry
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Enter every part as a <strong className="text-white/70">positive</strong> number and mark it money in or
              money out — you never have to type a negative.
            </p>
          </div>
          <button
            onClick={() => !saving && onClose?.()}
            disabled={saving}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-50 flex-shrink-0"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* The bank line being split */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{row.description || 'Bank entry'}</div>
              <div className="text-xs text-white/40 mt-0.5">
                {parentDate || 'no date'}
                {row.raw?.bankAccount ? ` · ${row.raw.bankAccount}` : ''}
                {row.raw?.sourceDocument ? ` · ${row.raw.sourceDocument}` : ''}
              </div>
            </div>
            <div className={`text-lg font-bold whitespace-nowrap ${parentIsIncome ? 'text-emerald-300' : 'text-red-300'}`}>
              {parentIsIncome ? '+' : '−'}{formatCurrency(Math.abs(parentSigned))}
            </div>
          </div>
        </div>

        {alreadySplit && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-100 font-medium">
              This entry is already split into {currentChildren.expenses.length + currentChildren.rents.length} parts.
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              Adding more parts below keeps the existing ones. To start over, remove the split first —
              parts you typed yourself are only unlinked, never deleted.
            </p>
            <button
              onClick={() => setConfirmUnsplit(true)}
              disabled={saving}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-semibold disabled:opacity-50"
            >
              Remove the split
            </button>
          </div>
        )}

        {/* Running balance */}
        <div className={`rounded-xl border px-4 py-3 mb-4 ${
          balanced
            ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
            : 'border-amber-500/30 bg-amber-500/[0.08]'
        }`}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="text-emerald-300">Money in: {formatCurrency(newIn + linkedIn + existingIn)}</span>
            <span className="text-red-300">Money out: {formatCurrency(newOut + linkedOut + existingOut)}</span>
            <span className="text-white/60">Net of the parts: {formatCurrency(net)}</span>
            <span className="text-white/60">Bank entry: {formatCurrency(parentSigned)}</span>
          </div>
          <p className={`text-sm font-semibold mt-1.5 ${balanced ? 'text-emerald-300' : 'text-amber-200'}`}>
            {balanced ? (
              <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Balanced — the parts add up to the bank entry.</span>
            ) : (
              <>Still to account for: {formatCurrency(Math.abs(diff))}{' '}
                <span className="font-normal text-amber-200/70">
                  ({diff > 0 ? 'add money in, or reduce money out' : 'add money out, or reduce money in'})
                </span>
              </>
            )}
          </p>
          {totalParts < 2 && (
            <p className="text-xs text-white/40 mt-1">A split needs at least two parts.</p>
          )}
        </div>

        {/* New parts */}
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Parts</h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEvenOpen(v => !v)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-white/70 hover:text-white hover:bg-white/[0.1]"
              title="Divide what's left evenly across several properties — for an HOA bill covering three condos, for example"
            >
              Divide evenly…
            </button>
            <button
              onClick={() => addPart('income')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Money in
            </button>
            <button
              onClick={() => addPart('expense')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Money out
            </button>
          </div>
        </div>

        {evenOpen && (
          <div className="mb-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3">
            <p className="text-xs text-sky-200 font-medium mb-2">
              Divide the {formatCurrency(Math.abs(diff))} still unaccounted for evenly across the properties you check.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2 max-h-32 overflow-y-auto">
              {sortedProperties.map(p => {
                const on = evenProps.has(String(p.id));
                return (
                  <button
                    key={p.id}
                    onClick={() => setEvenProps(prev => {
                      const n = new Set(prev);
                      on ? n.delete(String(p.id)) : n.add(String(p.id));
                      return n;
                    })}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition ${
                      on ? 'bg-sky-500/25 border-sky-400/50 text-white' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white/90'
                    }`}
                  >
                    {p.emoji || '🏠'} {p.name}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={evenKind}
                onChange={(e) => { setEvenKind(e.target.value); setEvenCategory(''); }}
                className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5"
              >
                <option value="expense">Money out</option>
                <option value="income">Money in</option>
              </select>
              <select
                value={evenCategory}
                onChange={(e) => setEvenCategory(e.target.value)}
                className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 min-w-[160px]"
              >
                <option value="">Category…</option>
                {evenKind === 'income'
                  ? incomeCategories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)
                  : EXPENSE_OPTIONS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                    </optgroup>
                  ))}
              </select>
              <button
                onClick={divideEvenly}
                className="text-xs px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-sky-950 font-semibold"
              >
                Create {evenProps.size || 0} equal parts
              </button>
              <button onClick={() => setEvenOpen(false)} className="text-xs text-white/50 hover:text-white/80 px-2">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {parts.map((p, i) => {
            const noProp = needsNoProperty(p.kind, p.category);
            return (
              <div key={p.key} className={`rounded-xl border p-2.5 ${
                p.kind === 'income' ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.04]'
              }`}>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={p.kind}
                    onChange={(e) => setPart(p.key, { kind: e.target.value, category: '' })}
                    className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5"
                  >
                    <option value="expense">− Money out</option>
                    <option value="income">+ Money in</option>
                  </select>

                  <select
                    value={p.category}
                    onChange={(e) => setPart(p.key, { category: e.target.value })}
                    className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 min-w-[170px]"
                  >
                    <option value="">Category…</option>
                    {p.kind === 'income'
                      ? incomeCategories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)
                      : EXPENSE_OPTIONS.map(g => (
                        <optgroup key={g.label} label={g.label}>
                          {g.options.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                        </optgroup>
                      ))}
                  </select>

                  <select
                    value={p.propertyId}
                    onChange={(e) => setPart(p.key, { propertyId: e.target.value })}
                    disabled={noProp}
                    className="bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 min-w-[170px] disabled:opacity-40"
                  >
                    <option value="">{noProp ? 'No property (business-wide)' : 'Property…'}</option>
                    {sortedProperties.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.emoji || '🏠'} {pr.name}</option>
                    ))}
                  </select>

                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.amount}
                      onChange={(e) => setPart(p.key, { amount: e.target.value })}
                      placeholder="0.00"
                      className="w-28 bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg pl-5 pr-2 py-1.5 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <button
                    onClick={() => fillRemainder(p.key)}
                    className="text-[11px] px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-white/60 hover:text-white"
                    title="Set this part to whatever is left over"
                  >
                    = rest
                  </button>

                  <input
                    type="text"
                    value={p.note}
                    onChange={(e) => setPart(p.key, { note: e.target.value })}
                    placeholder="Note (optional)"
                    className="flex-1 min-w-[120px] bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-white/30 placeholder-white/30"
                  />

                  {parts.length > 1 && (
                    <button
                      onClick={() => removePart(p.key)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 flex items-center justify-center flex-shrink-0"
                      title="Remove this part"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reuse what she already typed */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-sky-300" />
              Use entries you already typed in
              {linkedRows.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                  {linkedRows.length} linked
                </span>
              )}
            </h3>
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(parseInt(e.target.value))}
              className="bg-white/[0.06] border border-white/15 text-white text-[11px] rounded-lg px-2 py-1"
            >
              <option value={7}>within 1 week</option>
              <option value={14}>within 2 weeks</option>
              <option value={45}>within 45 days</option>
            </select>
          </div>
          <p className="text-xs text-white/45 mb-2">
            Check anything that is really part of this bank entry — an owner-packet rent, a repair you already
            entered. Linking counts it as a part; nothing is retyped and nothing is duplicated.
          </p>
          <input
            type="search"
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            placeholder="Search these entries…"
            className="w-full mb-2 bg-white/[0.06] border border-white/15 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-white/30 placeholder-white/30"
          />
          <div className="border border-white/10 rounded-xl max-h-56 overflow-y-auto divide-y divide-white/[0.05]">
            {visibleCandidates.length === 0 && (
              <p className="text-xs text-white/40 px-3 py-4 text-center">
                No unlinked entries near {parentDate || 'this date'}. Widen the window, or just type the parts above.
              </p>
            )}
            {visibleCandidates.slice(0, 200).map(c => {
              const on = linkedIds.has(c.key);
              return (
                <label
                  key={c.key}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${on ? 'bg-sky-500/10' : 'hover:bg-white/[0.03]'}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setLinkedIds(prev => {
                      const n = new Set(prev);
                      on ? n.delete(c.key) : n.add(c.key);
                      return n;
                    })}
                    className="w-3.5 h-3.5 accent-sky-500 flex-shrink-0"
                  />
                  <span className="text-[10px] font-mono text-white/40 w-16 flex-shrink-0">{c.date}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    c.kind === 'rent' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                  }`}>
                    {c.kind === 'rent' ? 'in' : 'out'}
                  </span>
                  <span className="text-xs text-white/70 truncate flex-1">{c.description}</span>
                  <span className="text-[11px] text-white/40 truncate max-w-[130px] hidden md:block">{c.propertyName}</span>
                  <span className={`text-xs font-semibold whitespace-nowrap ${c.kind === 'rent' ? 'text-emerald-300' : 'text-red-300'}`}>
                    {c.kind === 'rent' ? '+' : '−'}{formatCurrency(Math.abs(c.amount))}
                  </span>
                </label>
              );
            })}
          </div>
          {visibleCandidates.length > 200 && (
            <p className="text-[11px] text-white/35 mt-1">
              Showing the first 200 of {visibleCandidates.length} — narrow it with the search box.
            </p>
          )}
        </div>

        {/* Problems */}
        {partProblems.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5">
            {partProblems.map((m, i) => (
              <p key={i} className="text-xs text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> {m}
              </p>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <p className="text-xs text-white/40 mr-auto">
            The bank entry stays in the list for reconciliation, but stops counting on its own —
            these parts count instead.
          </p>
          <button
            onClick={() => onClose?.()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            title={!balanced ? 'The parts have to add up to the bank entry first' : undefined}
          >
            {saving ? 'Saving…' : `Save split (${totalParts} parts)`}
          </button>
        </div>

        {/* Unsplit confirm */}
        {confirmUnsplit && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => !saving && setConfirmUnsplit(false)} />
            <div className="relative w-full max-w-sm bg-slate-800 border border-white/15 rounded-2xl p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-2">Remove this split?</h3>
              <p className="text-sm text-white/70 mb-3">
                The {currentChildren.expenses.filter(e => e.splitCreated).length + currentChildren.rents.filter(r => r.splitCreated).length} parts
                created here will be deleted. The{' '}
                {currentChildren.expenses.filter(e => !e.splitCreated).length + currentChildren.rents.filter(r => !r.splitCreated).length} entries
                you had typed yourself are only unlinked — they stay in your books. The bank entry starts counting on its own again.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmUnsplit(false)} disabled={saving} className="px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-sm disabled:opacity-50">Cancel</button>
                <button onClick={handleUnsplit} disabled={saving} className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-bold disabled:opacity-50">
                  {saving ? 'Removing…' : 'Remove split'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
