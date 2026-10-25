# Dulin Properties

Mike's cross-project notes are in his vault at `~/Dropbox (Personal)/Vault`. When asked about priorities, status across projects, or what Mike decided, read `01-Week/` (newest note) and this project's `NOW.md` there (`10-Folio/` for mikeshealth, `40-Rentals/` for rainbow-rentals and dulinproperties, `20-FCBOH/` for engagement-workspace, `50-Finances/` for mikes-money). Never copy anything from `05-Health/` into this repo, an issue, or a PR.

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
- **FFB-first bookkeeping (July 2026):** the FFB bank statements are the ledger of record for cash, and **every transaction on every bundled account is imported** — not just the rental account. `src/data/ffbStatements.js` holds hand-verified Jan–Jun 2026 statement data (balanced to the penny per account per month) and feeds both the DocumentImport quick-load presets and the Bank Reconciliation tab (`src/components/InputData/FFBReconciliation.jsx`).
  - Shape: `FFB_STATEMENTS[]` → each month has `accounts: []`, one entry per account with its own `summary` and `transactions`. `FFB_ACCOUNTS` is the account registry (•••5710 Rental, •••5711 Rental 2, •••0410 Personal, •••3110). Helpers: `ffbStatementToEntries(stmt, accts?)`, `ffbStatementTotals(stmt)`, `ffbAccount(stmt, acct)`, `ffbAllAccountBlocks()`.
  - **•••3110 is balance-only** — FFB prints no line items for it in any statement, so its month-end balances live separately in `FFB_3110_BALANCES` and its activity appears as the "Transfer to XXX3110" debits on •••0410. The reconciliation UI says this out loud rather than silently omitting the account.
  - Three exclusion categories keep the bank ledger complete without polluting the rental books — all three stay visible in the ledger for reconciliation but are excluded from income/expense totals, the monthly report, the rent ledger and Schedule E: income `owner-distribution` (SIGONFILE deposits = the managers' nets, already counted as gross rent in the owner packets), income `non-rental` (personal credits on •••5711 / •••0410, e.g. annuity payments), and expense `transfer` (card bill payments, investment buys, inter-account transfers, personal insurance). Use the shared helpers in `constants.js`: `countsAsIncome(row)`, `isTransferExpense(e)`, `NON_INCOME_CATEGORIES`.
  - **Split bank entries (July 2026).** One bank line often covers several real transactions — a management company's monthly payment (gross rent in, management fee, repairs, owner distribution), a Lowe's charge across properties, an HOA payment for 3 condos. `src/components/InputData/SplitEntryModal.jsx` (launched from the Split button on each row in `ValidateTransactions.jsx`) breaks one line into parts.
    - **Amounts stay positive on both sides.** Direction is a field, not a sign. A split balances when `sum(income parts) − sum(expense parts) === parent's signed amount` (income parent positive, expense parent negative). Never store negative amounts.
    - Fields: children carry `splitChildOf` (parent id) + `splitGroupId`; parts the modal created also carry `splitCreated: true` so un-splitting can delete them while merely *unlinking* rows Dianne typed herself. Parent carries `splitParent: true`, `splitGroupId`, `splitPartCount`.
    - `isSplitParent(row)` in `constants.js` removes the parent from every total — `countsAsIncome` and `countsAsExpense` both check it. The parent stays visible in the ledger (struck-through, nested children under it) so the bank still reconciles.
    - Save order is children first, parent flag last, so an interrupted save leaves the bank line still counting rather than silently dropping money.
    - Existing rows are offered as link candidates by **date proximity only** — never description (the owner-packet importer drops descriptions) and never amount (a part's amount intentionally differs from the bank line).
    - Anything summing FFB rows must exclude children: `FFBReconciliation.jsx` filters `!splitChildOf` from its match pools, since children inherit the parent's `sourceDocument` and date.
  - **Business-level income:** `BUSINESS_INCOME_CATEGORIES = ['interest', 'business-income']` — counts as income but belongs to no property, so it's excluded from the rent-only subtotal, the rent ledger, and per-property Schedule E line 3 (it lands in a business-level section instead). Alex (the accountant) requires bank interest to be booked somewhere; this is where.
  - **`bankAccount` and `payee`:** imported rows carry `bankAccount` (which bundled account the line came from) and `payee`. FFB prints no payee for ordinary checks — only the number — so `payee` is blank on import and Dianne fills it in from her checkbook via the "who was this to?" button in the validation list. Never repeat the check number in `notes` when the description already contains it, or the row reads "Check #6450, 6450".
  - When a new FFB statement arrives, add a month to `FFB_STATEMENTS` with one `accounts` entry per account plus a `FFB_3110_BALANCES` row. Verification rule, applied **per account**: deposits sum to `depositsTotal`, debits to `debitsTotal`, and `previousBalance + deposits + interest − debits = endingBalance`. Note FFB's deposit count/total excludes the interest line, which it reports separately.

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
