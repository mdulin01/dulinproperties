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

/**
 * Extract property address from a detail page header.
 * Format is typically: "ADDRESS - Dulin - Full Address, City, State ZIP"
 * or just the address on a line by itself.
 */
function extractPropertyAddress(rows) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const text = rowToText(rows[i]);
    // Look for the property header pattern: "Address - Name - Full Address"
    const dashPattern = text.match(/^(.+?)\s*[-–]\s*\w+\s*[-–]\s*(.+)/);
    if (dashPattern) {
      return {
        shortAddress: dashPattern[1].trim(),
        fullAddress: dashPattern[2].trim(),
      };
    }
  }

  // Fallback: look for lines that look like addresses (contain numbers + street keywords)
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const text = rowToText(rows[i]);
    if (/^\d+\s+\w/.test(text) && /(?:st|rd|ave|dr|ln|ct|blvd|way|pl|cir|loop|pkwy)/i.test(text)) {
      return { shortAddress: text.split(/[-–,]/)[0].trim(), fullAddress: text };
    }
  }
  return null;
}

/**
 * Parse a single property detail page.
 * Returns { propertyAddress, cashSummary, transactions[] }
 */
function parsePropertyPage(rows) {
  const address = extractPropertyAddress(rows);
  const transactions = [];
  let inTransactionTable = false;
  let cashSummary = {};

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
      continue;
    }

    if (!inTransactionTable) continue;

    // Skip non-data rows
    if (!text || textLower.includes('page ') || textLower.includes('total')) continue;

    // Try to parse a transaction row
    // The row items have positional data — use them to separate columns
    const row = rows[i];
    if (row.length < 3) continue;

    // Look for a date at the start
    const firstItem = row[0].text;
    const date = parseDate(firstItem);

    // Also check if this row starts with a date-like pattern
    const isTransactionRow = date || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(firstItem);

    if (!isTransactionRow) {
      // Could be a continuation line or a balance row — check for amounts
      if (hasMoneyAmount(text) &&
          (textLower.includes('beginning cash') || textLower.includes('ending cash'))) {
        continue; // skip balance rows
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

    // Known transaction types — used to detect the "Type" column
    const knownTypes = [
      'rent income', 'management fees', 'bill', 'owner distribution',
      'beginning cash balance', 'ending cash balance', 'deposit', 'credit',
      'late fee', 'nsf fee', 'security deposit', 'prepaid rent'
    ];

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
    if (!type) {
      for (const t of knownTypes) {
        if (textLower.includes(t)) {
          type = t;
          break;
        }
      }
    }

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

    if (sortedAmounts.length >= 3) {
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
    });
  }

  return {
    propertyAddress: address,
    cashSummary,
    transactions,
  };
}

/**
 * Auto-categorize a transaction based on its payee, type, and description.
 */
function categorizeTransaction(tx) {
  const text = `${tx.payee} ${tx.type} ${tx.description}`.toLowerCase();

  const rules = [
    // Income categories
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

    const result = parsePropertyPage(rows);
    if (result.transactions.length > 0 || result.propertyAddress) {
      properties.push(result);
    }
  }

  // Flatten all transactions with property info attached
  const allTransactions = [];
  properties.forEach(prop => {
    prop.transactions.forEach(tx => {
      const category = categorizeTransaction(tx);
      const isIncome = tx.cashIn > 0 && tx.cashOut === 0;
      const isExpense = tx.cashOut > 0;
      const isDistribution = category === 'owner-distribution';

      allTransactions.push({
        ...tx,
        propertyAddress: prop.propertyAddress?.shortAddress || '',
        propertyFullAddress: prop.propertyAddress?.fullAddress || '',
        category,
        isIncome,
        isExpense,
        isDistribution,
        amount: isIncome ? tx.cashIn : tx.cashOut,
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
      totalIncome: allTransactions.filter(t => t.isIncome).reduce((s, t) => s + t.cashIn, 0),
      totalExpenses: allTransactions.filter(t => t.isExpense && !t.isDistribution).reduce((s, t) => s + t.cashOut, 0),
      totalDistributions: allTransactions.filter(t => t.isDistribution).reduce((s, t) => s + t.cashOut, 0),
    },
  };
}

export default parseOwnerPacket;
