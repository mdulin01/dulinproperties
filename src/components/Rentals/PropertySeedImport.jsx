import React, { useState } from 'react';
import { Upload, Check, Loader, AlertCircle, X } from 'lucide-react';
import { propertyColors } from '../../constants';

/**
 * One-time bulk property import component.
 * Pre-loaded with Dulin Properties from Taylor CAD records.
 * Shows a review list, then imports all at once.
 */

const SEED_PROPERTIES = [
  { street: '1357 Sammons St', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '60399' },
  { street: '5102 Encino Rd', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '64220' },
  { street: '5217 Questa Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '124279' },
  { street: '840 Poplar St', city: 'Abilene', state: 'TX', zip: '79602', currentValue: '26028' },
  { street: '5490 Questa Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '63524' },
  { street: '5426 Durango Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '125101' },
  { street: '898 Presidio Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '113718' },
  { street: '5220 Encino Rd', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '62425' },
  { street: '1329 S 11th St', city: 'Abilene', state: 'TX', zip: '79602', currentValue: '67417' },
  { street: '5209 Springbrook Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '107137' },
  { street: '657 Ruidosa Dr #220', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59274' },
  { street: '2501 Greenbriar Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '166929' },
  { street: '657 Ruidosa Dr #215', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59274' },
  { street: '3510 Brook Hollow Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '165221' },
  { street: '1725 Partridge Pl', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '134437' },
  { street: '5297 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '49201' },
  { street: '5017 Wagon Wheel Ave', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '133520' },
  { street: '5341 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '83645' },
  { street: '1617 Partridge Pl', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '131351' },
  { street: '5397 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '49061' },
  { street: '2234 Bel Air Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '91636' },
  { street: '5350 Pueblo Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '48442' },
  { street: '1657 Covey Ln', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '168137' },
  { street: '5402 S 7th St', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '59015' },
  { street: '5297 Taos Dr', city: 'Abilene', state: 'TX', zip: '79605', currentValue: '67463' },
];

// House emojis to cycle through
const emojis = ['🏠', '🏡', '🏘️', '🏚️', '🏗️'];

export default function PropertySeedImport({ existingProperties, onImport, onClose }) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set(SEED_PROPERTIES.map((_, i) => i)));

  // Check which ones already exist by street address
  const existingAddresses = new Set(
    (existingProperties || []).map(p => (p.street || '').toLowerCase().trim())
  );

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
        monthlyRent: '',
        hasMortgage: false,
        mortgageBalance: '',
        mortgageAPR: '',
        mortgageMonthlyPayment: '',
        escrowMonthly: '',
        mortgageLender: '',
        mortgageStartDate: '',
        notes: 'Imported from Taylor CAD records',
        color: propertyColors[idx % propertyColors.length],
        emoji: emojis[idx % emojis.length],
        photo: null,
        propertyStatus: 'occupied',
        tenants: [],
      }));

    if (props.length > 0) {
      await onImport(props);
    }
    setImporting(false);
    setDone(true);
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
              <h2 className="text-lg font-bold text-white">Import Properties</h2>
              <p className="text-xs text-white/40">Taylor CAD records — {SEED_PROPERTIES.length} properties</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {!done ? (
          <>
            {/* Summary */}
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
                <p className="text-xs text-yellow-300">{duplicateCount} propert{duplicateCount === 1 ? 'y' : 'ies'} already exist and will be skipped.</p>
              </div>
            )}

            {/* Toggle all */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={toggleAll} className="text-xs text-white/50 hover:text-white transition">
                {selectedIds.size === SEED_PROPERTIES.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Property list */}
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
                        <span className="text-xs text-white/30 block">{p.city}, {p.state} {p.zip}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-green-400 font-medium">{fmt(p.currentValue)}</span>
                      {isDuplicate && <span className="text-[10px] text-yellow-400 block">Already exists</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Import button */}
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
        ) : (
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
      </div>
    </div>
  );
}
