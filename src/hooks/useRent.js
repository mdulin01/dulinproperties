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

  return {
    rentPayments,
    showAddRentModal,
    addRentPayment,
    updateRentPayment,
    deleteRentPayment,
    setShowAddRentModal,
    setRentPayments,
  };
};

export default useRent;
