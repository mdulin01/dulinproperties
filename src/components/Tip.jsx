import React, { useState, useEffect } from 'react';
import { Info, X, Lightbulb } from 'lucide-react';

/**
 * Tip — small dismissible info banner for contextual guidance.
 *
 * Pass a unique `tipKey` and the message stays dismissed across reloads
 * (localStorage). Omit `tipKey` to make the banner non-persistent.
 *
 * Variants: 'info' (blue), 'tip' (amber lightbulb), 'success' (emerald).
 */
export default function Tip({
  tipKey,
  variant = 'tip',
  children,
  className = '',
  dismissible = true,
}) {
  const storageKey = tipKey ? `tip-dismissed:${tipKey}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (storageKey) {
      try { if (localStorage.getItem(storageKey) === '1') setDismissed(true); } catch (e) {}
    }
  }, [storageKey]);

  if (dismissed) return null;

  const variantCls = {
    tip:     'bg-amber-500/[0.07] border-amber-500/30 text-amber-100',
    info:    'bg-blue-500/[0.07] border-blue-500/30 text-blue-100',
    success: 'bg-emerald-500/[0.07] border-emerald-500/30 text-emerald-100',
  }[variant] || '';
  const iconCls = {
    tip:     'text-amber-300',
    info:    'text-blue-300',
    success: 'text-emerald-300',
  }[variant] || '';
  const Icon = variant === 'info' ? Info : Lightbulb;

  const dismiss = () => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch (e) {}
    }
    setDismissed(true);
  };

  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-3 py-2.5 ${variantCls} ${className}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconCls}`} />
      <div className="flex-1 text-xs leading-relaxed">{children}</div>
      {dismissible && (
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-white/30 hover:text-white/70 transition"
          aria-label="Dismiss tip"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
