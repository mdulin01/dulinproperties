import React, { useState, useRef } from 'react';
import { ExternalLink, Zap, Pencil, Trash2, MoreVertical, Star, Share2 } from 'lucide-react';
import { getDomainFromUrl } from '../../utils';
import PortalMenu from './PortalMenu';
import { useSharedHub } from '../../contexts/SharedHubContext';

const IdeaCard = React.memo(({ idea, onPromoteToTask }) => {
  const { deleteIdea, highlightIdea, setShowAddIdeaModal, showToast } = useSharedHub();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const categoryEmojis = {
    trip: '✈️', recipe: '🍝', date: '🍷', home: '🏠',
    gift: '🎁', activity: '🎯', career: '💼', other: '💡',
  };

  const statusStyles = {
    inbox: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Inbox' },
    saved: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Saved' },
    planned: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Planned' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Done' },
  };

  const status = statusStyles[idea.status] || statusStyles.inbox;
  const emoji = categoryEmojis[idea.category] || '💡';
  const domain = idea.url ? getDomainFromUrl(idea.url) : null;
  const isInbox = idea.status === 'inbox';

  const previewImage = idea.preview?.image;

  return (
    <div className={`bg-white/[0.05] backdrop-blur-md border rounded-2xl hover:bg-white/[0.08] hover:border-white/[0.12] transition group ${idea.highlighted ? 'border-amber-400/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/60' : isInbox ? 'border-cyan-500/30 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40' : 'border-white/[0.08]'}`}>
      {/* Preview image banner */}
      {previewImage && (
        <a
          href={idea.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block"
        >
          <img
            src={previewImage}
            alt=""
            className="w-full h-28 object-cover"
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
        </a>
      )}

      <div className="p-4">
        {/* Top row: emoji + status + menu */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {idea.highlighted && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
            <span className="text-xl">{emoji}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {/* 3-dot menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-lg hover:bg-white/10 transition text-white/30 hover:text-white"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              <PortalMenu anchorRef={menuRef} show={showMenu} onClose={() => setShowMenu(false)}>
                <button
                  onClick={() => { setShowMenu(false); setShowAddIdeaModal(idea); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {idea.status !== 'done' && idea.status !== 'planned' && (
                  <button
                    onClick={() => { setShowMenu(false); onPromoteToTask(idea); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 transition text-left"
                  >
                    <Zap className="w-3.5 h-3.5" /> Plan This
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); highlightIdea(idea.id); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-slate-600 transition text-left"
                >
                  <Star className={`w-3.5 h-3.5 ${idea.highlighted ? 'text-amber-400 fill-amber-400' : ''}`} />
                  {idea.highlighted ? 'Unhighlight' : 'Highlight'}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    const url = `${window.location.origin}/?hub=idea&id=${idea.id}`;
                    if (navigator.share) {
                      navigator.share({ title: idea.title, url }).catch(() => {});
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
                  onClick={() => { setShowMenu(false); deleteIdea(idea.id); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </PortalMenu>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-sm font-semibold text-white mb-1 line-clamp-2">{idea.title}</div>

        {/* Description */}
        {idea.description && (
          <div className="text-xs text-white/40 mb-2 line-clamp-2">{idea.description}</div>
        )}

        {/* URL domain */}
        {domain && (
          <a
            href={idea.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg text-xs text-teal-400 hover:text-teal-300 transition mb-2"
          >
            <ExternalLink className="w-3 h-3" />
            {domain}
          </a>
        )}

        {/* Tags */}
        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {idea.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                {tag}
              </span>
            ))}
            {idea.tags.length > 3 && (
              <span className="text-[10px] text-white/20">+{idea.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Added by */}
        <div className="text-[10px] text-white/25">{idea.addedBy}</div>
      </div>
    </div>
  );
});

IdeaCard.displayName = 'IdeaCard';
export default IdeaCard;
