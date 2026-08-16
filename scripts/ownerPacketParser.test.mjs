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
import { detectAmountColumns, assignAmountColumns, attachOrphanText, UNPAID_SECTION_RE } from '../src/utils/ownerPacketParser.js';

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

console.log('attachOrphanText');
// Both owner-packet formats wrap a long payee or description across two or
// three PDF lines, and the pieces land either side of the line carrying the
// date. The y values below are real line positions off two statements. pdf.js
// measures y upward from the bottom of the page, so these are negated page-top
// offsets — only the distances matter.
const y = (top) => -top;

/** Returns a map of transaction y → its description after attaching. */
const attach = (txTops, orphanRows) => {
  const txs = txTops.map(t => ({ y: y(t), description: `TX${t}`, type: '' }));
  attachOrphanText(txs, orphanRows.map(([top, text]) => ({ text, y: y(top) })));
  return Object.fromEntries(txs.map(t => [-t.y, t.description]));
};

// Absolute, March packet, 1329-A S. 11th St. Wrapped text sits both above and
// below the dated line; the management-fee row carries nothing of its own.
const absolute = attach([288, 308, 328, 342, 362, 388, 412], [
  [302, 'Reliant Energy - Master'],
  [312, 'Account'],
  [358, 'Absolute Real Estate Management Fees - Management Fees'],
  [368, 'Management, LLC for 03/2026'],
  [382, 'HVAC (Heat, Ventilation, Air) - 17089 -'],
  [408, 'Owner Distribution - Owner payment for'],
]);
check('Absolute: utility fragments join their own row',
  absolute[308], 'Reliant Energy - Master TX308 Account');
check('Absolute: management fee row picks up the description above and below it',
  absolute[362], 'Absolute Real Estate Management Fees - Management Fees TX362 Management, LLC for 03/2026');
check('Absolute: HVAC description joins the row below it', absolute[388], 'HVAC (Heat, Ventilation, Air) - 17089 - TX388');
check('Absolute: owner distribution keeps its own text', absolute[412], 'Owner Distribution - Owner payment for TX412');
check('Absolute: the repair row above is left alone', absolute[342], 'TX342');

// Barnett & Hill, July packet, 657 Ruidosa #106. The 07/31 security-deposit
// transfer prints nothing on its dated line — its whole description is split
// across the lines above and below. That row is the one Dianne reported as a
// $1,000 expense.
const bh = attach([308, 328, 348, 368, 394, 418, 442, 468], [
  [414, 'Bank\tMeadow B. Avallone, Alexis R. Guerrero, 657 Ruidosa'],
  [422, 'Transfer\t#106: Security Deposit Transfer'],
  [388, 'Richard S.\tCC'],
  [398, 'Thompson\treceipt'],
  [438, 'Meadow B.\tClearing Account - Meadow B. Avallone, 657 Ruidosa'],
  [448, 'Avallone\t#106: Move Out Refund'],
]);
check('B&H: the security-deposit row is reassembled from both sides',
  bh[418],
  'Bank\tMeadow B. Avallone, Alexis R. Guerrero, 657 Ruidosa TX418 Transfer\t#106: Security Deposit Transfer');
check('B&H: the prepaid-rent row above keeps only its own fragments',
  bh[394], 'Richard S.\tCC TX394 Thompson\treceipt');
check('B&H: the move-out refund below keeps only its own fragments',
  bh[442], 'Meadow B.\tClearing Account - Meadow B. Avallone, 657 Ruidosa TX442 Avallone\t#106: Move Out Refund');

// "Unknown" is the placeholder for a row with no payee and no type. Once real
// text arrives it should be replaced, not concatenated.
const placeholder = [{ y: y(418), description: 'Unknown', type: '' }];
attachOrphanText(placeholder, [{ text: 'Security Deposit Transfer', y: y(422) }]);
check('the Unknown placeholder is dropped once real text arrives',
  placeholder[0].description, 'Security Deposit Transfer');
check('and the recovered text sets the type', placeholder[0].type, 'security deposit');

// A heading far from any row must not be glued onto one.
const lonely = [{ y: y(288), description: 'TX288', type: '' }];
attachOrphanText(lonely, [{ text: 'Beginning Cash Balance as of 03/01/', y: y(200) }]);
check('a distant fragment is dropped, not guessed at', lonely[0].description, 'TX288');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
