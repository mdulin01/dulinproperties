import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Edit3, Trash2, Plus, Loader } from 'lucide-react';
import { expenseCategories } from '../../constants';
import { formatCurrency } from '../../utils';

/**
 * ExpenseReportUpload - Parses uploaded expense reports (CSV, text, PDF-extracted text)
 * and lets the user review/edit parsed line items before importing them as expenses.
 *
 * Supports management company monthly reports with common formats:
 * - CSV files with headers
 * - Tab/pipe-delimited text
 * - Pasted text from PDF expense reports
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

// Parse amount string, handling ($1,234.56) negative format, dashes, etc.
function parseAmount(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '');
  // Handle (1234.56) accounting negative format
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return Math.abs(parseFloat(cleaned.slice(1, -1)) || 0);
  }
  return Math.abs(parseFloat(cleaned) || 0);
}

// Try to parse a date string in various formats
function parseDate(str) {
  if (!str) return '';
  const trimmed = str.trim();
  // ISO format: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // MM/DD/YYYY or M/D/YYYY
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

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes('|')) delimiter = '|';

  // Parse header
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Find relevant columns by fuzzy matching
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
    if (amount === 0 && descCol >= 0 && !cols[descCol]) continue; // skip empty rows

    const description = descCol >= 0 ? cols[descCol] || '' : '';
    rows.push({
      id: `import-${Date.now()}-${i}`,
      description,
      amount,
      date: dateCol >= 0 ? parseDate(cols[dateCol]) : '',
      category: catCol >= 0 ? guessCategory(cols[catCol]) : guessCategory(description),
      vendor: vendorCol >= 0 ? cols[vendorCol] || '' : '',
      propertyHint: propCol >= 0 ? cols[propCol] || '' : '',
      selected: true,
    });
  }
  return rows;
}

// Parse free-form text (e.g., pasted from PDF)
function parseFreeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const rows = [];
  // Look for lines with dollar amounts
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

    // Description is the line minus the amount and date
    let description = line
      .replace(amountRegex, '')
      .replace(dateRegex, '')
      .replace(/[\$\|\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Skip header-like lines
    if (description.toLowerCase().includes('total') && i > lines.length - 3) continue;

    rows.push({
      id: `import-${Date.now()}-${i}`,
      description: description || `Line item ${i + 1}`,
      amount,
      date,
      category: guessCategory(description),
      vendor: '',
      propertyHint: '',
      selected: true,
    });
  }
  return rows;
}


export default function ExpenseReportUpload({ properties, onImport, onClose }) {
  const [step, setStep] = useState('upload'); // upload | review | done
  const [parsedItems, setParsedItems] = useState([]);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [defaultPropertyId, setDefaultPropertyId] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');

    try {
      const text = await file.text();
      let items = parseDelimited(text);
      if (items.length === 0) {
        items = parseFreeText(text);
      }
      if (items.length === 0) {
        setParseError('Could not parse any expense items from this file. Try pasting the text directly.');
        return;
      }
      // Apply default date from report month if items don't have dates
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
    if (items.length === 0) {
      items = parseFreeText(pasteText);
    }
    if (items.length === 0) {
      setParseError('Could not parse any expense items from this text. Make sure each line includes a dollar amount.');
      return;
    }
    items = items.map(item => ({
      ...item,
      date: item.date || `${reportMonth}-01`,
    }));
    setParsedItems(items);
    setStep('review');
  };

  // Toggle item selection
  const toggleItem = (id) => {
    setParsedItems(prev => prev.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // Update a parsed item field
  const updateItem = (id, field, value) => {
    setParsedItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove an item
  const removeItem = (id) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  // Select/deselect all
  const toggleAll = () => {
    const allSelected = parsedItems.every(i => i.selected);
    setParsedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
  };

  // Import selected items
  const handleImport = async () => {
    const selected = parsedItems.filter(i => i.selected);
    if (selected.length === 0) return;

    setImporting(true);
    const expenses = selected.map(item => {
      const prop = defaultPropertyId
        ? properties.find(p => String(p.id) === String(defaultPropertyId))
        : (item.propertyHint
          ? properties.find(p =>
              (p.name || '').toLowerCase().includes(item.propertyHint.toLowerCase()) ||
              (p.address || '').toLowerCase().includes(item.propertyHint.toLowerCase())
            )
          : null);

      return {
        description: item.description,
        amount: item.amount,
        date: item.date,
        category: item.category,
        vendor: item.vendor,
        propertyId: prop ? String(prop.id) : '',
        propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
        notes: `Imported from expense report (${reportMonth})`,
        receiptPhoto: '',
        source: 'expense-report',
        reportMonth,
      };
    });

    await onImport(expenses);
    setImporting(false);
    setStep('done');
  };

  const selectedCount = parsedItems.filter(i => i.selected).length;
  const selectedTotal = parsedItems.filter(i => i.selected).reduce((sum, i) => sum + (i.amount || 0), 0);

  const getCategoryLabel = (cat) => {
    const found = expenseCategories.find(c => c.value === cat);
    return found ? `${found.emoji} ${found.label}` : cat;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Expense Report</h2>
              <p className="text-xs text-white/40">Upload a management company report or paste expense data</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            {/* Report month */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Report Month</label>
              <input
                type="month"
                value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Default property */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Apply to property (optional — can set per-item later)</label>
              <select
                value={defaultPropertyId}
                onChange={e => setDefaultPropertyId(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="">Select per line item</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
                ))}
              </select>
            </div>

            {/* File upload */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Upload File (CSV, TSV, or text)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-white/[0.1] rounded-xl text-white/40 hover:text-white/60 hover:border-orange-500/30 transition flex flex-col items-center gap-2"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm">Click to upload expense report</span>
                <span className="text-xs text-white/30">CSV, TSV, or plain text files</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-white/[0.08]" />
              <span className="text-xs text-white/30">OR</span>
              <div className="flex-1 border-t border-white/[0.08]" />
            </div>

            {/* Paste text */}
            <div>
              <label className="text-xs text-white/40 mb-1 block">Paste expense report text</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your expense report here...&#10;&#10;Example:&#10;01/15/2026  Plumbing repair  $450.00&#10;01/15/2026  Management fee   $150.00&#10;01/20/2026  Landscaping      $85.00"
                rows={8}
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

        {step === 'review' && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleAll}
                  className="text-xs text-white/50 hover:text-white transition"
                >
                  {parsedItems.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-white">
                  {selectedCount} of {parsedItems.length} items selected
                </span>
              </div>
              <span className="text-sm font-bold text-orange-400">
                {formatCurrency(selectedTotal)}
              </span>
            </div>

            {/* Items list */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {parsedItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition ${
                    item.selected
                      ? 'bg-white/[0.05] border-orange-500/20'
                      : 'bg-white/[0.02] border-white/[0.05] opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={`mt-1 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition ${
                        item.selected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {item.selected && <Check className="w-3 h-3" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          className="flex-1 bg-transparent text-sm font-medium text-white border-b border-transparent hover:border-white/20 focus:border-orange-500/50 focus:outline-none px-0 py-0.5"
                        />
                        <span className="text-sm font-bold text-orange-400 whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={item.category}
                          onChange={e => updateItem(item.id, 'category', e.target.value)}
                          className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
                        >
                          {expenseCategories.map(c => (
                            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={item.date}
                          onChange={e => updateItem(item.id, 'date', e.target.value)}
                          className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
                        />
                        {!defaultPropertyId && (
                          <select
                            value={item.propertyId || ''}
                            onChange={e => updateItem(item.id, 'propertyId', e.target.value)}
                            className="px-2 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
                          >
                            <option value="">No property</option>
                            {properties.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => { setStep('upload'); setParsedItems([]); }}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {importing ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <>Import {selectedCount} Expenses ({formatCurrency(selectedTotal)})</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Import Complete</h3>
            <p className="text-white/50 text-sm mb-6">
              {selectedCount} expenses totaling {formatCurrency(selectedTotal)} have been added.
            </p>
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
