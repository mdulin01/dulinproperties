import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { documentTypes } from '../../constants';

const AddDocumentModal = React.memo(({
  document,
  properties,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    title: '',
    type: 'other',
    propertyId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    tags: '',
    notes: '',
    fileName: '',
    fileUrl: '',
  });

  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);

  // Load existing document data if editing
  useEffect(() => {
    if (document && typeof document === 'object' && document.id) {
      setFormData({
        title: document.title || '',
        type: document.type || 'other',
        propertyId: document.propertyId || '',
        date: document.date || new Date().toISOString().split('T')[0],
        amount: document.amount ? String(document.amount) : '',
        tags: document.tags ? document.tags.join(', ') : '',
        notes: document.notes || '',
        fileName: document.fileName || '',
        fileUrl: document.fileUrl || '',
      });
    } else {
      // Reset for create mode
      setFormData({
        title: '',
        type: 'other',
        propertyId: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        tags: '',
        notes: '',
        fileName: '',
        fileUrl: '',
      });
    }
    setFileError('');
    setPendingFile(null);
  }, [document]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const [pendingFile, setPendingFile] = useState(null);

  const handleFileSelect = (file) => {
    setFileError('');

    // Validate file size (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError('File size exceeds 10 MB limit');
      return;
    }

    // Store the raw File object for Firebase Storage upload
    setPendingFile(file);
    setFormData(prev => ({
      ...prev,
      fileName: file.name,
      fileUrl: '', // Will be set after upload by parent
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      setFileError('Title is required');
      return;
    }

    const tagsArray = formData.tags
      ? formData.tags.split(',').map(t => t.trim()).filter(t => t)
      : [];

    const docData = {
      id: document?.id || `doc_${Date.now()}`,
      title: formData.title,
      type: formData.type,
      propertyId: formData.propertyId || null,
      date: formData.date,
      amount: formData.amount ? parseFloat(formData.amount) : null,
      tags: tagsArray,
      notes: formData.notes,
      fileName: formData.fileName,
      fileUrl: formData.fileUrl,
      createdAt: document?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(docData, pendingFile || null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/15 bg-slate-800/80">
          <h2 className="text-xl font-semibold text-white">
            {document?.id ? 'Edit Document' : 'Add Document'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Lease Agreement, Maintenance Receipt"
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>

          {/* Type and Property in a row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Document Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              >
                {documentTypes.map(dt => (
                  <option key={dt.value} value={dt.value}>
                    {dt.emoji} {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Property */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Associated Property
              </label>
              <select
                name="propertyId"
                value={formData.propertyId}
                onChange={handleInputChange}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              >
                <option value="">None</option>
                {properties?.map(prop => (
                  <option key={prop.id} value={prop.id}>
                    {prop.emoji || '🏠'} {prop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Amount in a row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Amount (Optional)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Tags (Comma-separated)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="e.g., urgent, reviewed, filed"
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>

          {/* File Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-white/40 bg-white/[0.08]'
                : 'border-white/15 hover:border-white/25'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/15 rounded-lg hover:bg-white/20 transition-colors text-white text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Choose File
            </button>
            <p className="text-sm text-slate-400 mt-3">
              or drag and drop your file here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Max file size: 10 MB
            </p>

            {/* File preview */}
            {formData.fileName && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg inline-block">
                <p className="text-sm text-white">
                  ✓ {formData.fileName}
                </p>
              </div>
            )}
          </div>

          {/* Error message */}
          {fileError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{fileError}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional details or comments..."
              rows={3}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t border-white/15 bg-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg text-white font-medium transition-colors"
          >
            {document?.id ? 'Update' : 'Save'} Document
          </button>
        </div>
      </div>
    </div>
  );
});

AddDocumentModal.displayName = 'AddDocumentModal';

export default AddDocumentModal;
