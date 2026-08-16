/**
 * Owner Packet PDF Parser
 *
 * Parses monthly owner statement PDFs from property management companies
 * (specifically Absolute Real Estate Management format).
 *
 * PDF Structure:
 *   Page 1: Consolidated Summary (property list with totals)
 *   Pages 2+: Per-property detail pages with transaction tables
 *
 * Each property page has:
 *   - Property address header
 *   - Property Cash Summary (Beginning/Ending balance, Cash In/Out, Mgmt Fees, Disbursements)
 *   - Transaction table: Date | Payee/Payer | Type | Reference | Description | Cash In | Cash Out | Balance
 *
 * Uses pdfjs-dist for client-side PDF text extraction.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - use CDN for reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extract all text items from a PDF page, grouped by approximate row (y-position).
 * Returns an array of rows, each row being an array of { text, x, y, width } items sorted by x.
 */
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

  // Group items by y-position (within 3px tolerance)
  const rowMap = new Map();
  items.forEach(item => {
    let foundKey = null;
    for (const key of rowMap.keys()) {
      if (Math.abs(key - item.y) <= 3) {
        foundKey = key;
        break;
      }
    }
    const key = foundKey !== null ? foundKey : item.y;
    if (!rowMap.has(key)) rowMap.set(key, []);
    rowMap.get(key).push(item);
  });

  // Sort rows by y-position (descending = top to bottom in PDF coords)
  const rows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  return rows;
}

/**
 * Join text items in a row into a single string, preserving gaps as tabs for column detection.
 */
function rowToText(row) {
  if (row.length === 0) return '';
  let result = '';
  let lastEnd = 0;
  for (const item of row) {
    const gap = item.x - lastEnd;
    if (gap > 15 && result.length > 0) {
      result += '\t';
    } else if (gap > 5 && result.length > 0) {
      result += ' ';
    }
    result += item.text;
    lastEnd = item.x + (item.width || item.text.length * 5);
  }
  return result;
}

/**
 * Detect if a row contains a money amount pattern.
 */
function hasMoneyAmount(text) {
  return /\$?\s*[\d,]+\.\d{2}/.test(text) || /\([\d,]+\.\d{2}\)/.test(text);
}

/**
 * Parse a money string. Handles $1,234.56 and (1,234.56) accounting format.
 */
