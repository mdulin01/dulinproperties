import { useState, useCallback, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Get the last day of a given month.
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Format a month string like "2026-02" from year and month (1-indexed).
 */
function toMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Subtract N months from a given year/month. Returns { year, month } (month is 1-indexed).
 */
function subtractMonths(year, month, n) {
  let m = month - n;
  let y = year;
  while (m < 1) { m += 12; y--; }
  return { year: y, month: m };
}

/**
 * Check if a given month matches the recurring frequency schedule.
 */
function monthMatchesFrequency(targetYear, targetMonth, frequency, startMonth) {
  if (frequency === 'monthly') return true;
  if (frequency === 'quarterly') {
    const diff = ((targetMonth - startMonth) % 3 + 3) % 3;
    return diff === 0;
  }
  if (frequency === 'annually') {
    return targetMonth === startMonth;
  }
  return false;
}

/**
 * Auto-create recurring expense instances from templates.
 * Checks current month and backfills up to 2 prior months.
 * Returns array of new expense objects to add. Does not mutate input.
 */
export function autoCreateRecurringExpenses(expenses) {
  const templates = expenses.filter(e => e.isTemplate === true);
  if (templates.length === 0) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const newExpenses = [];

  templates.forEach(template => {
    const dueDay = template.dueDay || 1;
    const frequency = template.recurringFrequency || 'monthly';
    const createdDate = template.createdAt ? new Date(template.createdAt) : now;
    const templateDate = template.date ? new Date(template.date + 'T00:00:00') : createdDate;
    const effectiveStart = templateDate < createdDate ? templateDate : createdDate;
    const startMonth = effectiveStart.getMonth() + 1;

    for (let offset = 0; offset < 3; offset++) {
      const { year: tYear, month: tMonth } = subtractMonths(currentYear, currentMonth, offset);
      const monthStr = toMonthStr(tYear, tMonth);

      if (!monthMatchesFrequency(tYear, tMonth, frequency, startMonth)) continue;

      const exists = expenses.some(e =>
        e.generatedFromTemplate === template.id && e.generatedForMonth === monthStr
      );
      if (exists) continue;

      const effectiveStartMonth = toMonthStr(effectiveStart.getFullYear(), effectiveStart.getMonth() + 1);
      if (monthStr < effectiveStartMonth) continue;

      const maxDay = daysInMonth(tYear, tMonth);
      const actualDay = Math.min(dueDay, maxDay);
      const dateStr = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

      newExpenses.push({
        id: `${Date.now()}-${template.id}-${monthStr}`,
        createdAt: new Date().toISOString(),
        createdBy: 'System (auto-generated)',
        propertyId: template.propertyId || '',
        propertyName: template.propertyName || '',
        category: template.category || 'other',
        description: template.description || '',
        amount: template.amount || 0,
        date: dateStr,
        vendor: template.vendor || '',
        notes: template.notes || '',
        receiptPhoto: '',
        recurring: false,
        isTemplate: false,
        generatedFromTemplate: template.id,
        generatedForMonth: monthStr,
      });
    }
  });

  return newExpenses;
}

/**
 * Strip undefined values from an object (Firestore rejects undefined).
 * Replaces undefined with '' for strings or 0 for numbers.
 */
export function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        clean[key] = '';  // Replace undefined with empty string
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }
  return obj;
}

/**
 * Directly save expenses to Firestore. No refs, no indirection.
 * Returns true on success, false on failure.
 */
async function saveExpensesDirect(db, expenses, currentUser) {
  if (!db) {
    console.error('[expenses] saveExpensesDirect: no db instance!');
    return false;
  }
  if (!expenses || expenses.length === 0) {
    console.error('[expenses] saveExpensesDirect: refusing to save empty array');
    return false;
  }
  // Sanitize: Firestore rejects undefined values
  const cleanExpenses = sanitizeForFirestore(expenses);
  const saveId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log('[expenses] saveExpensesDirect: saving', cleanExpenses.length, 'expenses, saveId:', saveId);
  try {
    await setDoc(doc(db, 'rentalData', 'expenses'), {
      expenses: cleanExpenses,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser || 'unknown',
      saveId: saveId,
    }, { merge: true });
    console.log('[expenses] saveExpensesDirect: SUCCESS');
    return true;
  } catch (error) {
    console.error('[expenses] saveExpensesDirect: FAILED', error);
    return false;
  }
}

/**
 * useExpenses Hook
 * Manages expense data and operations.
 *
 * db and currentUser are passed directly so saves go straight to Firestore
 * with zero ref indirection.
 */
export const useExpenses = (db, currentUser, showToast) => {
  const [expenses, setExpenses] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(null);

  const addExpense = useCallback((expense) => {
    const newExpense = {
      ...expense,
      id: expense.id || Date.now().toString(),
      createdAt: expense.createdAt || new Date().toISOString(),
    };
    console.log('[expenses] addExpense called:', newExpense.description || newExpense.category);
    setExpenses(prev => {
      const updated = [...prev, newExpense];
      console.log('[expenses] addExpense: saving', updated.length, 'total expenses');
      saveExpensesDirect(db, updated, currentUser);
      return updated;
    });
    showToast('Expense recorded', 'success');
  }, [db, currentUser, showToast]);

  const updateExpense = useCallback((expenseId, updates) => {
    setExpenses(prev => {
      const updated = prev.map(e => e.id === expenseId ? { ...e, ...updates } : e);
      saveExpensesDirect(db, updated, currentUser);
      return updated;
    });
    showToast('Expense updated', 'success');
  }, [db, currentUser, showToast]);

  const deleteExpense = useCallback((expenseId) => {
    setExpenses(prev => {
      const updated = prev.filter(e => e.id !== expenseId);
      if (updated.length > 0) {
        saveExpensesDirect(db, updated, currentUser);
      }
      return updated;
    });
    showToast('Expense deleted', 'info');
  }, [db, currentUser, showToast]);

  return {
    expenses,
    showAddExpenseModal,
    addExpense,
    updateExpense,
    deleteExpense,
    setShowAddExpenseModal,
    setExpenses,
  };
};

export default useExpenses;
