// Explicit Eastern dates; never inherit the server's timezone.
const eastern = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
export const asArray = value => Array.isArray(value) ? value : [];
export const money = value => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};
export function easternDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(eastern.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function instant(value) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export const recordDate = value => calendarDate(value) || (instant(value) ? easternDate(instant(value)) : null);
export const daysBetween = (first, last) => Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000);
export function firstName(tenant) {
  const value = tenant?.firstName || tenant?.name || '';
  if (typeof value !== 'string') return null;
  const first = value.trim().split(/\s+/)[0];
  return /^[\p{L}][\p{L}\p{M}'’-]*$/u.test(first) ? first : null;
}
export const propertyName = property => typeof property?.name === 'string' ? property.name : '';
export const currentTenants = (tenants, today) => asArray(tenants).filter(t => t &&
  !['former', 'vacant'].includes(t.status) && (!calendarDate(t.leaseStart) || t.leaseStart <= today));
export function leaseEnd(tenants) {
  return tenants.map(t => calendarDate(t.leaseEnd)).filter(Boolean).sort()[0] || null;
}
export function endingLeases(properties, tenantsFor, today) {
  return [...new Set(properties.filter(p => !['vacant', 'renovation', 'listed', 'owner-occupied', 'month-to-month'].includes(p.propertyStatus)).flatMap(p => tenantsFor(p).filter(t => t.leaseType !== 'month-to-month')
    .map(t => calendarDate(t.leaseEnd)).filter(date => date && daysBetween(today, date) >= 0 && daysBetween(today, date) <= 90)
    .map(date => `${propertyName(p)} ${date}`)))].sort();
}
export const inLastWeek = (value, now) => {
  const at = instant(value);
  return at && at <= now && at.getTime() >= now.getTime() - 7 * 86400000;
};
export function paymentsAsOf(payments, now) {
  const today = easternDate(now);
  return asArray(payments).filter(p => p && (!p.datePaid ||
    (recordDate(p.datePaid) && recordDate(p.datePaid) <= today && (!instant(p.datePaid) || instant(p.datePaid) <= now))))
    .map(p => ({ ...p, datePaid: recordDate(p.datePaid) || '', amount: money(p.amount) ?? 0 }));
}