function parseMoney(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Parse a date string in MM/DD/YYYY or similar format to ISO YYYY-MM-DD.
 */
function parseDate(str) {
  if (!str) return '';
  const trimmed = str.trim();
  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

/**
 * Detect the statement period from page 1 text.
 * Looks for patterns like "Jan 01, 2026 - Jan 31, 2026"
 */
function detectStatementPeriod(allText) {
  const periodMatch = allText.match(
    /(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})\s*[-–]\s*(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/
  );
  if (periodMatch) {
    const months = {
      'jan': '01', 'january': '01', 'feb': '02', 'february': '02',
      'mar': '03', 'march': '03', 'apr': '04', 'april': '04',
      'may': '05', 'jun': '06', 'june': '06',
      'jul': '07', 'july': '07', 'aug': '08', 'august': '08',
      'sep': '09', 'september': '09', 'oct': '10', 'october': '10',
      'nov': '11', 'november': '11', 'dec': '12', 'december': '12',
    };
    const startMonth = months[periodMatch[1].toLowerCase()] || '01';
    const endMonth = months[periodMatch[4].toLowerCase()] || '01';
    return {
      startDate: `${periodMatch[3]}-${startMonth}-${periodMatch[2].padStart(2, '0')}`,
      endDate: `${periodMatch[6]}-${endMonth}-${periodMatch[5].padStart(2, '0')}`,
      monthStr: `${periodMatch[6]}-${endMonth}`,
      displayPeriod: `${periodMatch[1]} ${periodMatch[2]}, ${periodMatch[3]} – ${periodMatch[4]} ${periodMatch[5]}, ${periodMatch[6]}`,
    };
  }
  return null;
}

// Known management-company office addresses — these appear as letterhead on
// some statement formats and must NOT be treated as property addresses.
// Add more here if other packets are misclassified.
const MGMT_OFFICE_ADDRESSES = [
  /^750\s+n\.?\s+judge\s+ely/i, // Barnett & Hill, Abilene TX
];

function isMgmtOfficeAddress(text) {
  return MGMT_OFFICE_ADDRESSES.some(re => re.test(text || ''));
}

// Known transaction-type keywords (lowercase). Used by parsePropertyPage to
// identify the "Type" column and by continuation-line merging to catch type
// keywords that wrap onto a second PDF row.
const KNOWN_TYPES = [
  'rent income', 'management fees', 'management fee',
  'owner distribution', 'owner disbursement',
  'bill', 'beginning cash balance', 'ending cash balance',
  'deposit', 'credit', 'late fee', 'nsf fee', 'security deposit',
  'prepaid rent', 'receipt',
];

/**
 * Find the transaction type named in a piece of text, preferring the most
 * specific match. "Security Deposit Transfer" is a security deposit, not a
 * deposit; "Management Fees" is not merely a fee. Scanning KNOWN_TYPES in
 * order would return whichever happens to be listed first.
 */
function detectType(text) {
  const hay = (text || '').toLowerCase();
  let best = '';
  for (const kt of KNOWN_TYPES) {
    if (hay.includes(kt) && kt.length > best.length) best = kt;
  }
  return best;
}

/**
 * Read the x-anchors of the money columns out of the transaction-table header
 * row ("… | Cash In | Cash Out | Balance").
 *
 * This matters more than it looks. Without anchors the parser has to *guess*
 * which column an amount sits in from its type keyword and the gap between
 * amounts, and it guesses wrong on layouts it hasn't seen — a $1,000 rent
 * receipt lands in Cash Out and shows up as an expense. The header row tells
 * us the answer outright, so read it.
 *
 * Returns { cashIn, cashOut, balance } as right-edge x positions (accounting
 * tables right-align both the header and the figures under it), or null when
 * the header can't be found.
 */
export function detectAmountColumns(row) {
  // Header words arrive as separate text items — "Cash" then "In". Merge items
  // that are touching so the phrase is matchable.
  const merged = [];
  for (const item of row) {
    const right = item.x + (item.width || item.text.length * 5);
    const last = merged[merged.length - 1];
    if (last && item.x - last.right <= 6) {
      last.text = `${last.text} ${item.text}`;
      last.right = right;
    } else {
      merged.push({ text: item.text, left: item.x, right });
    }
  }
  const find = (re) => merged.find(m => re.test(m.text.toLowerCase().replace(/\s+/g, ' ').trim()));
  const cashIn = find(/^cash ?in$/);
  const cashOut = find(/^cash ?out$/);
  const balance = find(/^balance$/);
  if (!cashIn || !cashOut) return null;
  return { cashIn: cashIn.right, cashOut: cashOut.right, balance: balance ? balance.right : null };
}

// Section headings that introduce bills the owner has NOT paid yet — money
// that is owed, not money that moved. Dianne's July statement listed a $58.07
// management fee as due, and the app booked it as paid.
// Anchored at the start of the line on purpose: a loose match would catch
// ordinary descriptions ("past due notice", "open work order") and silently
// stop importing real expenses.
export const UNPAID_SECTION_RE =
  /^\s*(?:(?:unpaid|outstanding|open|pending)\s+(?:bills?|invoices?|charges?|payables?)|bills?\s+(?:due|payable|outstanding|unpaid)|accounts?\s+payable|payables?)\b/i;

/**
 * Place each money figure on a transaction row into its column, using the
 * header anchors from detectAmountColumns. Accounting tables right-align both
 * the header and the figures, so a figure belongs to the anchor its right edge
 * lines up with.
 *
 * Returns null when nothing lines up — that means we're looking at a layout we
 * don't actually understand, and the caller should fall back rather than
 * invent a column.
 */
export function assignAmountColumns(amounts, columns, tolerance = 40) {
  if (!columns || !amounts?.length) return null;
  const anchors = [
    { key: 'cashIn', x: columns.cashIn },
    { key: 'cashOut', x: columns.cashOut },
    ...(columns.balance != null ? [{ key: 'balance', x: columns.balance }] : []),
  ];
  const placed = { cashIn: 0, cashOut: 0, balance: 0 };
  for (const amt of amounts) {
    const right = amt.x + (amt.width || String(amt.text || '').length * 5);
    let best = anchors[0];
    let bestDist = Math.abs(right - anchors[0].x);
    for (const a of anchors.slice(1)) {
      const d = Math.abs(right - a.x);
      if (d < bestDist) { best = a; bestDist = d; }
    }
    if (bestDist > tolerance) return null;
    placed[best.key] = amt.value;
  }
  return placed;
}

// A row-level status word. Deliberately narrow — "due" alone appears in plenty
// of innocent descriptions ("due date", "past due notice sent"), so only the
// explicit word "unpaid" counts here.
const UNPAID_ROW_RE = /\bunpaid\b/i;

// "123 Anything, City, ST 79605" — a house number, then anything, then the
// City, ST ZIP tail every US mailing address ends with.
export const CITY_STATE_ZIP_RE = /^\s*\d+\s+.+,\s*[A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/;

export const STREET_SUFFIX_RE =
  /\b(?:st|street|rd|road|ave|avenue|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pl|place|cir|circle|loop|pkwy|parkway|trl|trail|ter|terrace|hwy|highway)\b\.?/i;

// The header row of a secondary table ("Due Date | Payee | Description |
// Unpaid"). It carries no transaction of its own and must not be swept into
// the description of the row above it.
const SECONDARY_HEADER_RE = /payee/i;

/**
 * Extract property address from a detail page header.
 * Format is typically: "ADDRESS - Dulin - Full Address, City, State ZIP"
 * or just the address on a line by itself.
 *
 * `skipAddresses` (optional Set<string>) is a list of lowercase short-address
 * strings to skip — used by the caller to exclude letterhead addresses that
 * appear on every page.
 */
function extractPropertyAddress(rows, skipAddresses = new Set()) {
  const shouldSkip = (shortAddr) => {
    if (!shortAddr) return false;
    if (skipAddresses.has(shortAddr.toLowerCase())) return true;
    if (isMgmtOfficeAddress(shortAddr)) return true;
    return false;
  };

  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const text = rowToText(rows[i]);
    // Look for the property header pattern: "Address - Name - Full Address"
    const dashPattern = text.match(/^(.+?)\s*[-–]\s*\w+\s*[-–]\s*(.+)/);
    if (dashPattern) {
      const shortAddr = dashPattern[1].trim();
      if (shouldSkip(shortAddr)) continue;
      return { shortAddress: shortAddr, fullAddress: dashPattern[2].trim() };
    }
  }

  // Fallback: a page header that reads like a US mailing address — house
  // number, street, then "City, ST ZIP". This catches the headers the dash
  // pattern misses, including ones with a single dash ("657 Ruidosa #106 -
  // 5402 S 7th #106, Abilene, TX 79605") and street names the old keyword
  // list didn't know ("Ruidosa", "Encino Road"). Half of Dianne's July
  // statement imported with no property attached because of that list.
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const text = rowToText(rows[i]);
    if (CITY_STATE_ZIP_RE.test(text)) {
      const shortAddr = text.split(/[-–,]/)[0].trim();
      if (shouldSkip(shortAddr)) continue;
      return { shortAddress: shortAddr, fullAddress: text };
    }
  }
  // Last resort: the old street-suffix keyword sniff, widened to spelled-out
  // suffixes.
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const text = rowToText(rows[i]);
    if (/^\d+\s+\w/.test(text) && STREET_SUFFIX_RE.test(text)) {
      const shortAddr = text.split(/[-–,]/)[0].trim();
      if (shouldSkip(shortAddr)) continue;
      return { shortAddress: shortAddr, fullAddress: text };
    }
  }
  return null;
}

