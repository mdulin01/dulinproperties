import React, { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { getPropertyTenants } from '../../hooks/useProperties';

/**
 * DocsActionItems — lease/tenant/document-related action items.
 * Rendered at the top of the Documents page so Dianne sees what's missing
 * (leases, lease dates, tenant info) before she starts browsing files.
 */
export default function DocsActionItems({ properties, onOpenProperty }) {
  const [expanded, setExpanded] = useState(true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getManager = (color) => {
    if (!color) return 'Absolute';
    if (color.includes('purple') || color.includes('violet') || color.includes('indigo')) return 'Barnett & Hill';
    if (color.includes('rose') || color.includes('pink')) return 'Dianne Dulin';
    return 'Absolute';
  };
  const isManaged = (p) => {
    const mgr = getManager(p.color || '');
    return mgr === 'Absolute' || mgr === 'Barnett & Hill';
  };
  const effectiveStatus = (p) => p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant');

  // Build action items (lease-related only — financial items live in Input Data)
  const items = [];

  (properties || []).forEach(p => {
    if (isManaged(p)) return; // lease admin is handled by the management company for those

    const tenants = getPropertyTenants(p);
    const status = effectiveStatus(p);

    // No lease dates entered — only for occupied properties
    if (['occupied', 'month-to-month'].includes(status) && tenants.length > 0) {
      const hasAny = tenants.some(t => t.leaseStart || t.leaseEnd);
      if (!hasAny) {
        items.push({
          id: `no-lease-${p.id}`,
          icon: '📝',
          severity: 'amber',
          text: `${p.emoji || '🏠'} ${p.name} — no lease dates entered`,
          actionLabel: 'Add lease',
          onClick: () => onOpenProperty?.(p),
        });
      }
    }

    // Lease expired
    tenants.forEach(t => {
      if (!t.leaseEnd) return;
      const end = new Date(t.leaseEnd + 'T00:00:00');
      if (isNaN(end)) return;
      if (end < today) {
        items.push({
          id: `expired-${p.id}-${t.id || 'x'}`,
          icon: '📋',
          severity: 'red',
          text: `${p.emoji || '🏠'} ${p.name} — lease ${t.name ? `for ${t.name} ` : ''}expired ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
          actionLabel: 'Renew',
          onClick: () => onOpenProperty?.(p),
        });
      } else {
        const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        if (days <= 60) {
          items.push({
            id: `expiring-${p.id}-${t.id || 'x'}`,
            icon: '⏳',
            severity: 'amber',
            text: `${p.emoji || '🏠'} ${p.name} — lease ${t.name ? `for ${t.name} ` : ''}expires in ${days} day${days === 1 ? '' : 's'}`,
            actionLabel: 'View',
            onClick: () => onOpenProperty?.(p),
          });
        }
      }
    });

    // Occupied without any tenant info
    if (['occupied', 'month-to-month'].includes(status) && tenants.length === 0) {
      items.push({
        id: `no-tenant-${p.id}`,
        icon: '👤',
        severity: 'amber',
        text: `${p.emoji || '🏠'} ${p.name} — occupied but no tenant details`,
        actionLabel: 'Add tenant',
        onClick: () => onOpenProperty?.(p),
      });
    }
  });

  if (items.length === 0) return null;

  const severityCls = {
    red: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
    amber: 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
  };

  return (
    <div className="mb-4 border border-amber-500/30 bg-amber-500/[0.05] rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.02] transition"
      >
        <FileText className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-200">
          {items.length} document{items.length === 1 ? '' : 's'} to handle
        </span>
        <span className="text-xs text-amber-300/60 ml-auto">Leases &amp; tenant info</span>
        <ChevronDown className={`w-4 h-4 text-amber-300 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>
      {expanded && (
        <div className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base flex-shrink-0" aria-hidden="true">{item.icon}</span>
              <span className="text-sm text-white/80 flex-1 min-w-0">{item.text}</span>
              <button
                onClick={item.onClick}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition flex-shrink-0 ${severityCls[item.severity] || severityCls.amber}`}
              >
                {item.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
