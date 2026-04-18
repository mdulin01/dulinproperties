import React, { useMemo } from 'react';
import { Plus, Check, AlertCircle, DollarSign, Receipt } from 'lucide-react';
import HelpTip from '../HelpTip';
import { formatCurrency } from '../../utils';
import { getPropertyTenants } from '../../hooks/useProperties';

const getManager = (color) => {
  if (!color) return 'Absolute';
  if (color.includes('purple') || color.includes('violet') || color.includes('indigo')) return 'Barnett & Hill';
  if (color.includes('rose') || color.includes('pink')) return 'Dianne Dulin';
  return 'Absolute';
};

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * ManagedRentals — quick-action view for the 4 properties Dianne self-manages
 * (the ones whose card color marks them as "Dianne Dulin").
 *
 * For each property we show this month's rent status and two big buttons:
 *   • Record rent payment (opens AddRentModal pre-filled)
 *   • Add expense        (opens AddExpenseModal pre-filled)
 *
 * Keeps her flow tight: open the app → Input Data → Managed Rentals → click.
 */
export default function ManagedRentals({
  properties,
  rentPayments,
  expenses,
  onAddRent,
  onAddExpense,
  onOpenProperty,
}) {
  const ym = currentYM();
  const myProps = useMemo(
    () => properties.filter(p => getManager(p.color || '') === 'Dianne Dulin'),
    [properties]
  );

  // tenant(s) per property (tenants live on the property object)
  const tenantsForProperty = (p) => getPropertyTenants(p);

  // This-month paid rent per property
  const paidThisMonth = (p) => (rentPayments || []).some(r =>
    String(r.propertyId) === String(p.id) &&
    r.status === 'paid' &&
    (r.month || (r.datePaid || '').slice(0, 7)) === ym
  );

  // YTD totals for this property
  const ytdTotals = (p) => {
    const yr = ym.slice(0, 4);
    const rent = (rentPayments || [])
      .filter(r => String(r.propertyId) === String(p.id) && r.status === 'paid' && ((r.month || (r.datePaid || '').slice(0, 7)).startsWith(yr)))
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const exp = (expenses || [])
      .filter(e => String(e.propertyId) === String(p.id) && (e.date || '').startsWith(yr) && e.category !== 'owner-distribution')
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return { rent, exp };
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-1.5">
          Properties you manage yourself
          <HelpTip label="Why these four">
            These are the properties not handled by Absolute or Barnett &amp; Hill — you collect rent and pay
            for repairs directly. Record each rent payment and expense here so the dashboard and
            Schedule E stay accurate.
          </HelpTip>
        </h3>
        <p className="text-xs text-white/50">
          Record rent when it comes in, and log any expenses you pay out of pocket (repairs, utilities, supplies).
        </p>
      </div>

      {myProps.length === 0 && (
        <div className="flex items-start gap-2 p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sm text-sky-200">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>
            No self-managed properties found. Properties marked with a pink/rose color in Properties → Edit will
            show up here.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {myProps.map(p => {
          const paid = paidThisMonth(p);
          const { rent, exp } = ytdTotals(p);
          const tList = tenantsForProperty(p);
          return (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                {/* Identity */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl" aria-hidden="true">{p.emoji || '🏠'}</span>
                  <div className="min-w-0">
                    <button
                      onClick={() => onOpenProperty?.(p)}
                      className="text-base font-semibold text-white truncate text-left hover:underline"
                    >
                      {p.name || 'Unnamed'}
                    </button>
                    <div className="text-[11px] text-white/40 truncate">
                      {p.street || ''}
                      {tList.length > 0 && (
                        <span className="ml-1">· {tList.map(t => t.name).filter(Boolean).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rent status pill */}
                <div className="flex items-center gap-2 md:mx-4">
                  {paid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                      <Check className="w-3 h-3" />
                      Rent paid {monthLabel(ym)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                      <AlertCircle className="w-3 h-3" />
                      Rent not yet recorded for {monthLabel(ym)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onAddRent?.(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
                    title={`Record a rent payment for ${p.name}`}
                  >
                    <DollarSign className="w-4 h-4" /> Record rent
                  </button>
                  <button
                    onClick={() => onAddExpense?.(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                    title={`Log an expense for ${p.name}`}
                  >
                    <Receipt className="w-4 h-4" /> Add expense
                  </button>
                </div>
              </div>

              {/* YTD mini-totals */}
              <div className="grid grid-cols-3 border-t border-white/[0.06] text-center divide-x divide-white/[0.06]">
                <div className="px-3 py-2">
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">YTD rent</div>
                  <div className="text-sm font-semibold text-emerald-300">{rent ? formatCurrency(rent) : '—'}</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">YTD expenses</div>
                  <div className="text-sm font-semibold text-red-300">{exp ? formatCurrency(exp) : '—'}</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">YTD net</div>
                  <div className={`text-sm font-semibold ${rent - exp >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
                    {rent || exp ? formatCurrency(rent - exp) : '—'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
