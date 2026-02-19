import React, { useState } from 'react';
import { MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { expenseCategories, incomeCategories } from '../../constants';
import { formatDate, formatCurrency } from '../../utils';

const TransactionCard = ({ transaction, onEdit, onDelete, properties }) => {
  const [showMenu, setShowMenu] = useState(false);

  // Determine if income or expense
  const isIncome = transaction.type === 'income';
  const borderColor = isIncome ? 'border-l-emerald-400' : 'border-l-red-400';
  const accentColor = isIncome ? 'text-emerald-400' : 'text-red-400';

  // Get category details
  const getCategoryInfo = () => {
    const categories = isIncome ? incomeCategories : expenseCategories;
    const category = categories.find(c => c.value === transaction.category);
    return category || { label: 'Unknown', emoji: '💰' };
  };

  // Get property name
  const getPropertyName = () => {
    if (!transaction.propertyId) return null;
    const property = properties?.find(p => p.id === transaction.propertyId);
    return property?.name || 'Unknown Property';
  };

  const categoryInfo = getCategoryInfo();
  const propertyName = getPropertyName();

  return (
    <div
      className={`relative bg-white/[0.05] border border-white/[0.08] border-l-4 ${borderColor} rounded-2xl overflow-hidden hover:shadow-lg transition p-4`}
    >
      <div className="flex items-start justify-between">
        {/* Left side - Icon, description, details */}
        <div className="flex-1 flex gap-4">
          {/* Category Icon */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl`}>
            {categoryInfo.emoji}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Description & Category */}
            <div className="mb-2">
              <h3 className="text-white font-semibold text-sm truncate">
                {transaction.description || categoryInfo.label}
              </h3>
              <p className="text-slate-400 text-xs mt-1">{categoryInfo.label}</p>
            </div>

            {/* Date and Property */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-slate-400 text-xs">
                {formatDate(transaction.date)}
              </span>
              {propertyName && (
                <>
                  <span className="text-slate-600 text-xs">•</span>
                  <span className="text-slate-400 text-xs">{propertyName}</span>
                </>
              )}
              {transaction.recurring && (
                <>
                  <span className="text-slate-600 text-xs">•</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${accentColor} bg-white/[0.08]`}>
                    {transaction.recurringFrequency || 'Monthly'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Amount and Menu */}
        <div className="flex flex-col items-end gap-3">
          {/* Amount */}
          <div className={`text-lg font-bold ${accentColor}`}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </div>

          {/* 3-dot Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800/95 border border-white/15 rounded-xl shadow-xl z-50 min-w-max overflow-hidden">
                <button
                  onClick={() => {
                    onEdit(transaction);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-slate-200 hover:bg-white/10 transition text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(transaction.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-500/10 transition text-sm border-t border-white/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;
