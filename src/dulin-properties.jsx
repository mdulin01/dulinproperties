import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, LogOut, User, Loader, MoreVertical, ChevronDown, Edit3, Trash2, Eye, DollarSign, MapPin, Calendar, FileText, CheckSquare, Upload } from 'lucide-react';

// Constants and utilities
import {
  ownerEmails, ownerDisplayNames, propertyTypes, propertyColors, documentTypes,
  expenseCategories, incomeCategories, taskPriorities, timeHorizons,
  listCategories, ideaCategories, tenantStatuses, rentStatuses
} from './constants';
import {
  formatDate, formatCurrency, validateFileSize, isHeicFile, getSafeFileName,
  isTaskDueToday, isTaskDueThisWeek, taskMatchesHorizon, getDaysUntil, getLeaseStatus
} from './utils';

// Components
import LoginScreen from './components/LoginScreen';
import ConfirmDialog from './components/ConfirmDialog';

// Hub components (tasks still used on Dashboard)
import AddTaskModal from './components/SharedHub/AddTaskModal';
import SharedListModal from './components/SharedHub/SharedListModal';
import AddIdeaModal from './components/SharedHub/AddIdeaModal';
import TaskCard from './components/SharedHub/TaskCard';
import ListCard from './components/SharedHub/ListCard';
import IdeaCard from './components/SharedHub/IdeaCard';

// Rentals components
import PropertyCard from './components/Rentals/PropertyCard';
import NewPropertyModal from './components/Rentals/NewPropertyModal';
import PropertySeedImport from './components/Rentals/PropertySeedImport';
import PropertyDetail from './components/Rentals/PropertyDetail';
import PropertyFinancialBreakdownModal from './components/Rentals/PropertyFinancialBreakdownModal';
import TenantModal from './components/Rentals/TenantModal';

// Tenants components
import TenantsList from './components/Tenants/TenantsList';

// Rent components
import RentLedger from './components/Rent/RentLedger';
import AddRentPaymentModal from './components/Rent/AddRentPaymentModal';

// Expenses components
import ExpensesList from './components/Expenses/ExpensesList';
import AddExpenseModal from './components/Expenses/AddExpenseModal';
import ExpenseReportUpload from './components/Expenses/ExpenseReportUpload';

// Documents components
import DocumentCard from './components/Documents/DocumentCard';
import AddDocumentModal from './components/Documents/AddDocumentModal';
import DocumentViewer from './components/Documents/DocumentViewer';

// Financials components (kept for backward compat)
import TransactionCard from './components/Financials/TransactionCard';
import AddTransactionModal from './components/Financials/AddTransactionModal';
import FinancialSummary from './components/Financials/FinancialSummary';

// Hooks
import { useSharedHub } from './hooks/useSharedHub';
import { useProperties, getPropertyTenants } from './hooks/useProperties';
import { useDocuments } from './hooks/useDocuments';
import { useFinancials } from './hooks/useFinancials';
import { useRent } from './hooks/useRent';
import { useExpenses, autoCreateRecurringExpenses, sanitizeForFirestore } from './hooks/useExpenses';

// Contexts
import { SharedHubProvider } from './contexts/SharedHubContext';
import BuildInfo from './components/BuildInfo';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import heic2any from 'heic2any';

// Import Firebase config
import { firebaseConfig } from './firebase-config';
import logger from './logger';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Accent bar
const AccentBar = () => (
  <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-sky-500 to-teal-500" />
);


