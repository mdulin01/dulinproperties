import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, Landmark, Wrench } from 'lucide-react';
import { FFB_STATEMENTS, FFB_3110_BALANCES } from '../../data/ffbStatements';
import { formatCurrency } from '../../utils';

/**
 * FFBReconciliation — "Bank Reconciliation" tab on the Input Data page.
 *
 * The FFB statements (src/data/ffbStatements.js) are the ledger of record for
 * cash. Each statement package covers four accounts (•••5710 rental, •••5711,
 * •••0410 personal, and •••3110 which FFB reports as a balance only), and this
 * panel reconciles each one separately. For every account/month it answers
 * three questions:
 *
 *   1. COVERAGE  — is every line on the bank statement in the app?
 *      Each statement transaction is matched against imported FFB rows by
 *      amount + date. Missing lines are listed so mom can import them.
 *
 *   2. CATEGORIES — are the imported rows categorized so nothing double-counts?
 *      Owner-distribution deposits must be category 'owner-distribution' (not
 *      'rent'), interest must be 'interest', card-payment/investment/internal
 *      debits must be 'transfer', and credits on the personal accounts must be
 *      'non-rental'. A one-click fix button repairs any that aren't.
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
    // Split parts inherit their parent's source and date, so they'd otherwise
    // compete with the real bank line for a match. Only the parent — the row
    // that actually hit the bank — belongs in the pool.
    const ffbIncomes = (rentPayments || [])
      .filter(r => r.sourceDocument === 'FFB Bank' && !r.splitChildOf)
      .map(r => ({ kind: 'income', id: r.id, date: (r.datePaid || `${r.month || ''}-01`).slice(0, 10), amount: round2(r.amount), category: r.category || 'rent', used: false }));
    const ffbExpenses = (expenses || [])
      .filter(e => e.sourceDocument === 'FFB Bank' && !e.splitChildOf)
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

    // Match one statement line against the imported rows.
    const matchLine = (tx, acct) => {
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
      // Only strict about the categories that cause double-counting or leak
      // personal money into the rental books; 'other' vs 'repair' etc. is
      // mom's judgment call, not a reconciliation error.
      const STRICT = new Set(['owner-distribution', 'non-rental', 'interest', 'transfer']);
      const catWrong = !!best && expectedCat !== actualCat && (STRICT.has(expectedCat) || STRICT.has(actualCat));

      return { tx, acct, imported: !!best, matchedRow: best ? best.row : null, expectedCat, catWrong };
    };

    return FFB_STATEMENTS.map(stmt => {
      // Reconcile account by account, in statement order (5710 first).
      const accounts = stmt.accounts.map(a => {
        const lines = a.transactions.map(tx => matchLine(tx, a.acct));
        return {
          ...a,
          lines,
          missing: lines.filter(l => !l.imported),
          catFixes: lines.filter(l => l.catWrong),
        };
      });

      const lines = accounts.flatMap(a => a.lines);
      const missing = lines.filter(l => !l.imported);
      const catFixes = lines.filter(l => l.catWrong);

      // Distribution cross-check against manager statements (distributions
      // only ever land on the rental account, but scan them all).
      const distChecks = accounts
        .flatMap(a => a.transactions)
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

      return { stmt, accounts, lines, missing, catFixes, distChecks, allImported, allCatsOk, allDistOk };
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
            Every line below comes straight from the FFB statements — <strong>all four bundled accounts</strong>,
            because the bank is the one place every transaction appears. Green means the line is imported and
            categorized so nothing double-counts against the management-company statements and no personal
            money lands in the rental books.
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

      {monthResults.map(({ stmt, accounts, lines, missing, catFixes, distChecks, allImported, allCatsOk, allDistOk }) => {
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
                  <p className="text-[10px] text-white/40">Ending balance · all accounts</p>
                  <p className="text-sm font-semibold text-white">
                    {formatCurrency(
                      accounts.reduce((s, a) => s + a.summary.endingBalance, 0)
                      + (FFB_3110_BALANCES.find(b => b.monthStr === stmt.monthStr)?.endingBalance || 0)
                    )}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06]">
                {/* Per-account blocks — one summary strip + issue list each */}
                <div className="pt-3 space-y-4">
                  {accounts.map(a => (
                    <div key={a.acct}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {a.missing.length === 0 && a.catFixes.length === 0
                          ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                        <p className="text-xs font-semibold text-white">•••{a.acct}</p>
                        <p className="text-[10px] text-white/35 truncate">{a.title}</p>
                        {a.nonRental && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 border border-white/10">non-rental</span>
                        )}
                        <span className="text-[10px] text-white/35 ml-auto">
                          {a.lines.length - a.missing.length}/{a.lines.length} lines in app
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          ['Starting balance', a.summary.previousBalance],
                          [`Deposits (${a.summary.depositCount}) + interest`, a.summary.depositsTotal + a.summary.interest],
                          [`Debits (${a.summary.debitCount})`, -a.summary.debitsTotal],
                          ['Ending balance', a.summary.endingBalance],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                            <p className="text-[10px] text-white/40">{label}</p>
                            <p className={`text-sm font-semibold ${val < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(Math.abs(val))}{val < 0 ? ' out' : ''}</p>
                          </div>
                        ))}
                      </div>

                      {/* Missing lines on this account */}
                      {a.missing.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-2">
                          <p className="text-xs font-semibold text-red-300 mb-2">
                            {a.missing.length} statement line{a.missing.length === 1 ? '' : 's'} not in the app yet — quick-load {stmt.label} on the Import tab:
                          </p>
                          <ul className="space-y-1">
                            {a.missing.map((l, i) => (
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

                      {/* Category problems on this account */}
                      {a.catFixes.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-2">
                          <p className="text-xs font-semibold text-amber-300 mb-2">
                            Categorized so they'd leak into rental totals — the Fix button above repairs all of these:
                          </p>
                          <ul className="space-y-1">
                            {a.catFixes.map((l, i) => (
                              <li key={i} className="text-[11px] text-white/60 flex justify-between gap-3">
                                <span className="truncate">{l.tx.date.slice(5)} · {l.tx.desc}</span>
                                <span className="text-white/40 flex-shrink-0">{l.matchedRow.category} → <span className="text-amber-300">{l.expectedCat}</span></span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 3110 — balance only, no line items printed by FFB */}
                  {(() => {
                    const b = FFB_3110_BALANCES.find(x => x.monthStr === stmt.monthStr);
                    if (!b) return null;
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/70">•••3110 — balance only</p>
                          <p className="text-[10px] text-white/35">
                            FFB prints no line items for this account. Its activity appears as the “Transfer to XXX3110” debits on •••0410.
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-white flex-shrink-0">{formatCurrency(b.endingBalance)}</p>
                      </div>
                    );
                  })()}
                </div>

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