/**
 * Collect every address-looking line across all pages, then return the set of
 * addresses that appear on more than half the pages. Those are letterhead
 * (management-company office address) and must be skipped as property
 * addresses.
 */
function detectLetterheadAddresses(allPageRows) {
  const counts = {};
  const totalPages = allPageRows.length;
  for (const rows of allPageRows) {
    const seenOnThisPage = new Set();
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const text = rowToText(rows[i]);
      const dashPattern = text.match(/^(.+?)\s*[-–]\s*\w+\s*[-–]\s*(.+)/);
      if (dashPattern) {
        const k = dashPattern[1].trim().toLowerCase();
        if (!seenOnThisPage.has(k)) { seenOnThisPage.add(k); counts[k] = (counts[k] || 0) + 1; }
        continue;
      }
      if (/^\d+\s+\w/.test(text) && /(?:st|rd|ave|dr|ln|ct|blvd|way|pl|cir|loop|pkwy)/i.test(text)) {
        const k = text.split(/[-–,]/)[0].trim().toLowerCase();
        if (!seenOnThisPage.has(k)) { seenOnThisPage.add(k); counts[k] = (counts[k] || 0) + 1; }
      }
    }
  }
  // Addresses appearing on > 50% of pages (and at least 3) are letterhead.
  const skip = new Set();
  for (const [k, c] of Object.entries(counts)) {
    if (c >= 3 && c > totalPages / 2) skip.add(k);
  }
  return skip;
}

