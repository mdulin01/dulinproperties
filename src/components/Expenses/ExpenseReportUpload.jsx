import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Trash2, Loader, ChevronDown, ChevronUp, DollarSign, TrendingUp, TrendingDown, Building } from 'lucide-react';
import logger from '../../logger';
import { expenseCategories, incomeCategories } from '../../constants';
import { formatCurrency } from '../../utils';
import { parseOwnerPacket } from '../../utils/ownerPacketParser';

/**
 * ExpenseReportUpload - Parses uploaded expense reports (CSV, text, or Owner Packet PDF)
 * and lets the user review/edit parsed line items before importing.
 *
 * PDF Support: Handles Absolute Real Estate Management "Owner Packet" PDFs
 * with per-property transaction tables.
 */

// Attempt to auto-categorize an expense description
function guessCategory(description) {
  const desc = (description || '').toLowerCase();
  const map = [
    [['management', 'mgmt fee', 'property management'], 'management-fee'],
    [['repair', 'fix', 'replace'], 'repair'],
    [['maint', 'maintenance', 'service'], 'maintenance'],
    [['water', 'electric', 'gas', 'utilit', 'sewer', 'trash', 'waste'], 'utilities'],
    [['landscap', 'lawn', 'mow', 'yard', 'tree', 'snow'], 'landscaping'],
    [['insur'], 'insurance'],
    [['tax', 'property tax'], 'taxes'],
    [['hoa', 'association', 'condo fee'], 'hoa'],
    [['legal', 'attorney', 'lawyer', 'evict'], 'legal'],
    [['clean', 'janitorial'], 'cleaning'],
    [['pest', 'exterminator', 'termite'], 'pest-control'],
    [['plumb', 'drain', 'pipe', 'toilet', 'faucet'], 'plumbing'],
    [['electric', 'wiring', 'outlet', 'breaker', 'light'], 'electrical'],
    [['hvac', 'heat', 'air condition', 'furnace', 'ac ', 'a/c'], 'hvac'],
    [['appliance', 'washer', 'dryer', 'dishwasher', 'refriger', 'stove', 'oven'], 'appliance'],
    [['mortgage', 'loan'], 'mortgage'],
  ];
  for (const [keywords, category] of map) {
    if (keywords.some(k => desc.includes(k))) return category;
  }
  return 'other';
}

// Parse amount string, handling ($1,234.56) negative format
function parseAmount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return Math.abs(parseFloat(cleaned.slice(1, -1)) || 0);
  }
  return Math.abs(parseFloat(cleaned) || 0);
}

// Try to parse a date string
function parseDate(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const mdy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  return '';
}

// Parse CSV/TSV/pipe-delimited text into rows
function parseDelimited(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes('|')) delimiter = '|';
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const findCol = (names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const descCol = findCol(['description', 'desc', 'detail', 'item', 'memo', 'charge', 'expense']);
  const amtCol = findCol(['amount', 'total', 'cost', 'charge', 'debit', 'price']);
  const dateCol = findCol(['date', 'posted', 'trans']);
  const catCol = findCol(['category', 'type', 'class']);
  const vendorCol = findCol(['vendor', 'payee', 'paid to', 'company']);
  const propCol = findCol(['property', 'address', 'unit', 'location']);
  if (descCol === -1 && amtCol === -1) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const amount = amtCol >= 0 ? parseAmount(cols[amtCol]) : 0;
    if (amount === 0 && descCol >= 0 && !cols[descCol]) continue;
    const description = descCol >= 0 ? cols[descCol] || '' : '';
    rows.push({
      id: `import-${Date.now()}-${i}`,
      description,
      amount,
      date: dateCol >= 0 ? parseDate(cols[dateCol]) : '',
      category: catCol >= 0 ? guessCategory(cols[catCol]) : guessCategory(description),
      vendor: vendorCol >= 0 ? cols[vendorCol] || '' : '',
      propertyHint: propCol >= 0 ? cols[propCol] || '' : '',
      flowType: 'expense',
      selected: true,
    });
  }
  return rows;
}

