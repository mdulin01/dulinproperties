import { db } from './firebase.js';
import { countsAsExpense, countsAsIncome, documentTypes, expenseCategories } from '../../src/constants.js';
import { asArray, calendarDate, currentTenants, daysBetween, easternDate, endingLeases, firstName, inLastWeek, instant, leaseEnd, money, paymentsAsOf, propertyName, recordDate } from './digest-common.js';

const CATEGORIES = new Set(expenseCategories.map(category => category.value));
const DOCUMENT_TYPES = new Set(documentTypes.map(type => type.value));
const tenantsOf = p => asArray(p.tenants).length ? p.tenants : p.tenant?.name ? [p.tenant] : [];
const datesOf = meta => [...new Set(asArray(meta?.dates).filter(calendarDate))].sort();

export async function loadDigestData({ firestore = db() } = {}) {
  const ids = ['properties', 'rent', 'expenses', 'documents', 'backupMeta'];
  const snapshots = await Promise.all(ids.map(id => firestore.doc(`rentalData/${id}`).get()));
  const [properties, rent, expenses, documents, backup] = snapshots.map(snap => snap.data());
  const dates = datesOf(backup);
  const newest = dates.at(-1);
  const snapshot = newest ? (await firestore.doc(`rentalData/backup-${newest}`).get()).data() : null;
  return {
    properties: properties?.properties || [], rentPayments: rent?.payments ?? null,
    expenses: expenses?.expenses ?? null, documents: documents?.documents ?? null,
    backupMeta: backup || {}, backupSizeBytes: typeof snapshot?.json === 'string' ? Buffer.byteLength(snapshot.json, 'utf8') : null,
  };
}

function propertyRows(properties, data, now) {
  const today = easternDate(now);
  const month = today.slice(0, 7);
  const tracked = Array.isArray(data.rentPayments);
  const payments = paymentsAsOf(data.rentPayments, now).filter(r => countsAsIncome(r) &&
    ['rent', 'prepaid-rent'].includes(r.category || 'rent') && ['paid', 'partial', 'late'].includes(r.status));
  return properties.map(p => {
    const tenants = currentTenants(tenantsOf(p), today);
    const vacant = ['vacant', 'renovation', 'listed'].includes(p.propertyStatus) ||
      (!p.propertyStatus && !tenants.length) || (tenantsOf(p).length > 0 && !tenants.length);
    const due = vacant ? 0 : p.propertyStatus === 'owner-occupied' ? null : money(p.monthlyRent);
    const records = payments.filter(r => String(r.propertyId) === String(p.id));
    const applied = records.filter(r => (r.month || r.datePaid || '').startsWith(month));
    const received = tracked ? money(records.filter(r => r.datePaid.startsWith(month)).reduce((sum, r) => sum + r.amount, 0)) : null;
    const credited = money(applied.reduce((sum, r) => sum + r.amount, 0));
    const terms = tenants.find(t => t.rentDueDay || t.graceDays != null) || p;
    const dueDay = Math.min(28, Math.max(1, parseInt(terms.rentDueDay, 10) || 1));
    const graceDays = Math.max(0, parseInt(terms.graceDays ?? 5, 10) || 0);
    const daysPast = daysBetween(`${month}-${String(dueDay).padStart(2, '0')}`, today);
    const settled = applied.some(r => r.status === 'paid') || credited >= due - 0.005;
    const status = vacant ? 'vacant' : due === null || !tracked ? null : settled ? 'paid'
      : daysPast > graceDays ? 'late' : 'partial';
    return {
      name: propertyName(p), tenant: vacant ? null : firstName(tenants[0]),
      rentDue: due, rentReceivedThisMonth: received, status,
      daysLate: status === null ? null : status === 'late' ? daysPast : 0,
      leaseEnds: vacant ? null : leaseEnd(tenants),
    };
  });
}

export function buildDigest(data, now = new Date()) {
  const asOf = easternDate(now);
  const properties = asArray(data.properties);
  const names = new Map(properties.map(p => [String(p.id), propertyName(p)]));
  const totals = Object.create(null);
  for (const expense of asArray(data.expenses)) {
    const date = recordDate(expense.date);
    if (!date || date > asOf || !date.startsWith(asOf.slice(0, 7)) || expense.isTemplate || !countsAsExpense(expense)) continue;
    const category = CATEGORIES.has(expense.category) ? expense.category : 'other';
    totals[category] = money((totals[category] || 0) + (money(expense.amount) || 0));
  }
  return {
    asOf, properties: propertyRows(properties, data, now),
    leasesEndingWithin90Days: endingLeases(properties, p => currentTenants(tenantsOf(p), asOf), asOf),
    expensesThisMonthByCategory: Array.isArray(data.expenses) ? { ...totals } : null,
    documentsAddedLast7Days: Array.isArray(data.documents) ? data.documents.filter(doc => doc && inLastWeek(doc.createdAt, now)).map(doc => ({
      property: names.get(String(doc.propertyId)) || null,
      type: DOCUMENT_TYPES.has(doc.type) ? doc.type : 'other',
      addedAt: instant(doc.createdAt).toISOString(),
    })).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) : null,
    lastBackup: instant(data.backupMeta?.lastAt)?.toISOString() || null,
    backupDates: datesOf(data.backupMeta),
    backupSizeBytes: Number.isSafeInteger(data.backupSizeBytes) && data.backupSizeBytes >= 0 ? data.backupSizeBytes : null,
  };
}