/**
 * Parse a single property detail page.
 * Returns { propertyAddress, cashSummary, transactions[] }
 */
function parsePropertyPage(rows, skipAddresses = new Set()) {
  const address = extractPropertyAddress(rows, skipAddresses);
  const transactions = [];
  let inTransactionTable = false;
  let cashSummary = {};
  // lastTxRowIdx tracks the row index of the most recently parsed transaction so
  // we can append continuation rows (long descriptions that wrap onto the next
  // PDF line) to that transaction's description.
  let lastTxRowIdx = -1;
  // Right-edge x of the Cash In / Cash Out / Balance columns, read from the
  // table header. Null until we find a header we understand.
  let columns = null;
  // True once we've passed into an "unpaid bills / payables" section. Rows
  // there are amounts owed, not cash that moved.
  let inUnpaidSection = false;
  // Wrapped-cell fragments, held until we know where every transaction row on
  // this page sits vertically.
  const orphans = [];

  for (let i = 0; i < rows.length; i++) {
    const text = rowToText(rows[i]);
    const textLower = text.toLowerCase();

    // Detect "Property Cash Summary" section
    if (textLower.includes('property cash summary')) {
      // Parse the next few rows for summary values
      for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
        const summaryText = rowToText(rows[j]);
        if (/beginning\s*cash/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.beginningBalance = parseMoney(amt[0]);
        }
        if (/cash\s*in/i.test(summaryText) && !/cash\s*out/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.cashIn = parseMoney(amt[0]);
        }
        if (/cash\s*out/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.cashOut = parseMoney(amt[0]);
        }
        if (/management\s*fees?/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.managementFees = parseMoney(amt[0]);
        }
        if (/owner\s*disburse/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.ownerDisbursements = parseMoney(amt[0]);
        }
        if (/ending\s*cash/i.test(summaryText)) {
          const amt = summaryText.match(/[\d,]+\.\d{2}/);
          if (amt) cashSummary.endingBalance = parseMoney(amt[0]);
        }
      }
      continue;
    }

    // Detect transaction table header
    if (textLower.includes('payee') && textLower.includes('type') ||
        textLower.includes('payee/payer')) {
      inTransactionTable = true;
      // A fresh table header ends any unpaid-bills section above it and gives
      // us this table's column positions.
      inUnpaidSection = false;
      columns = detectAmountColumns(rows[i]) || columns;
      continue;
    }

    // A heading like "Unpaid Bills" or "Payables Due" starts a section of money
    // that is owed rather than paid. Everything under it stays flagged until
    // the next real transaction-table header.
    if (!hasMoneyAmount(text) && UNPAID_SECTION_RE.test(text)) {
      inUnpaidSection = true;
      continue;
    }

    if (!inTransactionTable) continue;

    // Skip non-data rows
    if (!text || textLower.includes('page ') || textLower.includes('total')) continue;

    // Try to parse a transaction row
    // The row items have positional data — use them to separate columns
    const row = rows[i];

    // Look for a date at the start
    const firstItem = row[0].text;
    const date = parseDate(firstItem);

    // Also check if this row starts with a date-like pattern
    const isTransactionRow = date || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(firstItem);

    if (!isTransactionRow) {
      // Balance rows — skip. The figure sometimes sits on its own line, so
      // don't require one here.
      if (textLower.includes('beginning cash') || textLower.includes('ending cash')) {
        continue;
      }
      // A wrapped cell. Owner packets break a long payee or description across
      // two or three PDF lines, and those pieces can land either side of the
      // line carrying the date — Barnett & Hill prints the payee above and the
      // type below. Assuming the piece belongs to the transaction *above* it
      // (what this code used to do) both loses the text its own row needed and
      // corrupts its neighbour's. Park it and decide by vertical position once
      // every transaction row on the page is known.
      // Fragments containing a figure count too — "Late Fee of $10.00 per day:
      // 06/06/2026 -" is a wrapped description, not a transaction. The rows
      // that genuinely carry money have already been handled above: a real
      // transaction starts with a date, and balance/total lines returned
      // earlier.
      // A fragment with no letters is a stray figure — the balance that spilled
      // onto its own line, a year, a reference. There's no way to tell which
      // row it belongs to and nothing to gain from guessing, so drop it.
      if (text && /[a-z]/i.test(text) && !SECONDARY_HEADER_RE.test(text)) {
        orphans.push({ text, y: row[0].y });
      }
      continue;
    }

    // Parse the transaction from positional items
    // PDF table columns: Date | Payee/Payer | Type | Reference | Description | Cash In | Cash Out | Balance
    // We care most about: Date, Payee/Payer, Cash In, Cash Out
    // Type and Reference are less important for the import

    const amounts = [];
    const nonAmountItems = [];

    for (const item of row) {
      if (/^[\$\(\-]?\s*[\d,]+\.\d{2}\)?$/.test(item.text.replace(/\s/g, ''))) {
        amounts.push({ ...item, value: parseMoney(item.text) });
      } else {
        nonAmountItems.push(item);
      }
    }

    // Need at least one amount to be a valid transaction
    if (amounts.length === 0) continue;

    // The non-amount items (excluding date) give us text fields
    const textParts = nonAmountItems.filter(item => item.text !== firstItem);

    // Use the module-level KNOWN_TYPES so continuation-line merging sees the
    // same list.
    const knownTypes = KNOWN_TYPES;

    // Separate: payee (first non-date text), type, reference, description
    let type = '';
    let payee = '';
    let descriptionParts = [];

    for (const part of textParts) {
      const partLower = part.text.toLowerCase();
      // Skip pure reference numbers
      if (/^\d+$/.test(part.text) || /^[A-Z]{2,4}\d+/.test(part.text) || /^#?\d{4,}/.test(part.text)) {
        continue;
      }
      // Detect type column
      if (!type && knownTypes.some(t => partLower.includes(t))) {
        type = part.text;
        continue;
      }
      // First text item after date = payee/payer (most important field)
      if (!payee) {
        payee = part.text;
      } else {
        descriptionParts.push(part.text);
      }
    }

    // If no type detected from parts, try from the full text
    if (!type) type = detectType(textLower);

    // Determine cash in / cash out from amounts + their x-positions
    // The PDF columns are ordered: ... | Cash In | Cash Out | Balance
    // So by x-position, leftmost amount = cash in column, middle = cash out, rightmost = balance
    let cashIn = 0;
    let cashOut = 0;
    let balance = 0;

    // Sort amounts by x-position (left to right in the table)
    const sortedAmounts = [...amounts].sort((a, b) => a.x - b.x);

    // Also detect income vs expense from the type field
    const typeLower = (type || '').toLowerCase();
    const isIncomeType = typeLower.includes('rent') || typeLower.includes('income') ||
        typeLower.includes('deposit') || typeLower.includes('late fee') ||
        typeLower.includes('credit') || typeLower.includes('prepaid');

    // Preferred path: the header told us where each money column sits, so read
    // the columns instead of guessing from keywords. An amount belongs to the
    // column whose right edge it lines up with.
    // A "Bills Due" table has its own single money column ("Unpaid"), which
    // lines up with none of the transaction table's. Take the figure at face
    // value — the bill's amount — rather than filing it as a balance and
    // ending up with a $0 row.
    const unpaidRow = inUnpaidSection || UNPAID_ROW_RE.test(text);
    const placed = unpaidRow
      ? { cashIn: 0, cashOut: Math.abs(sortedAmounts[sortedAmounts.length - 1].value), balance: 0 }
      : assignAmountColumns(sortedAmounts, columns);
    const columnsTrusted = placed !== null;
    if (placed) {
      cashIn = placed.cashIn;
      cashOut = placed.cashOut;
      balance = placed.balance;
    }

    if (columnsTrusted) {
      // nothing more to do — the columns are authoritative
    } else if (sortedAmounts.length >= 3) {
      // Three amounts present: Cash In, Cash Out, Balance
      cashIn = sortedAmounts[0].value;
      cashOut = sortedAmounts[1].value;
      balance = sortedAmounts[2].value;
    } else if (sortedAmounts.length === 2) {
      // Two amounts: could be (CashIn + Balance) or (CashOut + Balance)
      // The rightmost is balance
      balance = sortedAmounts[1].value;
      const amt = sortedAmounts[0].value;

      // Use x-position gap to help determine column:
      // If the amount is far left (closer to Cash In column), it's income
      // If it's in the middle area (Cash Out column), it's expense
      // Also use type as a strong signal
      if (isIncomeType) {
        cashIn = amt;
      } else {
        // Check x-position: if the gap between the two amounts is large,
        // the first one is probably Cash In (skipping Cash Out column)
        // If the gap is small, they're in adjacent columns (Cash Out + Balance)
        const gap = sortedAmounts[1].x - sortedAmounts[0].x;
        if (gap > 100 && !typeLower.includes('bill') && !typeLower.includes('management') && !typeLower.includes('owner')) {
          // Large gap suggests Cash In column (leftmost) + Balance (rightmost), skipping Cash Out
          cashIn = amt;
        } else {
          cashOut = amt;
        }
      }
    } else if (sortedAmounts.length === 1) {
      // Single amount — determine direction from type
      if (isIncomeType) {
        cashIn = sortedAmounts[0].value;
      } else {
        cashOut = sortedAmounts[0].value;
      }
    }

    // Skip balance-only rows
    const typeCheck = (type || textLower);
    if (typeCheck.includes('beginning cash balance') || typeCheck.includes('ending cash balance')) {
      continue;
    }

    // Use payee as the primary description — it's the most useful field
    // Fall back to type if no payee found
    const displayDescription = payee || type || 'Unknown';
    const extraDescription = descriptionParts.join(' ');

    transactions.push({
      date: date || '',
      payee: payee || '',
      type: type || '',
      description: extraDescription ? `${displayDescription} - ${extraDescription}` : displayDescription,
      cashIn: Math.abs(cashIn),
      cashOut: Math.abs(cashOut),
      balance,
      columnsTrusted,
      unpaid: unpaidRow,
      y: row[0].y,
    });
    lastTxRowIdx = i;
  }

  attachOrphanText(transactions, orphans);

  return {
    propertyAddress: address,
    cashSummary,
    transactions,
  };
}

