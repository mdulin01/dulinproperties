# Weekly Firestore backup

The Vercel cron checks daily at 14:00 UTC (10 a.m. Eastern daylight time,
9 a.m. Eastern standard time). It writes a snapshot only when the previous
one is at least 6.5 days old. A missed day is caught on the next daily run.
This adapts `weeklyBackup()` from Rainbow Rentals; the projects and credentials
remain separate.

## Setup and activation

Before deploying, configure these **server-only Production environment variables**
in the Dulin Properties Vercel project:

- `FIREBASE_SERVICE_ACCOUNT`: a service-account JSON (raw or base64) for the
  `dulinproperties` Firebase project, with Firestore read/write permissions.
  A service account from any other project is rejected. Use the existing secret
  settings; never paste the value in a chat or commit it. Do not use a `VITE_` prefix.
- `CRON_SECRET`: a random secret of at least 16 characters. Vercel supplies it as
  a bearer token when running the job. A missing secret fails closed.

After review, deploy to Production. In Vercel Settings → Cron Jobs, verify
`/api/cron/backup` appears and run it once. Expect `200` with a backup date.
An immediate repeat returns `backup: null`. An authenticated request with
`?dry=1` skips Firebase entirely; it does **not** verify credentials or storage.
An unsigned request must return `401`, not the SPA HTML.

Confirm in the **Dulin Properties** Firestore console that
`rentalData/backupMeta.lastAt` advanced and the dated snapshot exists. Check the
cron logs for non-200 responses and monitor the timestamp for staleness.
A failure returns `500`; metadata and old snapshots remain unchanged.

## Contents and retention

- `rentalData/backup-YYYY-MM-DD` contains `json`, `at`, and `by: 'cron'`.
- `rentalData/backupMeta` lists the eight retained dates and last successful time.
- Every top-level `rentalData` document is included except IDs starting with
  `backup`. Properties, expenses, financials, rent, reconciliations, and the shared
  hub are included. The document index retains metadata and Storage references,
  but embedded `fileData` and legacy `fileUrl` data URLs are omitted. Normal
  Storage URLs stay in the index.
- Writes, pruning, and metadata use one transaction. Oversized snapshots
  (over 950 KiB of JSON) fail before any changes; move to managed exports if needed.
- This is an application-data snapshot **in the same Firestore database**.
  It does not cover Firebase Auth, Storage file contents, subcollections, other
  collections, or whole-project loss. Existing Firestore access rules still apply.

## Recovery

Use the Firebase console to privately save the selected snapshot's `json` value.
Validate its date and contents before restoring. The JSON maps document IDs to
their original data: restore each entry to `rentalData/<document ID>` only after
an owner-reviewed recovery plan and a separate capture of the current state.
Do not import `backup*` entries, publish the export, or delete current documents
automatically. Storage files must still exist separately.

Validation uses fictional fixtures: `npm run test:backup`, then `npm run build`.
These checks do not write production data or prove the deployed cron is active.
With the Firebase CLI and Java installed, `npm run test:backup:emulator` also
checks retention, concurrent duplicate delivery, and oversized-backup failure
against a local Firestore emulator in the isolated `demo-dulin-backup` project.
`tests/backup.rules` is for that emulator only; it is not a production rules file.

References: [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
and [Firestore limits](https://firebase.google.com/docs/firestore/quotas).
