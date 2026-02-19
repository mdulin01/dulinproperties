import React, { useState } from 'react';
import { Upload, Check, Loader, AlertCircle, X } from 'lucide-react';
import { propertyColors } from '../../constants';

/**
 * One-time bulk property import component.
 * Pre-loaded with Dulin Properties from Taylor CAD records.
 * Shows a review list, then imports all at once.
 */

const SEED_PROPERTIES = [
  { street: '1357 Sammons St', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '60399', monthlyRent: '1000', tenantName: 'Michelle Arrendondo', mgmt: 'Absolute RE' },
  { street: '5102 Encino Rd', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '64220', monthlyRent: '680', tenantName: 'Renate Evans', mgmt: 'Barnett & Hill' },
  { street: '5217 Questa Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '124279', monthlyRent: '1300', tenantName: 'Wyatt C. Greenwood', mgmt: 'Barnett & Hill' },
  { street: '840 Poplar St', city: 'Abilene', state: 'TX', zip: '79602', currentValue: '26028', monthlyRent: '700', tenantName: 'Daniel I. Medina', mgmt: 'Barnett & Hill' },
  { street: '5490 Questa Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '63524', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5426 Durango Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '125101', monthlyRent: '1152', tenantName: 'Elena Flores', mgmt: 'Barnett & Hill' },
  { street: '898 Presidio Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '113718', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5220 Encino Rd', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '62425', monthlyRent: '987', tenantName: 'Estela Contreras', mgmt: 'Barnett & Hill' },
  { street: '1329 S 11th St', city: 'Abilene', state: 'TX', zip: '79602', currentValue: '67417', monthlyRent: '725', tenantName: 'Byron C. Plummer', mgmt: 'Absolute RE' },
  { street: '5209 Springbrook Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '107137', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '657 Ruidosa Dr #220', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59274', monthlyRent: '800', tenantName: 'Patrick Roach', mgmt: 'Barnett & Hill' },
  { street: '2501 Greenbriar Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '166929', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '657 Ruidosa Dr #215', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59274', monthlyRent: '850', tenantName: 'Alika K. Alexander', mgmt: 'Barnett & Hill' },
  { street: '3510 Brook Hollow Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '165221', monthlyRent: '1550', tenantName: 'Roberto Garcia', mgmt: 'Absolute RE' },
  { street: '1725 Partridge Pl', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '134437', monthlyRent: '1600', tenantName: 'Alfreda O. Colbert', mgmt: 'Absolute RE' },
  { street: '5297 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '49201', monthlyRent: '900', tenantName: 'Leevon M. Henderson', mgmt: 'Barnett & Hill' },
  { street: '5017 Wagon Wheel Ave', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '133520', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5341 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '83645', monthlyRent: '975', tenantName: 'Joe C. Rubalicado', mgmt: 'Absolute RE' },
  { street: '1617 Partridge Pl', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '131351', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5397 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '49061', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '2234 Bel Air Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '91636', monthlyRent: '895', tenantName: 'Lisa Polk', mgmt: 'Absolute RE' },
  { street: '5350 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '48442', monthlyRent: '1250', tenantName: 'Morgan A. Huff', mgmt: 'Absolute RE' },
  { street: '1657 Covey Ln', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '168137', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5402 S 7th St', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59015', monthlyRent: '', tenantName: '', mgmt: '' },
  { street: '5297 Taos Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '67463', monthlyRent: '750', tenantName: 'Linda Gray', mgmt: 'Absolute RE' },
];

// House emojis to cycle through
const emojis = ['🏠', '🏡', '🏘️', '🏚️', '🏗️'];

export default function PropertySeedImport({ existingProperties, onImport, onUpdate, onClose }) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState('import'); // 'import' | 'sync'
  const [selectedIds, setSelectedIds] = useState(new Set(SEED_PROPERTIES.map((_, i) => i)));
  const [syncDone, setSyncDone] = useState(false);

  // Build lookup of existing properties by normalized street
  const existingMap = {};
  (existingProperties || []).forEach(p => {
    const key = (p.street || '').toLowerCase().trim();
    if (key) existingMap[key] = p;
  });
  const existingAddresses = new Set(Object.keys(existingMap));

  // Properties that exist AND have rent data to sync
  const syncable = SEED_PROPERTIES.filter(p => {
    const key = p.street.toLowerCase().trim();
    if (!existingMap[key]) return false;
    if (!p.monthlyRent) return false;
    const existing = existingMap[key];
    // Show if rent is different or tenant missing
    return existing.monthlyRent !== p.monthlyRent || !(existing.tenants?.length > 0 && existing.tenants[0].name);
  });

  const toggleItem = (idx) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === SEED_PROPERTIES.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(SEED_PROPERTIES.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const now = new Date().toISOString();
    const props = SEED_PROPERTIES
      .filter((_, idx) => selectedIds.has(idx))
      .filter(p => !existingAddresses.has(p.street.toLowerCase().trim()))
      .map((p, idx) => ({
        id: Date.now() + idx,
        createdAt: now,
        name: p.street,
        street: p.street,
        city: p.city,
        state: p.state,
        zip: p.zip,
        address: `${p.street}, ${p.city}, ${p.state} ${p.zip}`,
        type: 'single-family',
        units: 1,
        currentValue: p.currentValue,
        purchasePrice: '',
        purchaseDate: '',
        monthlyRent: p.monthlyRent || '',
        hasMortgage: false,
        mortgageBalance: '',
        mortgageAPR: '',
        mortgageMonthlyPayment: '',
        escrowMonthly: '',
        mortgageLender: '',
        mortgageStartDate: '',
        notes: p.mgmt ? `Managed by ${p.mgmt}` : 'Imported from Taylor CAD records',
        color: propertyColors[idx % propertyColors.length],
        emoji: emojis[idx % emojis.length],
        photo: null,
        propertyStatus: p.tenantName ? 'occupied' : 'vacant',
        tenants: p.tenantName ? [{ id: Date.now().toString() + idx, name: p.tenantName, email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: p.monthlyRent || '' }] : [],
      }));

    if (props.length > 0) {
      await onImport(props);
    }
    setImporting(false);
    setDone(true);
  };

  const handleSyncRents = async () => {
    setImporting(true);
    for (const seed of syncable) {
      const key = seed.street.toLowerCase().trim();
      const existing = existingMap[key];
      if (!existing) continue;
      const updates = { monthlyRent: seed.monthlyRent };
      if (seed.mgmt) updates.notes = `Managed by ${seed.mgmt}`;
      if (seed.tenantName) {
        const currentTenants = existing.tenants || [];
        if (!currentTenants.length || !currentTenants[0].name) {
          updates.tenants = [{ id: Date.now().toString(), name: seed.tenantName, email: '', phone: '', leaseStart: '', leaseEnd: '', rentAmount: seed.monthlyRent }];
          updates.tenant = updates.tenants[0];
          updates.propertyStatus = 'occupied';
        }
      }
      await onUpdate(existing.id, updates);
    }
    setImporting(false);
    setSyncDone(true);
  };

  const newCount = SEED_PROPERTIES.filter((p, idx) =>
    selectedIds.has(idx) && !existingAddresses.has(p.street.toLowerCase().trim())
  ).length;
  const duplicateCount = SEED_PROPERTIES.filter((p, idx) =>
    selectedIds.has(idx) && existingAddresses.has(p.street.toLowerCase().trim())
  ).length;
  const totalValue = SEED_PROPERTIES
    .filter((_, idx) => selectedIds.has(idx))
    .reduce((s, p) => s + (parseFloat(p.currentValue) || 0), 0);
  const totalMonthlyRent = SEED_PROPERTIES
    .filter(p => p.monthlyRent)
    .reduce((s, p) => s + (parseFloat(p.monthlyRent) || 0), 0);

  const fmt = (v) => '$' + Number(v).toLocaleString();

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/20 border border-teal-500/30 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Property Manager</h2>
              <p className="text-xs text-white/40">{SEED_PROPERTIES.length} properties — {SEED_PROPERTIES.filter(p => p.monthlyRent).length} with rent data</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/[0.05] rounded-xl p-1">
          <button
            onClick={() => setTab('import')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${tab === 'import' ? 'bg-teal-500 text-white' : 'text-white/50 hover:text-white'}`}
          >
            Import New ({newCount})
          </button>
          <button
            onClick={() => setTab('sync')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${tab === 'sync' ? 'bg-teal-500 text-white' : 'text-white/50 hover:text-white'}`}
          >
            Sync Rents ({syncable.length})
          </button>
        </div>

        {/* ===== IMPORT TAB ===== */}
        {tab === 'import' && !done && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Selected</p>
                <p className="text-lg font-bold text-white">{selectedIds.size}</p>
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">New</p>
                <p className="text-lg font-bold text-teal-400">{newCount}</p>
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Total Value</p>
                <p className="text-lg font-bold text-green-400">{fmt(totalValue)}</p>
              </div>
            </div>

            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <p className="text-xs text-yellow-300">{duplicateCount} propert{duplicateCount === 1 ? 'y' : 'ies'} already exist — use Sync Rents tab to update their data.</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <button onClick={toggleAll} className="text-xs text-white/50 hover:text-white transition">
                {selectedIds.size === SEED_PROPERTIES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-1 max-h-[45vh] overflow-y-auto mb-4">
              {SEED_PROPERTIES.map((p, idx) => {
                const isDuplicate = existingAddresses.has(p.street.toLowerCase().trim());
                const isSelected = selectedIds.has(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition ${
                      isDuplicate
                        ? 'opacity-40 bg-white/[0.02]'
                        : isSelected
                          ? 'bg-teal-500/10 border border-teal-500/20'
                          : 'bg-white/[0.03] border border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-white/20'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white">{p.street}</span>
                        <span className="text-xs text-white/30 block">
                          {p.tenantName ? `${p.tenantName} — ` : ''}{p.city}, {p.state} {p.zip}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {p.monthlyRent && <span className="text-xs text-teal-400 block">{fmt(p.monthlyRent)}/mo</span>}
                      <span className="text-sm text-green-400 font-medium">{fmt(p.currentValue)}</span>
                      {isDuplicate && <span className="text-[10px] text-yellow-400 block">Already exists</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleImport}
              disabled={newCount === 0 || importing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition disabled:opacity-50"
            >
              {importing ? (
                <><Loader className="w-4 h-4 animate-spin" /> Importing...</>
              ) : (
                <>Import {newCount} Properties</>
              )}
            </button>
          </>
        )}

        {/* Import done */}
        {tab === 'import' && done && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Import Complete</h3>
            <p className="text-white/50 text-sm mb-6">{newCount} properties have been added.</p>
            <button onClick={onClose} className="px-6 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition">
              Done
            </button>
          </div>
        )}

        {/* ===== SYNC RENTS TAB ===== */}
        {tab === 'sync' && !syncDone && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Properties to Update</p>
                <p className="text-lg font-bold text-teal-400">{syncable.length}</p>
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Total Monthly Rent</p>
                <p className="text-lg font-bold text-green-400">{fmt(totalMonthlyRent)}</p>
              </div>
            </div>

            {syncable.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/40 text-sm">All existing properties are already up to date.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-white/40 mb-3">These existing properties will get updated rent amounts and tenant info from the Jan 2026 owner statements.</p>
                <div className="space-y-1 max-h-[45vh] overflow-y-auto mb-4">
                  {syncable.map((p, idx) => {
                    const existing = existingMap[p.street.toLowerCase().trim()];
                    return (
                      <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <div>
                          <span className="text-sm font-medium text-white">{p.street}</span>
                          <span className="text-xs text-white/30 block">
                            {p.tenantName && <span className="text-blue-400">{p.tenantName}</span>}
                            {p.mgmt && <span className="text-white/20"> — {p.mgmt}</span>}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-teal-400 font-medium">{fmt(p.monthlyRent)}/mo</span>
                          {existing?.monthlyRent && existing.monthlyRent !== p.monthlyRent && (
                            <span className="text-[10px] text-white/30 block">was {fmt(existing.monthlyRent)}</span>
                          )}
                          {!existing?.monthlyRent && (
                            <span className="text-[10px] text-green-400 block">new</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSyncRents}
                  disabled={importing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition disabled:opacity-50"
                >
                  {importing ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Updating...</>
                  ) : (
                    <>Update {syncable.length} Properties</>
                  )}
                </button>
              </>
            )}
          </>
        )}

        {/* Sync done */}
        {tab === 'sync' && syncDone && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Rent Data Synced</h3>
            <p className="text-white/50 text-sm mb-6">{syncable.length} properties updated with rent & tenant data.</p>
            <button onClick={onClose} className="px-6 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
