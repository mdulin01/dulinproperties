/**
 * FFB Bank statements — hand-verified data for the Dulin family's First
 * Financial Bank relationship, keyed directly from the statement PDFs.
 *
 * This file is the single source of truth for:
 *   1. The one-click "quick-load" import presets in DocumentImport.
 *   2. The Bank Reconciliation panel (statement totals + line-by-line check).
 *
 * ACCOUNTS — one statement package covers four accounts. Every transaction
 * that FFB prints a line item for is captured here, across all accounts:
 *
 *   •••5710  Rental Account (Dianne / Mike / Joe Dulin) — the main rental
 *            operating account. Tenant rents, manager distributions, all
 *            property bills.
 *   •••5711  Second rental-titled account. Nearly dormant: interest plus a
 *            couple of mobile check deposits (flagged for review).
 *   •••0410  Bill J Dulin / Dianne / Mike / Joe — personal. TIAA annuity
 *            credits, personal insurance, internal transfers, personal
 *            checks. Marked nonRental so nothing here reaches the rental
 *            books: income rows use 'non-rental', debits use 'transfer'.
 *   •••3110  Balance only. FFB does NOT print line items for 3110 in these
 *            statements — it appears solely in SUMMARY OF ACCOUNTS. Its
 *            activity is visible indirectly as the "Transfer to XXX3110"
 *            debits on 0410. See FFB_3110_BALANCES below.
 *
 * Income categories:
 *   'rent'               — direct tenant rent hitting the bank (Apartments.com
 *                          deposits, the monthly mobile-check rent deposit).
 *   'owner-distribution' — SIGONFILE deposits from Barnett & Hill / Absolute.
 *                          These are the NET of rents the managers already
 *                          collected, so they are EXCLUDED from income totals
 *                          (the per-property rents from the owner packets are
 *                          the income of record). They exist so the bank
 *                          ledger is complete and reconcilable.
 *   'non-rental'         — personal money on the non-rental accounts
 *                          (annuities, personal deposits, their interest).
 *                          Excluded from rental income totals and Schedule E.
 *   'interest'           — bank interest on the rental accounts.
 *
 * Expense category 'transfer' marks money that left an account but is NOT a
 * rental expense (credit-card bill payments — the card statements carry the
 * real line items — investment buys, internal transfers, personal items).
 * Transfers are excluded from expense totals just like owner distributions.
 *
 * Every account/month has been cross-checked against the statement's own
 * summary: deposits sum to depositsTotal, debits sum to debitsTotal, and
 * previousBalance + deposits + interest − debits = endingBalance.
 */

