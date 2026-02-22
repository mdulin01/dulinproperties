# Dulin Properties

## Overview
Rental property management app for tracking properties, tenants, finances, and documents. Includes a shared hub for tasks and collaboration.

- **Domain**: dulinproperties.app
- **GitHub**: github.com/mdulin01/dulinproperties (branch: main)
- **Vercel Project**: dulinproperties
- **Firebase Project**: dulinproperties
- **Firebase Auth Domain**: dulinproperties.firebaseapp.com

## Tech Stack
React 18 + Vite + Tailwind CSS, Firebase Auth (Google), Firestore, Firebase Storage. Deployed on Vercel.

### Environment Variables
Firebase credentials are stored in `.env.local` (not committed). For deployment, add `VITE_FIREBASE_*` variables in Vercel project settings. See `.env.example` for the full list.

## Architecture
Single-page app with main component `src/dulin-properties.jsx`. Custom hooks per feature (`useProperties`, `useFinancials`, `useDocuments`, `useExpenses`, `useSharedHub`). Components organized by feature area under `src/components/`.

### Key Sections
- **Rentals**: Property cards, property detail view, tenant management
- **Financials**: Transaction tracking, income/expense recording, financial summaries
- **Expenses**: Expense tracking with mileage rate calculation
- **Documents**: Upload/organize leases, contracts, receipts with viewer
- **Shared Hub**: Tasks, ideas, shared lists

### Component Structure
```
src/components/
  Rentals/     - NewPropertyModal, PropertyCard, PropertyDetail, TenantModal
  Financials/  - AddTransactionModal, FinancialSummary, TransactionCard
  Expenses/    - Expense tracking components
  Documents/   - AddDocumentModal, DocumentCard, DocumentViewer
  SharedHub/   - AddTaskModal, AddIdeaModal, TaskCard, IdeaCard, ListCard, etc.
  Rent/        - Rent tracking components
  Tenants/     - Tenant management components
```

## Remaining Work

### High Priority
- [ ] Test and fix any modal prop mismatches
- [ ] Verify Firestore rules are properly configured
- [ ] End-to-end testing of property CRUD flow

### Medium Priority
- [ ] Maintenance request tracking
- [ ] Lease expiration reminders
- [ ] Financial reporting / charts
- [ ] Document search and tagging

### Lower Priority
- [ ] Multi-user access (property managers)
- [ ] Tenant portal
- [ ] Integration with payment platforms

## Git Quick Reference
```bash
cd dulinproperties
npm run dev      # Dev server
npm run build    # Production build
git push         # Push to GitHub
```
