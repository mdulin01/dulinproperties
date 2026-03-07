import React, { useState, useCallback } from 'react';
import { Upload, ChevronDown, Check, X, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { expenseCategories, incomeCategories } from '../../constants';
import { formatCurrency } from '../../utils';

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
  { id: 'barnett-hill', label: 'Barnett & Hill', color: 'purple', icon: '🏢' },
  { id: 'absolute', label: 'Absolute', color: 'teal', icon: '🏠' },
  { id: 'ffb-bank', label: 'FFB Bank', color: 'blue', icon: '🏦' },
  { id: 'citi-card', label: 'Citi Card', color: 'amber', icon: '💳' },
];

const colorMap = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', accent: 'bg-purple-500' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', accent: 'bg-teal-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', accent: 'bg-blue-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', accent: 'bg-amber-500' },
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

export default function DocumentImport({ properties, expenses, addExpense, addRentPayment, showToast, onClose }) {
  const [activeSource, setActiveSource] = useState(null);
  const [entries, setEntries] = useState([]); // parsed entries for review
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [ffbMonth, setFfbMonth] = useState(null); // 'jan26' | 'feb26' for FFB sub-selector

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
  const handleImport = useCallback(() => {
    const selected = entries.filter(e => e.selected);
    if (selected.length === 0) return;

    setImporting(true);
    let count = 0;

    selected.forEach(entry => {
      if (entry.flowType === 'income') {
        // Add as rent payment
        addRentPayment({
          id: `import-${Date.now()}-${count}`,
          propertyId: entry.propertyId || '',
          propertyName: entry.propertyName || '',
          tenantName: entry.tenantName || '',
          amount: entry.amount,
          month: entry.date ? entry.date.substring(0, 7) : '',
          datePaid: entry.date,
          status: 'paid',
          category: entry.incomeCategory || 'rent',
          notes: `Imported from ${entry.sourceDocument}`,
          sourceDocument: entry.sourceDocument,
        });
      } else {
        // Add as expense
        addExpense({
          id: `import-${Date.now()}-${count}`,
          propertyId: entry.propertyId || '',
          propertyName: entry.propertyName || '',
          category: entry.category || 'other',
          description: entry.description,
          amount: entry.amount,
          date: entry.date,
          vendor: entry.vendor || '',
          notes: entry.checkNumber ? `Check #${entry.checkNumber}` : (entry.notes || ''),
          sourceDocument: entry.sourceDocument,
          checkNumber: entry.checkNumber || '',
        });
      }
      count++;
    });

    setImportedCount(count);
    setImporting(false);
    showToast(`Imported ${count} entries`, 'success');
    // Mark imported entries
    setEntries(prev => prev.map(e => e.selected ? { ...e, imported: true, selected: false } : e));
  }, [entries, addExpense, addRentPayment, showToast]);

  // Find duplicate: return matching existing expense(s) or null
  const findDuplicate = useCallback((entry) => {
    const matches = expenses.filter(e =>
      Math.abs((e.amount || 0) - entry.amount) < 0.01 &&
      e.date === entry.date &&
      (e.description || '').toLowerCase().includes((entry.description || '').toLowerCase().substring(0, 20))
    );
    return matches.length > 0 ? matches : null;
  }, [expenses]);

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
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SOURCE_TYPES.map(src => {
            const c = colorMap[src.color];
            return (
              <button
                key={src.id}
                onClick={() => {
                  setActiveSource(src.id);
                  // Auto-load pre-parsed data if available
                  if (src.id === 'barnett-hill') setEntries(parseBHFeb2026(properties));
                  else if (src.id === 'absolute') setEntries(parseAbsoluteFeb2026(properties));
                  else if (src.id === 'ffb-bank') { setFfbMonth(null); setEntries([]); }
                  else setEntries([]);
                }}
                className={`${c.bg} border ${c.border} rounded-2xl p-5 text-center hover:brightness-110 transition group`}
              >
                <span className="text-2xl block mb-2">{src.icon}</span>
                <span className={`text-sm font-semibold ${c.text}`}>{src.label}</span>
                <p className="text-[10px] text-white/30 mt-1">Upload or paste statement</p>
              </button>
            );
          })}
        </div>
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
            onClick={() => { setActiveSource(null); setEntries([]); setImportedCount(0); setFfbMonth(null); }}
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
        <div className={`${c.bg} border-2 border-dashed ${c.border} rounded-2xl p-8 text-center mb-4`}>
          <Upload className={`w-8 h-8 ${c.text} mx-auto mb-3 opacity-60`} />
          <p className={`text-sm font-medium ${c.text} mb-1`}>Upload {source.label} Statement</p>
          <p className="text-xs text-white/30 mb-4">PDF parsing coming soon — use manual entry below for now</p>

          {/* Manual paste area */}
          <div className="text-left mt-4">
            <p className="text-xs text-white/40 mb-2">Or paste statement data:</p>
            <textarea
              placeholder={`Paste ${source.label} statement text here...`}
              rows={6}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none font-mono"
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (!text) return;
                // Basic line-by-line parsing for pasted data
                // Each line: date | description | amount
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
          </div>
        </div>
      )}

      {/* Entries for review */}
      {entries.length > 0 && (
        <>
          {/* Summary bar */}
          <div className={`${c.bg} border ${c.border} rounded-xl p-3 mb-3 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">{notImported.length} entries</span>
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
