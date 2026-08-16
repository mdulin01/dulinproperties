/**
 * Reconcile a parsed owner packet against the statement's own arithmetic.
 *
 * Every property page prints a Property Cash Summary — Cash In, Cash Out,
 * Owner Disbursements. This runs the same parser the app uses and checks that
 * the transactions it extracted add up to those printed figures, property by
 * property. If a row is misread — wrong column, wrong category, dropped
 * entirely — the totals stop matching and this says which property.
 *
 * Run it on each month's packet before importing:
 *
 *   node scripts/checkOwnerPacket.mjs "~/Downloads/owner_statement_july.pdf"
 *
 * Exits non-zero if anything is off by more than a cent.
 */
import fs from 'fs';
import { parseOwnerPacket } from '../src/utils/ownerPacketParser.js';
import * as pdfjsLib from 'pdfjs-dist';

// The app points pdf.js at a CDN worker for the browser; on the command line
// use the copy in node_modules.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/checkOwnerPacket.mjs <owner-packet.pdf>');
  process.exit(2);
}

const R = (n) => Math.round((n || 0) * 100) / 100;
const money = (n) => R(n).toFixed(2).padStart(10);

const result = await parseOwnerPacket(new Uint8Array(fs.readFileSync(file)));
console.log(`Period: ${result.period?.displayPeriod || 'unknown'}`);
console.log(`Properties: ${result.properties.length}   Transactions: ${result.summary.totalTransactions}   Unpaid bills: ${result.summary.unpaidCount}\n`);

let problems = 0;

for (const prop of result.properties) {
  const name = prop.propertyAddress?.shortAddress || '(no address found)';
  if (!prop.propertyAddress) problems++;

  // Re-derive each row's direction exactly as parseOwnerPacket does, by
  // matching on the flattened transactions for this property.
  const rows = result.allTransactions.filter(t =>
    (t.propertyAddress || '') === (prop.propertyAddress?.shortAddress || ''));
  const live = rows.filter(t => !t.isUnpaid);

  const cashIn = R(live.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0));
  // The statement's "Cash Out" includes owner disbursements.
  const spend = R(live.filter(t => t.isExpense).reduce((s, t) => s + t.amount, 0));
  const dist = R(live.filter(t => t.isDistribution).reduce((s, t) => s + t.amount, 0));

  const want = prop.cashSummary || {};
  const checks = [
    ['Cash In', cashIn, R(Math.abs(want.cashIn ?? 0))],
    ['Cash Out', spend, R(Math.abs(want.cashOut ?? 0))],
    ['Owner Disb.', dist, R(Math.abs(want.ownerDisbursements ?? 0))],
  ];

  const bad = checks.filter(([, got, expected]) => R(got - expected) !== 0);
  if (bad.length === 0 && prop.propertyAddress) {
    console.log(`  ok   ${name}`);
    continue;
  }
  problems += bad.length;
  console.log(`  FAIL ${name}`);
  for (const [label, got, expected] of checks) {
    const flag = R(got - expected) === 0 ? '  ' : '->';
    console.log(`    ${flag} ${label.padEnd(12)} parsed ${money(got)}   statement ${money(expected)}`);
  }
  for (const t of rows) {
    console.log(`       ${(t.date || '----------')}  ${String(t.flowType).padEnd(12)}` +
      `${t.isUnpaid ? 'UNPAID ' : '       '}${(t.category || '').padEnd(18)}${money(t.amount)}  ${(t.description || '').slice(0, 50)}`);
  }
}

console.log(problems === 0
  ? '\nEvery property ties out to the statement.'
  : `\n${problems} figure(s) do not match the statement — do not import until these are understood.`);
process.exit(problems === 0 ? 0 : 1);
