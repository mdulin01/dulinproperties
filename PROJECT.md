# Rainbow Rentals

## Overview
Rental property management app for tracking properties, tenants, finances, and documents. Includes a shared hub for tasks and collaboration.

- **Domain**: rainbowrentals.app
- **GitHub**: github.com/mdulin01/rainbow-rentals (branch: main)
- **Vercel Project**: rainbow-rentals
- **Firebase Project**: rainbow-rentals
- **Firebase Auth Domain**: rainbow-rentals.firebaseapp.com

## Tech Stack
React 18 + Vite + Tailwind CSS, Firebase Auth (Google), Firestore, Firebase Storage. Deployed on Vercel.

## Architecture
Single-page app with main component `src/rainbow-rentals.jsx`. Custom hooks per feature (`useProperties`, `useFinancials`, `useDocuments`, `useSharedHub`). Components organized by feature area under `src/components/`.

### Key Sections
- **Rentals**: Property cards, property detail view, tenant management
- **Financials**: Transaction tracking, income/expense recording, financial summaries
- **Documents**: Upload/organize leases, contracts, receipts with viewer
- **Shared Hub**: Tasks, ideas, shared lists (same pattern as MikeandAdam)

### Component Structure
```
src/components/
  Rentals/     - NewPropertyModal, PropertyCard, PropertyDetail, TenantModal
  Financials/  - AddTransactionModal, FinancialSummary, TransactionCard
  Documents/   - AddDocumentModal, DocumentCard, DocumentViewer
  SharedHub/   - AddTaskModal, AddIdeaModal, TaskCard, IdeaCard, ListCard, etc.
```

## Remaining Work

### High Priority
- [ ] Test and fix any modal prop mismatches (recent fix in last commit)
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
cd rainbow-rentals
npm run dev      # Dev server
npm run build    # Production build
git push         # Push to GitHub
```
