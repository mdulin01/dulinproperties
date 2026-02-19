import React, { useState, useMemo, useCallback } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, DollarSign, CheckSquare, Square, X, Trash2 } from 'lucide-react';
import { rentStatuses } from '../../constants';
import { formatDate, formatCurrency } from '../../utils';
import { getPropertyTenants } from '../../hooks/useProperties';

export default function RentLedger({ rentPayments, properties, onAdd, onEdit, onDelete, onBulkDelete, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Get property/tenant name helpers
  const getPropertyName = (propertyId) => {
    const p = properties.find(pr => pr.id === propertyId);
    return p ? `${p.emoji || '🏠'} ${p.name}` : '—';
  };

  const getTenantName = (propertyId) => {
    const p = properties.find(pr => pr.id === propertyId);
    if (!p) return '—';
    const tenants = getPropertyTenants(p);
    return tenants.map(t => t.name).filter(Boolean).join(', ') || '—';
  };

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set();
    rentPayments.forEach(r => {
      const d = r.datePaid || r.month || '';
      if (d.length >= 4) years.add(d.substring(0, 4));
    });
    return [...years].sort().reverse();
  }, [rentPayments]);

  // Filter
  const filtered = useMemo(() => {
    let result = [...rentPayments];
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (propertyFilter !== 'all') result = result.filter(r => r.propertyId === propertyFilter);
    if (yearFilter !== 'all') result = result.filter(r => {
      const d = r.datePaid || r.month || '';
      return d.startsWith(yearFilter);
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.tenantName || '').toLowerCase().includes(q) ||
        (r.propertyName || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.month || '').includes(q)
      );
    }
    return result;
  }, [rentPayments, statusFilter, propertyFilter, yearFilter, searchQuery]);

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'tenant': return dir * (a.tenantName || '').localeCompare(b.tenantName || '');
        case 'property': return dir * (a.propertyName || '').localeCompare(b.propertyName || '');
        case 'date': return dir * (a.datePaid || 'zzzz').localeCompare(b.datePaid || 'zzzz');
        case 'amount': return dir * ((a.amount || 0) - (b.amount || 0));
        case 'status': return dir * (a.status || '').localeCompare(b.status || '');
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
      ? <ChevronUp className="w-3 h-3 text-emerald-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-emerald-400 inline ml-1" />;
  };

  // Multi-select helpers
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sorted.map(r => r.id)));
  }, [sorted]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (onBulkDelete) {
      onBulkDelete([...selectedIds]);
    }
    exitSelectMode();
  }, [selectedIds, onBulkDelete, exitSelectMode]);

  const selectedTotal = useMemo(() => {
    return sorted.filter(r => selectedIds.has(r.id)).reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [sorted, selectedIds]);

  const getStatusBadge = (status) => {
    const s = rentStatuses.find(rs => rs.value === status);
    if (!s) return <span className="text-xs text-white/40">{status}</span>;
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.border} border ${s.color}`}>
        {s.label}
      </span>
    );
  };

  // Summary stats - use property-level monthlyRent (total per property, not per-tenant)
  const totalExpected = properties.reduce((sum, p) => sum + (parseFloat(p.monthlyRent) || 0), 0);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthPayments = rentPayments.filter(r => r.month === currentMonth);
  const collected = thisMonthPayments.filter(r => r.status === 'paid').reduce((sum, r) => sum + (r.amount || 0), 0);
  const outstanding = totalExpected - collected;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Rent</h2>
          <p className="text-xs text-white/40">{rentPayments.length} payment records</p>
        </div>
        <div className="flex items-center gap-2">
          {!selectMode && sorted.length > 0 && (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white/70 rounded-xl text-sm font-medium hover:bg-white/20 transition"
            >
              <CheckSquare className="w-4 h-4" /> Select
            </button>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <div className="flex items-center gap-3">
            <button onClick={exitSelectMode} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <X className="w-4 h-4 text-white/60" />
            </button>
            <span className="text-sm text-white font-medium">
              {selectedIds.size} selected {selectedIds.size > 0 && <span className="text-emerald-400">({formatCurrency(selectedTotal)})</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectedIds.size === sorted.length ? deselectAll : selectAll}
              className="px-3 py-1.5 text-xs font-medium text-white/60 bg-white/10 rounded-lg hover:bg-white/20 transition"
            >
              {selectedIds.size === sorted.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Expected Monthly</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalExpected)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Collected ({currentMonth})</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(collected)}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Outstanding</p>
          <p className={`text-xl font-bold ${outstanding > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(Math.max(0, outstanding))}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Late Payments</p>
          <p className="text-xl font-bold text-orange-400">{rentPayments.filter(r => r.status === 'late').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search tenant, property..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">All Years</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <button onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === 'all' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >All</button>
          {rentStatuses.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === s.value ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">💰</p>
          <p className="text-white/30">No rent payments recorded</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {selectMode && (
                    <th className="w-10 px-3 py-3">
                      <button onClick={selectedIds.size === sorted.length ? deselectAll : selectAll}>
                        {selectedIds.size === sorted.length
                          ? <CheckSquare className="w-4 h-4 text-blue-400" />
                          : <Square className="w-4 h-4 text-white/30" />}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('date')}>
                    Date Paid <SortIcon col="date" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('tenant')}>
                    Tenant <SortIcon col="tenant" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('property')}>
                    Property <SortIcon col="property" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('amount')}>
                    Amount <SortIcon col="amount" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(payment => {
                  const isSelected = selectedIds.has(payment.id);
                  return (
                    <tr
                      key={payment.id}
                      className={`border-b border-white/[0.05] hover:bg-white/[0.03] transition cursor-pointer ${isSelected ? 'bg-blue-500/[0.08]' : ''}`}
                      onClick={() => selectMode ? toggleSelect(payment.id) : onEdit(payment)}
                    >
                      {selectMode && (
                        <td className="w-10 px-3 py-3">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-blue-400" />
                            : <Square className="w-4 h-4 text-white/20" />}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">{payment.datePaid ? formatDate(payment.datePaid) : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/70">{payment.tenantName || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/70">{payment.propertyName || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-emerald-400">{formatCurrency(payment.amount || 0)}</span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(payment.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
