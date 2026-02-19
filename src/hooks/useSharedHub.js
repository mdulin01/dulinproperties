import { useState, useCallback, useRef } from 'react';

/**
 * useSharedHub Hook
 * Manages all SharedHub data and operations in one place
 * Returns an object with state and callbacks ready to pass to SharedHubProvider
 *
 * All CRUD functions use functional state updates (prev =>) to avoid stale closure bugs.
 */

export const useSharedHub = (currentUser, saveSharedHub, showToast) => {
  // Keep a ref to saveSharedHub so callbacks always use the latest version
  const saveRef = useRef(saveSharedHub);
  saveRef.current = saveSharedHub;

  // ========== STATE ==========
  const [sharedTasks, setSharedTasks] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [sharedIdeas, setSharedIdeas] = useState([]);

  // Hub UI state
  const [hubSubView, setHubSubView] = useState('home');
  const [hubTaskFilter, setHubTaskFilter] = useState('all');
  const [hubTaskSort, setHubTaskSort] = useState('date');
  const [hubListFilter, setHubListFilter] = useState('all');
  const [hubIdeaFilter, setHubIdeaFilter] = useState('all');
  const [hubIdeaStatusFilter, setHubIdeaStatusFilter] = useState('all');
  const [collapsedSections, setCollapsedSections] = useState({});

  // Hub modal states (for card editing/creation)
  const [showAddTaskModal, setShowAddTaskModal] = useState(null);
  const [showSharedListModal, setShowSharedListModal] = useState(null);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(null);

  // ========== TASK CRUD ==========
  const addTask = useCallback((task) => {
    setSharedTasks(prev => {
      const newTasks = [...prev, task];
      saveRef.current(null, newTasks, null);
      return newTasks;
    });
    showToast('Task added', 'success');
  }, [showToast]);

  const updateTask = useCallback((taskId, updates) => {
    setSharedTasks(prev => {
      const newTasks = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
      saveRef.current(null, newTasks, null);
      return newTasks;
    });
  }, []);

  const deleteTask = useCallback((taskId) => {
    setSharedTasks(prev => {
      const newTasks = prev.filter(t => t.id !== taskId);
      saveRef.current(null, newTasks, null);
      return newTasks;
    });
    showToast('Task removed', 'info');
  }, [showToast]);

  const completeTask = useCallback((taskId) => {
    setSharedTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const newStatus = task.status === 'done' ? 'pending' : 'done';
      const newTasks = prev.map(t => t.id === taskId ? {
        ...t,
        status: newStatus,
        completedBy: newStatus === 'done' ? currentUser : null,
        completedAt: newStatus === 'done' ? new Date().toISOString() : null,
      } : t);
      saveRef.current(null, newTasks, null);
      return newTasks;
    });
  }, [currentUser]);

  const highlightTask = useCallback((taskId) => {
    setSharedTasks(prev => {
      const newTasks = prev.map(t => t.id === taskId ? { ...t, highlighted: !t.highlighted } : t);
      saveRef.current(null, newTasks, null);
      return newTasks;
    });
  }, []);

  // ========== LIST CRUD ==========
  const addList = useCallback((list) => {
    setSharedLists(prev => {
      const newLists = [...prev, list];
      saveRef.current(newLists, null, null);
      return newLists;
    });
    showToast('List created', 'success');
  }, [showToast]);

  const updateList = useCallback((listId, updates) => {
    setSharedLists(prev => {
      const newLists = prev.map(l => l.id === listId ? { ...l, ...updates } : l);
      saveRef.current(newLists, null, null);
      return newLists;
    });
  }, []);

  const deleteList = useCallback((listId) => {
    setSharedLists(prev => {
      const newLists = prev.filter(l => l.id !== listId);
      saveRef.current(newLists, null, null);
      return newLists;
    });
    showToast('List removed', 'info');
  }, [showToast]);

  const addListItem = useCallback((listId, item) => {
    setSharedLists(prev => {
      const newLists = prev.map(l => l.id === listId ? { ...l, items: [...(l.items || []), item] } : l);
      saveRef.current(newLists, null, null);
      return newLists;
    });
  }, []);

  const toggleListItem = useCallback((listId, itemId) => {
    setSharedLists(prev => {
      const newLists = prev.map(l => {
        if (l.id !== listId) return l;
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? {
            ...i,
            checked: !i.checked,
            checkedBy: !i.checked ? currentUser : null,
            checkedAt: !i.checked ? new Date().toISOString() : null,
          } : i)
        };
      });
      saveRef.current(newLists, null, null);
      return newLists;
    });
  }, [currentUser]);

  const deleteListItem = useCallback((listId, itemId) => {
    setSharedLists(prev => {
      const newLists = prev.map(l => {
        if (l.id !== listId) return l;
        return { ...l, items: l.items.filter(i => i.id !== itemId) };
      });
      saveRef.current(newLists, null, null);
      return newLists;
    });
  }, []);

  const highlightList = useCallback((listId) => {
    setSharedLists(prev => {
      const newLists = prev.map(l => l.id === listId ? { ...l, highlighted: !l.highlighted } : l);
      saveRef.current(newLists, null, null);
      return newLists;
    });
  }, []);

  // ========== IDEA CRUD ==========
  const addIdea = useCallback((idea) => {
    setSharedIdeas(prev => {
      const newIdeas = [...prev, idea];
      saveRef.current(null, null, newIdeas);
      return newIdeas;
    });
    showToast('Idea saved', 'success');
  }, [showToast]);

  const updateIdea = useCallback((ideaId, updates) => {
    setSharedIdeas(prev => {
      const newIdeas = prev.map(i => i.id === ideaId ? { ...i, ...updates } : i);
      saveRef.current(null, null, newIdeas);
      return newIdeas;
    });
  }, []);

  const deleteIdea = useCallback((ideaId) => {
    setSharedIdeas(prev => {
      const newIdeas = prev.filter(i => i.id !== ideaId);
      saveRef.current(null, null, newIdeas);
      return newIdeas;
    });
    showToast('Idea removed', 'info');
  }, [showToast]);

  const highlightIdea = useCallback((ideaId) => {
    setSharedIdeas(prev => {
      const newIdeas = prev.map(i => i.id === ideaId ? { ...i, highlighted: !i.highlighted } : i);
      saveRef.current(null, null, newIdeas);
      return newIdeas;
    });
  }, []);

  // ========== UI HELPERS ==========
  const toggleDashSection = useCallback((section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // ========== RETURN CONTEXT VALUE ==========
  return {
    // Data
    sharedTasks,
    sharedLists,
    sharedIdeas,

    // Task operations
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    highlightTask,

    // List operations
    addList,
    updateList,
    deleteList,
    addListItem,
    toggleListItem,
    deleteListItem,
    highlightList,

    // Idea operations
    addIdea,
    updateIdea,
    deleteIdea,
    highlightIdea,

    // UI state
    hubSubView,
    setHubSubView,
    hubTaskFilter,
    setHubTaskFilter,
    hubTaskSort,
    setHubTaskSort,
    hubListFilter,
    setHubListFilter,
    hubIdeaFilter,
    setHubIdeaFilter,
    hubIdeaStatusFilter,
    setHubIdeaStatusFilter,
    collapsedSections,
    toggleDashSection,

    // Setters for loading data from Firebase
    setSharedTasks,
    setSharedLists,
    setSharedIdeas,

    // Modal states
    showAddTaskModal,
    setShowAddTaskModal,
    showSharedListModal,
    setShowSharedListModal,
    showAddIdeaModal,
    setShowAddIdeaModal,

    // Utilities
    showToast,
  };
};

export default useSharedHub;
