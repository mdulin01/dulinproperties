import React, { useState, useCallback } from 'react';
import { Upload, ChevronDown, Check, X, AlertCircle, FileText } from 'lucide-react';
import { expenseCategories } from '../../constants';
import { formatCurrency } from '../../utils';

/**
 * DocumentImport – upload/parse management company statements, bank statements, etc.
 * Lives on the Documents page. Supports:
 *   - Barnett & Hill owner statements
 *   - Absolute Real Estate owner packets
 *   - FFB bank statements
 *   - Citi Card statements
 *
 * For each source the user can upload a PDF (future: auto-parse) or review
 * pre-parsed entries before importing them to the Expenses ledger.
 */

const SOURCE_TYPES = [
  { id: 'barnett-hill', label: 'Barnett & Hill', color: 'purple', icon: '🏢' },
  { id: 'absolute', label: 'Absolute', color: 'teal', icon: '🏠' },
  { id: 'ffb-bank', label: 'FFB Bank', color: 'blue', icon: '🏦' },
  { id: 'citi-card', label: 'Citi Card', color: 'amber', icon: '💳' },
];

const colorMap = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', accent: 'bg-purple-500' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', accent: 'bg-teal-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', accent: 'bg-blue-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', accent: 'bg-amber-500' },
};

/** Try to match a street address from a statement to a property in the properties list.
 *  Handles abbreviation differences (Road/Rd, Street/St, Drive/Dr, etc.) and
 *  the 5297 Taos / 5297 Pueblo collision by matching full street name.
 */
function matchProperty(addressFromStatement, properties) {
  if (!addressFromStatement) return null;

  const normalize = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/\bstreet\b/g, 'st')
      .replace(/\broad\b/g, 'rd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\bplace\b/g, 'pl')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\blane\b/g, 'ln')
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const addr = normalize(addressFromStatement);

  // Direct match
  for (const p of properties) {
    if (normalize(p.street) === addr) return p;
  }

  // Fuzzy: check if the property street is contained in the address or vice versa
  for (const p of properties) {
    const ps = normalize(p.street);
    if (addr.includes(ps) || ps.includes(addr)) return p;
  }

  // Number + partial street name match (but require street name, not just number)
  const addrParts = addr.split(' ');
  const addrNum = addrParts[0];
  const addrStreet = addrParts.slice(1).join(' ');
  for (const p of properties) {
    const ps = normalize(p.street);
    const psParts = ps.split(' ');
    const psNum = psParts[0];
    const psStreet = psParts.slice(1).join(' ');
    if (addrNum === psNum && addrStreet && psStreet && (addrStreet.includes(psStreet.split(' ')[0]) || psStreet.includes(addrStreet.split(' ')[0]))) {
      // Make sure we're not confusing Taos/Pueblo - require first word of street to match
      const addrFirstWord = addrStreet.split(' ')[0];
      const psFirstWord = psStreet.split(' ')[0];
      if (addrFirstWord === psFirstWord) return p;
    }
  }

  return null;
}

/** Guess expense category from a description string */
function guessCategory(description) {
  const d = (description || '').toLowerCase();
  if (d.includes('management fee')) return 'management-fee';
  if (d.includes('owner distribution') || d.includes('owner payment')) return 'owner-distribution';
  if (d.includes('repair') || d.includes('maintenance')) return 'repair';
  if (d.includes('insurance')) return 'insurance';
  if (d.includes('tax')) return 'taxes';
  if (d.includes('hoa')) return 'hoa';
  if (d.includes('pest')) return 'pest-control';
  if (d.includes('plumb')) return 'plumbing';
  if (d.includes('electric')) return 'electrical';
  if (d.includes('hvac') || d.includes('heat') || d.includes('air condition')) return 'hvac';
  if (d.includes('clean')) return 'cleaning';
  if (d.includes('landscap') || d.includes('lawn') || d.includes('mow')) return 'landscaping';
  if (d.includes('legal') || d.includes('attorney')) return 'legal';
  if (d.includes('atmos') || d.includes('gas bill') || d.includes('utilit') || d.includes('water') || d.includes('sewer')) return 'utilities';
  if (d.includes('internet') || d.includes('vexus') || d.includes('cable')) return 'internet';
  if (d.includes('lowe') || d.includes('home depot') || d.includes('hardware')) return 'repair';
  if (d.includes('appliance')) return 'appliance';
  if (d.includes('mortgage')) return 'mortgage';
  return 'other';
}

