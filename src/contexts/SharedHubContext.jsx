import React, { createContext, useContext } from 'react';

/**
 * SharedHub Context - Eliminates props drilling for shared hub operations
 *
 * Provides access to:
 * - Shared data (tasks, lists, ideas)
 * - CRUD operations for each type
 * - Highlight/state toggles
 *
 * Usage:
 *   const hub = useSharedHub();
 *   hub.tasks, hub.completeTask(), hub.deleteTask(), etc.
 */

export const SharedHubContext = createContext(null);

export const useSharedHub = () => {
  const context = useContext(SharedHubContext);
  if (!context) {
    throw new Error('useSharedHub must be used within SharedHubProvider');
  }
  return context;
};

/**
 * SharedHubProvider component
 * Wrap your app with this to provide SharedHub context to all children
 */
export const SharedHubProvider = ({ children, value }) => {
  return (
    <SharedHubContext.Provider value={value}>
      {children}
    </SharedHubContext.Provider>
  );
};

export default SharedHubContext;