/**
 * Give each wrapped-cell fragment to the transaction row it sits closest to.
 *
 * A wrapped cell hugs its own row — the fragment is a few points from the line
 * carrying the date, and roughly three times that from the neighbouring
 * transaction. Nearest-row wins, which handles fragments above the date line
 * (Barnett & Hill's payee) and below it (their type column) without needing to
 * know which layout we're looking at.
 *
 * Fragments that aren't close to any transaction are dropped rather than
 * guessed at — a stray heading appended to a real row changes its category.
 */
export function attachOrphanText(transactions, orphans, maxDistance = 25) {
  if (!transactions.length || !orphans?.length) return transactions;
  const extra = new Map();
  for (const orphan of orphans) {
    let best = null;
    let bestDist = Infinity;
    for (const tx of transactions) {
      const d = Math.abs(orphan.y - tx.y);
      if (d < bestDist) { best = tx; bestDist = d; }
    }
    if (!best || bestDist > maxDistance) continue;
    const list = extra.get(best) || [];
    list.push(orphan);
    extra.set(best, list);
  }
  for (const [tx, list] of extra) {
    // Top-to-bottom, so the reassembled description reads in document order.
    // pdf.js y grows upward, so descending y is downward on the page.
    list.sort((a, b) => b.y - a.y);
    const above = list.filter(o => o.y > tx.y).map(o => o.text);
    const below = list.filter(o => o.y <= tx.y).map(o => o.text);
    tx.description = [...above, tx.description, ...below]
      .filter(t => t && t !== 'Unknown')
      .join(' ')
      .trim();
    if (!tx.type) tx.type = detectType(tx.description) || '';
  }
  return transactions;
}

