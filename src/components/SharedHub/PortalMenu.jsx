import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PortalMenu = ({ anchorRef, show, onClose, children }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Position the menu relative to anchor button
  useLayoutEffect(() => {
    if (!show || !anchorRef?.current) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuHeight = menuEl ? menuEl.offsetHeight : 200;
    const menuWidth = 160;

    let left = anchor.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = anchor.bottom + 4;
    if (top + menuHeight > window.innerHeight - 8) {
      top = anchor.top - menuHeight - 4;
    }
    top = Math.max(8, top);

    setPos({ top, left });
  }, [show, anchorRef]);

  // Click outside to close (checks both anchor and portal menu)
  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e) => {
      if (anchorRef?.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [show, onClose, anchorRef]);

  // Close on scroll (internal scroll container or window)
  useEffect(() => {
    if (!show) return;
    const scrollContainer = document.getElementById('main-scroll');
    const handleScroll = () => onClose();
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [show, onClose]);

  if (!show) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos ? `${pos.top}px` : '-9999px',
        left: pos ? `${pos.left}px` : '-9999px',
        zIndex: 9999,
      }}
      className="w-40 bg-slate-700 rounded-xl shadow-xl border border-slate-600 overflow-hidden"
    >
      {children}
    </div>,
    document.body
  );
};

export default PortalMenu;
