import React, { useState, useRef } from 'react';
import { X, Check, Calendar, Link, Link2, ExternalLink, Tag, Flag, User, ImagePlus, Trash2 } from 'lucide-react';
import { timeHorizons, taskPriorities } from '../../constants';
import { getDomainFromUrl } from '../../utils';

const AddTaskModal = React.memo(({
  onClose,
  onSave,
  editTask,
  task,
  currentUser,
  trips,
  fitnessEvents,
  partyEvents,
  properties,
}) => {
  // Support both prop names (editTask or task) for backward compat
  const existingTask = editTask || (task && task.id ? task : null);
  // Initialize form data from existingTask if provided, otherwise empty
  const [formData, setFormData] = useState(existingTask ? {
    title: existingTask.title || '',
    description: existingTask.description || '',
    url: existingTask.url || '',
    image: existingTask.image || '',
    timeHorizon: existingTask.timeHorizon || 'today',
    dueDate: existingTask.dueDate || '',
    assignedTo: existingTask.assignedTo || 'Mike',
    priority: existingTask.priority || 'medium',
    linkedTo: existingTask.linkedTo || null,
    tags: existingTask.tags ? existingTask.tags.join(', ') : '',
  } : {
    title: '',
    description: '',
    url: '',
    image: '',
    timeHorizon: 'today',
    dueDate: '',
    assignedTo: 'Mike',
    priority: 'medium',
    linkedTo: null,
    tags: '',
  });

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  // Resize image to keep Firestore doc size manageable
  const resizeImage = (file, maxWidth = 400) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const [dragActive, setDragActive] = useState(false);

  const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await resizeImage(file);
    updateField('image', dataUrl);
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);

  const isEditing = !!existingTask;

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError('');
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
    // Validation: title is required
    if (!formData.title.trim()) {
      setValidationError('Task title is required');
      return;
    }

    // Build the task object
    const task = {
      id: existingTask?.id || Date.now(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      url: formData.url.trim(),
      image: formData.image || '',
      timeHorizon: formData.timeHorizon,
      dueDate: formData.dueDate,
      assignedTo: formData.assignedTo,
      priority: formData.priority,
      linkedTo: formData.linkedTo,
      tags: formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0),
      status: existingTask?.status || 'pending',
      createdBy: currentUser,
      createdAt: existingTask?.createdAt || new Date().toISOString(),
    };

    onSave(task);
  };

  // Get all available sections for linking
  const getSectionOptions = () => {
    const options = [];

    // Add properties
    if (properties && properties.length > 0) {
      properties.forEach(prop => {
        options.push({
          label: `${prop.emoji || '🏠'} ${prop.name}`,
          value: String(prop.id),
          section: 'property',
        });
      });
    }

    // Add trips
    if (trips && trips.length > 0) {
      trips.forEach(trip => {
        options.push({
          label: trip.destination,
          value: trip.id,
          section: 'trips',
        });
      });
    }

    // Add fitness events
    if (fitnessEvents && fitnessEvents.length > 0) {
      fitnessEvents.forEach(event => {
        options.push({
          label: event.name,
          value: event.id,
          section: 'fitnessEvents',
        });
      });
    }

    // Add party events
    if (partyEvents && partyEvents.length > 0) {
      partyEvents.forEach(event => {
        options.push({
          label: event.name,
          value: event.id,
          section: 'partyEvents',
        });
      });
    }

    return options;
  };

  const sectionOptions = getSectionOptions();
  // Support both linkedTo.itemId and linkedTo.propertyId for backward compat
  const linkedItemId = formData.linkedTo?.itemId || formData.linkedTo?.propertyId || '';
  const currentLinkedSection = formData.linkedTo
    ? sectionOptions.find(opt => String(opt.value) === String(linkedItemId))
    : null;

  const getPriorityColor = (priority) => {
    const priorityObj = taskPriorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : 'text-slate-400';
  };

  const getPriorityBg = (priority) => {
    const priorityObj = taskPriorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.bg : 'bg-slate-500/20';
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackgroundClick}
    >
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg mx-auto w-full max-h-[85dvh] flex flex-col overflow-hidden">
        {/* Gradient header bar */}
        <div className="h-1 bg-gradient-to-r from-teal-400 via-blue-500 to-indigo-500" />

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
              {isEditing ? 'Edit Task' : 'Create Task'}
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              placeholder="What needs to be done?"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
            />
            {validationError && (
              <p className="text-red-400 text-sm mt-1">{validationError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              placeholder="Add details about this task..."
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition resize-none"
            />
          </div>

          {/* URL / Link */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Link
            </label>
            <input
              type="url"
              placeholder="Add a helpful link (recipe, store, article...)"
              value={formData.url}
              onChange={(e) => updateField('url', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
            />
            {formData.url && getDomainFromUrl(formData.url) && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-600 rounded-lg text-sm text-teal-400 mt-2">
                <span>{getDomainFromUrl(formData.url)}</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <ImagePlus className="w-4 h-4" />
              Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImagePick}
              className="hidden"
            />
            {formData.image ? (
              <div className="relative inline-block w-full">
                <img
                  src={formData.image}
                  alt="Task"
                  className="w-full max-h-48 object-cover rounded-xl border-2 border-slate-600"
                />
                <button
                  type="button"
                  onClick={() => updateField('image', '')}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full transition text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-6 border-2 border-dashed rounded-xl transition flex flex-col items-center justify-center gap-2 text-sm cursor-pointer ${
                  dragActive
                    ? 'border-teal-400 bg-teal-500/10 text-teal-400'
                    : 'border-slate-600 text-white/40 hover:text-white/60 hover:border-slate-500'
                }`}
              >
                <ImagePlus className="w-6 h-6" />
                <span>Tap to choose or take a photo</span>
                <span className="text-[11px] text-white/25 hidden md:block">or drag & drop an image here</span>
              </div>
            )}
          </div>

          {/* Time Horizon */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Time Horizon *
            </label>
            <div className="flex flex-wrap gap-2">
              {timeHorizons.map(horizon => (
                <button
                  key={horizon.value}
                  onClick={() => updateField('timeHorizon', horizon.value)}
                  className={`px-4 py-2 rounded-xl font-medium transition ${
                    formData.timeHorizon === horizon.value
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white'
                      : 'bg-slate-700 text-white/60 hover:text-white'
                  }`}
                >
                  {horizon.emoji} {horizon.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => updateField('dueDate', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
            />
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Assigned To *
            </label>
            <div className="flex gap-2">
              {['Mike', 'Liam', 'Both'].map(person => (
                <button
                  key={person}
                  onClick={() => updateField('assignedTo', person)}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition ${
                    formData.assignedTo === person
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white'
                      : 'bg-slate-700 text-white/60 hover:text-white'
                  }`}
                >
                  {person}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Priority *
            </label>
            <div className="flex gap-2">
              {taskPriorities.map(p => (
                <button
                  key={p.value}
                  onClick={() => updateField('priority', p.value)}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition ${
                    formData.priority === p.value
                      ? `bg-gradient-to-r from-teal-400 to-cyan-500 text-white`
                      : `bg-slate-700 text-white/60 hover:text-white`
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link to Property */}
          {sectionOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <Link className="w-4 h-4" />
                Link to Property
              </label>
              <select
                value={linkedItemId}
                onChange={(e) => {
                  if (e.target.value) {
                    const selected = sectionOptions.find(opt => String(opt.value) === e.target.value);
                    if (selected) {
                      const linked = {
                        section: selected.section,
                        itemId: selected.value,
                      };
                      // For properties, also set propertyId for backward compat
                      if (selected.section === 'property') {
                        linked.propertyId = selected.value;
                      }
                      updateField('linkedTo', linked);
                    }
                  } else {
                    updateField('linkedTo', null);
                  }
                }}
                className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
              >
                <option value="">None</option>
                {sectionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
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
                      className="px-3 py-1 bg-slate-700 text-teal-400 text-sm rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with action button */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-teal-400 to-cyan-500 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Check className="w-5 h-5" />
            {isEditing ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
});

AddTaskModal.displayName = 'AddTaskModal';

export default AddTaskModal;
