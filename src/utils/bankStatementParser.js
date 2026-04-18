/**
 * Bank / Credit-card Statement PDF Parser (heuristic)
 *
 * Used for FFB Bank, Citi Card, and Costco Card statements, whose layouts
 * vary enough that a single rigid parser would fail more often than it helps.
 *
 * Strategy:
 *   1. Extract text items from every page via pdfjs-dist, grouped by y-position.
 *   2. For each row: look for a leading date token and a trailing money token.
 *      If both are present, treat it as a transaction candidate.
 *   3. Heuristically decide income vs expense from keywords in the description,
 *      or from a second amount column (some statements print deposits in one
 *      column and withdrawals in another).
 *
 * The user always reviews the parsed entries before importing, so missed
 * rows are strictly a convenience loss, not a correctness bug.
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/** Group page text items into rows by y-position (3px tolerance). */
async function extractPageRows(page) {
  const textContent = await page.getTextContent();
  const items = textContent.items
    .filter(item => item.str.trim())
    .map(item => ({
      text: item.str.trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      width: item.width,
    }));

  const rowMap = new Map();
  items.forEach(item => {
    let foundKey = null;
    for (const key of rowMap.keys()) {
      if (Math.abs(key - item.y) <= 3) { foundKey = key; break; }
    }
    const key = foundKey !== null ? foundKey : item.y;
    if (!rowMap.has(key)) rowMap.set(key, []);
    rowMap.get(key).push(item);
  });

  return [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));
}

/** Collapse a row of text items into a tab-separated line, preserving gaps. */
function rowToText(row) {
  if (row.length === 0) return '';
  let result = '';
  let lastEnd = 0;
  for (const item of row) {
    const gap = item.x - lastEnd;
    if (gap > 15 && result.length > 0) result += '\t';
    else if (gap > 5 && result.length > 0) result += ' ';
    result += item.text;
    lastEnd = item.x + (item.width || item.text.length * 5);
  }
  return result;
}

const MONEY_RE = /\(?\$?-?\s*[\d,]+\.\d{2}\)?/g;

function parseMoney(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[$,\s]/g, '');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Parse a date token. Handles MM/DD/YYYY, MM/DD/YY, MM/DD (no year).
 * For MM/DD without a year we return null — the caller supplies the statement year.
 */
