# Dulin Properties — Project Guidelines

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
- **Deployment:** Vercel
- **Version Control:** GitHub (mdulin01/dulinproperties)

## File Scope Boundary

**CRITICAL: When working on this project, ONLY access files within the `dulinproperties/` directory.** Do not read, write, or reference files from any sibling project folder (rainbow-rentals, lifedesigncourse, downtownGSO, etc.). If you need something from another project, stop and ask first.

## Infrastructure

- **Firebase Storage Bucket:** `gs://dulinproperties.firebasestorage.app`
- **Storage Rules:** Authenticated users only (`request.auth != null`). Deployed via Firebase CLI.
- **CORS Origins:** `https://www.dulinproperties.app`, `https://dulinproperties.app`, `http://localhost:5173`
- **Billing Plan:** Blaze (pay-as-you-go) — required for Storage
- **Firebase credentials** are in `.env.local` (not committed). Use `VITE_FIREBASE_*` env vars.

## Architecture Notes

- **Main component:** `src/dulin-properties.jsx`
- **Shared utility:** `src/utils.js` — contains `formatCurrency()` used across the app
- **Key component files:**
  - `src/components/Rentals/PropertyCard.jsx` — property card in dashboard grid
  - `src/components/Rentals/PropertyDetail.jsx` — full property detail view
  - `src/components/Rentals/PropertyFinancialBreakdownModal.jsx` — financial breakdown modal
- This project shares a similar structure with `rainbow-rentals` but they are **completely separate** — separate Firebase projects, separate repos, separate domains, separate Vercel deployments.
