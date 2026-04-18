import { useState, useCallback } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { sanitizeForFirestore } from './useExpenses';

/**
 * useRent Hook
 * Manages rent payment ledger data and operations
 * All CRUD uses functional state updates (prev =>) to avoid stale closure bugs.
 *
 * db is optional for bulk ops (runTransaction needs it); legacy single-entry
 * writes still go through saveRef.current.
 */
export const useRent = (currentUser, saveRef, showToast, db = null) => {

  const [rentPayments, setRentPayments] = useState([]);
  const [showAddRentModal, setShowAddRentModal] = useState(null);

  const addRentPayment = useCallback((payment) => {
    const newPayment = {
      ...payment,
      id: payment.id || Date.now().toString(),
      createdAt: payment.createdAt || new Date().toISOString(),
    };
    setRentPayments(prev => {
      const updated = [...prev, newPayment];
      saveRef.current(updated);
      return updated;
    });
    showToast('Rent payment recorded', 'success');
  }, [showToast]);

  const updateRentPayment = useCallback((paymentId, updates) => {
    setRentPayments(prev => {
      const updated = prev.map(r => r.id === paymentId ? { ...r, ...updates } : r);
      saveRef.current(updated);
      return updated;
    });
    showToast('Payment updated', 'success');
  }, [showToast]);

  const deleteRentPayment = useCallback((paymentId) => {
    setRentPayments(prev => {
      const updated = prev.filter(r => r.id !== paymentId);
      saveRef.current(updated);
      return updated;
    });
    showToast('Payment deleted', 'info');
  }, [showToast]);

  /** Atomic bulk delete. See bulkDeleteExpenses for the full rationale. */
  const bulkDeleteRentPayments = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: true, count: 0 };
    }
    if (!db) {
      console.error('[rent] bulkDeleteRentPayments: no db');
      return { ok: false, count: 0, error: 'no-db' };
    }
    const idSet = new Set(ids.map(String));
    const docRef = doc(db, 'rentalData', 'rent');
    try {
      const remaining = await runTransaction(db, async (t) => {
        const snap = await t.get(docRef);
        const existing = snap.exists() ? (snap.data().payments || []) : [];
        const next = existing.filter(r => !idSet.has(String(r.id)));
        t.set(docRef, {
          payments: sanitizeForFirestore(next),
          lastUpdated: new Date().toISOString(),
          updatedBy: currentUser || 'unknown',
          saveId: `${Date.now()}-bulk-del-${Math.random().toString(36).slice(2, 6)}`,
        }, { merge: true });
        return next;
      });
      setRentPayments(remaining);
      showToast(`${ids.length} payments deleted`, 'info');
      return { ok: true, count: ids.length };
    } catch (err) {
      console.error('[rent] bulkDeleteRentPayments: FAILED', err);
      showToast(`Failed to delete rent payments: ${err.message || 'unknown error'}`, 'error');
      return { ok: false, count: 0, error: err.message };
    }
  }, [db, currentUser, showToast]);

  /**
   * Add many rent payments in ONE atomic Firestore write via runTransaction.
   * Same reasoning as bulkAddExpenses — avoids React setState race AND the
   * Firestore per-doc write throttle.
   */
  const bulkAddRentPayments = useCallback(async (newPayments) => {
    if (!Array.isArray(newPayments) || newPayments.length === 0) {
      return { ok: true, count: 0 };
    }
    if (!db) {
      console.error('[rent] bulkAddRentPayments: no db instance (pass db to useRent)');
      showToast('Database not ready. Try again in a moment.', 'error');
      return { ok: false, count: 0, error: 'no-db' };
    }
    const stamped = newPayments.map((p, i) => ({
      ...p,
      id: p.id || `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: p.createdAt || new Date().toISOString(),
    }));
    const docRef = doc(db, 'rentalData', 'rent');
    try {
      const combined = await runTransaction(db, async (t) => {
        const snap = await t.get(docRef);
        const existing = snap.exists() ? (snap.data().payments || []) : [];
        const next = [...existing, ...stamped];
        t.set(docRef, {
          payments: sanitizeForFirestore(next),
          lastUpdated: new Date().toISOString(),
          updatedBy: currentUser || 'unknown',
          saveId: `${Date.now()}-bulk-${Math.random().toString(36).slice(2, 6)}`,
        }, { merge: true });
        return next;
      });
      setRentPayments(combined);
      return { ok: true, count: stamped.length };
    } catch (err) {
      console.error('[rent] bulkAddRentPayments: transaction FAILED', err);
      showToast(`Failed to save ${stamped.length} rent payments: ${err.message || 'unknown error'}`, 'error');
      return { ok: false, count: 0, error: err.message };
    }
  }, [db, currentUser, showToast]);

  return {
    rentPayments,
    showAddRentModal,
    addRentPayment,
    updateRentPayment,
    deleteRentPayment,
    bulkDeleteRentPayments,
    bulkAddRentPayments,
    setShowAddRentModal,
    setRentPayments,
  };
};

export default useRent;
