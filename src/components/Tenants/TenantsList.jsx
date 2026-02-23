import React, { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, User, Phone, Mail, Calendar, DollarSign } from 'lucide-react';
import { tenantStatuses } from '../../constants';
import { formatDate, formatCurrency, getDaysUntil } from '../../utils';
import { getPropertyTenants } from '../../hooks/useProperties';

export default function TenantsList({ properties, onEditTenant, onAddTenant, onViewProperty }) {
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
    if (!s) return <span className="text-xs text-white/40">{status}</span>;
    return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const vacantCount = properties.filter(p => !p.tenant || p.tenant.status === 'vacant').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Tenants</h2>
          <p className="text-xs text-white/40">{allTenants.length} tenants across {properties.length} properties</p>
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
                    Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tenant, idx) => {
                  const daysLeft = tenant.leaseEnd ? getDaysUntil(tenant.leaseEnd) : null;
                  return (
                    <tr
                      key={`${tenant.propertyId}-${idx}`}
                      className="border-b border-white/[0.05] hover:bg-white/[0.03] transition cursor-pointer"
                      onClick={() => onEditTenant(tenant.propertyId, tenant)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">{tenant.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewProperty(tenant.propertyId); }}
                          className="text-sm text-teal-400 hover:text-teal-300 transition"
                        >
                          {tenant.propertyEmoji} {tenant.propertyName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(tenant.status)}</td>
                      <td className="px-4 py-3">
                        {tenant.leaseEnd ? (
                          <div>
                            <span className="text-sm text-white/70">{formatDate(tenant.leaseEnd)}</span>
                            {daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && (
                              <span className="text-xs text-orange-400 ml-2">{daysLeft}d left</span>
                            )}
                            {daysLeft !== null && daysLeft < 0 && (
                              <span className="text-xs text-red-400 ml-2">Expired</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tenant.coTenantCount > 1 ? (
                          <div>
                            <span className="text-sm font-medium text-emerald-400">
                              {formatCurrency(tenant.propertyRent / tenant.coTenantCount)}
                            </span>
                            <span className="text-[10px] text-white/30 block">
                              split {tenant.coTenantCount} ways
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-emerald-400">
                            {tenant.monthlyRent ? formatCurrency(tenant.monthlyRent) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-white/60">
                          {tenant.securityDeposit ? formatCurrency(tenant.securityDeposit) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {tenant.email && (
                            <a href={`mailto:${tenant.email}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {tenant.phone && (
                            <a href={`tel:${tenant.phone}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70">
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
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
