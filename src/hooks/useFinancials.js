import { useState, useCallback, useRef } from 'react';

/**
 * useFinancials Hook
 * Manages all Financials data and operations
 * CRUD uses functional state updates (prev =>) to avoid stale closure bugs.
 * Read-only aggregation helpers still use transactions from closure (fine for reads).
 */
export const useFinancials = (currentUser, saveFinancials, showToast) => {
  const saveRef = useRef(saveFinancials);
  saveRef.current = saveFinancials;

  const [transactions, setTransactions] = useState([]);
  const [financialViewMode, setFinancialViewMode] = useState('transactions');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionPropertyFilter, setTransactionPropertyFilter] = useState('all');
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(null);

  const addTransaction = useCallback((transaction) => {
    const newTransaction = {
      ...transaction,
      id: transaction.id || Date.now().toString(),
      createdAt: transaction.createdAt || new Date().toISOString(),
    };
    setTransactions(prev => {
      const newTransactions = [...prev, newTransaction];
      saveRef.current(newTransactions);
      return newTransactions;
    });
    showToast(`${transaction.type === 'income' ? 'Income' : 'Expense'} added`, 'success');
  }, [showToast]);

  const updateTransaction = useCallback((transactionId, updates) => {
    setTransactions(prev => {
      const newTransactions = prev.map(t => t.id === transactionId ? { ...t, ...updates } : t);
      saveRef.current(newTransactions);
      return newTransactions;
    });
    showToast('Transaction updated', 'success');
  }, [showToast]);

  const deleteTransaction = useCallback((transactionId) => {
    setTransactions(prev => {
      const newTransactions = prev.filter(t => t.id !== transactionId);
      saveRef.current(newTransactions);
      return newTransactions;
    });
    showToast('Transaction deleted', 'info');
  }, [showToast]);

  // Read-only aggregation helpers (closure capture is fine for reads)
  const getTotalIncome = useCallback((propertyId = null) => {
    return transactions
      .filter(t => t.type === 'income' && (!propertyId || t.propertyId === propertyId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const getTotalExpenses = useCallback((propertyId = null) => {
    return transactions
      .filter(t => t.type === 'expense' && (!propertyId || t.propertyId === propertyId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const getProfit = useCallback((propertyId = null) => {
    const income = getTotalIncome(propertyId);
    const expenses = getTotalExpenses(propertyId);
    return income - expenses;
  }, [getTotalIncome, getTotalExpenses]);

  const getMonthlyBreakdown = useCallback(() => {
    const breakdown = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const [year, month] = t.date.split('-');
      const key = `${year}-${month}`;
      if (!breakdown[key]) breakdown[key] = { income: 0, expense: 0 };
      if (t.type === 'income') breakdown[key].income += t.amount || 0;
      else breakdown[key].expense += t.amount || 0;
    });
    return breakdown;
  }, [transactions]);

  const getPropertyBreakdown = useCallback(() => {
    const breakdown = {};
    transactions.forEach(t => {
      const propId = t.propertyId || 'unassigned';
      if (!breakdown[propId]) breakdown[propId] = { income: 0, expense: 0, profit: 0 };
      if (t.type === 'income') breakdown[propId].income += t.amount || 0;
      else breakdown[propId].expense += t.amount || 0;
      breakdown[propId].profit = breakdown[propId].income - breakdown[propId].expense;
    });
    return breakdown;
  }, [transactions]);

  const getFilteredTransactions = useCallback(() => {
    return transactions.filter(t => {
      const typeMatch = transactionTypeFilter === 'all' || t.type === transactionTypeFilter;
      const propertyMatch = transactionPropertyFilter === 'all' || t.propertyId === transactionPropertyFilter;
      return typeMatch && propertyMatch;
    });
  }, [transactions, transactionTypeFilter, transactionPropertyFilter]);

  return {
    transactions,
    financialViewMode,
    transactionTypeFilter,
    transactionPropertyFilter,
    showAddTransactionModal,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTotalIncome,
    getTotalExpenses,
    getProfit,
    getMonthlyBreakdown,
    getPropertyBreakdown,
    getFilteredTransactions,
    setFinancialViewMode,
    setTransactionTypeFilter,
    setTransactionPropertyFilter,
    setShowAddTransactionModal,
    setTransactions,
    showToast,
  };
};

export default useFinancials;