/** Account metadata, in statement order. */
export const FFB_ACCOUNTS = [
  { acct: '5710', number: '4127835710', label: '•••5710 Rental',  title: 'Dianne / Mike / Joe Dulin — Rental Account', nonRental: false, detail: true },
  { acct: '5711', number: '4127835711', label: '•••5711 Rental 2', title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account', nonRental: false, detail: true },
  { acct: '0410', number: '4128290410', label: '•••0410 Personal', title: 'Bill J Dulin / Dianne / Mike / Joe Dulin', nonRental: true,  detail: true },
  { acct: '3110', number: '4127843110', label: '•••3110 (balance only)', title: 'Heritage Checking', nonRental: true, detail: false },
];

/** Kept for backwards compatibility — the primary rental account. */
export const FFB_ACCOUNT = '...5710';

/**
 * •••3110 has NO line-item detail in the 2026 statements — only a balance in
 * SUMMARY OF ACCOUNTS. Recorded here so the reconciliation panel can say so
 * out loud rather than silently omitting the account.
 */
export const FFB_3110_BALANCES = [

  { monthStr: '2026-01', endingBalance: 5440.13 },
  { monthStr: '2026-02', endingBalance: 4249.87 },
  { monthStr: '2026-03', endingBalance: 4313.98 },
  { monthStr: '2026-04', endingBalance: 5062.44 },
  { monthStr: '2026-05', endingBalance: 5603.28 },
  { monthStr: '2026-06', endingBalance: 5825.73 },
];

export const FFB_STATEMENTS = [
  {
    id: 'jan26',
    monthStr: '2026-01',
    label: 'January 2026',
    periodLabel: '1/01 – 1/30',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 128917.32,
          depositsTotal: 11862.83, depositCount: 6,
          debitsTotal: 9998.47, debitCount: 11,
          interest: 39.79,
          endingBalance: 130821.47,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1600.00, date: '2026-01-05', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-01-06', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-01-06', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 700.00, date: '2026-01-12', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7142.83, date: '2026-01-13', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 600.00, date: '2026-01-23', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'Interest Deposit', amount: 39.79, date: '2026-02-01', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #865)', amount: 25.69, date: '2026-01-12', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #866)', amount: 221.02, date: '2026-01-12', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'ZEL* Marnie Montelongo', amount: 150.00, date: '2026-01-14', cat: 'other', vendor: 'Marnie Montelongo' },
          { flow: 'expense', desc: 'Lowes - Repairs/Supplies', amount: 1169.95, date: '2026-01-20', cat: 'repair', vendor: 'Lowes', checkNum: '90172' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-01-21', cat: 'internet', vendor: 'Vexus', checkNum: '90173' },
          // Checks
          { flow: 'expense', desc: 'Check #6443', amount: 150.00, date: '2026-01-09', cat: 'other', vendor: '', checkNum: '6443' },
          { flow: 'expense', desc: 'Check #6444', amount: 6500.00, date: '2026-01-07', cat: 'other', vendor: '', checkNum: '6444' },
          { flow: 'expense', desc: 'Check #6445', amount: 1314.00, date: '2026-01-09', cat: 'other', vendor: '', checkNum: '6445' },
          { flow: 'expense', desc: 'Check #6446', amount: 55.00, date: '2026-01-21', cat: 'other', vendor: '', checkNum: '6446' },
          { flow: 'expense', desc: 'Check #6447', amount: 141.65, date: '2026-01-21', cat: 'other', vendor: '', checkNum: '6447' },
          { flow: 'expense', desc: 'Check #6448', amount: 162.76, date: '2026-01-26', cat: 'other', vendor: '', checkNum: '6448' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 8671.29,
          depositsTotal: 205.81, depositCount: 1,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.16,
          endingBalance: 8878.26,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Mobile Check Deposit (verify — rental or personal?)', amount: 205.81, date: '2026-01-12', incomeCat: 'other', vendor: '' },
          { flow: 'income', desc: 'Interest Deposit', amount: 1.16, date: '2026-02-01', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 16930.90,
          depositsTotal: 275.51, depositCount: 2,
          debitsTotal: 2405.49, debitCount: 3,
          interest: 3.42,
          endingBalance: 14804.34,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-01-05', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-01-05', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Interest Deposit', amount: 3.42, date: '2026-02-01', incomeCat: 'non-rental', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Bill Paid - CITIBUSINESS (Conf #867)', amount: 2020.49, date: '2026-01-13', cat: 'transfer', vendor: 'Citibusiness' },
          { flow: 'expense', desc: 'Check #9872', amount: 300.00, date: '2026-01-02', cat: 'transfer', vendor: '', checkNum: '9872' },
          { flow: 'expense', desc: 'Check #9874', amount: 85.00, date: '2026-01-21', cat: 'transfer', vendor: '', checkNum: '9874' },
        ],
      },
    ],
  },

  {
    id: 'feb26',
    monthStr: '2026-02',
    label: 'February 2026',
    periodLabel: '2/02 – 2/27',
    startDate: '2026-02-02',
    endDate: '2026-03-01',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 130821.47,
          depositsTotal: 32757.35, depositCount: 9,
          debitsTotal: 7904.45, debitCount: 12,
          interest: 39.32,
          endingBalance: 155713.69,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 836.10, date: '2026-02-03', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 9130.35, date: '2026-02-03', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-02-05', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-02-06', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 800.00, date: '2026-02-06', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1625.00, date: '2026-02-06', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 200.00, date: '2026-02-11', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7744.70, date: '2026-02-11', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 10601.20, date: '2026-02-23', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'Interest Deposit', amount: 39.32, date: '2026-03-01', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #872)', amount: 25.69, date: '2026-02-02', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #871)', amount: 281.46, date: '2026-02-02', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'QBooks Online - Intuit', amount: 122.59, date: '2026-02-05', cat: 'software', vendor: 'Intuit' },
          { flow: 'expense', desc: 'Bill Paid - Citibusiness (Conf #878)', amount: 4786.16, date: '2026-02-06', cat: 'transfer', vendor: 'Citibusiness' },
          { flow: 'expense', desc: 'Lowes - Repairs/Supplies', amount: 805.07, date: '2026-02-09', cat: 'repair', vendor: 'Lowes', checkNum: '90176' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #881)', amount: 271.22, date: '2026-02-20', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-02-25', cat: 'internet', vendor: 'Vexus', checkNum: '90179' },
          // Checks
          { flow: 'expense', desc: 'Check #6449', amount: 120.84, date: '2026-02-09', cat: 'other', vendor: '', checkNum: '6449' },
          { flow: 'expense', desc: 'Check #6450', amount: 100.00, date: '2026-02-05', cat: 'other', vendor: '', checkNum: '6450' },
          { flow: 'expense', desc: 'Check #6451', amount: 126.02, date: '2026-02-23', cat: 'other', vendor: '', checkNum: '6451' },
          { flow: 'expense', desc: 'Check #6452', amount: 657.00, date: '2026-02-27', cat: 'other', vendor: '', checkNum: '6452' },
          { flow: 'expense', desc: 'Check #6455', amount: 500.00, date: '2026-02-26', cat: 'other', vendor: '', checkNum: '6455' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 8878.26,
          depositsTotal: 0.00, depositCount: 0,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.02,
          endingBalance: 8879.28,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Interest Deposit', amount: 1.02, date: '2026-03-01', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 14804.34,
          depositsTotal: 275.51, depositCount: 2,
          debitsTotal: 5109.00, debitCount: 3,
          interest: 2.43,
          endingBalance: 9973.28,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-02-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-02-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Interest Deposit', amount: 2.43, date: '2026-03-01', incomeCat: 'non-rental', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Transfer from XXX0410 to XXX3110 (Conf #29370709)', amount: 1000.00, date: '2026-02-11', cat: 'transfer', vendor: '' },
          { flow: 'expense', desc: 'Transfer from XXX0410 to XXX3110 (Conf #29417225)', amount: 1000.00, date: '2026-02-17', cat: 'transfer', vendor: '' },
          { flow: 'expense', desc: 'Bill Paid - STATE FARM INS Auto/Life/Fire/Health (Conf #882)', amount: 3109.00, date: '2026-02-25', cat: 'transfer', vendor: 'State Farm' },
        ],
      },
    ],
  },

  {
    id: 'mar26',
    monthStr: '2026-03',
    label: 'March 2026',
    periodLabel: '3/02 – 3/31',
    startDate: '2026-03-02',
    endDate: '2026-03-31',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 155713.69,
          depositsTotal: 21778.16, depositCount: 6,
          debitsTotal: 12616.53, debitCount: 11,
          interest: 46.22,
          endingBalance: 164921.54,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 1400.00, date: '2026-03-04', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-03-05', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1600.00, date: '2026-03-06', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-03-09', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7106.08, date: '2026-03-11', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 9852.08, date: '2026-03-27', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'Interest Deposit', amount: 46.22, date: '2026-03-31', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #887)', amount: 27.74, date: '2026-03-04', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'Bill Paid - Citibusiness (Conf #890)', amount: 4786.16, date: '2026-03-09', cat: 'transfer', vendor: 'Citibusiness' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-03-23', cat: 'internet', vendor: 'Vexus', checkNum: '90181' },
          { flow: 'expense', desc: 'State Life Insurance Co (personal - review)', amount: 6720.46, date: '2026-03-25', cat: 'transfer', vendor: 'State Life Insurance', checkNum: '90182' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #895)', amount: 30.96, date: '2026-03-26', cat: 'utilities', vendor: 'Atmos Energy' },
          // Checks
          { flow: 'expense', desc: 'Check #6453', amount: 148.01, date: '2026-03-02', cat: 'other', vendor: '', checkNum: '6453' },
          { flow: 'expense', desc: 'Check #6454', amount: 313.80, date: '2026-03-09', cat: 'other', vendor: '', checkNum: '6454' },
          { flow: 'expense', desc: 'Check #6456', amount: 200.00, date: '2026-03-24', cat: 'other', vendor: '', checkNum: '6456' },
          { flow: 'expense', desc: 'Check #6457', amount: 146.00, date: '2026-03-31', cat: 'other', vendor: '', checkNum: '6457' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 100.00, date: '2026-03-03', cat: 'other', vendor: '', checkNum: '9999' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 35.00, date: '2026-03-30', cat: 'other', vendor: '', checkNum: '9999' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 8879.28,
          depositsTotal: 154.71, depositCount: 1,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.09,
          endingBalance: 9035.08,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Mobile Check Deposit (verify — rental or personal?)', amount: 154.71, date: '2026-03-31', incomeCat: 'other', vendor: '' },
          { flow: 'income', desc: 'Interest Deposit', amount: 1.09, date: '2026-03-31', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 9973.28,
          depositsTotal: 275.51, depositCount: 2,
          debitsTotal: 300.00, debitCount: 1,
          interest: 1.99,
          endingBalance: 9950.78,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-03-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-03-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Interest Deposit', amount: 1.99, date: '2026-03-31', incomeCat: 'non-rental', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Check #9875', amount: 300.00, date: '2026-03-30', cat: 'transfer', vendor: '', checkNum: '9875' },
        ],
      },
    ],
  },

  {
    id: 'apr26',
    monthStr: '2026-04',
    label: 'April 2026',
    periodLabel: '4/01 – 4/30',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 164921.54,
          depositsTotal: 23602.83, depositCount: 9,
          debitsTotal: 8781.34, debitCount: 12,
          interest: 48.44,
          endingBalance: 179791.47,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-04-06', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 600.00, date: '2026-04-06', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1600.00, date: '2026-04-06', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-04-07', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 500.00, date: '2026-04-09', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 765.00, date: '2026-04-14', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 877.50, date: '2026-04-14', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 6286.03, date: '2026-04-14', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 11154.30, date: '2026-04-28', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'Interest Deposit', amount: 48.44, date: '2026-04-30', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'ZEL* Marnie Montelongo', amount: 163.00, date: '2026-04-03', cat: 'other', vendor: 'Marnie Montelongo' },
          { flow: 'expense', desc: 'Bill Paid - Costco Anywhere Card (Conf #901)', amount: 1455.59, date: '2026-04-08', cat: 'transfer', vendor: 'Costco Card' },
          { flow: 'expense', desc: 'Bill Paid - Costco Anywhere Card (Conf #902)', amount: 4679.01, date: '2026-04-10', cat: 'transfer', vendor: 'Costco Card' },
          { flow: 'expense', desc: 'ZEL* Michael Dulin (personal - review)', amount: 300.00, date: '2026-04-13', cat: 'transfer', vendor: 'Michael Dulin' },
          { flow: 'expense', desc: 'Lowes - Repairs/Supplies', amount: 40.72, date: '2026-04-13', cat: 'repair', vendor: 'Lowes', checkNum: '90184' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-04-16', cat: 'internet', vendor: 'Vexus', checkNum: '90185' },
          // Checks
          { flow: 'expense', desc: 'Check #6458', amount: 130.00, date: '2026-04-08', cat: 'other', vendor: '', checkNum: '6458' },
          { flow: 'expense', desc: 'Check #6459', amount: 1314.00, date: '2026-04-16', cat: 'other', vendor: '', checkNum: '6459' },
          { flow: 'expense', desc: 'Check #6460', amount: 130.00, date: '2026-04-14', cat: 'other', vendor: '', checkNum: '6460' },
          { flow: 'expense', desc: 'Check #6461', amount: 212.00, date: '2026-04-14', cat: 'other', vendor: '', checkNum: '6461' },
          { flow: 'expense', desc: 'Check #6462', amount: 208.62, date: '2026-04-28', cat: 'other', vendor: '', checkNum: '6462' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 40.00, date: '2026-04-24', cat: 'other', vendor: '', checkNum: '9999' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 9035.08,
          depositsTotal: 0.00, depositCount: 0,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.12,
          endingBalance: 9036.20,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Interest Deposit', amount: 1.12, date: '2026-04-30', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 9950.78,
          depositsTotal: 275.51, depositCount: 2,
          debitsTotal: 300.00, debitCount: 1,
          interest: 1.51,
          endingBalance: 9927.80,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-04-03', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-04-03', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Interest Deposit', amount: 1.51, date: '2026-04-30', incomeCat: 'non-rental', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'ZEL* Michael Dulin (personal)', amount: 300.00, date: '2026-04-13', cat: 'transfer', vendor: 'Michael Dulin' },
        ],
      },
    ],
  },

  {
    id: 'may26',
    monthStr: '2026-05',
    label: 'May 2026',
    periodLabel: '5/01 – 5/31',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 179791.47,
          depositsTotal: 23258.53, depositCount: 7,
          debitsTotal: 126182.95, debitCount: 9,
          interest: 40.94,
          endingBalance: 76907.99,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-05-05', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1600.00, date: '2026-05-06', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-05-07', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 8068.40, date: '2026-05-12', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 600.00, date: '2026-05-14', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 11125.13, date: '2026-05-22', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 45.00, date: '2026-05-28', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'Interest Deposit', amount: 40.94, date: '2026-05-31', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #909)', amount: 29.38, date: '2026-05-01', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'ZEL* Marnie Montelongo', amount: 250.00, date: '2026-05-04', cat: 'other', vendor: 'Marnie Montelongo' },
          { flow: 'expense', desc: 'Bill Paid - Costco Anywhere Card (Conf #912)', amount: 4783.48, date: '2026-05-11', cat: 'transfer', vendor: 'Costco Card' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-05-18', cat: 'internet', vendor: 'Vexus', checkNum: '90190' },
          { flow: 'expense', desc: 'Vanguard Investment Buy (not an expense)', amount: 120000.00, date: '2026-05-19', cat: 'transfer', vendor: 'Vanguard' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #915)', amount: 25.69, date: '2026-05-26', cat: 'utilities', vendor: 'Atmos Energy' },
          { flow: 'expense', desc: 'State Farm - Auto/Life/Fire/Health (Conf #918 - review)', amount: 906.00, date: '2026-05-26', cat: 'insurance', vendor: 'State Farm' },
          // Checks
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 40.00, date: '2026-05-12', cat: 'other', vendor: '', checkNum: '9999' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 40.00, date: '2026-05-27', cat: 'other', vendor: '', checkNum: '9999' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 9036.20,
          depositsTotal: 0.00, depositCount: 0,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.15,
          endingBalance: 9037.35,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Interest Deposit', amount: 1.15, date: '2026-05-31', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 9927.80,
          depositsTotal: 1916.33, depositCount: 3,
          debitsTotal: 0.00, debitCount: 0,
          interest: 2.14,
          endingBalance: 11846.27,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-05-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-05-04', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Mobile Check Deposit (personal account)', amount: 1640.82, date: '2026-05-26', incomeCat: 'non-rental', vendor: '' },
          { flow: 'income', desc: 'Interest Deposit', amount: 2.14, date: '2026-05-31', incomeCat: 'non-rental', vendor: 'FFB Bank' },
        ],
      },
    ],
  },

  {
    id: 'jun26',
    monthStr: '2026-06',
    label: 'June 2026',
    periodLabel: '6/01 – 6/30',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    accounts: [
      {
        acct: '5710',
        title: 'Dianne / Mike / Joe Dulin — Rental Account',
        summary: {
          previousBalance: 76907.99,
          depositsTotal: 22858.20, depositCount: 7,
          debitsTotal: 26329.96, debitCount: 11,
          interest: 19.76,
          endingBalance: 73455.99,
        },
        transactions: [
          // Deposits
          { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-06-03', incomeCat: 'rent', vendor: 'HodkiApartments.com' },
          { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-06-05', incomeCat: 'rent', vendor: '' },
          { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7413.40, date: '2026-06-10', incomeCat: 'owner-distribution', vendor: 'Barnett & Hill' },
          { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1625.00, date: '2026-06-23', incomeCat: 'rent', vendor: 'WalliApartments.com' },
          { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 500.00, date: '2026-06-24', incomeCat: 'rent', vendor: 'BerryApartments.com' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 11409.80, date: '2026-06-24', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 90.00, date: '2026-06-29', incomeCat: 'owner-distribution', vendor: 'Absolute RE' },
          { flow: 'income', desc: 'Interest Deposit', amount: 19.76, date: '2026-06-30', incomeCat: 'interest', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Bill Paid - Costco Anywhere Card (Conf #922)', amount: 406.22, date: '2026-06-08', cat: 'transfer', vendor: 'Costco Card' },
          { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-06-16', cat: 'internet', vendor: 'Vexus', checkNum: '90194' },
          { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #926)', amount: 27.83, date: '2026-06-26', cat: 'utilities', vendor: 'Atmos Energy' },
          // Checks
          { flow: 'expense', desc: 'Check #6463', amount: 25.00, date: '2026-06-10', cat: 'other', vendor: '', checkNum: '6463' },
          { flow: 'expense', desc: 'Check #6464', amount: 1314.00, date: '2026-06-03', cat: 'other', vendor: '', checkNum: '6464' },
          { flow: 'expense', desc: 'Check #6465', amount: 85.66, date: '2026-06-15', cat: 'other', vendor: '', checkNum: '6465' },
          { flow: 'expense', desc: 'Check #6466 (large - review)', amount: 23077.85, date: '2026-06-10', cat: 'other', vendor: '', checkNum: '6466' },
          { flow: 'expense', desc: 'Check #6467', amount: 1000.00, date: '2026-06-24', cat: 'other', vendor: '', checkNum: '6467' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 45.00, date: '2026-06-02', cat: 'other', vendor: '', checkNum: '9999' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 40.00, date: '2026-06-15', cat: 'other', vendor: '', checkNum: '9999' },
          { flow: 'expense', desc: 'Counter Check (#9999)', amount: 200.00, date: '2026-06-22', cat: 'other', vendor: '', checkNum: '9999' },
        ],
      },
      {
        acct: '5711',
        title: 'Bill J Dulin / Dianne / Mike / Joe — Rental Account',
        summary: {
          previousBalance: 9037.35,
          depositsTotal: 0.00, depositCount: 0,
          debitsTotal: 0.00, debitCount: 0,
          interest: 1.11,
          endingBalance: 9038.46,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'Interest Deposit', amount: 1.11, date: '2026-06-30', incomeCat: 'interest', vendor: 'FFB Bank' },
        ],
      },
      {
        acct: '0410',
        title: 'Bill J Dulin / Dianne / Mike / Joe Dulin',
        nonRental: true,
        summary: {
          previousBalance: 11846.27,
          depositsTotal: 861.34, depositCount: 3,
          debitsTotal: 300.00, debitCount: 1,
          interest: 2.52,
          endingBalance: 12410.13,
        },
        transactions: [
          // Deposits / credits
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 119.71, date: '2026-06-03', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'ANNUITY T-C IND&INST INC — Dianne Dulin (personal)', amount: 155.80, date: '2026-06-03', incomeCat: 'non-rental', vendor: 'T-C IND&INST INC' },
          { flow: 'income', desc: 'Mobile Check Deposit (personal account)', amount: 585.83, date: '2026-06-05', incomeCat: 'non-rental', vendor: '' },
          { flow: 'income', desc: 'Interest Deposit', amount: 2.52, date: '2026-06-30', incomeCat: 'non-rental', vendor: 'FFB Bank' },
          // Debits
          { flow: 'expense', desc: 'Check #9876', amount: 300.00, date: '2026-06-02', cat: 'transfer', vendor: '', checkNum: '9876' },
        ],
      },
    ],
  },

];


/** All statements' accounts flattened: [{ stmt, account }]. */
export function ffbAllAccountBlocks() {
  return FFB_STATEMENTS.flatMap(stmt => stmt.accounts.map(account => ({ stmt, account })));
}

/** The account block for a given statement + account id. */
export function ffbAccount(stmt, acct) {
  return (stmt?.accounts || []).find(a => a.acct === acct);
}

/** Statement-wide totals (all accounts combined). */
export function ffbStatementTotals(stmt) {
  return (stmt.accounts || []).reduce((t, a) => ({
    depositsTotal: Math.round((t.depositsTotal + a.summary.depositsTotal) * 100) / 100,
    debitsTotal: Math.round((t.debitsTotal + a.summary.debitsTotal) * 100) / 100,
    interest: Math.round((t.interest + a.summary.interest) * 100) / 100,
    lineCount: t.lineCount + a.transactions.length,
  }), { depositsTotal: 0, debitsTotal: 0, interest: 0, lineCount: 0 });
}

/**
 * Convert a statement's transactions into DocumentImport review entries.
 *
 * @param stmt   one entry of FFB_STATEMENTS
 * @param accts  optional array of account ids to include (default: all)
 */
export function ffbStatementToEntries(stmt, accts) {
  const wanted = Array.isArray(accts) && accts.length ? accts : null;
  const out = [];
  (stmt.accounts || []).forEach(a => {
    if (wanted && !wanted.includes(a.acct)) return;
    a.transactions.forEach((item, i) => {
      out.push({
        id: `ffb-${stmt.id}-${a.acct}-${i}`,
        description: item.desc,
        amount: item.amount,
        date: item.date,
        category: item.cat || '',
        vendor: item.vendor || '',
        checkNumber: item.checkNum || '',
        account: `...${a.acct}`,
        ffbAccount: a.acct,
        tenantName: '',
        propertyId: '',
        propertyName: '',
        sourceDocument: 'FFB Bank',
        flowType: item.flow,
        incomeCategory: item.flow === 'income' ? (item.incomeCat || 'rent') : undefined,
        selected: true,
        imported: false,
      });
    });
  });
  return out;
}

export default FFB_STATEMENTS;
