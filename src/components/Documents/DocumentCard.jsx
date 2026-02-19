import React, { useState, useRef } from 'react';
import { MoreVertical, Trash2, Download, Eye, Edit2 } from 'lucide-react';
import { documentTypes } from '../../constants';

const DocumentCard = React.memo(({ document, properties, onEdit, onDelete, onView }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Get document type info
  const docTypeInfo = documentTypes.find(dt => dt.value === document.type);
  const emoji = docTypeInfo?.emoji || '📁';
  const typeLabel = docTypeInfo?.label || 'Document';

  // Get associated property name
  const property = document.propertyId
    ? properties?.find(p => p.id === document.propertyId)
    : null;

  // Format date
  const formattedDate = document.date
    ? new Date(document.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'No date';

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="relative rounded-2xl">
      <div
        onClick={() => onView(document)}
        className="flex flex-col gap-3 p-4 bg-white/[0.05] backdrop-blur-md border border-white/[0.08] rounded-2xl hover:bg-white/[0.08] transition-colors cursor-pointer group"
      >
        {/* Header with type emoji and menu */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-2xl">{emoji}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate">
                {document.title || typeLabel}
              </h3>
              <p className="text-sm text-slate-400">{typeLabel}</p>
            </div>
          </div>

          {/* Menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-xl py-1 z-50 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(document);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(document);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    // Trigger download if file exists
                    if (document.fileUrl) {
                      const link = document.createElement('a');
                      link.href = document.fileUrl;
                      link.download = document.fileName || 'document';
                      link.click();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(document.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="text-xs text-slate-400">{formattedDate}</div>

        {/* Property link if available */}
        {property && (
          <div className="text-sm">
            <span className="text-slate-400">Property: </span>
            <span className="text-white font-medium">{property.address}</span>
          </div>
        )}

        {/* Amount if available */}
        {document.amount && (
          <div className="text-sm">
            <span className="text-slate-400">Amount: </span>
            <span className="text-white font-medium">
              ${typeof document.amount === 'number'
                ? document.amount.toFixed(2)
                : document.amount}
            </span>
          </div>
        )}

        {/* Tags if available */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            {document.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-white/10 border border-white/15 rounded-full text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* File indicator */}
        {document.fileName && (
          <div className="text-xs text-slate-400 pt-2 border-t border-white/10">
            📎 {document.fileName}
          </div>
        )}
      </div>
    </div>
  );
});

DocumentCard.displayName = 'DocumentCard';

export default DocumentCard;