// Parse free-form text (pasted from PDF)
function parseFreeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const rows = [];
  const amountRegex = /\$?\s*[\d,]+\.\d{2}/;
  const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amountMatch = line.match(amountRegex);
    if (!amountMatch) continue;
    const amount = parseAmount(amountMatch[0]);
    if (amount === 0) continue;
    const dateMatch = line.match(dateRegex);
    const date = dateMatch ? parseDate(dateMatch[0]) : '';
    let description = line.replace(amountRegex, '').replace(dateRegex, '').replace(/[\$\|\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (description.toLowerCase().includes('total') && i > lines.length - 3) continue;
    rows.push({
      id: `import-${Date.now()}-${i}`,
      description: description || `Line item ${i + 1}`,
      amount,
      date,
      category: guessCategory(description),
      vendor: '',
      propertyHint: '',
      flowType: 'expense',
      selected: true,
    });
  }
  return rows;
}


export default function ExpenseReportUpload({ properties, onImport, onClose }) {
  const [step, setStep] = useState('upload'); // upload | parsing | review | done
  const [parsedItems, setParsedItems] = useState([]);
  const [pdfSummary, setPdfSummary] = useState(null);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [defaultPropertyId, setDefaultPropertyId] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [viewFilter, setViewFilter] = useState('expenses'); // expenses | income | all
  const [expandedProps, setExpandedProps] = useState(new Set());
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Match a transaction's propertyAddress to an existing property
  const matchProperty = (propertyHint) => {
    if (!propertyHint || properties.length === 0) return null;
    const hint = propertyHint.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    // Try address or name match
    return properties.find(p => {
      const addr = (p.address || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const name = (p.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
      // Match by street number + partial street name
      const hintNum = hint.match(/^\d+/)?.[0];
      const addrNum = addr.match(/^\d+/)?.[0];
      if (hintNum && addrNum && hintNum === addrNum) {
        // Same street number — check if street name overlaps
        const hintWords = hint.split(/\s+/).filter(w => w.length > 2);
        const addrWords = addr.split(/\s+/).filter(w => w.length > 2);
        const overlap = hintWords.filter(w => addrWords.some(aw => aw.includes(w) || w.includes(aw)));
        if (overlap.length >= 1) return true;
      }
      return addr.includes(hint) || hint.includes(addr) || name.includes(hint) || hint.includes(name);
    });
  };

  // Handle PDF file upload
  const handlePdfUpload = async (file) => {
    setStep('parsing');
    setParseError('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await parseOwnerPacket(new Uint8Array(arrayBuffer));

      if (result.allTransactions.length === 0) {
        setParseError('No transactions found in this PDF. Make sure it\'s an owner packet with transaction details.');
        setStep('upload');
        return;
      }

      // Set report month from detected period
      if (result.period?.monthStr) {
        setReportMonth(result.period.monthStr);
      }

      setPdfSummary({
        period: result.period?.displayPeriod || 'Unknown period',
        totalProperties: result.summary.totalProperties,
        totalIncome: result.summary.totalIncome,
        totalExpenses: result.summary.totalExpenses,
        totalDistributions: result.summary.totalDistributions,
      });

      // Convert transactions to parsedItems format
      const items = result.allTransactions
        .filter(tx => !tx.isDistribution) // skip owner distributions by default
        .map((tx, idx) => {
          const matchedProp = matchProperty(tx.propertyAddress);
          return {
            id: `pdf-${Date.now()}-${idx}`,
            description: tx.description || tx.payee || tx.type || 'Unknown',
            amount: tx.amount || 0,
            date: tx.date || (result.period?.startDate) || `${reportMonth}-01`,
            category: tx.category,
            vendor: tx.payee || '',
            propertyHint: tx.propertyAddress || '',
            propertyFullAddress: tx.propertyFullAddress || '',
            propertyId: matchedProp ? String(matchedProp.id) : '',
            propertyName: matchedProp ? `${matchedProp.emoji || '🏠'} ${matchedProp.name}` : '',
            flowType: tx.flowType,
            type: tx.type || '',
            cashIn: tx.cashIn || 0,
            cashOut: tx.cashOut || 0,
            selected: !tx.isDistribution, // default: select both expenses and income (not distributions)
          };
        });

      setParsedItems(items);
      setStep('review');
    } catch (err) {
      logger.error('PDF parse error:', err);
      setParseError(`Failed to parse PDF: ${err.message}`);
      setStep('upload');
    }
  };

  // Handle file upload (CSV, text, or PDF)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');

    // PDF handling
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setUploadedFile(file);
      await handlePdfUpload(file);
      return;
    }

    // CSV/text handling
    try {
      const text = await file.text();
      let items = parseDelimited(text);
      if (items.length === 0) items = parseFreeText(text);
      if (items.length === 0) {
        setParseError('Could not parse any expense items from this file. Try pasting the text directly.');
        return;
      }
      items = items.map(item => ({
        ...item,
        date: item.date || `${reportMonth}-01`,
      }));
      setParsedItems(items);
      setStep('review');
    } catch (err) {
      setParseError('Failed to read file: ' + err.message);
    }
  };

  // Handle pasted text
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    setParseError('');
    let items = parseDelimited(pasteText);
    if (items.length === 0) items = parseFreeText(pasteText);
    if (items.length === 0) {
      setParseError('Could not parse any expense items from this text.');
      return;
    }
    items = items.map(item => ({
      ...item,
      date: item.date || `${reportMonth}-01`,
    }));
    setParsedItems(items);
    setStep('review');
  };

  const toggleItem = (id) => {
    setParsedItems(prev => prev.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateItem = (id, field, value) => {
    setParsedItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleAll = () => {
    const filtered = getFilteredItems();
    const allSelected = filtered.every(i => i.selected);
    const filteredIds = new Set(filtered.map(i => i.id));
    setParsedItems(prev => prev.map(i =>
      filteredIds.has(i.id) ? { ...i, selected: !allSelected } : i
    ));
  };

  const togglePropertyExpanded = (addr) => {
    setExpandedProps(prev => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  // Filter items by view mode
  const getFilteredItems = () => {
    if (viewFilter === 'expenses') return parsedItems.filter(i => i.flowType === 'expense');
    if (viewFilter === 'income') return parsedItems.filter(i => i.flowType === 'income');
    return parsedItems;
  };

  // Group items by property
  const getGroupedItems = () => {
    const filtered = getFilteredItems();
    const groups = new Map();
    filtered.forEach(item => {
      const key = item.propertyHint || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  };

  // Import selected items
  const handleImport = async () => {
    const selected = parsedItems.filter(i => i.selected);
    if (selected.length === 0) return;

    setImporting(true);
    const expenses = selected.map(item => {
      const prop = item.propertyId
        ? properties.find(p => String(p.id) === String(item.propertyId))
        : (defaultPropertyId
          ? properties.find(p => String(p.id) === String(defaultPropertyId))
          : matchProperty(item.propertyHint));

      return {
        description: item.description,
        amount: item.amount,
        date: item.date,
        category: item.category,
        vendor: item.vendor,
        propertyId: prop ? String(prop.id) : '',
        propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
        notes: `Imported from ${pdfSummary ? 'owner packet' : 'expense report'} (${reportMonth})`,
        receiptPhoto: '',
        source: pdfSummary ? 'owner-packet' : 'expense-report',
        reportMonth,
        flowType: item.flowType || 'expense',
      };
    });

    await onImport(expenses, uploadedFile);
    setImporting(false);
    setStep('done');
  };

  const selectedCount = parsedItems.filter(i => i.selected).length;
  const selectedTotal = parsedItems.filter(i => i.selected).reduce((sum, i) => sum + (i.amount || 0), 0);
  const selectedExpenseTotal = parsedItems.filter(i => i.selected && i.flowType === 'expense').reduce((sum, i) => sum + (i.amount || 0), 0);
  const selectedIncomeTotal = parsedItems.filter(i => i.selected && i.flowType === 'income').reduce((sum, i) => sum + (i.amount || 0), 0);

  const getCategoryLabel = (cat) => {
    const found = expenseCategories.find(c => c.value === cat) || incomeCategories?.find(c => c.value === cat);
    return found ? `${found.emoji} ${found.label}` : cat;
  };

  const hasPdfData = pdfSummary !== null;
  const groupedItems = hasPdfData ? getGroupedItems() : null;
  const filteredItems = getFilteredItems();

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Owner Packet / Report</h2>
              <p className="text-xs text-white/40">Upload a management company PDF or paste expense data</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* UPLOAD STEP */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Report Month</label>
              <input
                type="month"
                value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Default property (optional)</label>
              <select
                value={defaultPropertyId}
                onChange={e => setDefaultPropertyId(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="">Auto-detect from PDF</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
                ))}
              </select>
            </div>

            {/* File upload - now accepts PDF */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Upload File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/[0.1] rounded-xl text-white/40 hover:text-white/60 hover:border-orange-500/30 transition flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Click to upload owner packet or expense report</span>
                <span className="text-xs text-white/30">PDF (owner packet), CSV, TSV, or text files</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-white/[0.08]" />
              <span className="text-xs text-white/30">OR</span>
              <div className="flex-1 border-t border-white/[0.08]" />
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Paste expense report text</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your expense report here...&#10;&#10;Example:&#10;01/15/2026  Plumbing repair  $450.00&#10;01/15/2026  Management fee   $150.00"
                rows={6}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 resize-none font-mono"
              />
              {pasteText.trim() && (
                <button
                  onClick={handlePasteSubmit}
                  className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition"
                >
                  Parse Text
                </button>
              )}
            </div>

            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{parseError}</p>
              </div>
            )}
          </div>
        )}

        {/* PARSING STEP */}
        {step === 'parsing' && (
          <div className="text-center py-12">
            <Loader className="w-10 h-10 text-orange-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Parsing PDF...</h3>
            <p className="text-white/40 text-sm">Extracting transactions from owner packet</p>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* PDF Summary Banner */}
            {pdfSummary && (
              <div className="bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-300">Owner Packet Summary</span>
                  <span className="text-xs text-white/40 ml-auto">{pdfSummary.period}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">Income</p>
                    <p className="text-sm font-bold text-green-400">{formatCurrency(pdfSummary.totalIncome)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">Expenses</p>
                    <p className="text-sm font-bold text-red-400">{formatCurrency(pdfSummary.totalExpenses)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/40 mb-1">Properties</p>
                    <p className="text-sm font-bold text-white">{pdfSummary.totalProperties}</p>
                  </div>
                </div>
              </div>
            )}

            {/* View filter tabs */}
            {hasPdfData && (
              <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
                {[
                  { key: 'expenses', label: 'Expenses', icon: TrendingDown, color: 'text-red-400' },
                  { key: 'income', label: 'Income', icon: TrendingUp, color: 'text-green-400' },
                  { key: 'all', label: 'All', icon: DollarSign, color: 'text-white' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setViewFilter(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      viewFilter === tab.key
                        ? 'bg-white/10 ' + tab.color
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    <span className="text-white/30 ml-1">
                      ({tab.key === 'all' ? parsedItems.length :
                        parsedItems.filter(i => i.flowType === (tab.key === 'expenses' ? 'expense' : 'income')).length})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
              <div className="flex items-center gap-4">
                <button onClick={toggleAll} className="text-xs text-white/50 hover:text-white transition">
                  {filteredItems.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-white">
                  {selectedCount} selected
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedIncomeTotal > 0 && (
                  <span className="text-xs text-green-400">+{formatCurrency(selectedIncomeTotal)}</span>
                )}
                {selectedExpenseTotal > 0 && (
                  <span className="text-sm font-bold text-red-400">-{formatCurrency(selectedExpenseTotal)}</span>
                )}
              </div>
            </div>

            {/* Items list — grouped by property for PDF, flat for text/CSV */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {hasPdfData && groupedItems ? (
                // Grouped by property
                [...groupedItems.entries()].map(([propAddr, items]) => {
                  const isExpanded = expandedProps.has(propAddr) || groupedItems.size <= 3;
                  const propTotal = items.reduce((s, i) => s + (i.selected ? i.amount : 0), 0);
                  const propSelectedCount = items.filter(i => i.selected).length;
                  const matchedProp = items[0]?.propertyId
                    ? properties.find(p => String(p.id) === items[0].propertyId)
                    : null;

                  return (
                    <div key={propAddr} className="border border-white/[0.08] rounded-xl overflow-hidden">
                      {/* Property header */}
                      <button
                        onClick={() => togglePropertyExpanded(propAddr)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <span className="text-sm">{matchedProp?.emoji || '🏠'}</span>
                          <div>
                            <span className="text-sm font-medium text-white">
                              {matchedProp ? matchedProp.name : propAddr}
                            </span>
                            {matchedProp && propAddr !== 'Unassigned' && (
                              <span className="text-xs text-white/30 block">{propAddr}</span>
                            )}
                          </div>
                          <span className="text-xs text-white/30 ml-2">
                            {propSelectedCount}/{items.length} items
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-orange-400">{formatCurrency(propTotal)}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                        </div>
                      </button>

                      {/* Items */}
                      {isExpanded && (
                        <div className="divide-y divide-white/[0.05]">
                          {items.map(item => (
                            <TransactionRow
                              key={item.id}
                              item={item}
                              properties={properties}
                              onToggle={() => toggleItem(item.id)}
                              onUpdate={(field, value) => updateItem(item.id, field, value)}
                              onRemove={() => removeItem(item.id)}
                              showPropertySelect={false}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Flat list for CSV/text imports
                filteredItems.map(item => (
                  <TransactionRow
                    key={item.id}
                    item={item}
                    properties={properties}
                    onToggle={() => toggleItem(item.id)}
                    onUpdate={(field, value) => updateItem(item.id, field, value)}
                    onRemove={() => removeItem(item.id)}
                    showPropertySelect={!defaultPropertyId}
                  />
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setStep('upload'); setParsedItems([]); setPdfSummary(null); }}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {importing ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <>Import {selectedCount} Items ({formatCurrency(selectedTotal)})</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* DONE STEP */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Import Complete</h3>
            <p className="text-white/50 text-sm mb-2">
              {selectedCount} items totaling {formatCurrency(selectedTotal)} have been added.
            </p>
            {selectedIncomeTotal > 0 && selectedExpenseTotal > 0 && (
              <p className="text-white/40 text-xs mb-6">
                Income: +{formatCurrency(selectedIncomeTotal)} · Expenses: -{formatCurrency(selectedExpenseTotal)}
              </p>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Individual transaction row component.
 */
function TransactionRow({ item, properties, onToggle, onUpdate, onRemove, showPropertySelect }) {
  const isIncome = item.flowType === 'income';

  return (
    <div className={`px-4 py-3 transition ${
      item.selected
        ? 'bg-white/[0.03]'
        : 'bg-white/[0.01] opacity-50'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-1 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition ${
            item.selected
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'border-white/20 hover:border-white/40'
          }`}
        >
          {item.selected && <Check className="w-3 h-3" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={item.description}
                onChange={e => onUpdate('description', e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-white border-b border-transparent hover:border-white/20 focus:border-orange-500/50 focus:outline-none px-0 py-0.5"
              />
              {item.vendor && item.vendor !== item.description && (
                <span className="text-xs text-white/30">{item.vendor}</span>
              )}
            </div>
            <span className={`text-sm font-bold whitespace-nowrap ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Flow type badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              isIncome ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {isIncome ? 'Income' : 'Expense'}
            </span>
            <select
              value={item.category}
              onChange={e => onUpdate('category', e.target.value)}
              className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
            >
              {isIncome ? (
                <>
                  <option value="rent">💰 Rent</option>
                  <option value="late-fee">⏰ Late Fee</option>
                  <option value="deposit">🔒 Security Deposit</option>
                  <option value="other">💵 Other Income</option>
                </>
              ) : (
                expenseCategories.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))
              )}
            </select>
            <input
              type="date"
              value={item.date}
              onChange={e => onUpdate('date', e.target.value)}
              className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
            />
            {showPropertySelect && (
              <select
                value={item.propertyId || ''}
                onChange={e => onUpdate('propertyId', e.target.value)}
                className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none max-w-[150px]"
              >
                <option value="">No property</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={onRemove}
              className="p-1 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
