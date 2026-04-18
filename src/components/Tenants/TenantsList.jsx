import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, Phone, Mail, Edit3 } from 'lucide-react';
import { tenantStatuses } from '../../constants';
import { formatDate, formatCurrency, getDaysUntil } from '../../utils';
import { getPropertyTenants } from '../../hooks/useProperties';

/**
 * TenantsList — table of every tenant across properties.
 *
 * Each of these fields is editable in place (click the cell → pick/type → blur
 * or Enter to save): name, status, lease end, rent, security deposit, phone.
 * Clicking the cell opens just that field; clicking the Edit icon on the far
 * right still opens the full modal for everything else (photos, email,
 * co-tenant details, etc).
 */
export default function TenantsList({ properties, onEditTenant, onAddTenant, onViewProperty, addOrUpdateTenant, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Flatten tenants from all properties (supports multi-tenant)
  const allTenants = useMemo(() => {
    const result = [];
    properties.forEach(p => {
      const tenants = getPropertyTenants(p);
      const tenantCount = tenants.length;
      tenants.forEach(t => {
        result.push({
          ...t,
          propertyId: p.id,
          propertyName: p.name,
          propertyEmoji: p.emoji || '🏠',
          propertyRent: parseFloat(p.monthlyRent) || 0,
          coTenantCount: tenantCount,
        });
      });
    });
    return result;
  }, [properties]);

  // Filter
  const filtered = useMemo(() => {
    let result = [...allTenants];
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').includes(q) ||
        (t.propertyName || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allTenants, statusFilter, searchQuery]);

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'name': return dir * (a.name || '').localeCompare(b.name || '');
        case 'property': return dir * (a.propertyName || '').localeCompare(b.propertyName || '');
        case 'status': return dir * (a.status || '').localeCompare(b.status || '');
        case 'rent': {
          const rentA = a.coTenantCount > 1 ? a.propertyRent / a.coTenantCount : (parseFloat(a.monthlyRent) || 0);
          const rentB = b.coTenantCount > 1 ? b.propertyRent / b.coTenantCount : (parseFloat(b.monthlyRent) || 0);
          return dir * (rentA - rentB);
        }
        case 'deposit': return dir * ((parseFloat(a.securityDeposit) || 0) - (parseFloat(b.securityDeposit) || 0));
        case 'leaseEnd': return dir * (a.leaseEnd || '9999').localeCompare(b.leaseEnd || '9999');
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-teal-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-teal-400 inline ml-1" />;
  };

  const getStatusBadge = (status) => {
    const s = tenantStatuses.find(ts => ts.value === status);
    if (!s) return <span className="text-xs text-white/40">{status || 'No status'}</span>;
    return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  /**
   * Save a single-field edit. Guards against: no API wired, identical value,
   * or missing property. Shows a toast on error.
   */
  const saveField = (tenant, field, value) => {
    if (!addOrUpdateTenant) {
      showToast?.('Saving is not wired up in this view', 'error');
      return;
    }
    const prev = tenant[field] ?? '';
    // Normalize: treat "" and null/undefined as equal
    if (String(prev || '') === String(value ?? '')) return;
    const updated = {
      ...tenant,
      [field]: value,
    };
    // Strip the synthetic fields we attached in allTenants; addOrUpdateTenant
    // only wants the raw tenant object.
    delete updated.propertyId;
    delete updated.propertyName;
    delete updated.propertyEmoji;
    delete updated.propertyRent;
    delete updated.coTenantCount;
    addOrUpdateTenant(tenant.propertyId, updated);
    showToast?.(`Updated ${field === 'leaseEnd' ? 'lease end' : field}`, 'success');
  };

  // --- Inline editors ------------------------------------------------------

  // A small controlled text/number/date editor. Commits on Enter or blur;
  // Escape cancels. Renders the current value when idle and becomes an input
  // when clicked.
  const InlineField = ({ value, onCommit, type = 'text', placeholder, format, inputClassName = '', displayClassName = '' }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value ?? '');
    const inputRef = useRef(null);

    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
    useEffect(() => { setVal(value ?? ''); }, [value]);

    const commit = () => {
      setEditing(false);
      if (String(val ?? '') !== String(value ?? '')) onCommit(val);
    };

    if (editing) {
      return (
        <input
          ref={inputRef}
          type={type}
          value={val}
          placeholder={placeholder}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false); }
          }}
          onClick={e => e.stopPropagation()}
          className={`bg-white/10 border border-teal-400/60 text-white text-sm rounded px-2 py-1 w-full focus:outline-none ${inputClassName}`}
        />
      );
    }
    const display = format ? format(value) : (value || <span className="text-white/30">—</span>);
    return (
      <button
        onClick={e => { e.stopPropagation(); setEditing(true); }}
        className={`text-left w-full px-1 py-0.5 -mx-1 -my-0.5 rounded hover:bg-white/[0.06] transition cursor-text ${displayClassName}`}
        title="Click to edit"
      >
        {display}
      </button>
    );
  };

  const InlineStatus = ({ value, onCommit }) => {
    const handleChange = (e) => { e.stopPropagation(); onCommit(e.target.value); };
    return (
      <select
        value={value || ''}
        onChange={handleChange}
        onClick={e => e.stopPropagation()}
        className="bg-white/[0.06] border border-white/15 text-xs rounded-md px-1.5 py-1 focus:outline-none focus:border-teal-400/60"
      >
        <option value="">No status</option>
        {tenantStatuses.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    );
  };

  // -----------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Tenants</h2>
          <p className="text-xs text-white/40">
            {allTenants.length} tenants across {properties.length} properties
            {addOrUpdateTenant && <span className="ml-2 text-white/30">· click any cell to edit</span>}
          </p>
        </div>
        <button
          onClick={onAddTenant}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition"
        >
          <Plus className="w-4 h-4" /> Add Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search tenants, properties..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === 'all' ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >All</button>
          {tenantStatuses.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === s.value ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Total Tenants</p>
          <p className="text-xl font-bold text-teal-400">{allTenants.length}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Active</p>
          <p className="text-xl font-bold text-green-400">{allTenants.filter(t => t.status === 'active').length}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Monthly Rent</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(properties.reduce((sum, p) => sum + (parseFloat(p.monthlyRent) || 0), 0))}</p>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-white/30">No tenants found</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('name')}>
                    Tenant <SortIcon col="name" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('property')}>
                    Property <SortIcon col="property" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('leaseEnd')}>
                    Lease End <SortIcon col="leaseEnd" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('rent')}>
                    Rent <SortIcon col="rent" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('deposit')}>
                    Deposit <SortIcon col="deposit" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tenant, idx) => {
                  const daysLeft = tenant.leaseEnd ? getDaysUntil(tenant.leaseEnd) : null;
                  const effectiveRent = tenant.coTenantCount > 1
                    ? tenant.propertyRent / tenant.coTenantCount
                    : (parseFloat(tenant.monthlyRent) || 0);
                  return (
                    <tr
                      key={`${tenant.propertyId}-${idx}`}
                      className="border-b border-white/[0.05] hover:bg-white/[0.02] transition"
                    >
                      {/* Tenant name — inline text */}
                      <td className="px-4 py-2">
                        <InlineField
                          value={tenant.name || ''}
                          placeholder="Tenant name"
                          onCommit={(v) => saveField(tenant, 'name', v)}
                          displayClassName="text-sm font-medium text-white"
                        />
                      </td>

                      {/* Property — still a link */}
                      <td className="px-4 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewProperty(tenant.propertyId); }}
                          className="text-sm text-teal-400 hover:text-teal-300 transition"
                        >
                          {tenant.propertyEmoji} {tenant.propertyName}
                        </button>
                      </td>

                      {/* Status — inline select */}
                      <td className="px-4 py-2">
                        <InlineStatus
                          value={tenant.status || ''}
                          onCommit={(v) => saveField(tenant, 'status', v)}
                        />
                      </td>

                      {/* Lease end — inline date */}
                      <td className="px-4 py-2">
                        <InlineField
                          value={tenant.leaseEnd || ''}
                          type="date"
                          onCommit={(v) => saveField(tenant, 'leaseEnd', v)}
                          format={(v) => v ? (
                            <span className="text-sm">
                              <span className="text-white/70">{formatDate(v)}</span>
                              {daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && (
                                <span className="text-xs text-orange-400 ml-2">{daysLeft}d left</span>
                              )}
                              {daysLeft !== null && daysLeft < 0 && (
                                <span className="text-xs text-red-400 ml-2">Expired</span>
                              )}
                            </span>
                          ) : <span className="text-white/30">—</span>}
                        />
                      </td>

                      {/* Rent — inline number. If co-tenant, we edit the per-tenant rent. */}
                      <td className="px-4 py-2 text-right">
                        {tenant.coTenantCount > 1 ? (
                          <div>
                            <InlineField
                              value={tenant.monthlyRent || ''}
                              type="number"
                              placeholder="0"
                              onCommit={(v) => saveField(tenant, 'monthlyRent', v)}
                              format={(v) => {
                                const override = parseFloat(v) || 0;
                                const show = override > 0 ? override : effectiveRent;
                                return (
                                  <span className="text-sm font-medium text-emerald-400">
                                    {show ? formatCurrency(show) : '—'}
                                  </span>
                                );
                              }}
                              displayClassName="text-right"
                              inputClassName="text-right"
                            />
                            <span className="text-[10px] text-white/30 block">
                              split {tenant.coTenantCount} ways
                            </span>
                          </div>
                        ) : (
                          <InlineField
                            value={tenant.monthlyRent || ''}
                            type="number"
                            placeholder="0"
                            onCommit={(v) => saveField(tenant, 'monthlyRent', v)}
                            format={(v) => (
                              <span className="text-sm font-medium text-emerald-400">
                                {v ? formatCurrency(v) : '—'}
                              </span>
                            )}
                            displayClassName="text-right"
                            inputClassName="text-right"
                          />
                        )}
                      </td>

                      {/* Deposit — inline number */}
                      <td className="px-4 py-2 text-right">
                        <InlineField
                          value={tenant.securityDeposit || ''}
                          type="number"
                          placeholder="0"
                          onCommit={(v) => saveField(tenant, 'securityDeposit', v)}
                          format={(v) => (
                            <span className="text-sm text-white/70">
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          displayClassName="text-right"
                          inputClassName="text-right"
                        />
                      </td>

                      {/* Phone — inline tel */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <InlineField
                            value={tenant.phone || ''}
                            type="tel"
                            placeholder="Phone"
                            onCommit={(v) => saveField(tenant, 'phone', v)}
                            format={(v) => v ? (
                              <span className="text-sm text-white/70">{v}</span>
                            ) : <span className="text-white/30 text-sm">Add…</span>}
                          />
                          <div className="flex gap-1.5 flex-shrink-0">
                            {tenant.email && (
                              <a href={`mailto:${tenant.email}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70" title={tenant.email}>
                                <Mail className="w-4 h-4" />
                              </a>
                            )}
                            {tenant.phone && (
                              <a href={`tel:${tenant.phone}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70" title={tenant.phone}>
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Full-edit modal (photo, email, co-tenants, etc.) */}
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditTenant(tenant.propertyId, tenant); }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/[0.12] transition"
                          title="Open full editor"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
