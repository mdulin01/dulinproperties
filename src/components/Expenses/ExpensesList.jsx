import React, { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, RefreshCw, Pencil, Trash2, Calendar, Upload } from 'lucide-react';
import { expenseCategories, recurringFrequencies } from '../../constants';
import { formatDate, formatCurrency } from '../../utils';

// Ordinal suffix helper
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ExpensesList({ expenses, properties, onAdd, onEdit, onDelete, onGenerateFromTemplate, onImportReport, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Separate templates from regular expenses
  const templates = useMemo(() => expenses.filter(e => e.isTemplate === true), [expenses]);
  const regularExpenses = useMemo(() => expenses.filter(e => e.isTemplate !== true), [expenses]);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set();
    regularExpenses.forEach(e => {
      const d = e.date || '';
      if (d.length >= 4) years.add(d.substring(0, 4));
    });
    return [...years].sort().reverse();
  }, [regularExpenses]);

  // Filter (regular expenses only)
  const filtered = useMemo(() => {
    let result = [...regularExpenses];
    if (categoryFilter !== 'all') result = result.filter(e => e.category === categoryFilter);
    if (propertyFilter !== 'all') result = result.filter(e => e.propertyId === propertyFilter);
    if (yearFilter !== 'all') result = result.filter(e => (e.date || '').startsWith(yearFilter));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.propertyName || '').toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [regularExpenses, categoryFilter, propertyFilter, yearFilter, searchQuery]);

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'description': return dir * (a.description || '').localeCompare(b.description || '');
        case 'property': return dir * (a.propertyName || '').localeCompare(b.propertyName || '');
        case 'category': return dir * (a.category || '').localeCompare(b.category || '');
        case 'date': return dir * (a.date || 'zzzz').localeCompare(b.date || 'zzzz');
        case 'amount': return dir * ((a.amount || 0) - (b.amount || 0));
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'amount' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-red-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-red-400 inline ml-1" />;
  };

  const getCategoryBadge = (category) => {
    const c = expenseCategories.find(ec => ec.value === category);
    if (!c) return <span className="text-xs text-white/40">{category}</span>;
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-300">
        {c.emoji} {c.label}
      </span>
    );
  };

  // Helper: count how many times a recurring template should have fired between its creation and a target date
  const getRecurringOccurrences = (template, startDate, endDate) => {
    const freq = template.recurringFrequency || 'monthly';
    const created = template.createdAt ? new Date(template.createdAt) : new Date(template.date || Date.now());
    const start = new Date(Math.max(created.getTime(), startDate.getTime()));
    if (start > endDate) return 0;
    const startY = start.getFullYear(), startM = start.getMonth();
    const endY = endDate.getFullYear(), endM = endDate.getMonth();
    const totalMonths = (endY - startY) * 12 + (endM - startM) + 1;
    if (freq === 'monthly') return totalMonths;
    if (freq === 'quarterly') return Math.ceil(totalMonths / 3);
    if (freq === 'annually') return Math.ceil(totalMonths / 12);
    return totalMonths;
  };

  // Summary stats: regular expenses + recurring template expected amounts
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearStr = currentYear.toString();
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearStart = new Date(currentYear, 0, 1);

  const recordedTotal = regularExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const recordedYtd = regularExpenses
    .filter(e => (e.date || '').startsWith(currentYearStr))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const recordedMonth = regularExpenses
    .filter(e => (e.date || '').startsWith(currentMonth))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Calculate recurring template contributions (only for months without a generated instance)
  const recurringThisMonth = templates.reduce((sum, t) => {
    const hasInstance = regularExpenses.some(e => e.generatedFromTemplate === t.id && e.generatedForMonth === currentMonth);
    if (hasInstance) return sum; // already counted in recorded
    return sum + (t.amount || 0);
  }, 0);

  const recurringYtd = templates.reduce((sum, t) => {
    const occurrences = getRecurringOccurrences(t, yearStart, now);
    const generatedCount = regularExpenses.filter(e =>
      e.generatedFromTemplate === t.id && (e.date || '').startsWith(currentYearStr)
    ).length;
    const missingCount = Math.max(0, occurrences - generatedCount);
    return sum + missingCount * (t.amount || 0);
  }, 0);

  const totalExpenses = recordedTotal + recurringYtd; // use YTD recurring as approximation for "all time with templates"
  const ytdExpenses = recordedYtd + recurringYtd;
  const monthExpenses = recordedMonth + recurringThisMonth;

  // Monthly recurring total
  const monthlyRecurringTotal = templates.reduce((sum, t) => {
    const amt = t.amount || 0;
    if (t.recurringFrequency === 'quarterly') return sum + amt / 3;
    if (t.recurringFrequency === 'annually') return sum + amt / 12;
    return sum + amt;
  }, 0);

  // Check which templates have a generated instance for the current month
  const templateHasCurrentMonth = (templateId) =>
    regularExpenses.some(e => e.generatedFromTemplate === templateId && e.generatedForMonth === currentMonth);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Expenses</h2>
          <p className="text-xs text-white/40">{regularExpenses.length} expenses · {templates.length} recurring bills</p>
        </div>
        <div className="flex items-center gap-2">
          {onImportReport && (
            <button
              onClick={onImportReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-xl text-sm font-medium hover:bg-orange-500/30 transition"
            >
              <Upload className="w-4 h-4" /> Import Report
            </button>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">This Month</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(monthExpenses)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">YTD</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(ytdExpenses)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">All Time</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Monthly Recurring</p>
          <p className="text-xl font-bold text-blue-400">{formatCurrency(monthlyRecurringTotal)}</p>
        </div>
      </div>

      {/* Recurring Bills Templates */}
      {templates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-300">Recurring Bills</h3>
            <span className="text-xs text-white/30">{templates.length} active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {templates.map(t => {
              const cat = expenseCategories.find(c => c.value === t.category);
              const freq = recurringFrequencies.find(f => f.value === t.recurringFrequency);
              const hasThisMonth = templateHasCurrentMonth(t.id);
              return (
                <div
                  key={t.id}
                  className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 hover:bg-blue-500/10 transition group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasThisMonth && onGenerateFromTemplate) {
                            onGenerateFromTemplate(t);
                          }
                        }}
                        disabled={hasThisMonth}
                        className={`mt-0.5 p-1.5 rounded-lg transition flex-shrink-0 ${
                          hasThisMonth
                            ? 'text-emerald-400/50 cursor-default'
                            : 'text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 cursor-pointer'
                        }`}
                        title={hasThisMonth ? 'Already added this month' : 'Add to this month\'s expenses'}
                      >
                        {hasThisMonth
                          ? <span className="text-sm">✅</span>
                          : <RefreshCw className="w-4 h-4" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{cat?.emoji || '📋'}</span>
                          <span className="text-sm font-medium text-white truncate">{t.description || cat?.label || 'Untitled'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-red-400">{formatCurrency(t.amount || 0)}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300">{freq?.label || 'Monthly'}</span>
                          <span className="flex items-center gap-1 text-white/40">
                            <Calendar className="w-3 h-3" />
                            {ordinal(t.dueDay || 1)}
                          </span>
                          {t.propertyName && (
                            <span className="text-white/40 truncate max-w-[120px]">{t.propertyName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70"
                        title="Edit template"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
          />
        </div>
        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-red-500/50"
        >
          <option value="all">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-red-500/50"
        >
          <option value="all">All Categories</option>
          {expenseCategories.map(c => (
            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-red-500/50"
        >
          <option value="all">All Years</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">💸</p>
          <p className="text-white/30">No expenses recorded</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('date')}>
                    Date <SortIcon col="date" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('description')}>
                    Description <SortIcon col="description" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('category')}>
                    Category <SortIcon col="category" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('property')}>
                    Property <SortIcon col="property" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('amount')}>
                    Amount <SortIcon col="amount" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(exp => (
                  <tr
                    key={exp.id}
                    className="border-b border-white/[0.05] hover:bg-white/[0.03] transition cursor-pointer"
                    onClick={() => onEdit(exp)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm text-white/70">{exp.date ? formatDate(exp.date) : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-white">
                        {exp.description || '—'}
                        {exp.generatedFromTemplate && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300/70 align-middle">🔄 auto</span>}
                        {exp.receiptPhoto && <span className="ml-1.5 text-[10px] text-white/30 align-middle">📸</span>}
                      </span>
                      {exp.category === 'mileage' && exp.miles && (
                        <span className="text-xs text-white/40 block">🚗 {exp.miles} mi</span>
                      )}
                      {exp.vendor && <span className="text-xs text-white/40 block">{exp.vendor}</span>}
                    </td>
                    <td className="px-4 py-3">{getCategoryBadge(exp.category)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white/70">{exp.propertyName || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-red-400">{formatCurrency(exp.amount || 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
