import React, { useState } from 'react';
import DocumentImport from '../Documents/DocumentImport';
import ValidateTransactions from './ValidateTransactions';
import ManagedRentals from './ManagedRentals';
import PropertyInfo from './PropertyInfo';

const TABS = [
  { id: 'statements', icon: '📥', label: 'Import Statements & Reports',
    hint: 'Drop in monthly PDFs from your management companies, bank, and credit cards.' },
  { id: 'validate', icon: '✅', label: 'Data Validation',
    hint: 'Review every imported entry and mark it validated, edit, or discard.' },
  { id: 'managed', icon: '🏠', label: 'Managed Rentals',
    hint: 'Record rents and expenses for the four properties you manage yourself.' },
  { id: 'info', icon: '🧾', label: 'Property Info',
    hint: 'Enter each property\u2019s annual property-tax and insurance amounts.' },
];

/**
 * InputDataPage — landing page with three sub-sections where Dianne enters data.
 * Keeps her whole monthly workflow on one tab.
 */
export default function InputDataPage({
  // Core data
  properties, expenses, rentPayments, tenants,
  // Mutations
  addExpense, addRentPayment, updateProperty,
  bulkAddExpenses, bulkAddRentPayments,
  bulkDeleteExpenses, bulkDeleteRentPayments,
  updateExpense, deleteExpense,
  updateRentPayment, deleteRentPayment,
  // Modal launchers (for quick-add flows + validation edits)
  onAddRent, onAddExpense, onOpenProperty,
  onEditExpense, onEditRent,
  onNewExpense, onNewRent,
  // UI
  showToast,
}) {
  const [active, setActive] = useState('statements');
  const current = TABS.find(t => t.id === active) || TABS[0];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">📥 Input Data</h2>
        <p className="text-sm text-white/50">
          Your monthly workflow lives here — add statements, record rents, and keep property info current.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap border-b border-white/10 pb-0">
        {TABS.map(tab => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium border-b-2 transition ${
                isActive
                  ? 'border-sky-400 bg-white/5 text-white'
                  : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-base" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Current-tab hint */}
      <p className="text-xs text-white/40 -mt-3">{current.hint}</p>

      {/* Panels */}
      {active === 'statements' && (
        <DocumentImport
          properties={properties}
          expenses={expenses}
          rentPayments={rentPayments}
          addExpense={addExpense}
          addRentPayment={addRentPayment}
          bulkAddExpenses={bulkAddExpenses}
          bulkAddRentPayments={bulkAddRentPayments}
          bulkDeleteExpenses={bulkDeleteExpenses}
          bulkDeleteRentPayments={bulkDeleteRentPayments}
          deleteExpense={deleteExpense}
          deleteRentPayment={deleteRentPayment}
          showToast={showToast}
        />
      )}

      {active === 'validate' && (
        <ValidateTransactions
          expenses={expenses}
          rentPayments={rentPayments}
          properties={properties}
          updateExpense={updateExpense}
          deleteExpense={deleteExpense}
          updateRentPayment={updateRentPayment}
          deleteRentPayment={deleteRentPayment}
          onEditExpense={onEditExpense}
          onEditRent={onEditRent}
          onAddExpense={onNewExpense}
          onAddRent={onNewRent}
          showToast={showToast}
        />
      )}

      {active === 'managed' && (
        <ManagedRentals
          properties={properties}
          rentPayments={rentPayments}
          expenses={expenses}
          tenants={tenants}
          onAddRent={onAddRent}
          onAddExpense={onAddExpense}
          onOpenProperty={onOpenProperty}
        />
      )}

      {active === 'info' && (
        <PropertyInfo
          properties={properties}
          updateProperty={updateProperty}
          showToast={showToast}
        />
      )}
    </div>
  );
}
