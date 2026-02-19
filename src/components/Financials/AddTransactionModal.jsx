import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { expenseCategories, incomeCategories } from '../../constants';

const AddTransactionModal = ({
  transaction,
  properties,
  onSave,
  onClose,
}) => {
  const isEditing = !!transaction;
  const isIncome = transaction ? transaction.type === 'income' : false;

  // Form state
  const [type, setType] = useState(isIncome ? 'income' : 'expense');
  const [amount, setAmount] = useState(transaction?.amount || '');
  const [category, setCategory] = useState(transaction?.category || '');
  const [propertyId, setPropertyId] = useState(transaction?.propertyId || '');
  const [date, setDate] = useState(transaction?.date || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [recurring, setRecurring] = useState(transaction?.recurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState(
    transaction?.recurringFrequency || 'monthly'
  );

  // Reset form when editing different transaction
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setAmount(transaction.amount || '');
      setCategory(transaction.category || '');
      setPropertyId(transaction.propertyId || '');
      setDate(transaction.date || '');
      setDescription(transaction.description || '');
      setRecurring(transaction.recurring || false);
      setRecurringFrequency(transaction.recurringFrequency || 'monthly');
    }
  }, [transaction]);

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  const handleSave = () => {
    if (!amount || !category || !date) {
      alert('Please fill in amount, category, and date');
      return;
    }

    onSave({
      ...(isEditing && { id: transaction.id }),
      type,
      amount: parseFloat(amount),
      category,
      propertyId: propertyId || null,
      date,
      description,
      recurring,
      recurringFrequency: recurring ? recurringFrequency : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800/95 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-slate-800/95">
          <h2 className="text-white text-xl font-bold">
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Type Toggle */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-3">
              Transaction Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setType('income');
                  setCategory('');
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
                  type === 'income'
                    ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-400'
                    : 'bg-white/10 border border-white/15 text-slate-400 hover:bg-white/15'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => {
                  setType('expense');
                  setCategory('');
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
                  type === 'expense'
                    ? 'bg-red-500/30 border border-red-400 text-red-400'
                    : 'bg-white/10 border border-white/15 text-slate-400 hover:bg-white/15'
                }`}
              >
                Expense
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 pl-8 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:bg-white/15"
                step="0.01"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-2">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:bg-white/15 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">
                  Select a category...
                </option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-slate-800">
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Property */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-2">
              Property (Optional)
            </label>
            <div className="relative">
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:bg-white/15 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">
                  No property linked
                </option>
                {properties?.map((prop) => (
                  <option key={prop.id} value={prop.id} className="bg-slate-800">
                    {prop.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:bg-white/15"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 text-sm font-semibold mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Monthly rent payment"
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:bg-white/15"
            />
          </div>

          {/* Recurring */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border border-white/30 bg-white/10 cursor-pointer accent-emerald-400"
              />
              <span className="text-slate-400 font-semibold">Recurring Transaction</span>
            </label>
          </div>

          {/* Recurring Frequency */}
          {recurring && (
            <div>
              <label className="block text-slate-400 text-sm font-semibold mb-2">
                Frequency
              </label>
              <div className="relative">
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:bg-white/15 appearance-none cursor-pointer"
                >
                  <option value="weekly" className="bg-slate-800">
                    Weekly
                  </option>
                  <option value="biweekly" className="bg-slate-800">
                    Bi-weekly
                  </option>
                  <option value="monthly" className="bg-slate-800">
                    Monthly
                  </option>
                  <option value="quarterly" className="bg-slate-800">
                    Quarterly
                  </option>
                  <option value="annual" className="bg-slate-800">
                    Annual
                  </option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10 bg-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-400 bg-white/10 border border-white/15 hover:bg-white/15 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-emerald-500/80 hover:bg-emerald-500 transition"
          >
            {isEditing ? 'Update' : 'Add'} Transaction
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTransactionModal;
