import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, Landmark, Wrench } from 'lucide-react';
import { FFB_STATEMENTS } from '../../data/ffbStatements';
import { formatCurrency } from '../../utils';

/**
 * FFBReconciliation — "Bank Reconciliation" tab on the Input Data page.
 *
 * The FFB statements (src/data/ffbStatements.js) are the ledger of record for
 * cash. For each statement month this panel answers three questions:
 *
 *   1. COVERAGE  — is every line on the bank statement in the app?
 *      Each statement transaction is matched against imported FFB rows by
 *      amount + date. Missing lines are listed so mom can import them.
 *
 *   2. CATEGORIES — are the imported rows categorized so nothing double-counts?
 *      Owner-distribution deposits must be category 'owner-distribution' (not
 *      'rent'), interest must be 'interest', and card-payment/investment debits
 *      must be 'transfer'. A one-click fix button repairs any that aren't.
 *
 *   3. DISTRIBUTIONS — does each SIGONFILE deposit equal the net the manager
 *      reported? Matched against the owner-distribution EXPENSE rows imported
 *      from the Barnett & Hill / Absolute owner packets.
 */

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const sameAmount = (a, b) => Math.abs(round2(a) - round2(b)) < 0.005;

/** days between two YYYY-MM-DD strings (absolute) */
function daysBetween(a, b) {
  if (!a || !b) return 999;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.abs((da - db) / 86400000);
}

/** Map a statement vendor to the sourceDocument label the owner packets use. */
const VENDOR_TO_SOURCE = {
  'Barnett & Hill': 'Barnett & Hill',
  'Absolute RE': 'Absolute',
};