function parseDateToken(str, fallbackYear) {
  if (!str) return '';
  const trimmed = String(str).trim();
  // MM/DD/YYYY or MM/DD/YY
  let m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // MM/DD (no year)
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m && fallbackYear) {
    return `${fallbackYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

/**
 * Try to detect the statement year/period from page 1 text.
 * Looks for patterns like "Statement Period: 03/01/2026 - 03/31/2026"
 * or "March 1, 2026 through March 31, 2026".
 */
function detectPeriod(fullText) {
  // MM/DD/YYYY ranges
  let m = fullText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:-|–|to|through)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (m) {
    return {
      startDate: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
      endDate: `${m[6]}-${m[4].padStart(2, '0')}-${m[5].padStart(2, '0')}`,
      year: m[6],
      monthStr: `${m[6]}-${m[4].padStart(2, '0')}`,
    };
  }
  // "Month D, YYYY - Month D, YYYY"
  const months = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', september: '09', oct: '10', october: '10',
    nov: '11', november: '11', dec: '12', december: '12',
  };
  m = fullText.match(/(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})\s*(?:-|–|to|through)\s*(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) {
    const startMo = months[m[1].toLowerCase()];
    const endMo = months[m[4].toLowerCase()];
    if (startMo && endMo) {
      return {
        startDate: `${m[3]}-${startMo}-${m[2].padStart(2, '0')}`,
        endDate: `${m[6]}-${endMo}-${m[5].padStart(2, '0')}`,
        year: m[6],
        monthStr: `${m[6]}-${endMo}`,
      };
    }
  }
  // Fallback: any 4-digit year
  m = fullText.match(/\b(20\d{2})\b/);
  if (m) return { year: m[1], monthStr: null };
  return null;
}

// Words that imply income (deposits, credits, interest, refunds).
// "Payment" is ambiguous: on a card statement it means a credit (incoming money
// to the card → reducing balance), but on a bank statement it means a debit. We
// bias by sourceKind below.
const INCOME_KEYWORDS = [
  'deposit', 'credit', 'interest', 'refund', 'reversal',
  'ach deposit', 'mobile deposit', 'wire in', 'dep ',
];
const EXPENSE_KEYWORDS = [
  'withdrawal', 'debit', 'purchase', 'pos ', 'atm ', 'check ',
  'fee', 'service charge', 'transfer out', 'draft',
];

function guessFlowType(description, sourceKind) {
  const d = (description || '').toLowerCase();
  for (const kw of INCOME_KEYWORDS) if (d.includes(kw)) return 'income';
  for (const kw of EXPENSE_KEYWORDS) if (d.includes(kw)) return 'expense';
  // Cards: "payment" means a credit to the card (income-like, reducing balance).
  // Bank: "payment" means an outgoing payment (expense).
  if (d.includes('payment')) return sourceKind === 'card' ? 'income' : 'expense';
  // Default: bank statements rarely emit random rows as income; cards are spending.
  return 'expense';
}

function guessCategory(description) {
  const d = (description || '').toLowerCase();
  const rules = [
    [['lowe', 'home depot', 'menard', 'ace hardware', 'hardware'], 'repair'],
    [['plumb', 'drain', 'pipe', 'toilet', 'faucet', 'water heater'], 'plumbing'],
    [['electric', 'wiring', 'outlet', 'breaker'], 'electrical'],
    [['hvac', 'air condition', 'furnace', 'a/c', 'heating'], 'hvac'],
    [['appliance', 'washer', 'dryer', 'dishwasher', 'refriger'], 'appliance'],
    [['landscap', 'lawn', 'mow', 'yard', 'tree', 'snow'], 'landscaping'],
    [['insur'], 'insurance'],
    [['tax'], 'taxes'],
    [['hoa', 'association'], 'hoa'],
    [['reliant', 'centerpoint', 'atmos', 'utility', 'water bill', 'sewer', 'trash'], 'utilities'],
    [['management fee', 'mgmt'], 'management-fee'],
    [['interest'], 'interest'],
    [['fee', 'service charge'], 'bank-fee'],
  ];
  for (const [keywords, category] of rules) {
    if (keywords.some(k => d.includes(k))) return category;
  }
  return 'other';
}

/**
 * Parse one row into a transaction candidate. Returns null if it doesn't look
 * like a transaction (no date or no amount).
 */
function parseRow(row, statementYear, sourceKind) {
  if (!row || row.length === 0) return null;

  // Gather the raw text + positional amounts.
  const lineText = rowToText(row);
  const amounts = [];
  const textBits = [];
  for (const item of row) {
    const stripped = item.text.replace(/\s/g, '');
    if (/^[\$\(\-]?\$?[\d,]+\.\d{2}\)?$/.test(stripped)) {
      amounts.push({ x: item.x, value: parseMoney(item.text), raw: item.text });
    } else {
      textBits.push(item);
    }
  }
  if (amounts.length === 0) return null;

  // Date: look at the first few text items for a MM/DD[/YY] token.
  let date = '';
  let dateIdx = -1;
  for (let i = 0; i < Math.min(textBits.length, 3); i++) {
    const d = parseDateToken(textBits[i].text, statementYear);
    if (d) { date = d; dateIdx = i; break; }
  }
  // Sometimes the posting date is the FIRST token and a transaction date is the
  // second. Either is fine for our purposes.
  if (!date) {
    // Try to pull a date out of the merged line text (handles cases where a
    // date and another token merged into one item).
    const m = lineText.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (m) {
      const year = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : statementYear;
      if (year) date = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
  }
  if (!date) return null;

  // Description: all non-amount, non-date text items, in reading order.
  const descParts = textBits
    .filter((_, i) => i !== dateIdx)
    .map(t => t.text)
    .filter(s => s && !/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/.test(s));
  let description = descParts.join(' ').trim();
  // Strip common noise suffixes
  description = description.replace(/\s+(BALANCE|BAL)\s*$/i, '').trim();
  if (!description) description = '(no description)';

  // Amount: prefer the LEFTMOST money token that isn't a running balance.
  // Heuristic: if there are multiple amounts, the rightmost is usually the
  // running balance on a bank statement. The first non-balance amount is the
  // transaction amount.
  const sorted = [...amounts].sort((a, b) => a.x - b.x);
  let txAmount;
  let secondAmount;
  if (sorted.length === 1) {
    txAmount = sorted[0].value;
  } else if (sorted.length === 2) {
    // Could be (amount, balance) or (debit-col, credit-col).
    txAmount = sorted[0].value;
    secondAmount = sorted[1].value;
  } else {
    // 3+ amounts: treat leftmost as the txn value.
    txAmount = sorted[0].value;
  }
  if (!txAmount || Math.abs(txAmount) < 0.01) {
    // Try another amount if the first was zero.
    const nz = sorted.find(a => Math.abs(a.value) >= 0.01);
    if (!nz) return null;
    txAmount = nz.value;
  }

  // Flow type
  let flowType = guessFlowType(description, sourceKind);
  // Negative amounts in parentheses generally indicate expenses/debits.
  if (txAmount < 0) flowType = 'expense';

  return {
    date,
    description,
    amount: Math.abs(txAmount),
    flowType,
    category: guessCategory(description),
    vendor: '',
    raw: lineText,
  };
}

/**
 * Public entry point. Returns { period, transactions[], rawLines[] }.
 *
 * @param {Uint8Array|ArrayBuffer} pdfData
 * @param {'bank'|'card'} [sourceKind='bank']
 */
export async function parseBankStatement(pdfData, sourceKind = 'bank') {
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  } catch (err) {
    throw new Error(`Failed to open PDF: ${err.message}`);
  }
  if (pdf.numPages === 0) throw new Error('PDF has no pages');

  const allRows = [];
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const rows = await extractPageRows(page);
    allRows.push(...rows);
    fullText += rows.map(r => rowToText(r)).join('\n') + '\n';
  }

  const period = detectPeriod(fullText);
  const year = period?.year || '';

  const transactions = [];
  for (const row of allRows) {
    const tx = parseRow(row, year, sourceKind);
    if (tx) transactions.push(tx);
  }

  // De-dup within the same statement (some statements repeat summary lines).
  const seen = new Set();
  const deduped = [];
  for (const t of transactions) {
    const key = `${t.date}|${t.amount.toFixed(2)}|${t.description.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }

  return {
    period,
    transactions: deduped,
    rawLines: fullText.split('\n'),
  };
}

export default parseBankStatement;