export default function DocumentImport({ properties, expenses, addExpense, addRentPayment, showToast, onClose }) {
  const [activeSource, setActiveSource] = useState(null);
  const [entries, setEntries] = useState([]); // parsed entries for review
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Toggle entry selected state
  const toggleEntry = useCallback((idx) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  }, []);

  // Update entry field
  const updateEntry = useCallback((idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }, []);

  // Select/deselect all
  const selectAll = useCallback((val) => {
    setEntries(prev => prev.map(e => ({ ...e, selected: val })));
  }, []);

  // Import selected entries
  const handleImport = useCallback(() => {
    const selected = entries.filter(e => e.selected);
    if (selected.length === 0) return;

    setImporting(true);
    let count = 0;

    selected.forEach(entry => {
      if (entry.flowType === 'income') {
        // Add as rent payment
        addRentPayment({
          id: `import-${Date.now()}-${count}`,
          propertyId: entry.propertyId || '',
          propertyName: entry.propertyName || '',
          tenantName: entry.tenantName || '',
          amount: entry.amount,
          month: entry.date ? entry.date.substring(0, 7) : '',
          datePaid: entry.date,
          status: 'paid',
          notes: `Imported from ${entry.sourceDocument}`,
          sourceDocument: entry.sourceDocument,
        });
      } else {
        // Add as expense
        addExpense({
          id: `import-${Date.now()}-${count}`,
          propertyId: entry.propertyId || '',
          propertyName: entry.propertyName || '',
          category: entry.category || 'other',
          description: entry.description,
          amount: entry.amount,
          date: entry.date,
          vendor: entry.vendor || '',
          notes: entry.notes || '',
          sourceDocument: entry.sourceDocument,
        });
      }
      count++;
    });

    setImportedCount(count);
    setImporting(false);
    showToast(`Imported ${count} entries`, 'success');
    // Mark imported entries
    setEntries(prev => prev.map(e => e.selected ? { ...e, imported: true, selected: false } : e));
  }, [entries, addExpense, addRentPayment, showToast]);

  // Check for duplicate: does an expense with similar description+date+amount already exist?
  const isDuplicate = useCallback((entry) => {
    return expenses.some(e =>
      Math.abs((e.amount || 0) - entry.amount) < 0.01 &&
      e.date === entry.date &&
      (e.description || '').toLowerCase().includes((entry.description || '').toLowerCase().substring(0, 20))
    );
  }, [expenses]);

  // Render the source selection cards
  if (!activeSource) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Import from Statement</h3>
            <p className="text-xs text-white/40">Upload and parse management reports, bank statements, or credit card statements</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SOURCE_TYPES.map(src => {
            const c = colorMap[src.color];
            return (
              <button
                key={src.id}
                onClick={() => setActiveSource(src.id)}
                className={`${c.bg} border ${c.border} rounded-2xl p-5 text-center hover:brightness-110 transition group`}
              >
                <span className="text-2xl block mb-2">{src.icon}</span>
                <span className={`text-sm font-semibold ${c.text}`}>{src.label}</span>
                <p className="text-[10px] text-white/30 mt-1">Upload or paste statement</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const source = SOURCE_TYPES.find(s => s.id === activeSource);
  const c = colorMap[source.color];
  const selectedCount = entries.filter(e => e.selected).length;
  const notImported = entries.filter(e => !e.imported);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveSource(null); setEntries([]); setImportedCount(0); }}
            className="text-white/50 hover:text-white transition text-sm"
          >
            ← Back
          </button>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{source.icon}</span> {source.label}
            </h3>
          </div>
        </div>
      </div>

      {/* Upload area (if no entries yet) */}
      {entries.length === 0 && (
        <div className={`${c.bg} border-2 border-dashed ${c.border} rounded-2xl p-8 text-center mb-4`}>
          <Upload className={`w-8 h-8 ${c.text} mx-auto mb-3 opacity-60`} />
          <p className={`text-sm font-medium ${c.text} mb-1`}>Upload {source.label} Statement</p>
          <p className="text-xs text-white/30 mb-4">PDF parsing coming soon — use manual entry below for now</p>

          {/* Manual paste area */}
          <div className="text-left mt-4">
            <p className="text-xs text-white/40 mb-2">Or paste statement data:</p>
            <textarea
              placeholder={`Paste ${source.label} statement text here...`}
              rows={6}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none font-mono"
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (!text) return;
                // Basic line-by-line parsing for pasted data
                // Each line: date | description | amount
                const lines = text.split('\n').filter(l => l.trim());
                const parsed = lines.map((line, i) => {
                  const parts = line.split(/\t|  +/).map(p => p.trim());
                  const amount = parseFloat((parts[parts.length - 1] || '').replace(/[$,]/g, '')) || 0;
                  const date = parts[0] || '';
                  const desc = parts.slice(1, -1).join(' ') || line;
                  return {
                    id: `paste-${Date.now()}-${i}`,
                    description: desc,
                    amount: Math.abs(amount),
                    date: date,
                    category: guessCategory(desc),
                    vendor: '',
                    propertyId: '',
                    propertyName: '',
                    sourceDocument: source.label,
                    flowType: 'expense',
                    selected: true,
                  };
                });
                if (parsed.length > 0) setEntries(parsed);
              }}
            />
          </div>
        </div>
      )}

      {/* Entries for review */}
      {entries.length > 0 && (
        <>
          {/* Summary bar */}
          <div className={`${c.bg} border ${c.border} rounded-xl p-3 mb-3 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">{notImported.length} entries</span>
              <button onClick={() => selectAll(true)} className="text-xs text-white/40 hover:text-white/70 underline">Select All</button>
              <button onClick={() => selectAll(false)} className="text-xs text-white/40 hover:text-white/70 underline">Deselect All</button>
            </div>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              className={`px-4 py-2 ${c.accent} text-white rounded-xl text-sm font-medium hover:brightness-110 transition disabled:opacity-40`}
            >
              {importing ? 'Importing...' : `Import ${selectedCount} Selected`}
            </button>
          </div>

          {importedCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">{importedCount} entries imported successfully</span>
            </div>
          )}

          {/* Entry table */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Type</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Date</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Description</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Category</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Property</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const dup = isDuplicate(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-white/[0.04] transition ${
                          entry.imported ? 'opacity-30' :
                          entry.selected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        } ${dup ? 'bg-orange-500/[0.05]' : ''}`}
                      >
                        <td className="px-3 py-2">
                          {entry.imported ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <button onClick={() => toggleEntry(idx)}>
                              <div className={`w-4 h-4 rounded border ${entry.selected ? `${c.accent} border-transparent` : 'border-white/20'} flex items-center justify-center`}>
                                {entry.selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            entry.flowType === 'income' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {entry.flowType === 'income' ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-white/60 whitespace-nowrap">{entry.date}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-white/80">{entry.description}</span>
                          {entry.tenantName && <span className="block text-[10px] text-white/30">{entry.tenantName}</span>}
                          {dup && (
                            <span className="flex items-center gap-1 text-[10px] text-orange-400 mt-0.5">
                              <AlertCircle className="w-3 h-3" /> Possible duplicate
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={entry.category || 'other'}
                            onChange={(e) => updateEntry(idx, 'category', e.target.value)}
                            className="text-[10px] px-1.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 focus:outline-none"
                            disabled={entry.imported || entry.flowType === 'income'}
                          >
                            {expenseCategories.map(cat => (
                              <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={entry.propertyId || ''}
                            onChange={(e) => {
                              const prop = properties.find(p => String(p.id) === e.target.value);
                              updateEntry(idx, 'propertyId', e.target.value);
                              updateEntry(idx, 'propertyName', prop ? `${prop.emoji || '🏠'} ${prop.name}` : '');
                            }}
                            className="text-[10px] px-1.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 focus:outline-none max-w-[120px]"
                            disabled={entry.imported}
                          >
                            <option value="">—</option>
                            {properties.map(p => (
                              <option key={p.id} value={String(p.id)}>{p.emoji || '🏠'} {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-xs font-medium ${entry.flowType === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export the helper functions for use by parsers
export { matchProperty, guessCategory };
