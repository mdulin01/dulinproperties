import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, ChevronDown, Check, X, AlertCircle, FileText, Trash2, Loader, Calendar, ArrowRight } from 'lucide-react';
import HelpTip from '../HelpTip';
import { expenseCategories, incomeCategories } from '../../constants';
import { formatCurrency } from '../../utils';
import { parseOwnerPacket } from '../../utils/ownerPacketParser';

/**
 * DocumentImport – upload/parse management company statements, bank statements, etc.
 * Lives on the Documents page. Supports:
 *   - Barnett & Hill owner statements
 *   - Absolute Real Estate owner packets
 *   - FFB bank statements
 *   - Citi Card statements
 *
 * For each source the user can upload a PDF (future: auto-parse) or review
 * pre-parsed entries before importing them to the Expenses ledger.
 */

const SOURCE_TYPES = [
  { id: 'barnett-hill', label: 'Barnett & Hill', color: 'purple', icon: '🏢', canParsePdf: true, expectedCountPerMonth: 10 },
  { id: 'absolute', label: 'Absolute', color: 'teal', icon: '🏠', canParsePdf: true, expectedCountPerMonth: 12 },
  { id: 'ffb-bank', label: 'FFB Bank', color: 'blue', icon: '🏦', canParsePdf: false, expectedCountPerMonth: 8 },
  { id: 'citi-card', label: 'Citi Card', color: 'amber', icon: '💳', canParsePdf: false, expectedCountPerMonth: 2 },
  { id: 'costco-card', label: 'Costco Card', color: 'rose', icon: '🛒', canParsePdf: false, expectedCountPerMonth: 3 },
];

/**
 * Return months for the current year in chronological order (Jan first),
 * each as { ym: "YYYY-MM", label: "March 2026", short: "Mar '26", isFuture, isCurrent }.
 * When called from the grid we reverse to newest-first and collapse the "done" rows.
 */
function monthsForYear(year) {
  const out = [];
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const short = d.toLocaleDateString('en-US', { month: 'short' });
    out.push({
      ym,
      label,
      short,
      isFuture: ym > curYM,
      isCurrent: ym === curYM,
    });
  }
  return out;
}

const colorMap = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', accent: 'bg-purple-500' },
  teal:   { bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   text: 'text-teal-400',   accent: 'bg-teal-500' },
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   accent: 'bg-blue-500' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  accent: 'bg-amber-500' },
  rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   accent: 'bg-rose-500' },
};

/** Try to match a street address from a statement to a property in the properties list.
 *  Handles abbreviation differences (Road/Rd, Street/St, Drive/Dr, etc.) and
 *  the 5297 Taos / 5297 Pueblo collision by matching full street name.
 */
function matchProperty(addressFromStatement, properties) {
  if (!addressFromStatement) return null;

  const normalize = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/\bstreet\b/g, 'st')
      .replace(/\broad\b/g, 'rd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\bplace\b/g, 'pl')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\blane\b/g, 'ln')
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const addr = normalize(addressFromStatement);

  // Direct match
  for (const p of properties) {
    if (normalize(p.street) === addr) return p;
  }

  // Fuzzy: check if the property street is contained in the address or vice versa
  for (const p of properties) {
    const ps = normalize(p.street);
    if (addr.includes(ps) || ps.includes(addr)) return p;
  }

  // Number + partial street name match (but require street name, not just number)
  const addrParts = addr.split(' ');
  const addrNum = addrParts[0];
  const addrStreet = addrParts.slice(1).join(' ');
  for (const p of properties) {
    const ps = normalize(p.street);
    const psParts = ps.split(' ');
    const psNum = psParts[0];
    const psStreet = psParts.slice(1).join(' ');
    if (addrNum === psNum && addrStreet && psStreet && (addrStreet.includes(psStreet.split(' ')[0]) || psStreet.includes(addrStreet.split(' ')[0]))) {
      // Make sure we're not confusing Taos/Pueblo - require first word of street to match
      const addrFirstWord = addrStreet.split(' ')[0];
      const psFirstWord = psStreet.split(' ')[0];
      if (addrFirstWord === psFirstWord) return p;
    }
  }

  return null;
}

/** Guess expense category from a description string */
function guessCategory(description) {
  const d = (description || '').toLowerCase();
  if (d.includes('management fee')) return 'management-fee';
  if (d.includes('owner distribution') || d.includes('owner payment')) return 'owner-distribution';
  if (d.includes('repair') || d.includes('maintenance')) return 'repair';
  if (d.includes('insurance')) return 'insurance';
  if (d.includes('tax')) return 'taxes';
  if (d.includes('hoa')) return 'hoa';
  if (d.includes('pest')) return 'pest-control';
  if (d.includes('plumb')) return 'plumbing';
  if (d.includes('electric')) return 'electrical';
  if (d.includes('hvac') || d.includes('heat') || d.includes('air condition')) return 'hvac';
  if (d.includes('clean')) return 'cleaning';
  if (d.includes('landscap') || d.includes('lawn') || d.includes('mow')) return 'landscaping';
  if (d.includes('legal') || d.includes('attorney')) return 'legal';
  if (d.includes('atmos') || d.includes('gas bill') || d.includes('utilit') || d.includes('water') || d.includes('sewer')) return 'utilities';
  if (d.includes('internet') || d.includes('vexus') || d.includes('cable')) return 'internet';
  if (d.includes('lowe') || d.includes('home depot') || d.includes('hardware')) return 'repair';
  if (d.includes('appliance')) return 'appliance';
  if (d.includes('mortgage')) return 'mortgage';
  return 'other';
}

/**
 * Generate pre-parsed entries from Barnett & Hill Feb 2026 owner statement.
 * Each property's rent, mgmt fees, repairs, and distributions.
 */
