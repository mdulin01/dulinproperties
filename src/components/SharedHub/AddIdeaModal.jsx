import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Link2, ExternalLink, Lightbulb, Tag, Loader2, Image as ImageIcon } from 'lucide-react';
import { ideaCategories, ideaStatuses } from '../../constants';
import { suggestIdeaCategoryFromUrl, getDomainFromUrl, fetchUrlMetadata } from '../../utils';

const AddIdeaModal = React.memo(({
  onClose,
  onSave,
  editIdea,
  currentUser,
  onPromoteToTask,
}) => {
  // Initialize form data from editIdea if provided, otherwise empty
  const [formData, setFormData] = useState(editIdea ? {
    url: editIdea.url || '',
    title: editIdea.title || '',
    description: editIdea.description || '',
    category: editIdea.category || 'other',
    tags: editIdea.tags ? editIdea.tags.join(', ') : '',
    status: editIdea.status || 'inbox',
  } : {
    url: '',
    title: '',
    description: '',
    category: 'other',
    tags: '',
    status: 'inbox',
  });

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [preview, setPreview] = useState(editIdea?.preview || null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const fetchAbortRef = useRef(null);
  const lastFetchedUrl = useRef(editIdea?.url || '');

  const isEditing = !!editIdea;

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError('');
  };

  // Fetch URL preview metadata
  const fetchPreview = useCallback(async (url) => {
    const trimmed = url?.trim();
    if (!trimmed || trimmed === lastFetchedUrl.current) return;
    // Basic URL validation
    try { new URL(trimmed); } catch { return; }

    lastFetchedUrl.current = trimmed;
    setFetchingPreview(true);
    setPreview(null);

    try {
      const meta = await fetchUrlMetadata(trimmed);
      if (meta) {
        setPreview(meta);
        // Auto-fill title & description if empty
        setFormData(prev => ({
          ...prev,
          title: prev.title || meta.title || prev.title,
          description: prev.description || meta.description || prev.description,
        }));
      }
    } finally {
      setFetchingPreview(false);
    }
  }, []);

  // Auto-suggest category when URL changes
  const handleUrlChange = (url) => {
    updateField('url', url);
    if (url.trim()) {
      const suggestedCategory = suggestIdeaCategoryFromUrl(url);
      updateField('category', suggestedCategory);
    }
  };

  // Fetch preview on URL blur (user finished typing/pasting)
  const handleUrlBlur = () => {
    if (formData.url.trim()) {
      fetchPreview(formData.url);
    }
  };

  // Also fetch on paste after a brief delay
  const handleUrlPaste = (e) => {
    // The value won't be updated yet in onChange, so read from clipboard
    const pasted = e.clipboardData?.getData('text');
    if (pasted) {
      setTimeout(() => fetchPreview(pasted), 100);
    }
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      const hasData = Object.values(formData).some(v => {
        if (v === null || v === '') return false;
        if (typeof v === 'string') return v.trim().length > 0;
        return true;
      });
      if (hasData) {
        setShowConfirmClose(true);
      } else {
        onClose();
      }
    }
  };

  const handleClose = () => {
    const hasData = Object.values(formData).some(v => {
      if (v === null || v === '') return false;
      if (typeof v === 'string') return v.trim().length > 0;
      return true;
    });
    if (hasData) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = () => {
    // Validation: title and category are required
    if (!formData.title.trim()) {
      setValidationError('Idea title is required');
      return;
    }
    if (!formData.category) {
      setValidationError('Category is required');
      return;
    }

    // Build the idea object
    const idea = {
      id: editIdea?.id || Date.now(),
      url: formData.url.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      tags: formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0),
      status: formData.status,
      preview: preview || editIdea?.preview || null,
      addedBy: currentUser,
      linkedTo: null,
      createdAt: editIdea?.createdAt || new Date().toISOString(),
    };

    onSave(idea);
  };

  const handlePromoteToTask = () => {
    if (editIdea && onPromoteToTask) {
      onPromoteToTask(editIdea);
    }
  };

  // Get the domain for URL preview
  const urlDomain = formData.url ? getDomainFromUrl(formData.url) : '';
  const selectedCategory = ideaCategories.find(cat => cat.value === formData.category);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackgroundClick}
    >
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg mx-auto w-full max-h-[85dvh] flex flex-col overflow-hidden">
        {/* Gradient header bar */}
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500" />

        {/* Confirm close overlay */}
        {showConfirmClose && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-3xl">
            <div className="bg-slate-800 rounded-2xl p-6 m-4 shadow-xl border border-slate-700">
              <p className="text-white font-medium mb-4">Discard your changes?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmClose(false)}
                  className="flex-1 py-2 px-4 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-600 transition"
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => {
                    setFormData({});
                    onClose();
                  }}
                  className="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-yellow-400" />
              {isEditing ? 'Edit Idea' : 'Create Idea'}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700 rounded-full transition text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Link
            </label>
            <input
              type="url"
              placeholder="Paste link"
              value={formData.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              onPaste={handleUrlPaste}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-yellow-400 focus:outline-none transition"
            />
            {urlDomain && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-600 rounded-lg text-sm text-teal-400 mt-2">
                <span>{urlDomain}</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
            {/* Link preview */}
            {fetchingPreview && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-slate-700/50 rounded-xl">
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-xs text-white/50">Fetching preview...</span>
              </div>
            )}
            {!fetchingPreview && preview && (
              <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-slate-700/50">
                {preview.image && (
                  <img
                    src={preview.image}
                    alt=""
                    className="w-full h-32 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {(preview.title || preview.description) && (
                  <div className="p-3">
                    {preview.title && (
                      <div className="text-xs font-medium text-white/70 line-clamp-1">{preview.title}</div>
                    )}
                    {preview.description && (
                      <div className="text-[10px] text-white/40 mt-1 line-clamp-2">{preview.description}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Title *
            </label>
            <input
              type="text"
              placeholder="What's your idea?"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-yellow-400 focus:outline-none transition"
            />
            {validationError && validationError.includes('title') && (
              <p className="text-red-400 text-sm mt-1">{validationError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              placeholder="Add details about this idea..."
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-yellow-400 focus:outline-none transition resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Category *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ideaCategories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => updateField('category', cat.value)}
                  className={`py-2 px-2 rounded-xl font-medium transition flex flex-col items-center gap-1 text-xs ${
                    formData.category === cat.value
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                      : 'bg-slate-700 text-white/60 hover:text-white'
                  }`}
                  title={cat.label}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="hidden sm:block">{cat.label}</span>
                </button>
              ))}
            </div>
            {validationError && validationError.includes('Category') && (
              <p className="text-red-400 text-sm mt-2">{validationError}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            <input
              type="text"
              placeholder="Separate multiple tags with commas"
              value={formData.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-yellow-400 focus:outline-none transition"
            />
            {formData.tags && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(tag => tag.length > 0)
                  .map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-slate-700 text-amber-400 text-sm rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Status (only when editing) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white focus:border-yellow-400 focus:outline-none transition"
              >
                {ideaStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50 space-y-3 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {isEditing && onPromoteToTask && (
            <button
              onClick={handlePromoteToTask}
              className="w-full py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Check className="w-5 h-5" />
              Plan This
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Check className="w-5 h-5" />
            {isEditing ? 'Save Changes' : 'Create Idea'}
          </button>
        </div>
      </div>
    </div>
  );
});

AddIdeaModal.displayName = 'AddIdeaModal';

export default AddIdeaModal;
