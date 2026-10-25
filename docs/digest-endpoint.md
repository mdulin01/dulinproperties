# Read-only rentals digest

`GET /api/digest` is a server-to-server summary for the Monday rentals digest.
It reads Firestore through the existing server Firebase helper. It never writes,
sends messages, runs a backup, or creates portal tokens.

## Authentication and configuration

In **Vercel → dulinproperties → Settings → Environment Variables**, Mike adds:

| Name | Environment | Sensitive |
| --- | --- | --- |
| `DIGEST_SECRET` | Production | Yes |

Generate a new value locally with `openssl rand -hex 32 | pbcopy` and paste it
straight into Vercel settings. Use a separate value for each rental project.
Never put a value in chat, source, docs, or a PR. The scheduled task receives it
through that task's environment settings. The existing server-side
`FIREBASE_SERVICE_ACCOUNT` configuration is still required for authenticated reads.

The caller sends `Authorization: Bearer <DIGEST_SECRET>`. Missing, empty, or wrong
configuration/header returns **401 with an empty body**, before Firestore is read.
Per the vault's endpoint spec, **all non-GET methods also return empty 401** (the
handoff summary's 405 is superseded by that spec). Every response has
`Cache-Control: no-store`. Read failures return empty 500 and log only a fixed
error label, never the exception or request data.

After review and a separately authorized production deployment, this unsigned
request must print `401`:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://dulinproperties.app/api/digest
```

The draft branch `codex/digest-endpoint` has automatic Git deployments disabled
in `vercel.json` using [Vercel's branch configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentEnabled).
This keeps the PR review local; merging/releasing requires separate authorization.
Adding this endpoint does not configure or run the Monday scheduled task.

## Time, rent and privacy

- `asOf` is a calendar date in `America/New_York`, independent of the server timezone.
  ISO timestamps retain their timezone/instant; date-only records are local dates.
- `rentDue` is the current month's obligation. `rentReceivedThisMonth` is **cash
  received this calendar month**, based on `datePaid`, even if allocated to another
  rent month. Prepaid rent can therefore be `paid` with zero cash received this month.
  Future-dated receipts are excluded.
- Status uses current **rent-month** credits: `paid` when settled (including an
  explicitly paid ledger row), `late` for any balance after grace, and `partial`
  for any remaining balance before grace ends. The specified four-status contract
  has no `unpaid` state, so **`partial` includes zero paid, including before the due
  date**. `vacant` covers vacant, listed, renovating, and future/former households.
  Missing rent tracking uses `null` where the obligation/status is unknown.
- `daysLate` is calendar days since the contractual due date, but only once grace
  has ended; otherwise zero (`null` for unknown Dulin rent status).
- Only the first current tenant's first name is returned. Former/future tenant
  names are omitted. Property rows contain only `name`, `tenant`, `rentDue`,
  `rentReceivedThisMonth`, `status`, `daysLate`, and `leaseEnds`.
- `leaseEnds` is the earliest valid current lease end; `leasesEndingWithin90Days`
  includes today through day 90, excluding explicit month-to-month and vacant
  properties. No tenant identity is included in that list.
- Phone numbers, email addresses, message bodies, AI summaries/replies, portal
  tokens, payment instructions/Zelle details, and full tenant names are never
  projected into the response. These rules also apply to error responses.

## Dulin response

```json
{
  "asOf": "2026-11-03",
  "properties": [
    {"name": "Sample home", "tenant": "Avery", "rentDue": 1500, "rentReceivedThisMonth": 1500, "status": "paid", "daysLate": 0, "leaseEnds": "2027-01-31"}
  ],
  "leasesEndingWithin90Days": ["Sample home 2027-01-31"],
  "expensesThisMonthByCategory": {"repair": 250, "management-fee": 100},
  "documentsAddedLast7Days": [{"property": "Sample home", "type": "lease", "addedAt": "2026-11-02T14:00:00.000Z"}],
  "lastBackup": "2026-11-01T14:00:00.000Z",
  "backupDates": ["2026-10-25", "2026-11-01"],
  "backupSizeBytes": 12345
}
```

Uses the Firebase helper introduced in PR #1, pinned to the **dulinproperties**
project. Reads `rentalData/{properties,rent,expenses,documents,backupMeta}` and the
newest `backup-YYYY-MM-DD` named in validated backup metadata. No comms features
are invented for this app.

Rent uses the stored `monthlyRent`, `rent`/`prepaid-rent` receipts, and existing
`countsAsIncome` exclusions. Distributions, deposits, fees, non-rental income and
split parents do not count as rent. Stored tenant/property due and grace terms
are honored if present, otherwise due day 1 and a 5-day grace period are assumed.
This app does not currently track prorated obligations. Missing rent amounts,
owner-occupied obligations, or a missing rent ledger produce null status rather
than implying paid rent; a present empty ledger means no receipts.

Expenses are grouped by existing allowed categories for the current Eastern
month through `asOf`, using `countsAsExpense`. Transfers, distributions, split
parents and recurring templates are excluded. Unrecognized categories become
`other`. Missing expense tracking returns null, an existing empty ledger returns
an empty object. Amounts are rounded to cents.

Documents are a list of **only property, allowed type and addedAt**, based on
`createdAt` within the last 168 hours (inclusive), newest first. Unknown types
become `other`, unknown properties become null. Titles, filenames, URLs, file
contents and notes are excluded. Missing document tracking returns null; an
existing empty index returns an empty list.

`lastBackup` is the normalized ISO instant from `rentalData/backupMeta.lastAt`, or
null. `backupDates` contains validated dates in ascending order. `backupSizeBytes`
is the UTF-8 byte length of the newest backup document's `json` string, or null
when metadata/snapshot/payload is missing. The backup JSON itself is never returned.
No backup is created or repaired by this endpoint; see [weekly-backup.md](weekly-backup.md).

## Local verification

Synthetic fixtures only; no live credentials or Firestore access:

```sh
TZ=UTC npm run test:digest
TZ=Pacific/Honolulu npm run test:digest
npm run test:backup
node scripts/ownerPacketParser.test.mjs
npm run build
git diff --check
```

The tests cover authentication before any reads, non-GET behavior, privacy,
Eastern summer/winter/DST and grace boundaries, missing tracking, accounting
exclusions, document windows and UTF-8 backup byte size. The loader is tested
with a read-only store that has no mutation methods.
