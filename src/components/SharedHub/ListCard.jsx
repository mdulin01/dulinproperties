import React, { useState, useRef } from 'react';
import { Check, Plus, Trash2, ChevronDown, ChevronUp, Pencil, MoreVertical, Star, Share2 } from 'lucide-react';
import PortalMenu from './PortalMenu';
import { useSharedHub } from '../../contexts/SharedHubContext';

const ListCard = React.memo(({ list, currentUser, onNavigateToLinked, getLinkedLabel }) => {
  const { toggleListItem, addListItem, deleteListItem, deleteList, highlightList, setShowSharedListModal, showToast } = useSharedHub();
  const [expanded, setExpanded] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const checkedCount = list.items?.filter(i => i.checked).length || 0;
  const totalCount = list.items?.length || 0;
  const uncheckedItems = (list.items || []).filter(i => !i.checked);
  const checkedItems = (list.items || []).filter(i => i.checked);
  const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
  const isUnstarted = totalCount > 0 && checkedCount === 0;

  const categoryEmojis = { shopping: '🛒', groceries: '🥛', packing: '🧳', todo: '✅', custom: '📝' };
  const emoji = list.emoji || categoryEmojis[list.category] || '📝';

  const assigneeLabel = list.assignedTo === 'both' ? 'Both' : list.assignedTo;
  const linkedLabel = list.linkedTo && getLinkedLabel ? getLinkedLabel(list.linkedTo) : null;

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    addListItem(list.id, {
      id: Date.now(),
      text,
      checked: false,
      addedBy: currentUser,
      checkedBy: null,
      addedAt: new Date().toISOString(),
    });
    setNewItemText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddItem();
  };

  return (
    <div className={`bg-white/[0.05] backdrop-blur-md border rounded-2xl transition-all hover:bg-white/[0.08] ${list.highlighted ? 'border-amber-400/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/60' : isUnstarted ? 'border-yellow-500/40 shadow-lg shadow-yellow-500/15 ring-1 ring-yellow-400/50' : 'border-white/[0.08]'}`}>
      {/* Header - tap to expand */}
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-white/5 transition"
        >
          {list.highlighted && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
          <span className="text-xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{list.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/40">
                {checkedCount}/{totalCount} items
              </span>
              <span className="text-xs text-white/30">•</span>
              <span className="text-xs text-white/40">{assigneeLabel}</span>
              {linkedLabel && (
                <>
                  <span className="text-xs text-white/30">•</span>
                  <span className="text-xs text-teal-400">{linkedLabel}</span>
                </>
              )}
            </div>
          </div>
          {/* Progress indicator */}
          {totalCount > 0 && (
            <div className="shrink-0 w-10 h-10 relative">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
                <circle
                  cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                  strokeDasharray={`${(checkedCount / totalCount) * 94.2} 94.2`}
                  strokeLinecap="round"
                  className="text-teal-400"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/60">
                {Math.round((checkedCount / totalCount) * 100)}%
              </span>
            </div>
          )}
          <div className="shrink-0 text-white/30">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* 3-dot menu */}
        <div className="relative pr-2" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 rounded-lg hover:bg-white/10 transition text-white/40 hover:text-white"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <PortalMenu anchorRef={menuRef} show={showMenu} onClose={() => setShowMenu(false)}>
            <button
              onClick={() => { setShowMenu(false); setShowSharedListModal(list); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => { setShowMenu(false); highlightList(list.id); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
            >
              <Star className={`w-3.5 h-3.5 ${list.highlighted ? 'text-amber-400 fill-amber-400' : ''}`} />
              {list.highlighted ? 'Unhighlight' : 'Highlight'}
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                const url = `${window.location.origin}/?hub=list&id=${list.id}`;
                if (navigator.share) {
                  navigator.share({ title: list.name, url }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(url);
                  showToast('Link copied!', 'success');
                }
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-teal-400 hover:bg-teal-500/10 transition text-left"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              onClick={() => { setShowMenu(false); deleteList(list.id); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition text-left"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </PortalMenu>
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-white/5">
          {/* Add item input */}
          <div className="flex items-center gap-2 p-3 bg-slate-900/30">
            <input
              ref={inputRef}
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add item..."
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none"
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemText.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center disabled:opacity-30 transition"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Unchecked items */}
          <div className="px-3 pb-1">
            {uncheckedItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2 px-1 border-b border-white/5 last:border-0">
                <button
                  onClick={() => toggleListItem(list.id, item.id)}
                  className="shrink-0 w-5 h-5 rounded-full border-2 border-slate-500 hover:border-teal-400 transition"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{item.text}</span>
                  <span className="text-[10px] text-white/30 ml-2">{item.addedBy}</span>
                </div>
                <button
                  onClick={() => deleteListItem(list.id, item.id)}
                  className="shrink-0 p-1 text-white/20 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Checked items */}
          {checkedItems.length > 0 && (
            <div className="px-3 pb-3">
              <div className="text-[10px] text-white/30 uppercase tracking-wider px-1 py-1">Completed</div>
              {checkedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-1.5 px-1 opacity-40">
                  <button
                    onClick={() => toggleListItem(list.id, item.id)}
                    className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  <span className="flex-1 text-sm text-white/60 line-through">{item.text}</span>
                  {item.checkedBy && (
                    <span className="text-[10px] text-white/30">{item.checkedBy}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ListCard.displayName = 'ListCard';
export default ListCard;
