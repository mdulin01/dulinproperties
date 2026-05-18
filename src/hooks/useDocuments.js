import { useState, useCallback } from 'react';

/**
 * useDocuments Hook
 * Manages all Documents data and operations
 * All CRUD uses functional state updates (prev =>) to avoid stale closure bugs.
 */
export const useDocuments = (currentUser, saveRef, showToast) => {

  const [documents, setDocuments] = useState([]);
  const [documentViewMode, setDocumentViewMode] = useState('byType');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [documentPropertyFilter, setDocumentPropertyFilter] = useState('all');
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(null);

  const addDocument = useCallback((doc) => {
    setDocuments(prev => {
      const newDocs = [...prev, doc];
      saveRef.current(newDocs);
      return newDocs;
    });
    showToast('Document added', 'success');
  }, [showToast]);

  const updateDocument = useCallback((docId, updates) => {
    setDocuments(prev => {
      const newDocs = prev.map(d => d.id === docId ? { ...d, ...updates } : d);
      saveRef.current(newDocs);
      return newDocs;
    });
  }, []);

  const deleteDocument = useCallback((docId) => {
    setDocuments(prev => {
      const newDocs = prev.filter(d => d.id !== docId);
      saveRef.current(newDocs);
      return newDocs;
    });
    showToast('Document removed', 'info');
  }, [showToast]);

  return {
    documents,
    documentViewMode,
    documentTypeFilter,
    documentPropertyFilter,
    showAddDocumentModal,
    addDocument,
    updateDocument,
    deleteDocument,
    setDocumentViewMode,
    setDocumentTypeFilter,
    setDocumentPropertyFilter,
    setShowAddDocumentModal,
    setDocuments,
    showToast,
  };
};

export default useDocuments;