/**
 * Auto-categorize a transaction based on its payee, type, and description.
 */
function categorizeTransaction(tx) {
  const text = `${tx.payee} ${tx.type} ${tx.description}`.toLowerCase();

  const rules = [
    // Income categories
    [['prepaid rent'], 'prepaid-rent'],
    [['rent income', 'rent payment', 'monthly rent'], 'rent'],
    [['late fee', 'late charge'], 'late-fee'],
    [['security deposit', 'deposit refund'], 'deposit'],

    // Expense categories
    [['management fee', 'management fees', 'mgmt fee'], 'management-fee'],
    [['owner distribution', 'owner disbursement', 'owner draw'], 'owner-distribution'],
    [['plumb', 'drain', 'pipe', 'toilet', 'faucet', 'water heater'], 'plumbing'],
    [['electric', 'wiring', 'outlet', 'breaker', 'j and r electric'], 'electrical'],
    [['hvac', 'air condition', 'furnace', 'a/c', 'heating'], 'hvac'],
    [['appliance', 'washer', 'dryer', 'dishwasher', 'refriger', 'stove', 'oven', 'grit appliance'], 'appliance'],
    [['pest', 'exterminator', 'termite', 'roach'], 'pest-control'],
    [['clean', 'janitorial', 'maid'], 'cleaning'],
    [['landscap', 'lawn', 'mow', 'yard', 'tree', 'snow'], 'landscaping'],
    [['insur'], 'insurance'],
    [['tax', 'property tax'], 'taxes'],
    [['hoa', 'association'], 'hoa'],
    [['legal', 'attorney', 'evict'], 'legal'],
    [['reliant', 'centerpoint', 'atmos', 'utility', 'water bill', 'sewer', 'trash'], 'utilities'],
    [['lowe', 'home depot', 'menard', 'ace hardware'], 'repair'],
    [['repair', 'fix', 'replace', 'maintenance', 'service'], 'repair'],
  ];

  for (const [keywords, category] of rules) {
    if (keywords.some(k => text.includes(k))) return category;
  }
  return 'other';
}

