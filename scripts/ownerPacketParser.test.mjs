/**
 * Coordinate tests for the owner-packet money-column reader.
 *
 * The numbers below are real x-positions lifted from the March 2026 Absolute
 * owner packet — the header row and four transaction rows off the 1329-A S.
 * 11th St page. They exist because the old parser guessed which column a
 * figure sat in from keywords, and guessed wrong: a $1,000 rent receipt on
 * Dianne's July statement was booked as an expense.
 *
 * Run: node scripts/ownerPacketParser.test.mjs
 */
import { detectAmountColumns, assignAmountColumns, UNPAID_SECTION_RE } from '../src/utils/ownerPacketParser.js';

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
};

// pdf.js gives { text, x, width }; these mirror the real packet's geometry.
const item = (text, x0, x1) => ({ text, x: x0, width: x1 - x0 });
const amount = (text, x0, x1, value) => ({ ...item(text, x0, x1), value });

console.log('detectAmountColumns');

const headerRow = [
  item('Date', 45, 62), item('Payee', 92, 115), item('/', 117, 119), item('Payer', 121, 143),
  item('Type', 209, 227), item('Reference', 247, 284), item('Description', 307, 347),
  item('Cash', 456, 475), item('In', 477, 484),
  item('Cash', 494, 512), item('Out', 515, 528),
  item('Balance', 537, 567),
];
check('reads the three money columns off a split header',
  detectAmountColumns(headerRow), { cashIn: 484, cashOut: 528, balance: 567 });

check('reads a header whose words arrive pre-joined',
  detectAmountColumns([item('Cash In', 456, 484), item('Cash Out', 494, 528), item('Balance', 537, 567)]),
  { cashIn: 484, cashOut: 528, balance: 567 });

check('returns null when there is no money header at all',
  detectAmountColumns([item('Date', 45, 62), item('Description', 307, 347)]), null);

console.log('assignAmountColumns');
const cols = { cashIn: 484, cashOut: 528, balance: 567 };

// The row that started all this: rent collected, money IN.
check('rent receipt lands in Cash In, not Cash Out',
  assignAmountColumns([amount('950.00', 461, 486, 950), amount('950.00', 544, 569, 950)], cols),
  { cashIn: 950, cashOut: 0, balance: 950 });

// A utility bill actually paid — money OUT. Only 2px from the Cash Out anchor.
check('a paid bill lands in Cash Out',
  assignAmountColumns([amount('38.61', 509, 530, 38.61), amount('911.39', 544, 569, 911.39)], cols),
  { cashIn: 0, cashOut: 38.61, balance: 911.39 });

// Management fee — the case Dianne flagged as wrongly "paid".
check('management fee lands in Cash Out',
  assignAmountColumns([amount('95.00', 509, 530, 95), amount('668.89', 544, 569, 668.89)], cols),
  { cashIn: 0, cashOut: 95, balance: 668.89 });

check('all three columns at once',
  assignAmountColumns(
    [amount('1000.00', 461, 486, 1000), amount('58.07', 509, 530, 58.07), amount('941.93', 544, 569, 941.93)],
    cols),
  { cashIn: 1000, cashOut: 58.07, balance: 941.93 });

// A layout we don't understand must fall back, not guess.
check('figures far from every anchor return null',
  assignAmountColumns([amount('123.45', 120, 150, 123.45)], cols), null);

check('no columns detected returns null',
  assignAmountColumns([amount('950.00', 461, 486, 950)], null), null);

console.log('UNPAID_SECTION_RE');
for (const s of ['Unpaid Bills', 'unpaid bills', 'Bills Due', 'Outstanding Payables', 'Accounts Payable', 'Payables']) {
  check(`matches "${s}"`, UNPAID_SECTION_RE.test(s), true);
}
// These must NOT stop the importer — they are ordinary statement text.
for (const s of [
  'Past due notice sent to tenant',
  'Rent Income - balance due 03/2026',
  'Open work order - plumbing',
  'Description',
  'Payee / Payer',
]) {
  check(`ignores "${s}"`, UNPAID_SECTION_RE.test(s), false);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
