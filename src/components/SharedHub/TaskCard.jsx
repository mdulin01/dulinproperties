import React, { useState, useRef } from 'react';
import { Check, Pencil, Trash2, Link, ExternalLink, Flag, MoreVertical, Star, Share2 } from 'lucide-react';
import { getDomainFromUrl } from '../../utils';
import PortalMenu from './PortalMenu';
import { useSharedHub } from '../../contexts/SharedHubContext';

const TaskCard = React.memo(({ task, onNavigateToLinked, getLinkedLabel }) => {
  const { completeTask, deleteTask, updateTask, highlightTask, setShowAddTaskModal, showToast } = useSharedHub();
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const touchStartRef = useRef(null);
  const menuRef = useRef(null);

  const isDone = task.status === 'done';

  const priorityStyles = {
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Low' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Med' },
    high: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'High' },
  };
  const priority = priorityStyles[task.priority] || priorityStyles.low;

  const assigneeLower = (task.assignedTo || '').toLowerCase();
  const assigneeLabel = assigneeLower === 'both' ? 'M & L' : assigneeLower === 'mike' ? 'M' : 'L';

  // Swipe handlers
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setSwiping(true);
      setSwipeX(Math.max(-100, Math.min(0, dx)));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX < -80) {
      onDelete(task.id);
    }
    setSwipeX(0);
    setSwiping(false);
    touchStartRef.current = null;
  };

  const linkedLabel = task.linkedTo && getLinkedLabel ? getLinkedLabel(task.linkedTo) : null;
  const isLinkedToEvent = task && task.linkedTo && (task.linkedTo.section === 'partyEvents' || task.linkedTo.section === 'fitnessEvents');

  const urgencyClass = !isDone && task.priority === 'high'
    ? 'ring-2 ring-red-500/60 shadow-lg shadow-red-500/20'
    : !isDone && task.priority === 'medium'
    ? 'ring-1 ring-amber-400/40 shadow-md shadow-amber-500/10'
    : '';

  const handleCardClick = (e) => {
    // Don't trigger edit if clicking on checkbox, menu, URL link, or linked section button
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    setShowAddTaskModal(task);
  };

  return (
    <div className={`relative rounded-2xl ${task.highlighted ? 'ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/20' : urgencyClass} ${isLinkedToEvent ? 'ring-1 ring-teal-400/50' : ''}`}>
      {/* Delete background */}
      {swipeX < 0 && (
        <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center rounded-2xl">
          <Trash2 className="w-5 h-5 text-white" />
        </div>
      )}

      <div
        className={`relative flex items-center gap-3 p-3 bg-white/[0.05] backdrop-blur-md border border-white/[0.08] rounded-2xl transition-all cursor-pointer ${isDone ? 'opacity-40' : 'hover:bg-white/[0.08]'}`}
        style={{ transform: `translateX(${swipeX}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {/* Checkbox */}
        <button
          onClick={() => completeTask(task.id)}
          className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isDone
              ? 'bg-gradient-to-br from-teal-400 to-cyan-500 border-teal-400'
              : 'border-slate-500 hover:border-teal-400'
          }`}
        >
          {isDone && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium flex items-center gap-1.5 ${isDone ? 'line-through text-white/40' : 'text-white'}`}>
            {task.highlighted && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Priority badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
              {priority.label}
            </span>
            {/* Assignee */}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
              {assigneeLabel}
            </span>
            {/* Due date */}
            {task.dueDate && (
              <span className="text-[10px] text-white/40">
                {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {/* URL link */}
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1 hover:bg-blue-500/30 transition"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {getDomainFromUrl(task.url)}
              </a>
            )}
            {/* Linked section */}
            {linkedLabel && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigateToLinked(task.linkedTo); }}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 flex items-center gap-1 hover:bg-teal-500/30 transition"
              >
                <Link className="w-2.5 h-2.5" />
                {linkedLabel}
              </button>
            )}
          </div>
        </div>

        {/* Image thumbnail */}
        {task.image && (
          <img
            src={task.image}
            alt=""
            className="shrink-0 w-10 h-10 rounded-lg object-cover border border-white/10"
          />
        )}

        {/* 3-dot menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/40 hover:text-white"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <PortalMenu anchorRef={menuRef} show={showMenu} onClose={() => setShowMenu(false)}>
            <button
              onClick={() => { setShowMenu(false); setShowAddTaskModal(task); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => { setShowMenu(false); highlightTask(task.id); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
            >
              <Star className={`w-3.5 h-3.5 ${task.highlighted ? 'text-amber-400 fill-amber-400' : ''}`} />
              {task.highlighted ? 'Unhighlight' : 'Highlight'}
            </button>
            {task.priority !== 'high' && (
              <button
                onClick={() => {
                  const next = task.priority === 'low' ? 'medium' : 'high';
                  setShowMenu(false);
                  updateTask(task.id, { priority: next });
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-600 transition text-left ${
                  task.priority === 'low' ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {task.priority === 'low' ? 'Urgency → Med' : 'Urgency → High'}
              </button>
            )}
            {task.priority !== 'low' && (
              <button
                onClick={() => {
                  const next = task.priority === 'high' ? 'medium' : 'low';
                  setShowMenu(false);
                  updateTask(task.id, { priority: next });
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-600 transition text-left"
              >
                <Flag className="w-3.5 h-3.5" />
                {task.priority === 'high' ? 'Urgency → Med' : 'Urgency → Low'}
              </button>
            )}
            <button
              onClick={() => {
                setShowMenu(false);
                const url = `${window.location.origin}/?hub=task&id=${task.id}`;
                if (navigator.share) {
                  navigator.share({ title: task.title, url }).catch(() => {});
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
              onClick={() => { setShowMenu(false); deleteTask(task.id); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition text-left"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </PortalMenu>
        </div>
      </div>
    </div>
  );
});

TaskCard.displayName = 'TaskCard';
export default TaskCard;