export default function FFBReconciliation({
  expenses = [],
  rentPayments = [],
  bulkUpdateExpenses,
  bulkUpdateRentPayments,
  showToast,
}) {
  const [openMonth, setOpenMonth] = useState(null);
  const [fixing, setFixing] = useState(false);

  const monthResults = useMemo(() => {
    // Imported FFB rows, normalized to a common shape.
    const ffbIncomes = (rentPayments || [])
      .filter(r => r.sourceDocument === 'FFB Bank')
      .map(r => ({ kind: 'income', id: r.id, date: (r.datePaid || `${r.month || ''}-01`).slice(0, 10), amount: round2(r.amount), category: r.category || 'rent', used: false }));
    const ffbExpenses = (expenses || [])
      .filter(e => e.sourceDocument === 'FFB Bank')
      .map(e => ({ kind: 'expense', id: e.id, date: (e.date || '').slice(0, 10), amount: round2(e.amount), category: e.category || 'other', used: false }));

    // Owner-distribution expense rows from the owner packets, summed per
    // (manager, month) — the net each manager paid out.
    const distByMgrMonth = {};
    for (const e of expenses || []) {
      if (e.category !== 'owner-distribution') continue;
      const src = e.sourceDocument || '';
      if (src !== 'Barnett & Hill' && src !== 'Absolute') continue;
      const ym = (e.date || '').slice(0, 7);
      if (!ym) continue;
      const key = `${src}|${ym}`;
      if (!distByMgrMonth[key]) distByMgrMonth[key] = { total: 0, rows: [] };
      distByMgrMonth[key].total = round2(distByMgrMonth[key].total + round2(e.amount));
      distByMgrMonth[key].rows.push(round2(e.amount));
    }

    return FFB_STATEMENTS.map(stmt => {
      const lines = stmt.transactions.map(tx => {
        const pool = tx.flow === 'income' ? ffbIncomes : ffbExpenses;
        // Best match: same amount, closest date (within 3 days), not already used.
        let best = null;
        for (const row of pool) {
          if (row.used || !sameAmount(row.amount, tx.amount)) continue;
          const d = daysBetween(row.date, tx.date);
          if (d <= 3 && (!best || d < best.d)) best = { row, d };
        }
        if (best) best.row.used = true;

        const expectedCat = tx.flow === 'income' ? (tx.incomeCat || 'rent') : (tx.cat || 'other');
        const actualCat = best ? best.row.category : null;
        // Only strict about the categories that cause double-counting; 'other'
        // vs 'repair' etc. is mom's judgment call, not a reconciliation error.
        const STRICT = new Set(['owner-distribution', 'interest', 'transfer']);
        const catWrong = !!best && expectedCat !== actualCat && (STRICT.has(expectedCat) || STRICT.has(actualCat));

        return { tx, imported: !!best, matchedRow: best ? best.row : null, expectedCat, catWrong };
      });

      const missing = lines.filter(l => !l.imported);
      const catFixes = lines.filter(l => l.catWrong);

      // Distribution cross-check against manager statements.
      const distChecks = stmt.transactions
        .filter(tx => tx.incomeCat === 'owner-distribution')
        .map(tx => {
          const src = VENDOR_TO_SOURCE[tx.vendor] || tx.vendor;
          // Look in the deposit's own month and the month before (Absolute pays
          // early the following month).
          const [y, m] = tx.date.slice(0, 7).split('-').map(Number);
          const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
          const candidates = [tx.date.slice(0, 7), prevYm];
          let matchedMonth = null;
          for (const ym of candidates) {
            const g = distByMgrMonth[`${src}|${ym}`];
            if (!g) continue;
            // exact single row, or the whole month's total
            if (g.rows.some(a => sameAmount(a, tx.amount)) || sameAmount(g.total, tx.amount)) {
              matchedMonth = ym;
              break;
            }
          }
          return { tx, src, matchedMonth };
        });

      const allImported = missing.length === 0;
      const allCatsOk = catFixes.length === 0;
      const allDistOk = distChecks.every(d => d.matchedMonth);

      return { stmt, lines, missing, catFixes, distChecks, allImported, allCatsOk, allDistOk };
    });
  }, [expenses, rentPayments]);

  // Global category-fix payloads across all months.
  const allCatFixes = useMemo(() => {
    const rentFixes = {};
    const expFixes = {};
    for (const m of monthResults) {
      for (const f of m.catFixes) {
        if (!f.matchedRow?.id) continue;
        if (f.matchedRow.kind === 'income') rentFixes[String(f.matchedRow.id)] = { category: f.expectedCat };
        else expFixes[String(f.matchedRow.id)] = { category: f.expectedCat };
      }
    }
    return { rentFixes, expFixes, count: Object.keys(rentFixes).length + Object.keys(expFixes).length };
  }, [monthResults]);

  const handleFixCategories = async () => {
    if (fixing || allCatFixes.count === 0) return;
    setFixing(true);
    try {
      let ok = true;
      if (Object.keys(allCatFixes.rentFixes).length > 0 && bulkUpdateRentPayments) {
        const r = await bulkUpdateRentPayments(allCatFixes.rentFixes);
        ok = ok && !!r?.ok;
      }
      if (Object.keys(allCatFixes.expFixes).length > 0 && bulkUpdateExpenses) {
        const r = await bulkUpdateExpenses(allCatFixes.expFixes);
        ok = ok && !!r?.ok;
      }
      showToast?.(ok
        ? `Fixed ${allCatFixes.count} categor${allCatFixes.count === 1 ? 'y' : 'ies'} — totals no longer double-count`
        : 'Some category fixes failed to save — check the console.', ok ? 'success' : 'error');
    } catch (err) {
      console.error('[FFBReconciliation] fix categories failed:', err);
      showToast?.(`Fix failed: ${err.message}`, 'error');
    }
    setFixing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-400" /> FFB Bank Reconciliation
          </h3>
          <p className="text-xs text-white/50 mt-1 max-w-xl">
            Every line below comes straight from the FFB statements for the rental account (•••5710).
            Green means the line is imported and categorized so nothing double-counts against the
            management-company statements.
          </p>
        </div>
        {allCatFixes.count > 0 && (
          <button
            onClick={handleFixCategories}
            disabled={fixing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50"
          >
            <Wrench className="w-4 h-4" />
            {fixing ? 'Fixing…' : `Fix ${allCatFixes.count} miscategorized entr${allCatFixes.count === 1 ? 'y' : 'ies'}`}
          </button>
        )}
      </div>

      {monthResults.map(({ stmt, lines, missing, catFixes, distChecks, allImported, allCatsOk, allDistOk }) => {
        const isOpen = openMonth === stmt.id;
        const importedCount = lines.length - missing.length;
        const allGood = allImported && allCatsOk && allDistOk;
        return (
          <div key={stmt.id} className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
            {/* Month header */}
            <button
              onClick={() => setOpenMonth(isOpen ? null : stmt.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                {allGood
                  ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{stmt.label} <span className="text-white/40 font-normal">({stmt.periodLabel})</span></p>
                  <p className="text-[11px] text-white/40 truncate">
                    {importedCount}/{lines.length} lines in app
                    {!allCatsOk && ` · ${catFixes.length} category fix${catFixes.length === 1 ? '' : 'es'} needed`}
                    {!allDistOk && ' · distribution mismatch'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] text-white/40">Ending balance</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(stmt.summary.endingBalance)}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06]">
                {/* Statement summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                  {[
                    ['Starting balance', stmt.summary.previousBalance],
                    [`Deposits (${stmt.summary.depositCount}) + interest`, stmt.summary.depositsTotal + stmt.summary.interest],
                    [`Debits (${stmt.summary.debitCount})`, -stmt.summary.debitsTotal],
                    ['Ending balance', stmt.summary.endingBalance],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                      <p className="text-[10px] text-white/40">{label}</p>
                      <p className={`text-sm font-semibold ${val < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(Math.abs(val))}{val < 0 ? ' out' : ''}</p>
                    </div>
                  ))}
                </div>

                {/* Missing lines */}
                {missing.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-300 mb-2">
                      {missing.length} statement line{missing.length === 1 ? '' : 's'} not in the app yet — quick-load {stmt.label} on the Import tab:
                    </p>
                    <ul className="space-y-1">
                      {missing.map((l, i) => (
                        <li key={i} className="text-[11px] text-white/60 flex justify-between gap-3">
                          <span className="truncate">{l.tx.date.slice(5)} · {l.tx.desc}</span>
                          <span className={l.tx.flow === 'income' ? 'text-green-400' : 'text-red-400'}>
                            {l.tx.flow === 'income' ? '+' : '−'}{formatCurrency(l.tx.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Category problems */}
                {catFixes.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-300 mb-2">
                      Categorized so they double-count — the Fix button above repairs all of these:
                    </p>
                    <ul className="space-y-1">
                      {catFixes.map((l, i) => (
                        <li key={i} className="text-[11px] text-white/60 flex justify-between gap-3">
                          <span className="truncate">{l.tx.date.slice(5)} · {l.tx.desc}</span>
                          <span className="text-white/40 flex-shrink-0">{l.matchedRow.category} → <span className="text-amber-300">{l.expectedCat}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Distribution cross-check */}
                {distChecks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-2">Owner distributions vs. management statements</p>
                    <ul className="space-y-1.5">
                      {distChecks.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                          <span className="text-white/70 truncate">{d.tx.date.slice(5)} · {d.tx.vendor} deposit</span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-white font-medium">{formatCurrency(d.tx.amount)}</span>
                            {d.matchedMonth ? (
                              <span className="inline-flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3.5 h-3.5" /> matches {d.src} {d.matchedMonth}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-400" title="No matching owner-distribution total found in the imported management statements. Import that month's owner packet, or the manager may have split/combined payments.">
                                <AlertTriangle className="w-3.5 h-3.5" /> no match yet
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-white/30 mt-1.5">
                      A deposit "matches" when it equals an owner-distribution amount (or a month's total) from that
                      manager's imported statement. "No match yet" usually just means that month's owner packet
                      hasn't been imported.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-white/40">
        Months shown are the statements on file (January – June 2026). When a new FFB statement arrives,
        import it on the Import tab — Mike can add it to this reconciliation list too.
      </p>
    </div>
  );
}
