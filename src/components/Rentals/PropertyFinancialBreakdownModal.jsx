import React, { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils';

const PropertyFinancialBreakdownModal = ({ properties, rentPayments, expenses, onPropertyClick, onClose }) => {
  const [sortField, setSortField] = useState('profit');
  const [sortDir, setSortDir] = useState('desc');

  const currentYear = new Date().getFullYear();

  const propertyFinancials = useMemo(() => {
    return properties.map(property => {
      const propId = String(property.id);

      // YTD rent collected for this property
      const ytdRent = (rentPayments || [])
        .filter(p => String(p.propertyId) === propId && ['paid', 'partial'].includes(p.status))
        .filter(p => {
          const payDate = p.datePaid || p.month;
          return payDate && payDate.startsWith(String(currentYear));
        })
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      // YTD expenses for this property (exclude templates)
      const ytdExpenses = (expenses || [])
        .filter(e => String(e.propertyId) === propId && e.isTemplate !== true)
        .filter(e => e.date && e.date.startsWith(String(currentYear)))
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      const profit = ytdRent - ytdExpenses;
      const monthlyRent = parseFloat(property.monthlyRent) || 0;

      return { property, ytdRent, ytdExpenses, profit, monthlyRent };
    });
  }, [properties, rentPayments, expenses, currentYear]);

  const sorted = useMemo(() => {
    const arr = [...propertyFinancials];
    arr.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') { va = a.property.name.toLowerCase(); vb = b.property.name.toLowerCase(); }
      else if (sortField === 'rent') { va = a.ytdRent; vb = b.ytdRent; }
      else if (sortField === 'expenses') { va = a.ytdExpenses; vb = b.ytdExpenses; }
      else { va = a.profit; vb = b.profit; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [propertyFinancials, sortField, sortDir]);

  const totals = useMemo(() => {
    return propertyFinancials.reduce((acc, p) => ({
      ytdRent: acc.ytdRent + p.ytdRent,
      ytdExpenses: acc.ytdExpenses + p.ytdExpenses,
      profit: acc.profit + p.profit,
    }), { ytdRent: 0, ytdExpenses: 0, profit: 0 });
  }, [propertyFinancials]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-teal-400" />
      : <ChevronDown className="w-3 h-3 text-teal-400" />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Property Financial Breakdown</h2>
            <p className="text-white/40 text-sm mt-0.5">{currentYear} Year-to-Date</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Totals bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-white/[0.03] border-b border-white/10">
          <div className="text-center">
            <p className="text-white/40 text-xs">Total Rent</p>
            <p className="text-emerald-400 font-bold">{formatCurrency(totals.ytdRent)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-xs">Total Expenses</p>
            <p className="text-red-400 font-bold">{formatCurrency(totals.ytdExpenses)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-xs">Net Profit/Loss</p>
            <p className={`font-bold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totals.profit)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto max-h-[55vh]">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 px-5 py-3 text-xs text-white/50 border-b border-white/5 sticky top-0 bg-slate-800">
            <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-white/80 text-left">
              Property <SortIcon field="name" />
            </button>
            <button onClick={() => handleSort('rent')} className="flex items-center gap-1 hover:text-white/80 text-right justify-end">
              Rent <SortIcon field="rent" />
            </button>
            <button onClick={() => handleSort('expenses')} className="flex items-center gap-1 hover:text-white/80 text-right justify-end">
              Expenses <SortIcon field="expenses" />
            </button>
            <button onClick={() => handleSort('profit')} className="flex items-center gap-1 hover:text-white/80 text-right justify-end">
              Profit/Loss <SortIcon field="profit" />
            </button>
          </div>

          {/* Property rows */}
          {sorted.map(({ property, ytdRent, ytdExpenses, profit }) => (
            <div
              key={property.id}
              onClick={() => onPropertyClick(property)}
              className="grid grid-cols-4 gap-2 px-5 py-3 border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm text-white font-medium">{property.name}</span>
                <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-teal-400 transition flex-shrink-0" />
              </div>
              <div className="text-right text-sm text-emerald-400">{formatCurrency(ytdRent)}</div>
              <div className="text-right text-sm text-red-400">{formatCurrency(ytdExpenses)}</div>
              <div className={`text-right text-sm font-semibold flex items-center justify-end gap-1 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatCurrency(Math.abs(profit))}
              </div>
            </div>
          ))}

          {properties.length === 0 && (
            <p className="text-center text-white/30 py-12">No properties to show</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyFinancialBreakdownModal;
