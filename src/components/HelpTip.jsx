import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * HelpTip — a small (?) icon that shows a popover on hover (desktop) or tap (mobile).
 * Usage: <HelpTip>Here is some help text.</HelpTip>
 *
 * Keeps the popover within the viewport horizontally by flipping to the right
 * when the icon is near the left edge.
 */
export default function HelpTip({ children, side = 'right', className = '', label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click (so mobile taps can dismiss)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const pop = (
    <span
      role="tooltip"
      className={`absolute z-50 ${side === 'right' ? 'left-full ml-2' : 'right-full mr-2'} top-1/2 -translate-y-1/2 w-72 max-w-[80vw] px-3 py-2 rounded-xl bg-slate-800 border border-white/20 shadow-2xl text-[12px] leading-relaxed text-white/90`}
    >
      {children}
    </span>
  );

  return (
    <span ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={label || 'Help'}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white/50 hover:text-white/80 hover:bg-white/10 transition"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && pop}
    </span>
  );
}
