import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * Combobox — a typeahead replacement for <select> that filters options as you
 * type. Built for mom's data-entry workflow: tab into it, start typing a
 * property name, see the list filter, arrow / Enter to pick.
 *
 * Props:
 *   value           : currently-selected option value
 *   onChange(value) : called with the new value
 *   options         : Array<{ value: string, label: string, emoji?: string }>
 *   placeholder     : input placeholder when empty
 *   className       : extra classes on the input
 *   id              : optional id for label association
 *   disabled        : disable the input
 *   allowClear      : show an × to clear the selection
 *
 * Keyboard:
 *   ArrowDown/Up : move highlight
 *   Enter        : pick the highlighted option
 *   Tab          : pick the highlighted option (if list open) and move on
 *   Escape       : close without picking
 */
export default function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  id,
  disabled = false,
  allowClear = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => options.find(o => String(o.value) === String(value)),
    [options, value]
  );

  // When searching: filter by substring on label and emoji. When not searching
  // (no query), show every option so a click/tab opens the full list.
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      (o.label || '').toLowerCase().includes(q) ||
      (o.emoji || '').includes(q)
    );
  }, [options, query]);

  // Reset highlight whenever the filtered list changes.
  useEffect(() => { setHighlightIdx(0); }, [query, options]);

  // Click outside to close.
  useEffect(() => {
    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Auto-scroll the highlighted item into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const commit = (opt) => {
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlightIdx]) {
        e.preventDefault();
        commit(filtered[highlightIdx]);
      }
    } else if (e.key === 'Tab') {
      // On Tab: commit the highlighted option if the list is open, then let
      // the browser do its normal focus advance. This lets mom type, see the
      // match, and Tab away in one motion.
      if (open && query && filtered[highlightIdx]) {
        commit(filtered[highlightIdx]);
      } else {
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  const displayValue = open
    ? query
    : (selected ? `${selected.emoji ? selected.emoji + ' ' : ''}${selected.label}` : '');

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={displayValue}
          placeholder={selected ? '' : placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          className={`w-full pr-9 ${className}`}
        />
        {allowClear && selected && !open && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-[300] left-0 right-0 mt-1 bg-slate-800 border border-white/15 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              data-idx={i}
              role="option"
              aria-selected={i === highlightIdx}
              onMouseEnter={() => setHighlightIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlightIdx ? 'bg-emerald-500/20 text-white' : 'text-white/75 hover:bg-white/[0.06]'
              }`}
            >
              {opt.emoji ? <span className="mr-1.5">{opt.emoji}</span> : null}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-[300] left-0 right-0 mt-1 px-3 py-2 bg-slate-800 border border-white/15 rounded-xl text-xs text-white/40">
          No match.
        </div>
      )}
    </div>
  );
}
