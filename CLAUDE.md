# Dulin Properties

## Overview

Rental property management app for tracking properties, tenants, finances, documents, and expenses. Includes a shared hub for tasks and collaboration.

## Key URLs & Resources

| Resource | URL |
|----------|-----|
| **Live Site** | https://dulinproperties.app |
| **GitHub Repository** | https://github.com/mdulin01/dulinproperties |
| **Firebase Console** | https://console.firebase.google.com/project/dulinproperties |
| **Vercel Dashboard** | https://vercel.com/dashboard |

## Technical Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend/Database:** Firebase (Firestore, Authentication, Storage)
- **Deployment:** Vercel (auto-deploys from GitHub)
- **Version Control:** GitHub (mdulin01/dulinproperties)

## Infrastructure

- **Firebase Storage Bucket:** `gs://dulinproperties.firebasestorage.app`
- **Storage Rules:** Authenticated users only (`request.auth != null`)
- **CORS Origins:** `https://www.dulinproperties.app`, `https://dulinproperties.app`, `http://localhost:5173`
- **Billing Plan:** Blaze (pay-as-you-go) — required for Storage
- **Firebase credentials** are in `.env.local` (not committed). Use `VITE_FIREBASE_*` env vars.

## Project Structure

```
dulinproperties/
├── src/
│   ├── dulin-properties.jsx     # Main app component
│   ├── main.jsx                 # Entry point
│   ├── constants.js, theme.js, logger.js, utils.js
│   ├── firebase-config.js       # Firebase initialization
│   ├── components/
│   │   ├── Rentals/             # PropertyCard, PropertyDetail, TenantModal, NewPropertyModal, PropertyFinancialBreakdownModal
│   │   ├── Financials/          # AddTransactionModal, FinancialSummary, TransactionCard
│   │   ├── Expenses/            # Expense tracking (with mileage rate calc)
│   │   ├── Documents/           # AddDocumentModal, DocumentCard, DocumentViewer
│   │   ├── SharedHub/           # Tasks, ideas, lists
│   │   ├── Rent/                # Rent tracking
│   │   ├── Tenants/             # Tenant management
│   │   ├── LoginScreen.jsx, BuildInfo.jsx, ConfirmDialog.jsx
│   │   └── ...
│   ├── contexts/
│   │   └── SharedHubContext.jsx  # Shared state context
│   ├── hooks/
│   │   ├── useProperties.js, useRent.js, useExpenses.js
│   │   ├── useFinancials.js, useDocuments.js, useSharedHub.js
│   │   └── ...
│   └── utils/
│       └── ownerPacketParser.js  # Management company report parser
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── vercel.json
```

## Architecture Notes

- Main component: `src/dulin-properties.jsx`
- Custom hooks per feature area (useProperties, useFinancials, etc.)
- SharedHubContext for tasks/ideas/lists
- Management company detection uses card color: teal/default=Absolute, purple/violet/indigo=Barnett & Hill, rose/pink=Dianne Dulin. Use `getManager(p.color)`.
- Desktop nav has a hardcoded section list separate from `allSections` — update BOTH when adding nav sections.
- Action items for managed properties (Absolute, Barnett & Hill) should be excluded — only show owner-action items for Dianne Dulin (self-managed) properties.
- Shares structural patterns with `rainbow-rentals` but they are **completely separate** Firebase projects, repos, domains, and deployments.
- **FFB-first bookkeeping (July 2026):** the FFB bank statements (rental account •••5710) are the ledger of record for cash. `src/data/ffbStatements.js` holds hand-verified Jan–Jun 2026 statement data (summaries + transactions, balanced to the penny) and feeds both the DocumentImport quick-load presets and the Bank Reconciliation tab (`src/components/InputData/FFBReconciliation.jsx`). Two categories prevent double-counting against the owner packets: income `owner-distribution` (SIGONFILE deposits = managers' nets, excluded from income totals) and expense `transfer` (card bill payments / investment buys / personal, excluded from expense totals). When a new FFB statement arrives, add its month to `ffbStatements.js` following the existing pattern — the verification rule is deposits sum to depositsTotal, debits to debitsTotal, and previousBalance + deposits + interest − debits = endingBalance.

## Dev Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Cross-Project Learning Log

A shared learning file lives at `../learning.md` (one level up in the Coding-Projects root). **Read it at session start.** Write new learnings to it before session end, at compaction, and roughly every 30 minutes of active work. Entries should include date, project name, and a concise actionable lesson.

## File Scope Boundary

**CRITICAL: When working on this project, ONLY access files within the `dulinproperties/` directory.** Do not read, write, or reference files from any sibling project folder. If you need something from another project, stop and ask first.
