import { useState, useCallback } from 'react';

/**
 * useRent Hook
 * Manages rent payment ledger data and operations
 * All CRUD uses functional state updates (prev =>) to avoid stale closure bugs.
 */
export const useRent = (currentUser, saveRef, showToast) => {

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

  const bulkDeleteRentPayments = useCallback((ids) => {
    const idSet = new Set(ids);
    setRentPayments(prev => {
      const updated = prev.filter(r => !idSet.has(r.id));
      saveRef.current(updated);
      return updated;
    });
    showToast(`${ids.length} payments deleted`, 'info');
  }, [showToast]);

  /**
   * Add many rent payments at once with ONE Firestore write. Same reasoning as
   * bulkAddExpenses — rapid per-entry writes get throttled by Firestore's
   * 1 write/sec/doc limit and silently fail.
   * saveRef.current is the app's saveRentToFirestore; it should return a promise.
   */
  const bulkAddRentPayments = useCallback(async (newPayments) => {
    if (!Array.isArray(newPayments) || newPayments.length === 0) {
      return { ok: true, count: 0 };
    }
    const stamped = newPayments.map((p, i) => ({
      ...p,
      id: p.id || `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: p.createdAt || new Date().toISOString(),
    }));
    let snapshot = null;
    setRentPayments(prev => { snapshot = prev; return prev; });
    const updated = [...(snapshot || []), ...stamped];
    try {
      const maybe = saveRef.current ? saveRef.current(updated) : null;
      if (maybe && typeof maybe.then === 'function') await maybe;
      setRentPayments(updated);
      return { ok: true, count: stamped.length };
    } catch (err) {
      console.error('[rent] bulkAddRentPayments: save FAILED', err);
      showToast(`Failed to save ${stamped.length} rent payments`, 'error');
      return { ok: false, count: 0, error: err?.message };
    }
  }, [showToast]);

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