export default function DulinProperties() {
  // ========== AUTH STATE ==========
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    if (!isMountedRef.current) return;
    setToast({ message, type });
    setTimeout(() => { if (isMountedRef.current) setToast(null); }, 4000);
  }, []);

  // ========== NAVIGATION ==========
  const [activeSection, setActiveSection] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState('Mike');
  const [isOwner, setIsOwner] = useState(false);
  const [showAddNewMenu, setShowAddNewMenu] = useState(false);
  const [showMobileSectionDropdown, setShowMobileSectionDropdown] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ========== HOOK REFS ==========
  const saveSharedHubRef = useRef(() => {});
  const savePropertiesRef = useRef(() => {});
  const saveDocumentsRef = useRef(() => {});
  const saveFinancialsRef = useRef(() => {});
  const saveRentRef = useRef(() => {});
  const expensesSaveIdRef = useRef(null); // Track our own saves to avoid onSnapshot overwrite

  // ========== HOOKS ==========
  const sharedHub = useSharedHub(currentUser, saveSharedHubRef, showToast);
  const {
    sharedTasks, sharedLists, sharedIdeas,
    addTask, updateTask, deleteTask, completeTask, highlightTask,
    addList, updateList, deleteList, addListItem, toggleListItem, deleteListItem, highlightList,
    addIdea, updateIdea, deleteIdea, highlightIdea,
    hubSubView, setHubSubView, hubTaskFilter, setHubTaskFilter, hubTaskSort, setHubTaskSort,
    hubListFilter, setHubListFilter, hubIdeaFilter, setHubIdeaFilter, hubIdeaStatusFilter, setHubIdeaStatusFilter,
    collapsedSections, toggleDashSection,
    setSharedTasks, setSharedLists, setSharedIdeas,
    showAddTaskModal, setShowAddTaskModal,
    showSharedListModal, setShowSharedListModal,
    showAddIdeaModal, setShowAddIdeaModal,
  } = sharedHub;

  const propertiesHook = useProperties(currentUser, savePropertiesRef, showToast);
  const {
    properties, setProperties,
    selectedProperty, setSelectedProperty,
    propertyViewMode, setPropertyViewMode,
    showNewPropertyModal, setShowNewPropertyModal,
    showTenantModal, setShowTenantModal,
    addProperty, bulkAddProperties, updateProperty, deleteProperty, addOrUpdateTenant, removeTenant,
  } = propertiesHook;

  const documentsHook = useDocuments(currentUser, saveDocumentsRef, showToast);
  const {
    documents, setDocuments,
    documentViewMode, setDocumentViewMode,
    documentTypeFilter, setDocumentTypeFilter,
    documentPropertyFilter, setDocumentPropertyFilter,
    showAddDocumentModal, setShowAddDocumentModal,
    addDocument, updateDocument, deleteDocument,
  } = documentsHook;

  const financialsHook = useFinancials(currentUser, saveFinancialsRef, showToast);
  const {
    transactions, setTransactions,
    financialViewMode, setFinancialViewMode,
    transactionTypeFilter, setTransactionTypeFilter,
    transactionPropertyFilter, setTransactionPropertyFilter,
    showAddTransactionModal, setShowAddTransactionModal,
    addTransaction, updateTransaction, deleteTransaction,
    getTotalIncome, getTotalExpenses, getProfit, getMonthlyBreakdown, getPropertyBreakdown, getFilteredTransactions,
  } = financialsHook;

  const rentHook = useRent(currentUser, saveRentRef, showToast);
  const {
    rentPayments, setRentPayments,
    showAddRentModal, setShowAddRentModal,
    addRentPayment, updateRentPayment, deleteRentPayment, bulkDeleteRentPayments,
  } = rentHook;

  // Pass db directly — hook saves to Firestore internally, no ref indirection
  const expensesHook = useExpenses(db, currentUser, showToast);
  const {
    expenses, setExpenses,
    showAddExpenseModal, setShowAddExpenseModal,
    addExpense, updateExpense, deleteExpense, bulkDeleteExpenses,
  } = expensesHook;

  // Property financial breakdown modal
  const [showPropertyBreakdown, setShowPropertyBreakdown] = useState(false);
  const [propertySortBy, setPropertySortBy] = useState('none');

  // Expense report upload modal
  const [showExpenseReportUpload, setShowExpenseReportUpload] = useState(false);
  const [showPropertyImport, setShowPropertyImport] = useState(false);

  // Document viewer
  const [viewingDocument, setViewingDocument] = useState(null);

  // ========== AUTH ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMountedRef.current) return;
      if (firebaseUser) {
        setUser(firebaseUser);
        const userEmail = firebaseUser.email?.toLowerCase();
        const isOwnerUser = ownerEmails.some(email => userEmail === email);
        setIsOwner(isOwnerUser);
        if (isOwnerUser) {
          const localPart = userEmail?.split('@')[0];
          const displayName = ownerDisplayNames[localPart] || firebaseUser.displayName || 'User';
          setCurrentUser(displayName);
        }
      } else {
        setUser(null);
        setIsOwner(false);
      }
      if (isMountedRef.current) setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showToast('Login failed. Please try again.', 'error');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      showToast('Logout failed', 'error');
    }
  };

  // ========== FIRESTORE SAVE FUNCTIONS ==========
  const hubDataLoadedRef = useRef(false);

  const saveSharedHub = useCallback(async (newLists, newTasks, newIdeas) => {
    if (!user) { logger.warn('[hub] save skipped: no user'); return; }
    if (!hubDataLoadedRef.current) { logger.warn('[hub] save skipped: data not loaded yet'); return; }
    try {
      const updates = { lastUpdated: new Date().toISOString(), updatedBy: currentUser };
      if (newLists !== null && newLists !== undefined) updates.lists = sanitizeForFirestore(newLists);
      if (newTasks !== null && newTasks !== undefined) updates.tasks = sanitizeForFirestore(newTasks);
      if (newIdeas !== null && newIdeas !== undefined) updates.ideas = sanitizeForFirestore(newIdeas);
      await setDoc(doc(db, 'rentalData', 'sharedHub'), updates, { merge: true });
      logger.log('[hub] save SUCCESS');
    } catch (error) {
      logger.error('[hub] save FAILED:', error);
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveSharedHubRef.current = saveSharedHub; }, [saveSharedHub]);

  const savePropertiesToFirestore = useCallback(async (newProperties) => {
    if (!user) { logger.warn('[properties] save skipped: no user'); return; }
    try {
      const clean = sanitizeForFirestore(newProperties);
      logger.log('[properties] saving', clean.length, 'properties to Firestore');
      await setDoc(doc(db, 'rentalData', 'properties'), {
        properties: clean,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
      logger.log('[properties] save SUCCESS');
    } catch (error) {
      logger.error('[properties] save FAILED:', error);
      showToast('Failed to save property data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { savePropertiesRef.current = savePropertiesToFirestore; }, [savePropertiesToFirestore]);

  const saveDocumentsToFirestore = useCallback(async (newDocuments) => {
    if (!user) { logger.warn('[documents] save skipped: no user'); return; }
    try {
      const clean = sanitizeForFirestore(newDocuments);
      logger.log('[documents] saving', clean.length, 'documents to Firestore');
      await setDoc(doc(db, 'rentalData', 'documents'), {
        documents: clean,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
      logger.log('[documents] save SUCCESS');
    } catch (error) {
      logger.error('[documents] save FAILED:', error);
      showToast('Failed to save document data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveDocumentsRef.current = saveDocumentsToFirestore; }, [saveDocumentsToFirestore]);

  const saveFinancialsToFirestore = useCallback(async (newTransactions) => {
    if (!user) { logger.warn('[financials] save skipped: no user'); return; }
    try {
      const clean = sanitizeForFirestore(newTransactions);
      logger.log('[financials] saving', clean.length, 'transactions to Firestore');
      await setDoc(doc(db, 'rentalData', 'financials'), {
        transactions: clean,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
      logger.log('[financials] save SUCCESS');
    } catch (error) {
      logger.error('[financials] save FAILED:', error);
      showToast('Failed to save financial data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveFinancialsRef.current = saveFinancialsToFirestore; }, [saveFinancialsToFirestore]);

  const saveRentToFirestore = useCallback(async (newRentPayments) => {
    if (!user) { logger.warn('[rent] save skipped: no user'); return; }
    try {
      const clean = sanitizeForFirestore(newRentPayments);
      logger.log('[rent] saving', clean.length, 'payments to Firestore');
      await setDoc(doc(db, 'rentalData', 'rent'), {
        payments: clean,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
      logger.log('[rent] save SUCCESS');
    } catch (error) {
      logger.error('[rent] save FAILED:', error);
      showToast('Failed to save rent data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveRentRef.current = saveRentToFirestore; }, [saveRentToFirestore]);

  // NOTE: Expense saving is now handled directly inside the useExpenses hook.
  // No more saveExpensesRef indirection — the hook calls setDoc internally.

  // ========== FIRESTORE LOAD (onSnapshot) ==========
  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    // Subscribe to shared hub
    const hubUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'sharedHub'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.tasks) setSharedTasks(data.tasks);
          if (data.lists) setSharedLists(data.lists);
          if (data.ideas) setSharedIdeas(data.ideas);
        }
        hubDataLoadedRef.current = true;
        setDataLoading(false);
      },
      (error) => {
        logger.error('Error loading hub data:', error);
        setDataLoading(false);
      }
    );

    // Subscribe to properties
    const propertiesUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'properties'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.properties) setProperties(data.properties);
        }
      },
      (error) => logger.error('Error loading properties:', error)
    );

    // Subscribe to documents
    const documentsUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'documents'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.documents) setDocuments(data.documents);
        }
      },
      (error) => logger.error('Error loading documents:', error)
    );

    // Subscribe to financials
    const financialsUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'financials'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.transactions) setTransactions(data.transactions);
        }
      },
      (error) => logger.error('Error loading financials:', error)
    );

    // Subscribe to rent payments
    const rentUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'rent'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.payments) setRentPayments(data.payments);
        }
      },
      (error) => logger.error('Error loading rent data:', error)
    );

    // Subscribe to expenses
    const expensesUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'expenses'),
      (docSnap) => {
        logger.log('[expenses] onSnapshot fired, exists:', docSnap.exists());
        if (docSnap.exists()) {
          const data = docSnap.data();
          logger.log('[expenses] onSnapshot data: saveId=', data.saveId, 'expenses count=', data.expenses?.length || 0);
          // If this snapshot was triggered by our own save, skip to avoid overwriting local state
          if (data.saveId && data.saveId === expensesSaveIdRef.current) {
            logger.log('[expenses] Skipping onSnapshot from our own save');
            return;
          }
          if (data.expenses && data.expenses.length > 0) {
            logger.log('[expenses] onSnapshot: applying', data.expenses.length, 'expenses to state');
            // Auto-reclassify owner distributions (one-time migration)
            let needsSave = false;
            const migrated = data.expenses.map(e => {
              if (e.category === 'other' && (e.description || '').toLowerCase().includes('echeck') &&
                  (e.vendor || e.description || '').toLowerCase().includes('dianne dulin')) {
                needsSave = true;
                return { ...e, category: 'owner-distribution' };
              }
              return e;
            });
            if (needsSave) {
              logger.log('[expenses] Auto-reclassifying eCheck entries as owner-distribution');
              setExpenses(migrated);
              // Save migrated data back
              setDoc(doc(db, 'rentalData', 'expenses'), { expenses: migrated, lastUpdated: new Date().toISOString(), updatedBy: 'migration' }, { merge: true });
            } else {
              setExpenses(data.expenses);
            }
          } else {
            logger.warn('[expenses] onSnapshot: document exists but expenses is empty/missing');
          }
        } else {
          logger.warn('[expenses] onSnapshot: document does NOT exist in Firestore!');
        }
      },
      (error) => logger.error('[expenses] onSnapshot ERROR:', error)
    );

    return () => {
      hubUnsubscribe();
      propertiesUnsubscribe();
      documentsUnsubscribe();
      financialsUnsubscribe();
      rentUnsubscribe();
      expensesUnsubscribe();
    };
  }, [user]);

  // ========== AUTO-CREATE RECURRING EXPENSES ==========
  // Uses a Firestore TRANSACTION to atomically read-modify-write.
  // This eliminates the race condition where onSnapshot + setState + async save
  // could overwrite each other and lose data.
  const autoCreateDoneRef = useRef(false);
  useEffect(() => {
    if (!user || expenses.length === 0 || autoCreateDoneRef.current) return;
    const timer = setTimeout(async () => {
      if (autoCreateDoneRef.current) return;
      autoCreateDoneRef.current = true;

      try {
        const expensesDocRef = doc(db, 'rentalData', 'expenses');
        await runTransaction(db, async (transaction) => {
          // Read the ACTUAL Firestore data (not React state — avoids stale closures)
          const docSnap = await transaction.get(expensesDocRef);
          const data = docSnap.exists() ? docSnap.data() : {};
          const firestoreExpenses = data.expenses || [];

          logger.log('[expenses] Auto-creation: read', firestoreExpenses.length, 'expenses from Firestore');

          const newExpenses = autoCreateRecurringExpenses(firestoreExpenses);
          if (newExpenses.length === 0) {
            logger.log('[expenses] Auto-creation: no new expenses needed');
            return; // Nothing to do — transaction aborts cleanly
          }

          const updated = [...firestoreExpenses, ...newExpenses];
          const saveId = `${Date.now()}-auto`;
          expensesSaveIdRef.current = saveId;

          logger.log('[expenses] Auto-creation: writing', updated.length, 'expenses (added', newExpenses.length, ')');

          const cleanUpdated = sanitizeForFirestore(updated);
          transaction.set(expensesDocRef, {
            expenses: cleanUpdated,
            lastUpdated: new Date().toISOString(),
            updatedBy: currentUser || 'unknown',
            saveId: saveId,
          }, { merge: true });

          // Update local state AFTER the transaction succeeds
          setExpenses(cleanUpdated);
          showToast(`Auto-created ${newExpenses.length} recurring expense(s)`, 'success');
        });
      } catch (error) {
        logger.error('[expenses] Auto-creation transaction FAILED:', error);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, expenses.length > 0]);

  // ========== ONE-TIME DATA FIX (Jan 2026 statement reconciliation) ==========
  // Fixes: orphaned rent records, Taos/Pueblo mixup, missing late fees, 5490 Questa monthlyRent
  // TODO: Remove this block after it has run once successfully
  const janFixDoneRef = useRef(false);
  useEffect(() => {
    if (!user || properties.length === 0 || rentPayments.length === 0 || janFixDoneRef.current) return;
    const timer = setTimeout(async () => {
      if (janFixDoneRef.current) return;
      janFixDoneRef.current = true;

      try {
        logger.log('[migration] Starting Jan 2026 statement reconciliation...');

        const propByName = {};
        properties.forEach(p => {
          propByName[p.name.toLowerCase().trim()] = p;
          if (p.street) propByName[p.street.toLowerCase().trim()] = p;
        });

        const findProp = (search) => {
          const s = search.toLowerCase().trim();
          return properties.find(p =>
            p.name.toLowerCase().includes(s) ||
            (p.street && p.street.toLowerCase().includes(s))
          );
        };

        // FIX 1: Set monthlyRent on 5490 Questa
        const questa5490 = findProp('5490 questa');
        let propertiesChanged = false;
        const updatedProperties = properties.map(p => {
          if (questa5490 && String(p.id) === String(questa5490.id) && (!p.monthlyRent || parseFloat(p.monthlyRent) === 0)) {
            propertiesChanged = true;
            logger.log('[migration] Setting 5490 Questa monthlyRent to 900');
            return { ...p, monthlyRent: '900' };
          }
          return p;
        });

        const s11thB = updatedProperties.find(p => p.name && p.name.toLowerCase().includes('1329') && p.name.toLowerCase().includes('b'));
        if (s11thB && (!s11thB.monthlyRent || parseFloat(s11thB.monthlyRent) === 0)) {
          const idx = updatedProperties.findIndex(p => String(p.id) === String(s11thB.id));
          if (idx >= 0) {
            propertiesChanged = true;
            logger.log('[migration] Setting 1329 S 11th St B monthlyRent to 725');
            updatedProperties[idx] = { ...updatedProperties[idx], monthlyRent: '725' };
          }
        }

        if (propertiesChanged) {
          setProperties(updatedProperties);
          savePropertiesRef.current(updatedProperties);
        }

        // FIX 2: Relink orphaned rent records
        const encino5102 = findProp('5102 encino');
        const encino5220 = findProp('5220 encino');
        const taos = findProp('5297 taos');
        const pueblo5297 = findProp('5297 pueblo');

        const svProps = properties.filter(p => p.name.toLowerCase().includes('sunset villa') || p.name.toLowerCase().includes('ruidosa'));
        const sv215 = svProps.find(p => p.name.includes('215') || (p.street && p.street.includes('215')));
        const sv220 = svProps.find(p => p.name.includes('220') || (p.street && p.street.includes('220')));
        const sv106 = svProps.find(p => p.name.includes('106') || (p.street && p.street.includes('106')));

        let rentChanged = false;
        const updatedRent = rentPayments.map(r => {
          const tenant = (r.tenantName || '').toLowerCase();
          const amount = parseFloat(r.amount) || 0;
          const hasProperty = r.propertyId && r.propertyId !== '' && r.propertyId !== 'undefined';

          if (tenant.includes('renate evans') && !hasProperty && encino5102) {
            rentChanged = true;
            return { ...r, propertyId: String(encino5102.id), propertyName: encino5102.name };
          }
          if (tenant.includes('estela contreras') && !hasProperty && encino5220) {
            rentChanged = true;
            return { ...r, propertyId: String(encino5220.id), propertyName: encino5220.name };
          }
          if ((tenant.includes('alika') || tenant.includes('d2a7') || tenant.includes('alexander')) && !hasProperty && sv215) {
            rentChanged = true;
            return { ...r, propertyId: String(sv215.id), propertyName: sv215.name };
          }
          if (!hasProperty && !tenant && sv215 && (r.datePaid || '').startsWith('2026-01') &&
              ((amount === 320 && (r.datePaid || '').includes('01-08')) ||
               (amount === 400 && (r.datePaid || '').includes('01-14')))) {
            rentChanged = true;
            return { ...r, propertyId: String(sv215.id), propertyName: sv215.name, tenantName: r.tenantName || 'Alika K. Alexander' };
          }
          if (tenant.includes('patrick roach') && !hasProperty && sv220) {
            rentChanged = true;
            return { ...r, propertyId: String(sv220.id), propertyName: sv220.name };
          }
          if (tenant.includes('dan inguanzo') && !hasProperty && sv106) {
            rentChanged = true;
            return { ...r, propertyId: String(sv106.id), propertyName: sv106.name };
          }

          // FIX 3a: Byron Plummer 1329 A -> B
          const s11thA = properties.find(p => p.name && p.name.toLowerCase().includes('1329') && p.name.toLowerCase().includes(' a'));
          const s11thBProp = properties.find(p => p.name && p.name.toLowerCase().includes('1329') && p.name.toLowerCase().includes(' b'));
          if (tenant.includes('byron') && s11thA && s11thBProp && String(r.propertyId) === String(s11thA.id)) {
            rentChanged = true;
            return { ...r, propertyId: String(s11thBProp.id), propertyName: s11thBProp.name };
          }

          // FIX 3b: Linda Gray Pueblo -> Taos
          if (tenant.includes('linda gray') && taos && pueblo5297 && String(r.propertyId) === String(pueblo5297.id)) {
            rentChanged = true;
            return { ...r, propertyId: String(taos.id), propertyName: taos.name };
          }

          // FIX 4: $5 -> $10 late fee 5350 Pueblo
          const pueblo5350 = findProp('5350 pueblo');
          if (pueblo5350 && String(r.propertyId) === String(pueblo5350.id) && amount === 5 && (r.datePaid || '').startsWith('2026-01-06')) {
            rentChanged = true;
            return { ...r, amount: '10', notes: (r.notes || '') + ' [Fixed: was $5, corrected to $10 per-day late fee per statement]' };
          }

          return r;
        });

        // FIX 5: Add missing $160 late fee for Ruidosa #215
        const has160Fee = updatedRent.some(r => sv215 && String(r.propertyId) === String(sv215.id) && parseFloat(r.amount) === 160 && (r.datePaid || '').startsWith('2026-01-21'));
        if (!has160Fee && sv215) {
          rentChanged = true;
          updatedRent.push({
            id: 'migration-ruidosa215-latefee-' + Date.now(), propertyId: String(sv215.id), propertyName: sv215.name,
            tenantName: 'Alika K. Alexander', amount: '160', datePaid: '2026-01-21', month: '2026-01',
            status: 'paid', notes: 'Per-day late fee ($10/day, 01/06-01/21). Added from statement reconciliation.', createdAt: new Date().toISOString(),
          });
        }

        if (rentChanged) { setRentPayments(updatedRent); saveRentRef.current(updatedRent); }
        logger.log('[migration] Jan 2026 reconciliation complete. Properties changed:', propertiesChanged, 'Rent changed:', rentChanged);
      } catch (error) {
        logger.error('[migration] Jan 2026 reconciliation FAILED:', error);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, properties.length > 0, rentPayments.length > 0]);

  // ========== PHOTO UPLOAD HELPER ==========
  const uploadPhoto = async (file, prefix = 'rentals') => {
    let fileToUpload = file;
    let fileName = file.name || 'photo.jpg';

    if (isHeicFile(file)) {
      const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      fileToUpload = new File([convertedBlob], fileName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
      fileName = fileToUpload.name;
    }

    const timestamp = Date.now();
    const safeName = getSafeFileName(fileName);
    const storageRef = ref(storage, `${prefix}/${timestamp}_${safeName}`);
    await uploadBytes(storageRef, fileToUpload);
    return await getDownloadURL(storageRef);
  };

  // ========== PROPERTY PHOTO UPLOAD ==========
  const [uploadingPropertyPhoto, setUploadingPropertyPhoto] = useState(null);

  const handlePropertyPhotoUpload = async (propertyId, file) => {
    if (!file) return;
    const sizeError = validateFileSize(file);
    if (sizeError) { showToast(sizeError, 'error'); return; }

    setUploadingPropertyPhoto(propertyId);
    try {
      const url = await uploadPhoto(file, 'rentals/properties');
      // Use updateProperty with functional update - it will work with latest state
      // No need to find property from stale closure
      updateProperty(propertyId, (currentProperty) => ({
        photos: [...(currentProperty.photos || []), { id: Date.now(), url, addedAt: new Date().toISOString() }],
      }));
      showToast('Photo added!', 'success');
    } catch (error) {
      logger.error('Property photo upload failed:', error);
      showToast('Photo upload failed', 'error');
    } finally {
      setUploadingPropertyPhoto(null);
    }
  };

  // ========== DOCUMENT FILE UPLOAD ==========
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const handleDocumentFileUpload = async (file, docData) => {
    if (!file) return null;
    const sizeError = validateFileSize(file);
    if (sizeError) { showToast(sizeError, 'error'); return null; }

    setUploadingDocument(true);
    try {
      const url = await uploadPhoto(file, 'rentals/documents');
      return url;
    } catch (error) {
      logger.error('Document upload failed:', error);
      showToast('File upload failed', 'error');
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  // ========== PROMOTE IDEA TO TASK ==========
  const promoteIdeaToTask = (idea) => {
    setShowAddIdeaModal(null);
    setShowAddTaskModal({
      title: idea.title,
      description: idea.description || '',
      linkedTo: { section: 'idea', itemId: idea.id },
      _prefill: true,
    });
    updateIdea(idea.id, { status: 'planned' });
  };

  // ========== SEARCH ==========
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];

    sharedTasks.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'task', item: t, section: 'home' }));
    sharedLists.filter(l => l.title?.toLowerCase().includes(q))
      .forEach(l => results.push({ type: 'list', item: l, section: 'home' }));
    sharedIdeas.filter(i => i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
      .forEach(i => results.push({ type: 'idea', item: i, section: 'home' }));
    properties.filter(p => p.name?.toLowerCase().includes(q) || p.address?.street?.toLowerCase().includes(q) || getPropertyTenants(p).some(t => t.name?.toLowerCase().includes(q)))
      .forEach(p => results.push({ type: 'property', item: p, section: 'rentals' }));
    documents.filter(d => d.title?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q))
      .forEach(d => results.push({ type: 'document', item: d, section: 'documents' }));
    transactions.filter(t => t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'transaction', item: t, section: 'financials' }));
    rentPayments.filter(r => (r.tenantName || '').toLowerCase().includes(q) || (r.propertyName || '').toLowerCase().includes(q) || (r.month || '').includes(q))
      .forEach(r => results.push({ type: 'rent', item: r, section: 'rent' }));
    expenses.filter(e => (e.description || '').toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q) || (e.propertyName || '').toLowerCase().includes(q))
      .forEach(e => results.push({ type: 'expense', item: e, section: 'expenses' }));

    return results;
  };

  // ========== HELPER: Get property name by ID ==========
  const getPropertyName = (propertyId) => {
    if (!propertyId) return null;
    const prop = properties.find(p => String(p.id) === String(propertyId));
    return prop ? prop.name : null;
  };

  // ========== RENDER ==========

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleGoogleLogin} loading={false} />;
  }

  // Check if any modal is open (to hide nav)
  const anyModalOpen = showAddTaskModal || showSharedListModal || showAddIdeaModal ||
    showNewPropertyModal || showTenantModal || showAddDocumentModal || showAddTransactionModal ||
    showAddRentModal || showAddExpenseModal || viewingDocument || selectedProperty;

  // Mobile section dropdown
  const allSections = [
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'rentals', label: 'Properties', emoji: '🏠' },
    { id: 'tenants', label: 'Tenants', emoji: '👤' },
    { id: 'rent', label: 'Rent', emoji: '💰' },
    { id: 'expenses', label: 'Expenses', emoji: '💸' },
    { id: 'documents', label: 'Documents', emoji: '📄' },
  ];
  const activeSectionInfo = allSections.find(s => s.id === activeSection) || allSections[0];

  // Filter tasks for Hub dashboard
  const pendingTasks = sharedTasks.filter(t => t.status !== 'done');
  const todayTasks = pendingTasks.filter(isTaskDueToday);
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate < today;
  });

  // Filter properties by status - use propertyStatus if set, otherwise derive from tenant
  const getEffectiveStatus = (p) => p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant');
  // "owner-occupied" counts as occupied/rented for dashboard purposes
  const isOccupiedStatus = (s) => ['occupied', 'owner-occupied', 'lease-expired', 'month-to-month'].includes(s);
  const vacantProperties = properties.filter(p => getEffectiveStatus(p) === 'vacant');
  const renovationProperties = properties.filter(p => getEffectiveStatus(p) === 'renovation');
  const notCollectingRent = properties.filter(p => ['vacant', 'renovation'].includes(getEffectiveStatus(p)));
  const activeProperties = properties.filter(p => ['occupied', 'owner-occupied'].includes(getEffectiveStatus(p)));
  const leaseExpiredProperties = properties.filter(p => getEffectiveStatus(p) === 'lease-expired');
  const monthToMonthProperties = properties.filter(p => getEffectiveStatus(p) === 'month-to-month');

  // Properties with expiring leases (within 60 days, not already expired)
  const expiringLeases = properties.filter(p => {
    const tenants = getPropertyTenants(p);
    if (tenants.length === 0) return false;
    // Check if any tenant has a lease ending within 60 days
    return tenants.some(t => {
      if (!t.leaseEnd) return false;
      const end = new Date(t.leaseEnd + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 60;
    });
  });

  return (
    <SharedHubProvider value={sharedHub}>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
        <AccentBar />

        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile: section name with dropdown */}
              <div className="md:hidden relative">
                <button
                  onClick={() => setShowMobileSectionDropdown(!showMobileSectionDropdown)}
                  className="flex items-center gap-2 px-1 py-1 rounded-lg transition active:scale-95"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-sky-500 rounded-lg flex items-center justify-center shadow-lg">
                    <span className="text-xs font-bold text-white">DP</span>
                  </div>
                  <span className="text-lg font-bold text-white">{activeSectionInfo.emoji} {activeSectionInfo.label}</span>
                  <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${showMobileSectionDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showMobileSectionDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMobileSectionDropdown(false)} />
                    <div className="absolute top-full left-0 mt-2 z-50 bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl min-w-[180px] py-1"
                      style={{ animation: 'dropdownIn 0.15s ease-out both' }}>
                      {allSections.map(section => (
                        <button
                          key={section.id}
                          onClick={() => {
                            setActiveSection(section.id);
                            if (section.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                            setShowMobileSectionDropdown(false);
                            setShowAddNewMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                            activeSection === section.id ? 'bg-white/10 text-white font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="text-base">{section.emoji}</span>
                          <span>{section.label}</span>
                        </button>
                      ))}
                    </div>
                    <style>{`@keyframes dropdownIn { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
                  </>
                )}
              </div>
              {/* Desktop: logo + title */}
              <div className="hidden md:flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-sky-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-white">DP</span>
                </div>
                <h1 className="text-lg font-bold text-white leading-tight">Dulin Properties</h1>
              </div>
              {/* Desktop nav tabs */}
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {[
                  { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
                  { id: 'rentals', label: 'Properties', emoji: '🏠' },
                  { id: 'tenants', label: 'Tenants', emoji: '👤' },
                  { id: 'rent', label: 'Rents', emoji: '💰' },
                  { id: 'expenses', label: 'Expenses', emoji: '💸' },
                  { id: 'documents', label: 'Documents', emoji: '📄' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveSection(tab.id);
                      if (tab.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                      setShowAddNewMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                      activeSection === tab.id
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="mr-1.5">{tab.emoji}</span>{tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <Search className="w-4 h-4 text-white/60" />
              </button>
              <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <LogOut className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="px-4 pb-3">
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                autoFocus
              />
              {searchQuery && (
                <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                  {getSearchResults().map((result, i) => (
                    <button key={i} onClick={() => {
                      setActiveSection(result.section);
                      setShowSearch(false);
                      setSearchQuery('');
                      if (result.type === 'property') setSelectedProperty(result.item);
                      if (result.type === 'document') setViewingDocument(result.item);
                      if (result.type === 'task') setShowAddTaskModal(result.item);
                    }} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                      <span className="text-xs text-white/40 uppercase">{result.type}</span>
                      <p className="text-sm text-white truncate">{result.item.title || result.item.name || result.item.description}</p>
                    </button>
                  ))}
                  {getSearchResults().length === 0 && (
                    <p className="text-center text-white/40 text-sm py-4">No results found</p>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-4 pb-32">
          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* ========== DASHBOARD SECTION ========== */}
              {activeSection === 'dashboard' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Dashboard</h2>

                  {/* YTD Financial Summary */}
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const currentMonthIdx = new Date().getMonth(); // 0-indexed
                    const yearStr = String(currentYear);

                    // Helper: check if expense is a distribution
                    const isDistribution = (e) => e.category === 'owner-distribution';
                    const isMgmtFee = (e) => e.category === 'management-fee';
                    const isOperatingExpense = (e) => !isDistribution(e) && !isMgmtFee(e);

                    // YTD rent income (only paid)
                    const ytdRent = rentPayments
                      .filter(r => r.status === 'paid' && (r.month || r.datePaid || '').startsWith(yearStr))
                      .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                    // YTD expenses broken down (non-template only)
                    const regularExpenses = expenses.filter(e => !e.isTemplate);
                    const ytdAll = regularExpenses.filter(e => (e.date || '').startsWith(yearStr));
                    const ytdMgmtFees = ytdAll.filter(isMgmtFee).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                    const ytdOpEx = ytdAll.filter(isOperatingExpense).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                    const ytdDistributions = ytdAll.filter(isDistribution).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                    const ytdTotalExpenses = ytdMgmtFees + ytdOpEx; // distributions excluded
                    const ytdNet = ytdRent - ytdTotalExpenses;

                    // Monthly breakdown: Jan of current year through Dec
                    const months = Array.from({ length: 12 }, (_, i) => {
                      const monthStr = `${yearStr}-${String(i + 1).padStart(2, '0')}`;
                      const monthLabel = new Date(currentYear, i).toLocaleString('en-US', { month: 'short' });
                      const isPast = i <= currentMonthIdx;
                      const isCurrent = i === currentMonthIdx;

                      const income = rentPayments
                        .filter(r => r.status === 'paid' && (r.month || r.datePaid || '').startsWith(monthStr))
                        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                      const monthExps = regularExpenses.filter(e => (e.date || '').startsWith(monthStr));
                      const mgmt = monthExps.filter(isMgmtFee).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                      const opex = monthExps.filter(isOperatingExpense).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                      const dist = monthExps.filter(isDistribution).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                      const totalExp = mgmt + opex;

                      return { monthStr, monthLabel, income, mgmt, opex, dist, expenses: totalExp, net: income - totalExp, isPast, isCurrent };
                    });

                    return (
                      <>
                        {/* YTD cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1">YTD Gross Income</p>
                            <p className="text-xl font-bold text-emerald-400">{formatCurrency(ytdRent)}</p>
                          </div>
                          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider mb-1">YTD Expenses</p>
                            <p className="text-xl font-bold text-red-400">{formatCurrency(ytdTotalExpenses)}</p>
                            <p className="text-[9px] text-white/30 mt-1">
                              Mgmt: {formatCurrency(ytdMgmtFees)} · OpEx: {formatCurrency(ytdOpEx)}
                            </p>
                          </div>
                          <div className={`${ytdNet >= 0 ? 'bg-teal-500/10 border-teal-500/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-2xl p-4 text-center`}>
                            <p className={`text-[10px] font-semibold ${ytdNet >= 0 ? 'text-teal-400/70' : 'text-orange-400/70'} uppercase tracking-wider mb-1`}>YTD Net Income</p>
                            <p className={`text-xl font-bold ${ytdNet >= 0 ? 'text-teal-400' : 'text-orange-400'}`}>{formatCurrency(ytdNet)}</p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-semibold text-blue-400/70 uppercase tracking-wider mb-1">YTD Distributions</p>
                            <p className="text-xl font-bold text-blue-400">{formatCurrency(ytdDistributions)}</p>
                          </div>
                        </div>

                        {/* Monthly summary table */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden mb-6">
                          <div className="px-4 py-3 border-b border-white/5">
                            <h3 className="text-sm font-semibold text-white/70">{currentYear} Monthly Summary</h3>
                          </div>
                          <div className="divide-y divide-white/5">
                            {/* Header */}
                            <div className="grid grid-cols-6 gap-2 px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                              <span>Month</span>
                              <span className="text-right">Income</span>
                              <span className="text-right">Mgmt Fees</span>
                              <span className="text-right">Expenses</span>
                              <span className="text-right">Net</span>
                              <span className="text-right">Distributed</span>
                            </div>
                            {months.map(m => (
                              <div key={m.monthStr}
                                className={`grid grid-cols-6 gap-2 px-4 py-2.5 ${m.isCurrent ? 'bg-teal-500/5' : ''} ${!m.isPast ? 'opacity-30' : ''}`}>
                                <span className={`text-sm font-medium ${m.isCurrent ? 'text-teal-400' : 'text-white/70'}`}>
                                  {m.monthLabel}{m.isCurrent ? ' •' : ''}
                                </span>
                                <span className="text-sm text-right text-emerald-400/80">
                                  {m.isPast && m.income > 0 ? formatCurrency(m.income) : m.isPast ? '—' : ''}
                                </span>
                                <span className="text-sm text-right text-yellow-400/60">
                                  {m.isPast && m.mgmt > 0 ? formatCurrency(m.mgmt) : m.isPast ? '—' : ''}
                                </span>
                                <span className="text-sm text-right text-red-400/70">
                                  {m.isPast && m.opex > 0 ? formatCurrency(m.opex) : m.isPast ? '—' : ''}
                                </span>
                                <span className={`text-sm text-right font-medium ${m.isPast ? (m.net >= 0 ? 'text-teal-400' : 'text-orange-400') : ''}`}>
                                  {m.isPast && (m.income > 0 || m.expenses > 0) ? formatCurrency(m.net) : m.isPast ? '—' : ''}
                                </span>
                                <span className="text-sm text-right text-blue-400/60">
                                  {m.isPast && m.dist > 0 ? formatCurrency(m.dist) : m.isPast ? '—' : ''}
                                </span>
                              </div>
                            ))}
                            {/* YTD total row */}
                            <div className="grid grid-cols-6 gap-2 px-4 py-3 bg-white/[0.03] border-t border-white/10">
                              <span className="text-sm font-bold text-white">YTD Total</span>
                              <span className="text-sm text-right font-bold text-emerald-400">{formatCurrency(ytdRent)}</span>
                              <span className="text-sm text-right font-bold text-yellow-400/70">{formatCurrency(ytdMgmtFees)}</span>
                              <span className="text-sm text-right font-bold text-red-400">{formatCurrency(ytdOpEx)}</span>
                              <span className={`text-sm text-right font-bold ${ytdNet >= 0 ? 'text-teal-400' : 'text-orange-400'}`}>{formatCurrency(ytdNet)}</span>
                              <span className="text-sm text-right font-bold text-blue-400">{formatCurrency(ytdDistributions)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Property status alerts */}
                  {(vacantProperties.length > 0 || leaseExpiredProperties.length > 0 || expiringLeases.length > 0) && (
                    <div className="space-y-3 mb-6">
                      {vacantProperties.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-red-400 mb-2">Vacant Properties</h3>
                          {vacantProperties.map(p => (
                            <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                              className="block text-sm text-white/70 hover:text-white transition py-1">
                              {p.emoji || '🏠'} {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {leaseExpiredProperties.length > 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-orange-400 mb-2">Lease Expired</h3>
                          {leaseExpiredProperties.map(p => {
                            const tenants = getPropertyTenants(p);
                            const earliestEnd = tenants.map(t => t.leaseEnd).filter(Boolean).sort()[0];
                            const endLabel = earliestEnd ? ` — ${new Date(earliestEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '';
                            return (
                              <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                                className="block text-sm text-white/70 hover:text-white transition py-1">
                                {p.emoji || '🏠'} {p.name}<span className="text-orange-400/70">{endLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {expiringLeases.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Leases Expiring Soon</h3>
                          {expiringLeases.map(p => {
                            const tenants = getPropertyTenants(p);
                            const soonestEnd = tenants.map(t => t.leaseEnd).filter(Boolean).sort()[0];
                            const end = soonestEnd ? new Date(soonestEnd + 'T00:00:00') : new Date();
                            const today = new Date(); today.setHours(0,0,0,0);
                            const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                            return (
                              <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                                className="block text-sm text-white/70 hover:text-white transition py-1">
                                {p.emoji || '🏠'} {p.name} <span className="text-yellow-400/70">— {days}d left</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ========== RENTALS SECTION ========== */}
              {activeSection === 'rentals' && (
                <div>
                  {selectedProperty ? (
                    <PropertyDetail
                      property={selectedProperty}
                      onBack={() => setSelectedProperty(null)}
                      onEdit={() => setShowNewPropertyModal(selectedProperty)}
                      onEditTenant={(tenant) => setShowTenantModal({ ...selectedProperty, _editTenant: tenant })}
                      onAddTenant={() => setShowTenantModal({ ...selectedProperty, _addNew: true })}
                      onRemoveTenant={(tenantId) => {
                        removeTenant(selectedProperty.id, tenantId);
                        // Refresh selectedProperty
                        const updatedTenants = getPropertyTenants(selectedProperty).filter(t => String(t.id) !== String(tenantId));
                        setSelectedProperty({ ...selectedProperty, tenants: updatedTenants, tenant: updatedTenants[0] || null });
                      }}
                      onDelete={() => {
                        setConfirmDialog({
                          title: 'Delete Property',
                          message: `Are you sure you want to delete "${selectedProperty.name}"?`,
                          onConfirm: () => {
                            deleteProperty(selectedProperty.id);
                            setSelectedProperty(null);
                            setConfirmDialog(null);
                          },
                        });
                      }}
                      onPhotoUpload={(file) => handlePropertyPhotoUpload(selectedProperty.id, file)}
                      uploadingPhoto={uploadingPropertyPhoto === selectedProperty.id}
                      tasks={sharedTasks.filter(t => t.linkedTo?.propertyId === String(selectedProperty.id))}
                      showToast={showToast}
                      expenses={expenses}
                      rentPayments={rentPayments}
                      onUpdateProperty={(propId, updates) => {
                        updateProperty(propId, updates);
                        setSelectedProperty(prev => ({ ...prev, ...updates }));
                      }}
                    />
                  ) : (
                    <>
                      {/* Sub-nav */}
                      <div className="flex gap-1.5 mb-4 items-center justify-between sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { id: 'none', label: 'All' },
                            { id: 'status', label: 'Status' },
                            { id: 'cashflow', label: 'Cash Flow' },
                            { id: 'manager', label: 'Manager' },
                          ].map(s => (
                            <button key={s.id} onClick={() => setPropertySortBy(s.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                propertySortBy === s.id ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'
                              }`}>{s.label}</button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowNewPropertyModal('create')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition"
                          >
                            <Plus className="w-4 h-4" /> Add Property
                          </button>
                        </div>
                      </div>

                      {/* Properties Grid */}
                      {(() => {
                        // Management company mapping based on card color
                        const getManager = (color) => {
                          if (!color) return 'Absolute';
                          if (color.includes('purple') || color.includes('violet') || color.includes('indigo')) return 'Barnett & Hill';
                          if (color.includes('rose') || color.includes('pink')) return 'Dianne Dulin';
                          return 'Absolute';
                        };

                        // Sorting
                        const sortedProperties = [...properties].sort((a, b) => {
                          if (propertySortBy === 'status') {
                            const statusOrder = { 'occupied': 0, 'owner-occupied': 1, 'month-to-month': 2, 'lease-expired': 3, 'renovation': 4, 'vacant': 5 };
                            const sa = statusOrder[a.propertyStatus || (getPropertyTenants(a).length > 0 ? 'occupied' : 'vacant')] ?? 9;
                            const sb = statusOrder[b.propertyStatus || (getPropertyTenants(b).length > 0 ? 'occupied' : 'vacant')] ?? 9;
                            return sa - sb;
                          }
                          if (propertySortBy === 'cashflow') {
                            const cfA = (parseFloat(a.monthlyRent) || 0) - (parseFloat(a.mortgageMonthlyPayment) || 0) - (parseFloat(a.escrowMonthly) || 0);
                            const cfB = (parseFloat(b.monthlyRent) || 0) - (parseFloat(b.mortgageMonthlyPayment) || 0) - (parseFloat(b.escrowMonthly) || 0);
                            return cfB - cfA;
                          }
                          if (propertySortBy === 'manager') {
                            return getManager(a.color).localeCompare(getManager(b.color));
                          }
                          return 0;
                        });

                        return (
                        <div className="grid grid-cols-1 gap-4">
                          {sortedProperties.map(property => (
                            <PropertyCard
                              key={property.id}
                              property={property}
                              documents={documents}
                              expenses={expenses}
                              rentPayments={rentPayments}
                              onViewDetails={() => setSelectedProperty(property)}
                              onEdit={() => setShowNewPropertyModal(property)}
                              onDelete={() => {
                                setConfirmDialog({
                                  title: 'Delete Property',
                                  message: `Delete "${property.name}"? This cannot be undone.`,
                                  onConfirm: () => { deleteProperty(property.id); setConfirmDialog(null); },
                                });
                              }}
                              onViewDocument={(doc) => setViewingDocument(doc)}
                            />
                          ))}
                          {properties.length === 0 && (
                            <div className="text-center py-16">
                              <p className="text-4xl mb-3">🏠</p>
                              <p className="text-white/40">No properties yet</p>
                              <button onClick={() => setShowNewPropertyModal('create')} className="mt-3 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm hover:bg-teal-600 transition">
                                Add Your First Property
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })()}

                    </>
                  )}
                </div>
              )}

              {/* ========== TENANTS SECTION ========== */}
              {activeSection === 'tenants' && (
                <TenantsList
                  properties={properties}
                  onEditTenant={(propertyId, tenant) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    if (prop) setShowTenantModal({ ...prop, _editTenant: tenant || null });
                  }}
                  onAddTenant={() => {
                    // Open tenant modal for first property or show property selector
                    if (properties.length === 1) {
                      setShowTenantModal(properties[0]);
                    } else if (properties.length > 1) {
                      // Create a temp state to pick property first
                      setShowTenantModal({ _pickProperty: true });
                    } else {
                      showToast('Add a property first', 'info');
                    }
                  }}
                  onViewProperty={(propertyId) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    if (prop) { setActiveSection('rentals'); setSelectedProperty(prop); }
                  }}
                />
              )}

              {/* ========== RENT SECTION ========== */}
              {activeSection === 'rent' && (
                <RentLedger
                  rentPayments={rentPayments}
                  properties={properties}
                  onAdd={() => setShowAddRentModal('create')}
                  onEdit={(payment) => setShowAddRentModal(payment)}
                  onDelete={(paymentId) => {
                    setConfirmDialog({
                      title: 'Delete Payment',
                      message: 'Delete this rent payment record?',
                      onConfirm: () => { deleteRentPayment(paymentId); setConfirmDialog(null); },
                    });
                  }}
                  onBulkDelete={(ids) => {
                    setConfirmDialog({
                      title: 'Delete Payments',
                      message: `Delete ${ids.length} selected rent payment${ids.length > 1 ? 's' : ''}?`,
                      onConfirm: () => { bulkDeleteRentPayments(ids); setConfirmDialog(null); },
                    });
                  }}
                  showToast={showToast}
                />
              )}

              {/* ========== EXPENSES SECTION ========== */}
              {activeSection === 'expenses' && (
                <ExpensesList
                  expenses={expenses}
                  properties={properties}
                  onAdd={() => setShowAddExpenseModal('create')}
                  onImportReport={() => setShowExpenseReportUpload(true)}
                  onEdit={(expense) => setShowAddExpenseModal(expense)}
                  onDelete={(expenseId) => {
                    setConfirmDialog({
                      title: 'Delete Expense',
                      message: 'Delete this expense record?',
                      onConfirm: () => { deleteExpense(expenseId); setConfirmDialog(null); },
                    });
                  }}
                  onBulkDelete={(ids) => {
                    setConfirmDialog({
                      title: 'Delete Expenses',
                      message: `Delete ${ids.length} selected expense${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
                      onConfirm: () => { bulkDeleteExpenses(ids); setConfirmDialog(null); },
                    });
                  }}
                  onGenerateFromTemplate={(template) => {
                    const now = new Date();
                    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const dueDay = template.dueDay || 1;
                    const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const actualDay = Math.min(dueDay, maxDay);
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
                    addExpense({
                      id: `${Date.now()}-${template.id}-${monthStr}`,
                      createdAt: new Date().toISOString(),
                      createdBy: currentUser,
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
                  }}
                  showToast={showToast}
                />
              )}

              {/* ========== DOCUMENTS SECTION ========== */}
              {activeSection === 'documents' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-between sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    <div className="flex gap-1.5">
                      {[
                        { id: 'byType', emoji: '📁' },
                        { id: 'byProperty', emoji: '🏠' },
                        { id: 'all', emoji: '📄' },
                      ].map(tab => (
                        <button key={tab.id} onClick={() => setDocumentViewMode(tab.id)}
                          className={`px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                            documentViewMode === tab.id ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}>{tab.emoji}</button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAddDocumentModal('create')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition"
                    >
                      <Plus className="w-4 h-4" /> Add Document
                    </button>
                  </div>

                  {/* All Documents */}
                  {documentViewMode === 'all' && (
                    <div className="space-y-2">
                      {documents.map(docItem => (
                        <DocumentCard
                          key={docItem.id}
                          document={docItem}
                          propertyName={getPropertyName(docItem.propertyId)}
                          onEdit={() => setShowAddDocumentModal(docItem)}
                          onView={() => setViewingDocument(docItem)}
                          onDelete={() => {
                            setConfirmDialog({
                              title: 'Delete Document',
                              message: `Delete "${docItem.title}"?`,
                              onConfirm: () => { deleteDocument(docItem.id); setConfirmDialog(null); },
                            });
                          }}
                        />
                      ))}
                      {documents.length === 0 && (
                        <div className="text-center py-16">
                          <p className="text-4xl mb-3">📄</p>
                          <p className="text-white/40">No documents yet</p>
                          <button onClick={() => setShowAddDocumentModal('create')} className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600 transition">
                            Upload Your First Document
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By Property */}
                  {documentViewMode === 'byProperty' && (
                    <div className="space-y-4">
                      {properties.map(prop => {
                        const propDocs = documents.filter(d => String(d.propertyId) === String(prop.id));
                        if (propDocs.length === 0) return null;
                        return (
                          <div key={prop.id}>
                            <h3 className="text-sm font-semibold text-white/60 mb-2">{prop.emoji || '🏠'} {prop.name}</h3>
                            <div className="space-y-2">
                              {propDocs.map(docItem => (
                                <DocumentCard
                                  key={docItem.id}
                                  document={docItem}
                                  propertyName={prop.name}
                                  onEdit={() => setShowAddDocumentModal(docItem)}
                                  onView={() => setViewingDocument(docItem)}
                                  onDelete={() => deleteDocument(docItem.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Unlinked docs */}
                      {documents.filter(d => !d.propertyId).length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/60 mb-2">📁 General</h3>
                          <div className="space-y-2">
                            {documents.filter(d => !d.propertyId).map(docItem => (
                              <DocumentCard
                                key={docItem.id}
                                document={docItem}
                                onEdit={() => setShowAddDocumentModal(docItem)}
                                onView={() => setViewingDocument(docItem)}
                                onDelete={() => deleteDocument(docItem.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By Type */}
                  {documentViewMode === 'byType' && (
                    <div className="space-y-4">
                      {documentTypes.map(dtype => {
                        const typeDocs = documents.filter(d => d.type === dtype.value);
                        if (typeDocs.length === 0) return null;
                        return (
                          <div key={dtype.value}>
                            <h3 className="text-sm font-semibold text-white/60 mb-2">{dtype.emoji} {dtype.label} ({typeDocs.length})</h3>
                            <div className="space-y-2">
                              {typeDocs.map(docItem => (
                                <DocumentCard
                                  key={docItem.id}
                                  document={docItem}
                                  propertyName={getPropertyName(docItem.propertyId)}
                                  onEdit={() => setShowAddDocumentModal(docItem)}
                                  onView={() => setViewingDocument(docItem)}
                                  onDelete={() => deleteDocument(docItem.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ========== FINANCIALS SECTION ========== */}
              {activeSection === 'financials' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-start sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    {[
                      { id: 'transactions', emoji: '💰' },
                      { id: 'summary', emoji: '📈' },
                      { id: 'byProperty', emoji: '🏠' },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setFinancialViewMode(tab.id)}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                          financialViewMode === tab.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}>{tab.emoji}</button>
                    ))}
                  </div>

                  {/* Transactions */}
                  {financialViewMode === 'transactions' && (
                    <div>
                      <div className="flex gap-2 mb-4">
                        {['all', 'income', 'expense'].map(f => (
                          <button key={f} onClick={() => setTransactionTypeFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                              transactionTypeFilter === f ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}>{f}</button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {(getFilteredTransactions ? getFilteredTransactions() : transactions)
                          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                          .map(txn => (
                            <TransactionCard
                              key={txn.id}
                              transaction={txn}
                              propertyName={getPropertyName(txn.propertyId)}
                              onEdit={() => setShowAddTransactionModal(txn)}
                              onDelete={() => {
                                setConfirmDialog({
                                  title: 'Delete Transaction',
                                  message: 'Delete this transaction?',
                                  onConfirm: () => { deleteTransaction(txn.id); setConfirmDialog(null); },
                                });
                              }}
                            />
                          ))}
                        {transactions.length === 0 && (
                          <div className="text-center py-16">
                            <p className="text-4xl mb-3">💰</p>
                            <p className="text-white/40">No transactions yet</p>
                            <button onClick={() => setShowAddTransactionModal('create')} className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition">
                              Log Your First Transaction
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {financialViewMode === 'summary' && (
                    <FinancialSummary
                      transactions={transactions}
                      properties={properties}
                      getTotalIncome={getTotalIncome}
                      getTotalExpenses={getTotalExpenses}
                      getProfit={getProfit}
                      getMonthlyBreakdown={getMonthlyBreakdown}
                      getPropertyBreakdown={getPropertyBreakdown}
                    />
                  )}

                  {/* By Property */}
                  {financialViewMode === 'byProperty' && (
                    <div className="space-y-4">
                      {properties.map(prop => {
                        const propTxns = transactions.filter(t => String(t.propertyId) === String(prop.id));
                        const income = propTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
                        const expenses = propTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
                        return (
                          <div key={prop.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                            <h3 className="font-semibold text-white mb-2">{prop.emoji || '🏠'} {prop.name}</h3>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div><span className="text-white/40">Income:</span> <span className="text-emerald-400">{formatCurrency(income)}</span></div>
                              <div><span className="text-white/40">Expenses:</span> <span className="text-red-400">{formatCurrency(expenses)}</span></div>
                              <div><span className="text-white/40">Profit:</span> <span className={income - expenses >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(income - expenses)}</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ========== MODALS ========== */}

        {/* Hub Modals */}
        {showAddTaskModal && (
          <AddTaskModal
            task={typeof showAddTaskModal === 'object' ? showAddTaskModal : null}
            onSave={(taskData) => {
              if (typeof showAddTaskModal === 'object' && showAddTaskModal.id) {
                updateTask(showAddTaskModal.id, taskData);
              } else {
                addTask({ ...taskData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, status: 'pending' });
              }
              setShowAddTaskModal(null);
            }}
            onClose={() => setShowAddTaskModal(null)}
            currentUser={currentUser}
            properties={properties}
          />
        )}

        {showSharedListModal && (
          <SharedListModal
            list={typeof showSharedListModal === 'object' ? showSharedListModal : null}
            onSave={(listData) => {
              if (typeof showSharedListModal === 'object' && showSharedListModal.id) {
                updateList(showSharedListModal.id, listData);
              } else {
                addList({ ...listData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, items: [] });
              }
              setShowSharedListModal(null);
            }}
            onClose={() => setShowSharedListModal(null)}
            currentUser={currentUser}
          />
        )}

        {showAddIdeaModal && (
          <AddIdeaModal
            idea={typeof showAddIdeaModal === 'object' ? showAddIdeaModal : null}
            onSave={(ideaData) => {
              if (typeof showAddIdeaModal === 'object' && showAddIdeaModal.id) {
                updateIdea(showAddIdeaModal.id, ideaData);
              } else {
                addIdea({ ...ideaData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, status: 'inbox' });
              }
              setShowAddIdeaModal(null);
            }}
            onClose={() => setShowAddIdeaModal(null)}
            currentUser={currentUser}
          />
        )}

        {/* Property Seed Import */}
        {showPropertyImport && (
          <PropertySeedImport
            existingProperties={properties}
            onImport={(props) => bulkAddProperties(props)}
            onUpdate={(id, updates) => updateProperty(id, updates)}
            onClose={() => setShowPropertyImport(false)}
          />
        )}

        {/* Rental Modals */}
        {showNewPropertyModal && (
          <NewPropertyModal
            property={typeof showNewPropertyModal === 'object' ? showNewPropertyModal : null}
            onSave={(propData) => {
              if (typeof showNewPropertyModal === 'object' && showNewPropertyModal.id) {
                updateProperty(showNewPropertyModal.id, propData);
                if (selectedProperty?.id === showNewPropertyModal.id) {
                  setSelectedProperty({ ...showNewPropertyModal, ...propData });
                }
              } else {
                addProperty({ ...propData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowNewPropertyModal(null);
            }}
            onClose={() => setShowNewPropertyModal(null)}
            showToast={showToast}
            onPhotoUpload={handlePropertyPhotoUpload}
          />
        )}

        {showTenantModal && (
          <TenantModal
            property={showTenantModal}
            properties={properties}
            tenant={showTenantModal?._editTenant || (showTenantModal?._addNew ? null : null)}
            showToast={showToast}
            onSave={(tenantData, overridePropertyId) => {
              // Determine target property ID
              const targetId = overridePropertyId || showTenantModal.id;
              if (!targetId) {
                showToast('No property selected', 'error');
                return;
              }
              const targetProp = properties.find(p => String(p.id) === String(targetId));
              if (!targetProp) {
                showToast('Property not found', 'error');
                return;
              }
              // If editing an existing tenant, preserve their ID
              const editingTenant = showTenantModal?._editTenant;
              const dataWithId = editingTenant?.id ? { ...tenantData, id: editingTenant.id } : tenantData;
              addOrUpdateTenant(targetProp.id, dataWithId);
              // Refresh selectedProperty if viewing it
              if (selectedProperty && String(selectedProperty.id) === String(targetProp.id)) {
                // Re-fetch from properties after next render
                setTimeout(() => {
                  setProperties(prev => {
                    const updated = prev.find(p => String(p.id) === String(targetProp.id));
                    if (updated) setSelectedProperty({ ...updated });
                    return prev;
                  });
                }, 100);
              }
              setShowTenantModal(null);
            }}
            onClose={() => setShowTenantModal(null)}
            onUploadPhoto={uploadPhoto}
          />
        )}

        {/* Document Modals */}
        {showAddDocumentModal && (
          <AddDocumentModal
            document={typeof showAddDocumentModal === 'object' ? showAddDocumentModal : null}
            properties={properties}
            onSave={async (docData, file) => {
              let fileUrl = docData.fileUrl;
              if (file) {
                const url = await handleDocumentFileUpload(file, docData);
                if (!url) return; // Upload failed, don't save
                fileUrl = url;
              }
              const finalDoc = { ...docData, fileUrl };
              if (typeof showAddDocumentModal === 'object' && showAddDocumentModal.id) {
                updateDocument(showAddDocumentModal.id, finalDoc);
              } else {
                addDocument({ ...finalDoc, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddDocumentModal(null);
            }}
            onClose={() => setShowAddDocumentModal(null)}
            uploading={uploadingDocument}
          />
        )}

        {viewingDocument && (
          <DocumentViewer
            document={viewingDocument}
            propertyName={getPropertyName(viewingDocument.propertyId)}
            onClose={() => setViewingDocument(null)}
          />
        )}

        {/* Financial Modals */}
        {showAddTransactionModal && (
          <AddTransactionModal
            transaction={typeof showAddTransactionModal === 'object' ? showAddTransactionModal : null}
            properties={properties}
            onSave={(txnData) => {
              if (typeof showAddTransactionModal === 'object' && showAddTransactionModal.id) {
                updateTransaction(showAddTransactionModal.id, txnData);
              } else {
                addTransaction({ ...txnData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddTransactionModal(null);
            }}
            onClose={() => setShowAddTransactionModal(null)}
            showToast={showToast}
          />
        )}

        {/* Rent Payment Modal */}
        {showAddRentModal && (
          <AddRentPaymentModal
            payment={typeof showAddRentModal === 'object' ? showAddRentModal : null}
            properties={properties}
            onSave={(paymentData) => {
              if (typeof showAddRentModal === 'object' && showAddRentModal.id) {
                updateRentPayment(showAddRentModal.id, paymentData);
              } else {
                addRentPayment({ ...paymentData, id: Date.now().toString(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddRentModal(null);
            }}
            onDelete={(paymentId) => {
              setConfirmDialog({
                title: 'Delete Payment',
                message: 'Delete this rent payment record?',
                onConfirm: () => { deleteRentPayment(paymentId); setShowAddRentModal(null); setConfirmDialog(null); },
              });
            }}
            onClose={() => setShowAddRentModal(null)}
          />
        )}

        {/* Expense Modal */}
        {showAddExpenseModal && (
          <AddExpenseModal
            expense={typeof showAddExpenseModal === 'object' ? showAddExpenseModal : null}
            properties={properties}
            onUploadPhoto={uploadPhoto}
            onSave={(expenseData) => {
              if (typeof showAddExpenseModal === 'object' && showAddExpenseModal.id) {
                updateExpense(showAddExpenseModal.id, expenseData);
              } else {
                addExpense({ ...expenseData, id: Date.now().toString(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddExpenseModal(null);
            }}
            onDelete={(expenseId) => {
              setConfirmDialog({
                title: 'Delete Expense',
                message: 'Delete this expense record?',
                onConfirm: () => { deleteExpense(expenseId); setShowAddExpenseModal(null); setConfirmDialog(null); },
              });
            }}
            onClose={() => setShowAddExpenseModal(null)}
          />
        )}

        {/* Expense Report Upload Modal */}
        {showExpenseReportUpload && (
          <ExpenseReportUpload
            properties={properties}
            onImport={async (items, file) => {
              const incomeItems = items.filter(i => i.flowType === 'income');
              const expenseItems = items.filter(i => i.flowType !== 'income');

              // Route expenses → Expenses section
              for (const item of expenseItems) {
                addExpense({ ...item, id: Date.now().toString() + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString(), createdBy: currentUser });
                await new Promise(r => setTimeout(r, 50));
              }

              // Route income → Rent section
              for (const item of incomeItems) {
                const month = item.date ? item.date.substring(0, 7) : item.reportMonth || '';
                addRentPayment({
                  id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                  propertyId: item.propertyId || '',
                  propertyName: item.propertyName || '',
                  tenantName: item.vendor || '',
                  month,
                  amount: item.amount || 0,
                  datePaid: item.date || '',
                  status: 'paid',
                  notes: item.notes || `Imported from owner packet (${item.reportMonth || ''})`,
                  createdAt: new Date().toISOString(),
                  createdBy: currentUser,
                });
                await new Promise(r => setTimeout(r, 50));
              }

              // Auto-store uploaded PDF in Documents
              if (file) {
                try {
                  const fileUrl = await uploadPhoto(file, 'rentals/documents');
                  const reportMonth = items[0]?.reportMonth || new Date().toISOString().substring(0, 7);
                  addDocument({
                    id: Date.now().toString(),
                    title: file.name || 'Owner Packet',
                    type: 'other',
                    fileName: file.name || 'document.pdf',
                    fileUrl,
                    date: reportMonth + '-01',
                    notes: 'Auto-saved from owner packet import',
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser,
                  });
                } catch (err) {
                  logger.error('Failed to auto-save PDF to documents:', err);
                }
              }

              const parts = [];
              if (expenseItems.length) parts.push(`${expenseItems.length} expense${expenseItems.length > 1 ? 's' : ''}`);
              if (incomeItems.length) parts.push(`${incomeItems.length} rent payment${incomeItems.length > 1 ? 's' : ''}`);
              showToast(`Imported ${parts.join(' and ')}${file ? ' (PDF saved to Documents)' : ''}`, 'success');
            }}
            onClose={() => setShowExpenseReportUpload(false)}
          />
        )}

        {/* Property Financial Breakdown Modal */}
        {showPropertyBreakdown && (
          <PropertyFinancialBreakdownModal
            properties={properties}
            rentPayments={rentPayments}
            expenses={expenses}
            onPropertyClick={(prop) => {
              setShowPropertyBreakdown(false);
              setActiveSection('rentals');
              setSelectedProperty(prop);
            }}
            onClose={() => setShowPropertyBreakdown(false)}
          />
        )}

        {/* Confirm Dialog */}
        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border transition-all ${
            toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30 text-white' :
            toast.type === 'error' ? 'bg-red-500/90 border-red-400/30 text-white' :
            'bg-slate-700/90 border-white/20 text-white'
          }`}>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}

        {/* Desktop FAB */}
        {isOwner && !anyModalOpen && (
          <div className="hidden md:block fixed top-24 left-6 z-[90]">
            {showAddNewMenu && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[89]" onClick={() => setShowAddNewMenu(false)} />
                <div className="absolute top-16 left-0 z-[91] bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl w-[240px]"
                  style={{ animation: 'fabGridIn 0.15s ease-out both' }}>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { action: () => setShowAddTaskModal('create'), icon: '✅', label: 'Task', gradient: 'from-blue-400 to-indigo-500' },
                      { action: () => setShowAddRentModal('create'), icon: '💰', label: 'Rent', gradient: 'from-emerald-400 to-green-500' },
                      { action: () => setShowAddExpenseModal('create'), icon: '💸', label: 'Expense', gradient: 'from-red-400 to-rose-500' },
                      { action: () => setShowAddDocumentModal('create'), icon: '📄', label: 'Document', gradient: 'from-amber-400 to-orange-500' },
                      { action: () => setShowSharedListModal('create'), icon: '📋', label: 'List', gradient: 'from-emerald-400 to-teal-500' },
                    ].map((item, idx) => (
                      <button key={item.label} onClick={() => { setShowAddNewMenu(false); item.action(); }}
                        className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-white/10 transition active:scale-95"
                        style={{ animation: `fabItemIn 0.12s ease-out ${idx * 0.02}s both` }}>
                        <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-xl shadow-md`}>{item.icon}</span>
                        <span className="text-[11px] text-white/70 font-medium leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <style>{`
                  @keyframes fabGridIn { from { opacity: 0; transform: scale(0.9) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                  @keyframes fabItemIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                `}</style>
              </>
            )}
            <button onClick={() => setShowAddNewMenu(!showAddNewMenu)}
              className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
                showAddNewMenu ? 'bg-gradient-to-r from-pink-500 to-rose-500 rotate-45' : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:shadow-purple-500/30'
              }`}
              style={{ boxShadow: showAddNewMenu ? '0 8px 32px rgba(236,72,153,0.4)' : '0 8px 32px rgba(139,92,246,0.4)' }}>
              <Plus className="w-6 h-6 text-white transition-transform duration-200" />
            </button>
          </div>
        )}

        {/* Mobile Bottom Navigation with FAB */}
        {!anyModalOpen && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100]" style={{ transform: 'translateZ(0)' }}>
            {/* FAB Menu Popup */}
            {showAddNewMenu && isOwner && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99]" onClick={() => setShowAddNewMenu(false)} />
                <div className="fixed right-4 z-[101] bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl w-[240px]"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 132px)', animation: 'fabGridUp 0.2s cubic-bezier(0.16,1,0.3,1) both', transformOrigin: 'bottom right' }}>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { action: () => setShowAddTaskModal('create'), icon: '✅', label: 'Task', gradient: 'from-blue-400 to-indigo-500' },
                      { action: () => setShowAddRentModal('create'), icon: '💰', label: 'Rent', gradient: 'from-emerald-400 to-green-500' },
                      { action: () => setShowAddExpenseModal('create'), icon: '💸', label: 'Expense', gradient: 'from-red-400 to-rose-500' },
                      { action: () => setShowAddDocumentModal('create'), icon: '📄', label: 'Document', gradient: 'from-amber-400 to-orange-500' },
                      { action: () => setShowSharedListModal('create'), icon: '📋', label: 'List', gradient: 'from-emerald-400 to-teal-500' },
                    ].map((item, idx) => {
                      const row = Math.floor(idx / 3);
                      const delay = (1 - row) * 0.04 + (idx % 3) * 0.015;
                      return (
                        <button key={item.label} onClick={() => { setShowAddNewMenu(false); item.action(); }}
                          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-white/10 transition active:scale-95"
                          style={{ animation: `fabItemUp 0.25s cubic-bezier(0.16,1,0.3,1) ${delay}s both` }}>
                          <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-xl shadow-md`}>{item.icon}</span>
                          <span className="text-[11px] text-white/70 font-medium leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <style>{`
                  @keyframes fabGridUp { from { opacity: 0; transform: translateX(-50%) scaleY(0.3) scaleX(0.8) translateY(20px); } to { opacity: 1; transform: translateX(-50%) scaleY(1) scaleX(1) translateY(0); } }
                  @keyframes fabItemUp { from { opacity: 0; transform: translateY(12px) scale(0.7); } to { opacity: 1; transform: translateY(0) scale(1); } }
                `}</style>
              </>
            )}

            {/* Nav bar */}
            <div className="relative bg-slate-900 border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              {/* Tab buttons — all 6 sections */}
              <div className="flex items-end justify-around px-1 pt-1 pb-1">
                {[
                  { id: 'dashboard', label: 'Home', emoji: '📊', gradient: 'from-purple-500 to-violet-500' },
                  { id: 'rentals', label: 'Props', emoji: '🏠', gradient: 'from-teal-400 to-cyan-500' },
                  { id: 'tenants', label: 'Tenants', emoji: '👤', gradient: 'from-blue-400 to-indigo-500' },
                  { id: 'rent', label: 'Rent', emoji: '💰', gradient: 'from-emerald-400 to-green-500' },
                  { id: 'expenses', label: 'Costs', emoji: '💸', gradient: 'from-red-400 to-rose-500' },
                  { id: 'documents', label: 'Docs', emoji: '📄', gradient: 'from-amber-400 to-orange-500' },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      if (section.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                      setShowAddNewMenu(false);
                    }}
                    className="relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 min-w-[44px]"
                  >
                    <span className={`text-base mb-0.5 transition-transform ${activeSection === section.id ? 'scale-110' : ''}`}>
                      {section.emoji}
                    </span>
                    <span className={`text-[9px] font-medium transition-colors ${activeSection === section.id ? 'text-white' : 'text-white/40'}`}>
                      {section.label}
                    </span>
                    {activeSection === section.id && (
                      <div className={`absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-gradient-to-r ${section.gradient}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* FAB — floating above bottom nav on right side */}
            {isOwner && (
              <button
                onClick={() => setShowAddNewMenu(!showAddNewMenu)}
                className={`fixed right-4 z-[101] rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                  showAddNewMenu ? 'bg-gradient-to-r from-pink-500 to-rose-500 rotate-45' : 'bg-gradient-to-r from-purple-500 to-violet-600'
                }`}
                style={{
                  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
                  width: '3rem', height: '3rem',
                  boxShadow: showAddNewMenu
                    ? '0 4px 24px rgba(236,72,153,0.6)'
                    : '0 4px 24px rgba(139,92,246,0.6)',
                }}>
                <Plus className="w-5 h-5 text-white transition-transform duration-200" />
              </button>
            )}
          </nav>
        )}

        {/* Footer - desktop only */}
        <div className="hidden md:block text-center py-3 border-t border-white/5">
          <BuildInfo />
        </div>

        {/* Bottom rainbow bar - desktop only */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 hidden md:block" />
      </div>
    </SharedHubProvider>
  );
}
