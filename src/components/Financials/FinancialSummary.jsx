import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils';

const FinancialSummary = ({
  transactions,
  properties,
  getTotalIncome,
  getTotalExpenses,
  getProfit,
  getPropertyBreakdown,
  getMonthlyBreakdown,
}) => {
  // Calculate overall totals
  const totalIncome = useMemo(() => getTotalIncome(), [getTotalIncome]);
  const totalExpenses = useMemo(() => getTotalExpenses(), [getTotalExpenses]);
  const netProfit = useMemo(() => getProfit(), [getProfit]);

  // Get property breakdown
  const propertyBreakdown = useMemo(() => getPropertyBreakdown(), [getPropertyBreakdown]);

  // Get monthly breakdown
  const monthlyBreakdown = useMemo(() => getMonthlyBreakdown(), [getMonthlyBreakdown]);

  // Sort months in reverse chronological order
  const sortedMonths = useMemo(() => {
    return Object.entries(monthlyBreakdown)
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .slice(0, 12); // Last 12 months
  }, [monthlyBreakdown]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Income Card */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-semibold">Total Income</p>
              <p className="text-white text-2xl font-bold mt-1">
                {formatCurrency(totalIncome)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-semibold">Total Expenses</p>
              <p className="text-white text-2xl font-bold mt-1">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                netProfit >= 0
                  ? 'bg-emerald-500/20'
                  : 'bg-red-500/20'
              }`}
            >
              <DollarSign
                className={`w-6 h-6 ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-semibold">Net Profit</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {netProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netProfit))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Property Breakdown */}
      {Object.keys(propertyBreakdown).length > 0 && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6">
          <h3 className="text-white text-lg font-bold mb-4">Breakdown by Property</h3>
          <div className="space-y-3">
            {Object.entries(propertyBreakdown).map(([propId, breakdown]) => {
              const property = properties?.find(p => p.id === propId);
              const propertyName = property?.name || (propId === 'unassigned' ? 'Unassigned' : propId);

              return (
                <div
                  key={propId}
                  className="p-4 bg-white/[0.05] border border-white/[0.08] rounded-xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">{propertyName}</h4>
                    <span
                      className={`text-sm font-bold ${
                        breakdown.profit >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {breakdown.profit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(breakdown.profit))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>Income: <span className="text-emerald-400 font-semibold">{formatCurrency(breakdown.income)}</span></div>
                    <div>Expenses: <span className="text-red-400 font-semibold">{formatCurrency(breakdown.expense)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {sortedMonths.length > 0 && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6">
          <h3 className="text-white text-lg font-bold mb-4">Monthly Trend (Last 12 Months)</h3>
          <div className="space-y-2">
            {sortedMonths.map(([month, breakdown]) => {
              const profit = breakdown.income - breakdown.expense;
              const [year, monthNum] = month.split('-');
              const monthName = new Date(year, monthNum - 1).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={month}
                  className="p-3 bg-white/[0.05] rounded-lg flex items-center justify-between"
                >
                  <span className="text-slate-400 text-sm font-semibold">{monthName}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="text-right">
                      <div className="text-emerald-400">+{formatCurrency(breakdown.income)}</div>
                      <div className="text-red-400">-{formatCurrency(breakdown.expense)}</div>
                    </div>
                    <div
                      className={`font-bold w-20 text-right ${
                        profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {profit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(profit))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="text-center py-12 bg-white/[0.05] border border-white/[0.08] rounded-2xl">
          <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No transactions yet</p>
          <p className="text-slate-500 text-sm">Start adding income and expenses to see your financial summary</p>
        </div>
      )}
    </div>
  );
};

export default FinancialSummary;