/**
 * Parse a complete Owner Packet PDF.
 * Returns { period, properties[], allTransactions[], summary }
 */
export async function parseOwnerPacket(pdfData) {
  let pdf;
  try {
    // pdfData can be ArrayBuffer or Uint8Array
    pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  } catch (err) {
    throw new Error(`Failed to open PDF: ${err.message}`);
  }

  const numPages = pdf.numPages;
  if (numPages === 0) throw new Error('PDF has no pages');

  // Extract text from all pages
  const allPageRows = [];
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const rows = await extractPageRows(page);
    allPageRows.push(rows);
    fullText += rows.map(r => rowToText(r)).join('\n') + '\n---PAGE---\n';
  }

  // Detect statement period from page 1
  const period = detectStatementPeriod(fullText);

  // Find letterhead-like addresses that appear on many pages so parsePropertyPage
  // doesn't misclassify them as the property address (e.g., Barnett & Hill's
  // office address printed on every page of the Feb owner packet).
  const letterhead = detectLetterheadAddresses(allPageRows);

  // Parse each page (skip page 1 = consolidated summary, unless only 1 page)
  const properties = [];
  const startPage = numPages > 1 ? 1 : 0; // 0-indexed

  for (let i = startPage; i < numPages; i++) {
    const rows = allPageRows[i];

    // Check if this is a consolidated summary page (skip it)
    const pageText = rows.map(r => rowToText(r)).join(' ').toLowerCase();
    if (pageText.includes('consolidated summary') || pageText.includes('consolidated owner')) {
      continue;
    }

    const result = parsePropertyPage(rows, letterhead);
    if (result.transactions.length > 0 || result.propertyAddress) {
      properties.push(result);
    }
  }

  // Flatten all transactions with property info attached.
  //
  // Income vs expense classification:
  // The PDF column the amount lands in is unreliable — owner-packet layouts
  // vary, and a rent-collected row sometimes parses into the Cash Out column
  // instead of Cash In. We use the resolved category as the source of truth:
  //   - owner-distribution → distribution
  //   - rent / late-fee / prepaid-rent / deposit → income
  //   - everything else → expense
  // This prevents rent-collected rows from being silently filed as expenses,
  // which was inflating YTD expenses by tens of thousands.
  const INCOME_CATEGORIES = new Set(['rent', 'late-fee', 'prepaid-rent', 'deposit']);
  const allTransactions = [];
  properties.forEach(prop => {
    prop.transactions.forEach(tx => {
      let category = categorizeTransaction(tx);
      // An NSF reversal reads as "Rent Income - NSF reversal receipt" and lands
      // in Cash Out — money leaving because a tenant payment bounced. Leaving
      // it categorised as rent would make the validation screen offer to
      // "migrate" it into a rent payment, flipping money that actually went
      // out. Keep it an expense; the description still says what happened.
      if (INCOME_CATEGORIES.has(category) && tx.columnsTrusted && tx.cashOut > 0 && tx.cashIn === 0) {
        category = 'other';
      }
      const isDistribution = category === 'owner-distribution';
      const looksLikeIncome = INCOME_CATEGORIES.has(category);
      // When we read the real column positions off the table header, the PDF
      // itself says which side the money is on — believe it. The category
      // guesswork below is only the fallback for layouts whose header we
      // couldn't read.
      const isIncome = !isDistribution && (
        tx.columnsTrusted
          ? tx.cashIn > 0
          : (looksLikeIncome || (tx.cashIn > 0 && tx.cashOut === 0))
      );
      const isExpense = !isDistribution && !isIncome;
      // A bill that is still owed is not an expense yet — no cash has moved,
      // it won't be on the bank statement, and on a cash-basis Schedule E it
      // isn't deductible until it's paid.
      const isUnpaid = tx.unpaid === true;
      // Use whichever column has the value (parser may have put it in either one).
      const amount = Math.max(tx.cashIn || 0, tx.cashOut || 0);

      allTransactions.push({
        ...tx,
        propertyAddress: prop.propertyAddress?.shortAddress || '',
        propertyFullAddress: prop.propertyAddress?.fullAddress || '',
        category,
        isIncome,
        isExpense,
        isDistribution,
        isUnpaid,
        amount,
        flowType: isDistribution ? 'distribution' : (isIncome ? 'income' : 'expense'),
      });
    });
  });

  return {
    period,
    properties,
    allTransactions,
    summary: {
      totalProperties: properties.length,
      totalTransactions: allTransactions.length,
      totalIncome: allTransactions.filter(t => t.isIncome && !t.isUnpaid).reduce((s, t) => s + t.cashIn, 0),
      totalExpenses: allTransactions.filter(t => t.isExpense && !t.isDistribution && !t.isUnpaid).reduce((s, t) => s + t.cashOut, 0),
      totalDistributions: allTransactions.filter(t => t.isDistribution).reduce((s, t) => s + t.cashOut, 0),
      unpaidCount: allTransactions.filter(t => t.isUnpaid).length,
    },
  };
}

export default parseOwnerPacket;
