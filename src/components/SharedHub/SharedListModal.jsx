import React, { useState } from 'react';
import { X, Check, Plus, ShoppingCart, Trash2, User, Link, ChevronLeft } from 'lucide-react';
import { listCategories } from '../../constants';

const SharedListModal = React.memo(({
  onClose,
  onSave,
  onUpdateItems,
  editList,
  currentUser,
  trips,
  fitnessEvents,
  partyEvents
}) => {
  const isEditing = !!editList;
  const [mode, setMode] = useState(isEditing ? 'items' : 'form');

  // Form data state
  const [formData, setFormData] = useState(editList ? {
    name: editList.name || '',
    emoji: editList.emoji || '📝',
    category: editList.category || 'custom',
    assignedTo: editList.assignedTo || 'Both',
    linkedTo: editList.linkedTo || null,
  } : {
    name: '',
    emoji: '📝',
    category: 'custom',
    assignedTo: 'Both',
    linkedTo: null,
  });

  // Items state — used in both create and edit
  const [items, setItems] = useState(editList?.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [validationError, setValidationError] = useState('');

  const getDefaultEmoji = (category) => {
    const cat = listCategories.find(c => c.value === category);
    return cat ? cat.emoji : '📝';
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError('');
  };

  const handleCategoryChange = (category) => {
    updateField('category', category);
    if (!formData.emoji || formData.emoji === getDefaultEmoji(formData.category)) {
      updateField('emoji', getDefaultEmoji(category));
    }
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      if (mode === 'form') {
        const hasData = formData.name.trim();
        if (hasData) {
          setShowConfirmClose(true);
        } else {
          onClose();
        }
      } else if (!isEditing && items.length > 0) {
        setShowConfirmClose(true);
      } else {
        onClose();
      }
    }
  };

  const handleClose = () => {
    if (mode === 'form' && formData.name.trim()) {
      setShowConfirmClose(true);
    } else if (mode === 'items' && !isEditing && items.length > 0) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  // Advance from form to items mode (for new lists)
  const handleNextToItems = () => {
    if (!formData.name.trim()) {
      setValidationError('List name is required');
      return;
    }
    setMode('items');
  };

  // Save the list (both create and edit-details)
  const handleSaveList = () => {
    const newList = {
      id: editList?.id || Date.now(),
      name: formData.name.trim(),
      emoji: formData.emoji,
      category: formData.category,
      assignedTo: formData.assignedTo,
      linkedTo: formData.linkedTo,
      items: items,
      status: editList?.status || 'active',
      createdBy: editList?.createdBy || currentUser,
      createdAt: editList?.createdAt || new Date().toISOString(),
    };
    onSave(newList);
  };

  // For editing existing lists — save details only, keep items as-is
  const handleSubmitFormEdit = () => {
    if (!formData.name.trim()) {
      setValidationError('List name is required');
      return;
    }
    const newList = {
      id: editList.id,
      name: formData.name.trim(),
      emoji: formData.emoji,
      category: formData.category,
      assignedTo: formData.assignedTo,
      linkedTo: formData.linkedTo,
      items: editList.items || [],
      status: editList.status || 'active',
      createdBy: editList.createdBy || currentUser,
      createdAt: editList.createdAt,
    };
    onSave(newList);
  };

  // Item management
  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem = {
      id: Date.now(),
      text: newItemText.trim(),
      checked: false,
      addedBy: currentUser,
      checkedBy: null,
      addedAt: new Date().toISOString(),
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewItemText('');
    if (isEditing) {
      onUpdateItems(editList.id, updatedItems);
    }
  };

  const handleToggleItem = (itemId) => {
    const updatedItems = items.map(item =>
      item.id === itemId
        ? { ...item, checked: !item.checked, checkedBy: !item.checked ? currentUser : null }
        : item
    );
    setItems(updatedItems);
    if (isEditing) {
      onUpdateItems(editList.id, updatedItems);
    }
  };

  const handleDeleteItem = (itemId) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    setItems(updatedItems);
    if (isEditing) {
      onUpdateItems(editList.id, updatedItems);
    }
  };

  // Section linking options
  const getSectionOptions = () => {
    const options = [];
    if (trips && trips.length > 0) {
      trips.forEach(trip => options.push({ label: trip.destination, value: trip.id, section: 'trips' }));
    }
    if (fitnessEvents && fitnessEvents.length > 0) {
      fitnessEvents.forEach(event => options.push({ label: event.name, value: event.id, section: 'fitnessEvents' }));
    }
    if (partyEvents && partyEvents.length > 0) {
      partyEvents.forEach(event => options.push({ label: event.name, value: event.id, section: 'partyEvents' }));
    }
    return options;
  };

  const sectionOptions = getSectionOptions();
  const checkedCount = items.filter(item => item.checked).length;
  const totalCount = items.length;
  const uncheckedItems = items.filter(item => !item.checked);
  const checkedItems = items.filter(item => item.checked);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackgroundClick}
    >
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-lg mx-auto w-full max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

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
                  onClick={() => { onClose(); }}
                  className="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== FORM MODE ===== */}
        {mode === 'form' && (
          <>
            <div className="p-6 border-b border-slate-700">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-teal-400" />
                  {isEditing ? 'Edit List' : 'Create List'}
                </h3>
                <button onClick={handleClose} className="p-2 hover:bg-slate-700 rounded-full transition text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* List Name */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">List Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Beach Trip Packing, Weekly Groceries..."
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
                />
                {validationError && <p className="text-red-400 text-sm mt-1">{validationError}</p>}
              </div>

              {/* Emoji */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Emoji</label>
                <input
                  type="text"
                  placeholder="Pick an emoji"
                  value={formData.emoji}
                  onChange={(e) => updateField('emoji', e.target.value.slice(0, 2))}
                  maxLength={2}
                  className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition text-center text-lg"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['📝', '🛒', '🥛', '🧳', '✅', '🎯', '🏠', '🎁', '🍝', '✈️', '🎉', '💡', '🏋️', '📦', '🧹', '📚', '💊', '🐾', '👶', '🎂', '🍷', '🎮', '🎬', '🌮'].map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => updateField('emoji', e)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${formData.emoji === e ? 'bg-teal-500/30 ring-2 ring-teal-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {listCategories.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => handleCategoryChange(cat.value)}
                      className={`px-4 py-2 rounded-xl font-medium transition text-sm ${
                        formData.category === cat.value
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white'
                          : 'bg-slate-700 text-white/60 hover:text-white'
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> Assigned To *
                </label>
                <div className="flex gap-2">
                  {['Mike', 'Liam', 'Both'].map(person => (
                    <button
                      key={person}
                      onClick={() => updateField('assignedTo', person)}
                      className={`flex-1 px-4 py-2 rounded-xl font-medium transition ${
                        formData.assignedTo === person
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white'
                          : 'bg-slate-700 text-white/60 hover:text-white'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link to Section */}
              {sectionOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                    <Link className="w-4 h-4" /> Link to Section
                  </label>
                  <select
                    value={formData.linkedTo?.itemId || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = sectionOptions.find(opt => String(opt.value) === e.target.value);
                        if (selected) updateField('linkedTo', { section: selected.section, itemId: selected.value });
                      } else {
                        updateField('linkedTo', null);
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
                  >
                    <option value="">None</option>
                    {sectionOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700 bg-slate-900/50 space-y-3 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              {isEditing && (
                <button
                  onClick={() => setMode('items')}
                  className="w-full py-2 bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-600 transition"
                >
                  Edit Items
                </button>
              )}
              <button
                onClick={isEditing ? handleSubmitFormEdit : handleNextToItems}
                className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {isEditing ? (
                  <><Check className="w-5 h-5" /> Save Changes</>
                ) : (
                  <><Plus className="w-5 h-5" /> Next: Add Items</>
                )}
              </button>
            </div>
          </>
        )}

        {/* ===== ITEMS MODE ===== */}
        {mode === 'items' && (
          <>
            <div className="p-6 border-b border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-4xl">{isEditing ? editList.emoji : formData.emoji}</span>
                  {isEditing ? editList.name : formData.name}
                </h3>
                <button onClick={handleClose} className="p-2 hover:bg-slate-700 rounded-full transition text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-white/50">
                {checkedCount} of {totalCount} items
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Add item input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                  className="flex-1 px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-teal-400 focus:outline-none transition"
                  autoFocus={!isEditing}
                />
                <button
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Items list */}
              <div className="space-y-2">
                {uncheckedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition">
                    <button
                      onClick={() => handleToggleItem(item.id)}
                      className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-500 hover:border-teal-400 transition flex items-center justify-center"
                    >
                      <div className="w-4 h-4 rounded-full" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{item.text}</p>
                      <p className="text-xs text-white/40 mt-1">Added by {item.addedBy}</p>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="flex-shrink-0 p-2 hover:bg-slate-600 rounded-lg transition text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {checkedItems.length > 0 && (
                  <div className="pt-2 border-t border-slate-700">
                    {checkedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition opacity-50">
                        <button
                          onClick={() => handleToggleItem(item.id)}
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center justify-center transition"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-sm line-through">{item.text}</p>
                          <p className="text-xs text-white/30 mt-1">Checked by {item.checkedBy}</p>
                        </div>
                        <button onClick={() => handleDeleteItem(item.id)} className="flex-shrink-0 p-2 hover:bg-slate-600 rounded-lg transition text-red-400/50 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {totalCount === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-white/40 text-sm">No items yet. Add some to get started!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-700 bg-slate-900/50 space-y-3 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              {!isEditing && (
                <>
                  <button
                    onClick={() => setMode('form')}
                    className="w-full py-2 bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-600 transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Details
                  </button>
                  <button
                    onClick={handleSaveList}
                    className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Check className="w-5 h-5" />
                    Save List{totalCount > 0 ? ` (${totalCount} items)` : ''}
                  </button>
                </>
              )}
              {isEditing && (
                <button
                  onClick={() => setMode('form')}
                  className="w-full py-3 bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-600 transition"
                >
                  Edit List Details
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

SharedListModal.displayName = 'SharedListModal';

export default SharedListModal;