function parseBHFeb2026(properties) {
  const bhData = [
    { address: '5102 Encino Rd', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 680, date: '2026-02-01', tenant: 'Renate Evans' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 68, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 612, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '5217 Questa Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1300, date: '2026-02-01', tenant: 'kaelyn G. merrell' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 130, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1170, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '5220 Encino Rd', items: [
      { flow: 'income', desc: 'Rent Income - January 2026 (late)', amount: 12, date: '2026-02-02', tenant: 'Estela Contreras' },
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 323, date: '2026-02-02', tenant: 'Estela Contreras' },
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 676, date: '2026-02-03', tenant: 'Estela Contreras' },
      { flow: 'expense', desc: 'Repairs - Hill Properties Repair Bill', amount: 21, date: '2026-02-10', cat: 'repair', vendor: 'Hill Properties' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 101.10, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 738.90, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '5297 Pueblo Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 900, date: '2026-02-04', tenant: 'Leevon M. Henderson' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 90, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 810, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '5426 Durango Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 77, date: '2026-02-02', tenant: 'Elena Flores' },
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1075, date: '2026-02-03', tenant: 'Elena Flores' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 115.20, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1036.80, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '657 Ruidosa Dr #215', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 845, date: '2026-02-04', tenant: 'Odyssey N. Keller' },
      { flow: 'expense', desc: 'Repairs - Hill Properties Repair Bill', amount: 30, date: '2026-02-10', cat: 'repair', vendor: 'Hill Properties' },
      { flow: 'expense', desc: 'Management fees - 01/2026', amount: 53, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 85, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1397, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '657 Ruidosa Dr #220', items: [
      // Beginning balance $800 from Jan prepaid rent - mgmt fee and dist against it
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 80, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 720, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '840 Poplar St', items: [
      // Beginning balance $700 from Jan prepaid rent - repairs and mgmt against it
      { flow: 'expense', desc: 'Repairs - Hill Properties Repair Bill', amount: 1032.55, date: '2026-02-10', cat: 'repair', vendor: 'Hill Properties' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 70, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
    ]},
    { address: '842 Poplar St', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 550, date: '2026-02-02', tenant: 'Jay Bridges' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 55, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 495, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
    { address: '5402 S 7th St', items: [
      // Sunset Villa #106 - beginning balance $850 from Jan prepaid
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 85, date: '2026-02-10', cat: 'management-fee', vendor: 'Barnett & Hill' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 765, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Barnett & Hill' },
    ]},
  ];

  const entries = [];
  let idx = 0;
  for (const prop of bhData) {
    const matched = matchProperty(prop.address, properties);
    for (const item of prop.items) {
      entries.push({
        id: `bh-feb26-${idx++}`,
        description: item.desc,
        amount: item.amount,
        date: item.date,
        category: item.cat || 'other',
        vendor: item.vendor || '',
        tenantName: item.tenant || '',
        propertyId: matched ? String(matched.id) : '',
        propertyName: matched ? `${matched.emoji || '🏠'} ${matched.name}` : `⚠️ ${prop.address}`,
        propertyHint: prop.address,
        sourceDocument: 'Barnett & Hill',
        flowType: item.flow,
        incomeCategory: item.flow === 'income' ? 'rent' : undefined,
        selected: true,
        imported: false,
      });
    }
  }
  return entries;
}

/**
 * Generate pre-parsed entries from FFB Jan 2026 bank statement.
 * Account 4127835710 (main rental account): deposits, debits, and checks.
 * Account 4128290410: annuity deposits, insurance, Citi payment, checks.
 * Account 4127835711: mobile deposit + interest only.
 */
function parseFFBJan2026() {
  const items = [
    // --- Account 4127835710 – DEPOSITS ---
    { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1600.00, date: '2026-01-05', vendor: 'WalliApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-01-06', vendor: '', acct: '...5710' },
    { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-01-06', vendor: 'HodkiApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 700.00, date: '2026-01-12', vendor: 'BerryApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7142.83, date: '2026-01-13', vendor: 'Barnett & Hill', acct: '...5710' },
    { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 600.00, date: '2026-01-23', vendor: 'BerryApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'Interest Deposit', amount: 39.79, date: '2026-02-01', vendor: 'FFB Bank', acct: '...5710' },
    // --- Account 4127835710 – DEBITS ---
    { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #865)', amount: 25.69, date: '2026-01-12', cat: 'utilities', vendor: 'Atmos Energy', acct: '...5710' },
    { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #866)', amount: 221.02, date: '2026-01-12', cat: 'utilities', vendor: 'Atmos Energy', acct: '...5710' },
    { flow: 'expense', desc: 'ZEL* Marnie Montelongo', amount: 150.00, date: '2026-01-14', cat: 'other', vendor: 'Marnie Montelongo', acct: '...5710' },
    { flow: 'expense', desc: 'Lowes - Repairs/Supplies', amount: 1169.95, date: '2026-01-20', cat: 'repair', vendor: 'Lowes', checkNum: '90172', acct: '...5710' },
    { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-01-21', cat: 'internet', vendor: 'Vexus', checkNum: '90173', acct: '...5710' },
    // --- Account 4127835710 – CHECKS ---
    { flow: 'expense', desc: 'Check #6443', amount: 150.00, date: '2026-01-09', cat: 'other', vendor: '', checkNum: '6443', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6444', amount: 6500.00, date: '2026-01-07', cat: 'other', vendor: '', checkNum: '6444', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6445', amount: 1314.00, date: '2026-01-09', cat: 'other', vendor: '', checkNum: '6445', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6446', amount: 55.00, date: '2026-01-21', cat: 'other', vendor: '', checkNum: '6446', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6447', amount: 141.65, date: '2026-01-21', cat: 'other', vendor: '', checkNum: '6447', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6448', amount: 162.76, date: '2026-01-26', cat: 'other', vendor: '', checkNum: '6448', acct: '...5710' },
    // --- Account 4127835711 – DEPOSITS ---
    { flow: 'income', desc: 'Mobile Check Deposit', amount: 205.81, date: '2026-01-12', vendor: '', acct: '...5711' },
    { flow: 'income', desc: 'Interest Deposit', amount: 1.16, date: '2026-02-01', vendor: 'FFB Bank', acct: '...5711' },
    // --- Account 4128290410 – DEPOSITS ---
    { flow: 'income', desc: 'Annuity - T-C IND&INST INC (Dianne Flint)', amount: 119.71, date: '2026-01-05', vendor: 'T-C IND&INST INC', acct: '...0410' },
    { flow: 'income', desc: 'Annuity - T-C IND&INST INC (Dianne Flint)', amount: 155.80, date: '2026-01-05', vendor: 'T-C IND&INST INC', acct: '...0410' },
    { flow: 'income', desc: 'Interest Deposit', amount: 3.42, date: '2026-02-01', vendor: 'FFB Bank', acct: '...0410' },
    // --- Account 4128290410 – DEBITS ---
    { flow: 'expense', desc: 'Bill Paid - Citibusiness (Conf #867)', amount: 2020.49, date: '2026-01-13', cat: 'other', vendor: 'Citibusiness', acct: '...0410' },
    // --- Account 4128290410 – CHECKS ---
    { flow: 'expense', desc: 'Check #9872', amount: 300.00, date: '2026-01-02', cat: 'other', vendor: '', checkNum: '9872', acct: '...0410' },
    { flow: 'expense', desc: 'Check #9874', amount: 85.00, date: '2026-01-21', cat: 'other', vendor: '', checkNum: '9874', acct: '...0410' },
  ];

  return items.map((item, i) => ({
    id: `ffb-jan26-${i}`,
    description: item.desc,
    amount: item.amount,
    date: item.date,
    category: item.cat || '',
    vendor: item.vendor || '',
    checkNumber: item.checkNum || '',
    account: item.acct || '',
    tenantName: '',
    propertyId: '',
    propertyName: '',
    sourceDocument: 'FFB Bank',
    flowType: item.flow,
    incomeCategory: item.flow === 'income' ? 'rent' : undefined,
    selected: true,
    imported: false,
  }));
}

/**
 * Generate pre-parsed entries from FFB Feb 2026 bank statement.
 * Account 4127835710 (main rental account): deposits, debits, and checks.
 * Account 4128290410: annuity deposits, transfers, insurance, checks.
 * Account 4127835711: interest only.
 */
function parseFFBFeb2026() {
  const items = [
    // --- Account 4127835710 – DEPOSITS ---
    { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 836.10, date: '2026-02-03', vendor: 'Absolute RE', acct: '...5710' },
    { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 9130.35, date: '2026-02-03', vendor: 'Absolute RE', acct: '...5710' },
    { flow: 'income', desc: 'APTS HodkiApartments.com - Rent Deposit', amount: 925.00, date: '2026-02-05', vendor: 'HodkiApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'Mobile Check Deposit', amount: 895.00, date: '2026-02-06', vendor: '', acct: '...5710' },
    { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 800.00, date: '2026-02-06', vendor: 'BerryApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'APTS WalliApartments.com - Rent Deposit', amount: 1625.00, date: '2026-02-06', vendor: 'WalliApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'APTS BerryApartments.com - Rent Deposit', amount: 200.00, date: '2026-02-11', vendor: 'BerryApartments.com', acct: '...5710' },
    { flow: 'income', desc: 'SIGONFILE Barnett & Hill - Owner Distribution', amount: 7744.70, date: '2026-02-11', vendor: 'Barnett & Hill', acct: '...5710' },
    { flow: 'income', desc: 'SIGONFILE Absolute Real Es - Owner Distribution', amount: 10601.20, date: '2026-02-23', vendor: 'Absolute RE', acct: '...5710' },
    { flow: 'income', desc: 'Interest Deposit', amount: 39.32, date: '2026-03-01', vendor: 'FFB Bank', acct: '...5710' },
    // --- Account 4127835710 – DEBITS ---
    { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #872)', amount: 25.69, date: '2026-02-02', cat: 'utilities', vendor: 'Atmos Energy', acct: '...5710' },
    { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #871)', amount: 281.46, date: '2026-02-02', cat: 'utilities', vendor: 'Atmos Energy', acct: '...5710' },
    { flow: 'expense', desc: 'QBooks Online - Intuit', amount: 122.59, date: '2026-02-05', cat: 'software', vendor: 'Intuit', acct: '...5710' },
    { flow: 'expense', desc: 'Bill Paid - Citibusiness (Conf #878)', amount: 4786.16, date: '2026-02-06', cat: 'other', vendor: 'Citibusiness', acct: '...5710' },
    { flow: 'expense', desc: 'Lowes - Repairs/Supplies', amount: 805.07, date: '2026-02-09', cat: 'repair', vendor: 'Lowes', checkNum: '90176', acct: '...5710' },
    { flow: 'expense', desc: 'Atmos Energy - Gas (Conf #881)', amount: 271.22, date: '2026-02-20', cat: 'utilities', vendor: 'Atmos Energy', acct: '...5710' },
    { flow: 'expense', desc: 'Vexus - Internet', amount: 108.40, date: '2026-02-25', cat: 'internet', vendor: 'Vexus', checkNum: '90179', acct: '...5710' },
    // --- Account 4127835710 – CHECKS ---
    { flow: 'expense', desc: 'Check #6449', amount: 120.84, date: '2026-02-09', cat: 'other', vendor: '', checkNum: '6449', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6450', amount: 100.00, date: '2026-02-05', cat: 'other', vendor: '', checkNum: '6450', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6451', amount: 126.02, date: '2026-02-23', cat: 'other', vendor: '', checkNum: '6451', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6452', amount: 657.00, date: '2026-02-27', cat: 'other', vendor: '', checkNum: '6452', acct: '...5710' },
    { flow: 'expense', desc: 'Check #6455', amount: 500.00, date: '2026-02-26', cat: 'other', vendor: '', checkNum: '6455', acct: '...5710' },
    // --- Account 4127835711 – DEPOSITS ---
    { flow: 'income', desc: 'Interest Deposit', amount: 1.02, date: '2026-03-01', vendor: 'FFB Bank', acct: '...5711' },
    // --- Account 4128290410 – DEPOSITS ---
    { flow: 'income', desc: 'Annuity - T-C IND&INST INC (Dianne Flint)', amount: 119.71, date: '2026-02-04', vendor: 'T-C IND&INST INC', acct: '...0410' },
    { flow: 'income', desc: 'Annuity - T-C IND&INST INC (Dianne Flint)', amount: 155.80, date: '2026-02-04', vendor: 'T-C IND&INST INC', acct: '...0410' },
    { flow: 'income', desc: 'Interest Deposit', amount: 2.43, date: '2026-03-01', vendor: 'FFB Bank', acct: '...0410' },
    // --- Account 4128290410 – DEBITS ---
    { flow: 'expense', desc: 'Transfer to ...3110 (Conf #29370709)', amount: 1000.00, date: '2026-02-11', cat: 'other', vendor: 'Internal Transfer', acct: '...0410' },
    { flow: 'expense', desc: 'Transfer to ...3110 (Conf #29417225)', amount: 1000.00, date: '2026-02-17', cat: 'other', vendor: 'Internal Transfer', acct: '...0410' },
    { flow: 'expense', desc: 'State Farm Insurance - Auto/Life/Fire/Health (Conf #882)', amount: 3109.00, date: '2026-02-25', cat: 'insurance', vendor: 'State Farm', acct: '...0410' },
  ];

  return items.map((item, i) => ({
    id: `ffb-feb26-${i}`,
    description: item.desc,
    amount: item.amount,
    date: item.date,
    category: item.cat || '',
    vendor: item.vendor || '',
    checkNumber: item.checkNum || '',
    account: item.acct || '',
    tenantName: '',
    propertyId: '',
    propertyName: '',
    sourceDocument: 'FFB Bank',
    flowType: item.flow,
    incomeCategory: item.flow === 'income' ? 'rent' : undefined,
    selected: true,
    imported: false,
  }));
}

/**
 * Generate pre-parsed entries from Absolute RE Feb 2026 owner packet.
 * 12 properties with rent, mgmt fees, repairs, late fees, and distributions.
 */
function parseAbsoluteFeb2026(properties) {
  const absData = [
    { address: '1329 S 11th St', unit: 'A', items: [
      { flow: 'income', desc: 'Rent Income - February 2026 (Unit A)', amount: 728.33, date: '2026-02-01', tenant: 'Jaime B. Salazar' },
      { flow: 'expense', desc: 'Electricity - Unit A', amount: 53.56, date: '2026-02-01', cat: 'utilities', vendor: 'Electric Company' },
      { flow: 'expense', desc: 'Plumbing Repair - Unit A', amount: 98, date: '2026-02-01', cat: 'plumbing', vendor: 'Plumber' },
      { flow: 'expense', desc: 'Cleaning - Unit A', amount: 55, date: '2026-02-01', cat: 'cleaning', vendor: 'Cleaning Service' },
      { flow: 'expense', desc: 'Management fees - 02/2026 (Unit A)', amount: 72.83, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026 (Unit A)', amount: 255.44, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '1329 S 11th St', unit: 'B', items: [
      { flow: 'income', desc: 'Rent Income - February 2026 (Unit B)', amount: 725, date: '2026-02-01', tenant: 'Byron C. Plummer' },
      { flow: 'expense', desc: 'Repairs - Unit B', amount: 165, date: '2026-02-01', cat: 'repair', vendor: 'Repair Service' },
      { flow: 'expense', desc: 'Management fees - 02/2026 (Unit B)', amount: 72.50, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026 (Unit B)', amount: 487.50, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '1357 Sammons St', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1000, date: '2026-02-01', tenant: 'Michelle Arrendondo' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 100, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 900, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '1725 Partridge Pl', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1600, date: '2026-02-01', tenant: 'Alfreda O. Colbert' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 160, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1429.76, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '2234 Bel Air Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 895, date: '2026-02-01', tenant: 'Lisa Polk' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 89.50, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 805.50, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '3510 Brook Hollow Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1550, date: '2026-02-01', tenant: 'Roberto Garcia' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 155, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1395, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5297 Taos Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 750, date: '2026-02-01', tenant: 'Linda Gray' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 75, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 675, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5341 Pueblo Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 975, date: '2026-02-01', tenant: 'Joe C. Rubalicado' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 97.50, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 877.50, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5350 Pueblo Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1250, date: '2026-02-01', tenant: 'Morgan A. Huff' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 125, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1125, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5397 Pueblo Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 1150, date: '2026-02-01', tenant: 'David A. Saucedo' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 115, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 1035, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5490 Questa Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 900, date: '2026-02-01', tenant: 'Courtney A. Strong' },
      { flow: 'income', desc: 'Late Fee - February 2026', amount: 95, date: '2026-02-01', tenant: 'Courtney A. Strong', incCat: 'late-fee' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 90, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Late Fee Management Charge - 02/2026', amount: 9.50, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 895.50, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
    { address: '5209 Springbrook Dr', items: [
      { flow: 'income', desc: 'Rent Income - February 2026', amount: 800, date: '2026-02-01', tenant: 'Terry Henry' },
      { flow: 'expense', desc: 'Management fees - 02/2026', amount: 80, date: '2026-02-10', cat: 'management-fee', vendor: 'Absolute RE' },
      { flow: 'expense', desc: 'Owner Distribution - 02/2026', amount: 720, date: '2026-02-10', cat: 'owner-distribution', vendor: 'Absolute RE' },
    ]},
  ];

  const entries = [];
  let idx = 0;
  for (const prop of absData) {
    const matched = matchProperty(prop.address, properties);
    for (const item of prop.items) {
      const label = prop.unit ? `${prop.address} (${prop.unit})` : prop.address;
      entries.push({
        id: `abs-feb26-${idx++}`,
        description: item.desc,
        amount: item.amount,
        date: item.date,
        category: item.cat || 'other',
        vendor: item.vendor || '',
        tenantName: item.tenant || '',
        propertyId: matched ? String(matched.id) : '',
        propertyName: matched ? `${matched.emoji || '🏠'} ${matched.name}` : `⚠️ ${label}`,
        propertyHint: label,
        sourceDocument: 'Absolute',
        flowType: item.flow,
        incomeCategory: item.flow === 'income' ? (item.incCat || 'rent') : undefined,
        selected: true,
        imported: false,
      });
    }
  }
  return entries;
}

/**
 * Compact fingerprint so exact duplicates from re-imports can be detected without
 * relying on amount + date alone (which collides on recurring items like rent/mgmt fees).
 * Format: "YYYY-MM-DD|source|propId|amount|first 24 chars of description".
 */
function fingerprintEntry(e) {
  const date = (e.date || e.datePaid || '').slice(0, 10);
  const src = e.sourceDocument || '';
  const propId = String(e.propertyId || '');
  const amt = (parseFloat(e.amount) || 0).toFixed(2);
  const desc = (e.description || e.category || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 24).trim();
  return `${date}|${src}|${propId}|${amt}|${desc}`;
}

export default function DocumentImport({
  properties, expenses, rentPayments = [],
  addExpense, addRentPayment,
  bulkAddExpenses, bulkAddRentPayments,
  deleteExpense, deleteRentPayment,
  bulkDeleteExpenses, bulkDeleteRentPayments,
  showToast, onClose,
}) {
  const [replacingExisting, setReplacingExisting] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const [entries, setEntries] = useState([]); // parsed entries for review
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [ffbMonth, setFfbMonth] = useState(null); // 'jan26' | 'feb26' for FFB sub-selector
  const [detectedMonth, setDetectedMonth] = useState(null); // auto-detected from uploaded PDF period
  const [parsingPdf, setParsingPdf] = useState(false);
  const [parseError, setParseError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Build a { "YYYY-MM": { "Source Label": count } } map of existing imports
  // so the monthly grid can show which statements have been processed.
  const statusByMonth = useMemo(() => {
    const grid = {};
    const touch = (ym, src) => {
      if (!ym || !src) return;
      if (!grid[ym]) grid[ym] = {};
      grid[ym][src] = (grid[ym][src] || 0) + 1;
    };
    for (const e of expenses || []) {
      const ym = (e.date || '').slice(0, 7);
      touch(ym, e.sourceDocument);
    }
    for (const r of rentPayments || []) {
      const ym = (r.month || (r.datePaid || '').slice(0, 7));
      touch(ym, r.sourceDocument);
    }
    return grid;
  }, [expenses, rentPayments]);

  // Fingerprint set of every existing imported entry (expense + rent). Used to auto-skip
  // exact duplicates when parsing a re-imported PDF.
  const existingFingerprints = useMemo(() => {
    const set = new Set();
    for (const e of expenses || []) {
      if (!e.sourceDocument) continue;
      set.add(fingerprintEntry(e));
    }
    for (const r of rentPayments || []) {
      if (!r.sourceDocument) continue;
      set.add(fingerprintEntry({ ...r, date: r.datePaid || `${r.month || ''}-01` }));
    }
    return set;
  }, [expenses, rentPayments]);

  // All 12 months of the current year (chronological). Newest-first + row collapsing is
  // handled in the grid render so we can also show an "X months completed — tap to expand" row.
  const CURRENT_YEAR = new Date().getFullYear();
  const MONTHS = useMemo(() => monthsForYear(CURRENT_YEAR), [CURRENT_YEAR]);
  const [showCompletedMonths, setShowCompletedMonths] = useState(false);

  // Toggle entry selected state
  const toggleEntry = useCallback((idx) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  }, []);

  // Update entry field
  const updateEntry = useCallback((idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }, []);

  // Remove entry from review list
  const removeEntry = useCallback((idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Select/deselect all
  const selectAll = useCallback((val) => {
    setEntries(prev => prev.map(e => ({ ...e, selected: val })));
  }, []);

  // Import selected entries
  /**
   * Import selected entries in TWO Firestore writes (one for expenses, one for rent),
   * not one-per-entry. Rapid per-entry writes to the same document exceed Firestore's
   * ~1-write-per-second throttle and many fail silently.
   */
  const handleImport = useCallback(async () => {
    const selected = entries.filter(e => e.selected);
    if (selected.length === 0) return;
    setImporting(true);

    const expensePayloads = [];
    const rentPayloads = [];
    selected.forEach((entry, i) => {
      const fp = fingerprintEntry(entry);
      const base = {
        id: `import-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        propertyId: entry.propertyId || '',
        propertyName: entry.propertyName || '',
        sourceDocument: entry.sourceDocument,
        fingerprint: fp,
        validated: false,
      };
      if (entry.flowType === 'income') {
        rentPayloads.push({
          ...base,
          tenantName: entry.tenantName || '',
          amount: entry.amount,
          month: entry.date ? entry.date.substring(0, 7) : '',
          datePaid: entry.date,
          status: 'paid',
          category: entry.incomeCategory || 'rent',
          notes: `Imported from ${entry.sourceDocument}`,
        });
      } else {
        expensePayloads.push({
          ...base,
          category: entry.category || 'other',
          description: entry.description,
          amount: entry.amount,
          date: entry.date,
          vendor: entry.vendor || '',
          notes: entry.checkNumber ? `Check #${entry.checkNumber}` : (entry.notes || ''),
          checkNumber: entry.checkNumber || '',
        });
      }
    });

    // Prefer bulk functions; fall back to per-entry for backward compat if hooks are missing them.
    let expOk = true, rentOk = true;
    let expCount = 0, rentCount = 0;
    try {
      if (bulkAddExpenses) {
        const r = await bulkAddExpenses(expensePayloads);
        expOk = !!r?.ok;
        expCount = r?.count || 0;
      } else {
        expensePayloads.forEach(p => addExpense(p));
        expCount = expensePayloads.length;
      }
      if (bulkAddRentPayments) {
        const r = await bulkAddRentPayments(rentPayloads);
        rentOk = !!r?.ok;
        rentCount = r?.count || 0;
      } else {
        rentPayloads.forEach(p => addRentPayment(p));
        rentCount = rentPayloads.length;
      }
    } catch (err) {
      console.error('[DocumentImport] handleImport failed:', err);
      showToast(`Import failed: ${err.message}`, 'error');
      setImporting(false);
      return;
    }

    const total = expCount + rentCount;
    setImportedCount(total);
    setImporting(false);

    if (expOk && rentOk && total > 0) {
      showToast(`Imported ${total} ${total === 1 ? 'entry' : 'entries'} — saved successfully`, 'success');
      setEntries(prev => prev.map(e => e.selected ? { ...e, imported: true, selected: false } : e));
    } else if (total > 0) {
      showToast(`Import incomplete — some entries failed to save. Check the console.`, 'error');
    } else {
      showToast('Nothing was saved. Please try again or contact support.', 'error');
    }
  }, [entries, addExpense, addRentPayment, bulkAddExpenses, bulkAddRentPayments, showToast]);

  // Find duplicate: return matching existing expense/rent entries or null.
  //
  // Cross-source fuzzy check. Fingerprint-based dedup already catches exact
  // re-imports of the same statement (same source). This one catches the case
  // where the same real-world transaction lives in two different statements
  // (e.g., B&H rent row + FFB deposit row).
  //
  // IMPORTANT: earlier version had `desc.includes(entryDesc.substring(0,20))`,
  // and `"anything".includes("")` is `true` in JS. So any entry with an empty
  // or very short description matched every other row with the same date+amount.
  // Guard against that and also require the property to match when both sides
  // know their property.
  const findDuplicate = useCallback((entry) => {
    const entryDesc = (entry.description || '').toLowerCase().trim();
    const entryAmt = parseFloat(entry.amount) || 0;
    // Need a real amount, real date, and a distinctive description substring.
    if (!entry.date || entryAmt === 0 || entryDesc.length < 6) return null;
    const needle = entryDesc.slice(0, 20);

    const rentAsExpenseShape = (rentPayments || []).map(r => ({
      ...r,
      date: r.datePaid || (r.month ? `${r.month}-01` : ''),
      description: r.description || r.category || r.tenantName || '',
    }));
    const candidates = [...(expenses || []), ...rentAsExpenseShape];

    const matches = candidates.filter(e => {
      if (Math.abs((parseFloat(e.amount) || 0) - entryAmt) >= 0.01) return false;
      if (e.date !== entry.date) return false;
      if (entry.propertyId && e.propertyId && String(e.propertyId) !== String(entry.propertyId)) return false;
      return (e.description || '').toLowerCase().includes(needle);
    });
    return matches.length > 0 ? matches : null;
  }, [expenses, rentPayments]);

  /**
   * Parse an uploaded PDF file using pdfjs-dist (via parseOwnerPacket).
   * Works well for Absolute + Barnett & Hill owner packets.
   * For FFB / Citi the user should paste text (their layouts vary more).
   */
  const handlePdfFile = useCallback(async (file, sourceLabel) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('That does not look like a PDF file. Please drop a .pdf.');
      return;
    }
    setParsingPdf(true);
    setParseError('');
    setUploadedFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const result = await parseOwnerPacket(new Uint8Array(buf));
      if (!result.allTransactions || result.allTransactions.length === 0) {
        setParseError('No transactions found in that PDF. Check that it is a monthly owner statement.');
        setParsingPdf(false);
        return;
      }
      // Auto-detect month
      if (result.period?.monthStr) setDetectedMonth(result.period.monthStr);

      // Map parser output to our entry shape, then fingerprint each to auto-skip duplicates.
      const mapped = result.allTransactions.map((tx, idx) => {
        const matched = matchProperty(tx.propertyAddress || tx.propertyFullAddress, properties);
        const isIncome = tx.flowType === 'income' || (tx.cashIn > 0 && !tx.isDistribution);
        const entry = {
          id: `upload-${Date.now()}-${idx}`,
          description: tx.description || tx.payee || tx.type || 'Unknown',
          amount: tx.amount || tx.cashIn || tx.cashOut || 0,
          date: tx.date || (result.period?.startDate) || '',
          category: tx.category || (isIncome ? 'rent' : 'other'),
          vendor: tx.payee || '',
          tenantName: isIncome ? (tx.payee || '') : '',
          propertyId: matched ? String(matched.id) : '',
          propertyName: matched ? `${matched.emoji || '🏠'} ${matched.name}` : `⚠️ ${tx.propertyAddress || 'Unmatched'}`,
          propertyHint: tx.propertyAddress || '',
          sourceDocument: sourceLabel,
          flowType: isIncome ? 'income' : 'expense',
          incomeCategory: isIncome ? 'rent' : undefined,
          imported: false,
        };
        // Dedup: fingerprint match = likely re-import of the same line → auto-skip.
        const fp = fingerprintEntry(entry);
        const isDuplicate = existingFingerprints.has(fp);
        entry.fingerprint = fp;
        entry.isDuplicate = isDuplicate;
        // Default selection: skip owner distributions AND skip duplicates
        entry.selected = !tx.isDistribution && !isDuplicate;
        return entry;
      });

      setEntries(mapped);
      setParsingPdf(false);
    } catch (err) {
      console.error('PDF parse error:', err);
      setParseError(`Could not read that PDF: ${err.message}`);
      setParsingPdf(false);
    }
  }, [properties]);

  const handleFileInput = useCallback((e, sourceLabel) => {
    const file = e.target.files?.[0];
    if (file) handlePdfFile(file, sourceLabel);
  }, [handlePdfFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(true);
  }, []);
  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
  }, []);
  const handleFileDrop = useCallback((e, sourceLabel) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePdfFile(file, sourceLabel);
  }, [handlePdfFile]);

  // Render the source selection cards
  if (!activeSource) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Import from Statement</h3>
            <p className="text-xs text-white/40">Upload and parse management reports, bank statements, or credit card statements</p>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>

        {/* Friendly how-to banner — helps first-time users (or anyone coming back to it) know what to do */}
        <div className="bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-sky-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5" aria-hidden="true">👋</span>
            <div className="text-sm text-white/80 leading-relaxed">
              <p className="font-semibold text-white mb-1">How to add your monthly numbers</p>
              <ol className="list-decimal list-inside space-y-1 text-white/70">
                <li>In the grid below, find the row for the month you want to add.</li>
                <li>Click the empty <span className="bg-white/10 rounded px-1">⬜ Add</span> square under the statement you have (Barnett &amp; Hill, Absolute, FFB Bank, Citi Card, or Costco Card).</li>
                <li>Drag the PDF onto the drop zone <em>or</em> click the zone to choose a file. (For bank and credit-card statements, paste the text using the box below the drop zone.)</li>
                <li>Review the list of transactions, uncheck anything you don&rsquo;t want, then click <span className="font-semibold text-white">Import Selected</span>.</li>
              </ol>
              <p className="text-xs text-white/50 mt-2">
                ✅ green = already imported &middot; ⚠️ amber = looks incomplete &middot; ⬜ empty = not yet added &middot; current month is highlighted in <span className="text-amber-300">amber</span>
              </p>
            </div>
          </div>
        </div>

        {/* Monthly progress grid — 12 months of current year, newest at top, completed rows collapse. */}
        {(() => {
          const cellState = (ym, src) => {
            const count = statusByMonth[ym]?.[src.label] || 0;
            if (count >= src.expectedCountPerMonth) return { state: 'complete', count };
            if (count > 0) return { state: 'partial', count };
            return { state: 'empty', count };
          };
          const isMonthFullyDone = (m) =>
            !m.isFuture && SOURCE_TYPES.every(src => cellState(m.ym, src).state === 'complete');

          const ordered = MONTHS; // Jan at top, chronological
          const done   = ordered.filter(m => !m.isFuture && isMonthFullyDone(m));
          const active = ordered.filter(m => !m.isFuture && !isMonthFullyDone(m));
          const future = ordered.filter(m => m.isFuture);

          const renderRow = (m) => (
            <tr
              key={m.ym}
              className={`border-b border-white/[0.04] last:border-0 ${
                m.isCurrent ? 'bg-amber-400/[0.06] ring-1 ring-inset ring-amber-400/30' : ''
              }`}
            >
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className={m.isCurrent ? 'text-amber-300 font-semibold' : 'text-white/80'}>
                    {m.label}
                  </span>
                  {m.isCurrent && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      This month
                    </span>
                  )}
                </div>
              </td>
              {SOURCE_TYPES.map(src => {
                if (m.isFuture) {
                  return (
                    <td key={src.id} className="px-2 py-2 text-center">
                      <span className="text-[11px] text-white/20">—</span>
                    </td>
                  );
                }
                const { state, count } = cellState(m.ym, src);
                const expected = src.expectedCountPerMonth;
                const chipCls =
                  state === 'complete' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
                  state === 'partial'  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                                         'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06]';
                const icon =
                  state === 'complete' ? '✅' :
                  state === 'partial'  ? '⚠️' :
                                         '⬜';
                const label =
                  state === 'complete' ? `${count} imported` :
                  state === 'partial'  ? `${count} of ~${expected}` :
                                         'Add';
                return (
                  <td key={src.id} className="px-2 py-2 text-center">
                    <button
                      onClick={() => {
                        setActiveSource(src.id);
                        setDetectedMonth(m.ym);
                        setEntries([]);
                        setFfbMonth(null);
                        setUploadedFileName('');
                        setParseError('');
                      }}
                      className={`w-full px-2 py-1.5 rounded-lg border text-xs transition ${chipCls}`}
                      title={`${src.label} — ${m.label}: ${label}`}
                    >
                      <span className="mr-1" aria-hidden="true">{icon}</span>
                      <span className="font-medium">{label}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          );

          return (
            <div className="mb-4 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  {CURRENT_YEAR} statements by month
                  <HelpTip label="About this grid">
                    Each row is a month. Each column is one of the statements Dianne receives every month.
                    A colored box shows what&rsquo;s happening: <span className="text-emerald-300">green ✅</span> = already
                    imported, <span className="text-amber-300">amber ⚠️</span> = partial, <span className="text-white/50">grey ⬜</span> = nothing yet.
                    Click any box to add or review that statement.
                  </HelpTip>
                </h4>
                <span className="text-xs text-white/40">
                  {done.length > 0 && `${done.length} complete · `}
                  {active.length} still to do
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-white/50">Month</th>
                      {SOURCE_TYPES.map(src => (
                        <th key={src.id} className="text-center px-3 py-2 text-xs font-semibold text-white/50">
                          <span className="whitespace-nowrap">{src.icon} {src.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Completed months appear first (earlier in the year) — collapsed by default. */}
                    {done.length > 0 && !showCompletedMonths && (
                      <tr className="border-b border-white/[0.04]">
                        <td colSpan={1 + SOURCE_TYPES.length} className="px-3 py-3 text-center">
                          <button
                            onClick={() => setShowCompletedMonths(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/15 transition"
                          >
                            <span aria-hidden="true">✅</span>
                            <span>
                              {done.length} {done.length === 1 ? 'month' : 'months'} already complete
                              {done.length > 0 && ` (${done[0].short}${done.length > 1 ? `–${done[done.length - 1].short}` : ''})`}
                            </span>
                            <span className="text-emerald-300/60">· tap to show</span>
                          </button>
                        </td>
                      </tr>
                    )}
                    {done.length > 0 && showCompletedMonths && (
                      <>
                        {done.map(renderRow)}
                        <tr className="border-b border-white/[0.04]">
                          <td colSpan={1 + SOURCE_TYPES.length} className="px-3 py-2 text-center">
                            <button
                              onClick={() => setShowCompletedMonths(false)}
                              className="text-xs text-white/40 hover:text-white/70"
                            >
                              Hide completed months
                            </button>
                          </td>
                        </tr>
                      </>
                    )}
                    {/* Active months (incl. current month highlighted in amber) */}
                    {active.map(renderRow)}
                    {/* Future months — shown dimmed so the rest of the year is visible */}
                    {future.map(renderRow)}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 text-[11px] text-white/40 border-t border-white/[0.06]">
                A month is &ldquo;complete&rdquo; when every source has at least{' '}
                {SOURCE_TYPES.map(s => `${s.icon} ${s.expectedCountPerMonth}`).join(' · ')} entries.
                Current month is highlighted in <span className="text-amber-300">amber</span>.
              </div>
            </div>
          );
        })()}

        {/* (Source-picker card grid removed — use the monthly grid above; a click on any cell
             opens the same drop-zone flow with the month pre-selected.) */}
      </div>
    );
  }

  const source = SOURCE_TYPES.find(s => s.id === activeSource);
  const c = colorMap[source.color];
  const selectedCount = entries.filter(e => e.selected).length;
  const notImported = entries.filter(e => !e.imported);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveSource(null);
              setEntries([]);
              setImportedCount(0);
              setFfbMonth(null);
              setDetectedMonth(null);
              setUploadedFileName('');
              setParseError('');
            }}
            className="text-white/50 hover:text-white transition text-sm"
          >
            ← Back
          </button>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{source.icon}</span> {source.label}
            </h3>
          </div>
        </div>
      </div>

      {/* FFB Bank month picker */}
      {activeSource === 'ffb-bank' && !ffbMonth && entries.length === 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { id: 'jan26', label: 'January 2026', sub: '1/01 – 1/30', parseFn: parseFFBJan2026 },
            { id: 'feb26', label: 'February 2026', sub: '2/02 – 2/27', parseFn: parseFFBFeb2026 },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setFfbMonth(m.id); setEntries(m.parseFn()); }}
              className={`${c.bg} border ${c.border} rounded-xl p-4 text-center hover:brightness-110 transition`}
            >
              <span className={`text-sm font-semibold ${c.text}`}>{m.label}</span>
              <p className="text-[10px] text-white/30 mt-1">{m.sub}</p>
            </button>
          ))}
        </div>
      )}

      {/* Upload area (if no entries yet) */}
      {entries.length === 0 && (activeSource !== 'ffb-bank' || ffbMonth) && (
        <div className="mb-4 space-y-3">
          {/* Month hint if we jumped here from a specific grid cell */}
          {detectedMonth && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70">
              <Calendar className="w-4 h-4 text-white/50" />
              <span>Adding <span className="font-semibold text-white">{new Date(detectedMonth + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span> statement</span>
              <button
                onClick={() => setDetectedMonth(null)}
                className="ml-auto text-xs text-white/40 hover:text-white/70"
              >
                Change
              </button>
            </div>
          )}

          {/* Real drop zone — large, obvious, handles drag-drop + click-to-browse */}
          {source.canParsePdf ? (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleFileDrop(e, source.label)}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={`relative ${c.bg} border-4 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${
                dragActive ? `${c.border} border-opacity-100 brightness-125 ring-4 ring-offset-0 ring-${source.color}-400/40` : `${c.border} hover:brightness-110`
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFileInput(e, source.label)}
              />
              {parsingPdf ? (
                <>
                  <Loader className={`w-12 h-12 ${c.text} mx-auto mb-3 animate-spin`} />
                  <p className={`text-base font-semibold ${c.text} mb-1`}>Reading {uploadedFileName || 'your PDF'}…</p>
                  <p className="text-xs text-white/40">This usually takes a couple of seconds.</p>
                </>
              ) : (
                <>
                  <Upload className={`w-12 h-12 ${c.text} mx-auto mb-3`} />
                  <p className={`text-lg font-semibold ${c.text} mb-1`}>
                    Drop the {source.label} PDF here
                  </p>
                  <p className="text-sm text-white/60 mb-3">
                    …or click anywhere in this box to pick a file from your computer
                  </p>
                  <span className={`inline-flex items-center gap-2 px-4 py-2 ${c.accent} text-white rounded-xl text-sm font-medium`}>
                    <Upload className="w-4 h-4" /> Choose PDF
                  </span>
                  {uploadedFileName && !parsingPdf && !parseError && (
                    <p className="text-xs text-white/40 mt-3">Last file: {uploadedFileName}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className={`${c.bg} border-2 border-dashed ${c.border} rounded-2xl p-8 text-center`}>
              <FileText className={`w-10 h-10 ${c.text} mx-auto mb-3 opacity-60`} />
              <p className={`text-base font-semibold ${c.text} mb-1`}>{source.label} statements</p>
              <p className="text-xs text-white/40 mb-2">
                Automatic PDF reading isn&rsquo;t set up for this source yet — paste the statement text below and we&rsquo;ll parse it.
              </p>
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{parseError}</p>
            </div>
          )}

          {/* Collapsed paste fallback */}
          <details className="group bg-white/[0.02] border border-white/10 rounded-xl">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm text-white/60 flex items-center justify-between hover:text-white/80">
              <span>Or paste statement text instead</span>
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4">
              <textarea
                placeholder={`Paste ${source.label} statement text here — one line per transaction (date, description, amount)`}
                rows={6}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none font-mono"
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (!text) return;
                  const lines = text.split('\n').filter(l => l.trim());
                  const parsed = lines.map((line, i) => {
                    const parts = line.split(/\t|  +/).map(p => p.trim());
                    const amount = parseFloat((parts[parts.length - 1] || '').replace(/[$,]/g, '')) || 0;
                    const date = parts[0] || '';
                    const desc = parts.slice(1, -1).join(' ') || line;
                    return {
                      id: `paste-${Date.now()}-${i}`,
                      description: desc,
                      amount: Math.abs(amount),
                      date: date,
                      category: guessCategory(desc),
                      vendor: '',
                      propertyId: '',
                      propertyName: '',
                      sourceDocument: source.label,
                      flowType: 'expense',
                      selected: true,
                    };
                  });
                  if (parsed.length > 0) setEntries(parsed);
                }}
              />
              <p className="text-[11px] text-white/30 mt-2">
                Tip: each line should look like <code className="text-white/50">2026-03-05 Vendor Name 123.45</code>
              </p>
            </div>
          </details>
        </div>
      )}

      {/* Entries for review */}
      {entries.length > 0 && (
        <>
          {/* Dedup + month-level warning. Counts existing records for the same month+source. */}
          {(() => {
            const ym = (entries.find(e => e.date)?.date || '').slice(0, 7) || detectedMonth;
            const existingSame = (expenses || []).filter(e =>
              e.sourceDocument === source.label && (e.date || '').slice(0, 7) === ym
            ).length + (rentPayments || []).filter(r =>
              r.sourceDocument === source.label &&
              ((r.month || (r.datePaid || '').slice(0, 7)) === ym)
            ).length;
            const dupCount = entries.filter(e => e.isDuplicate).length;
            if (existingSame === 0 && dupCount === 0) return null;
            return (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-200 leading-relaxed">
                    {existingSame > 0 && (
                      <div className="mb-1">
                        <strong>This month already has {existingSame} {source.label} {existingSame === 1 ? 'entry' : 'entries'}.</strong>
                        {' '}Importing on top will add alongside them (may create duplicates).
                      </div>
                    )}
                    {dupCount > 0 && (
                      <div>
                        {dupCount} of {entries.length} {dupCount === 1 ? 'row looks like a' : 'rows look like'} duplicate{dupCount === 1 ? '' : 's'} of existing {dupCount === 1 ? 'entry' : 'entries'} and {dupCount === 1 ? 'was' : 'have been'} pre-unchecked.
                      </div>
                    )}
                  </div>
                </div>
                {existingSame > 0 && (bulkDeleteExpenses || deleteExpense) && (
                  <div className="flex items-center gap-2 mt-2 pl-6">
                    <button
                      disabled={replacingExisting}
                      onClick={async () => {
                        if (!confirm(`Delete all ${existingSame} existing ${source.label} entries for ${ym || 'this month'} before importing? This cannot be undone.`)) return;
                        const expIds = (expenses || [])
                          .filter(e => e.sourceDocument === source.label && (e.date || '').slice(0, 7) === ym)
                          .map(e => e.id);
                        const rentIds = (rentPayments || [])
                          .filter(r => r.sourceDocument === source.label && ((r.month || (r.datePaid || '').slice(0, 7)) === ym))
                          .map(r => r.id);
                        setReplacingExisting(true);
                        try {
                          // Prefer the new atomic bulk deletes; fall back to per-id loop only if missing.
                          if (bulkDeleteExpenses) {
                            await bulkDeleteExpenses(expIds);
                          } else {
                            for (const id of expIds) deleteExpense(id);
                          }
                          if (bulkDeleteRentPayments) {
                            await bulkDeleteRentPayments(rentIds);
                          } else {
                            for (const id of rentIds) deleteRentPayment(id);
                          }
                          showToast?.(`Removed ${expIds.length + rentIds.length} existing entries — click Import Selected to add the new ones`, 'info');
                        } finally {
                          setReplacingExisting(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-200 rounded-lg text-xs font-medium hover:bg-red-500/30 transition disabled:opacity-50"
                    >
                      {replacingExisting
                        ? 'Removing existing…'
                        : `Replace existing (${existingSame}) — delete first, then import`}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Summary bar */}
          <div className={`${c.bg} border ${c.border} rounded-xl p-3 mb-3 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">{notImported.length} entries</span>
              {entries.filter(e => e.isDuplicate).length > 0 && (
                <span className="text-xs text-amber-300">({entries.filter(e => e.isDuplicate).length} pre-unchecked as duplicates)</span>
              )}
              <button onClick={() => selectAll(true)} className="text-xs text-white/40 hover:text-white/70 underline">Select All</button>
              <button onClick={() => selectAll(false)} className="text-xs text-white/40 hover:text-white/70 underline">Deselect All</button>
            </div>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              className={`px-4 py-2 ${c.accent} text-white rounded-xl text-sm font-medium hover:brightness-110 transition disabled:opacity-40`}
            >
              {importing ? 'Importing...' : `Import ${selectedCount} Selected`}
            </button>
          </div>

          {importedCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">{importedCount} entries imported successfully</span>
            </div>
          )}

          {/* Entry table */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Type</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Date</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Description</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Category</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Property</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-white/40 uppercase">Amount</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const dupMatches = findDuplicate(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-white/[0.04] transition ${
                          entry.imported ? 'opacity-30' :
                          entry.selected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        } ${dupMatches ? 'bg-orange-500/[0.05]' : ''}`}
                      >
                        <td className="px-3 py-2">
                          {entry.imported ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <button onClick={() => toggleEntry(idx)}>
                              <div className={`w-4 h-4 rounded border ${entry.selected ? `${c.accent} border-transparent` : 'border-white/20'} flex items-center justify-center`}>
                                {entry.selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            entry.flowType === 'income' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {entry.flowType === 'income' ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-white/60 whitespace-nowrap">{entry.date}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-white/80">{entry.description}</span>
                          {entry.checkNumber && (
                            <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70">
                              #{entry.checkNumber}
                            </span>
                          )}
                          {(entry.tenantName || entry.account) && (
                            <span className="block text-[10px] text-white/30">
                              {entry.tenantName}{entry.tenantName && entry.account ? ' · ' : ''}{entry.account ? `Acct ${entry.account}` : ''}
                            </span>
                          )}
                          {dupMatches && (
                            <span className="relative group flex items-center gap-1 text-[10px] text-orange-400 mt-0.5 cursor-help">
                              <AlertCircle className="w-3 h-3" /> Possible duplicate
                              <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-50 w-72 p-2.5 bg-gray-900 border border-orange-500/30 rounded-lg shadow-xl text-[10px] text-white/80 leading-relaxed">
                                <span className="block font-semibold text-orange-400 mb-1">
                                  {dupMatches.length} existing {dupMatches.length === 1 ? 'match' : 'matches'} found:
                                </span>
                                {dupMatches.slice(0, 3).map((m, mi) => (
                                  <span key={mi} className="block border-t border-white/[0.06] pt-1 mt-1">
                                    <span className="block text-white/60">
                                      {m.description || m.category || 'No description'}
                                    </span>
                                    <span className="block text-white/40">
                                      {m.date} &middot; ${(m.amount || 0).toFixed(2)}
                                      {m.propertyName ? ` · ${m.propertyName}` : ''}
                                      {m.sourceDocument ? ` · via ${m.sourceDocument}` : ''}
                                    </span>
                                  </span>
                                ))}
                                {dupMatches.length > 3 && (
                                  <span className="block text-white/30 mt-1">+{dupMatches.length - 3} more</span>
                                )}
                                <span className="block text-orange-400/60 mt-1.5 italic">
                                  Matched on: same date, amount, and similar description
                                </span>
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {entry.flowType === 'income' ? (
                            <select
                              value={entry.incomeCategory || 'rent'}
                              onChange={(e) => updateEntry(idx, 'incomeCategory', e.target.value)}
                              className="text-[10px] px-1.5 py-1 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-400/70 focus:outline-none"
                              disabled={entry.imported}
                            >
                              {incomeCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={entry.category || 'other'}
                              onChange={(e) => updateEntry(idx, 'category', e.target.value)}
                              className="text-[10px] px-1.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 focus:outline-none"
                              disabled={entry.imported}
                            >
                              {expenseCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={entry.propertyId || ''}
                            onChange={(e) => {
                              const prop = properties.find(p => String(p.id) === e.target.value);
                              updateEntry(idx, 'propertyId', e.target.value);
                              updateEntry(idx, 'propertyName', prop ? `${prop.emoji || '🏠'} ${prop.name}` : '');
                            }}
                            className="text-[10px] px-1.5 py-1 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 focus:outline-none max-w-[120px]"
                            disabled={entry.imported}
                          >
                            <option value="">—</option>
                            {properties.map(p => (
                              <option key={p.id} value={String(p.id)}>{p.emoji || '🏠'} {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-xs font-medium ${entry.flowType === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!entry.imported && (
                            <button
                              onClick={() => removeEntry(idx)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Remove from review"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export the helper functions for use by parsers
export { matchProperty, guessCategory };
