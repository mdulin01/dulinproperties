import React from 'react';
import { X, Download, FileText, Image } from 'lucide-react';
import { documentTypes } from '../../constants';

const DocumentViewer = React.memo(({
  document,
  properties,
  onClose
}) => {
  if (!document) return null;

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
        month: 'long',
        day: 'numeric'
      })
    : 'No date';

  // Determine if file is image
  const isImage = document.fileUrl &&
    (document.fileUrl.includes('data:image') ||
     /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || ''));

  // Determine if file is PDF
  const isPdf = /\.pdf$/i.test(document.fileName || '');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/15 bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{emoji}</div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {document.title || typeLabel}
              </h2>
              <p className="text-sm text-slate-400">{typeLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Date</p>
              <p className="text-white font-medium">{formattedDate}</p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Type</p>
              <p className="text-white font-medium">{typeLabel}</p>
            </div>

            {property && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl col-span-2">
                <p className="text-xs text-slate-400 mb-1">Associated Property</p>
                <p className="text-white font-medium">{property.address}</p>
              </div>
            )}

            {document.amount && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Amount</p>
                <p className="text-white font-medium">
                  ${typeof document.amount === 'number'
                    ? document.amount.toFixed(2)
                    : document.amount}
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-white mb-3">Tags</p>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-sm bg-white/10 border border-white/15 rounded-full text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {document.notes && (
            <div>
              <p className="text-sm font-medium text-white mb-2">Notes</p>
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                  {document.notes}
                </p>
              </div>
            </div>
          )}

          {/* File Preview/Display */}
          {document.fileUrl && (
            <div>
              <p className="text-sm font-medium text-white mb-3">Document</p>

              {isImage ? (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <img
                    src={document.fileUrl}
                    alt={document.title}
                    className="w-full h-auto"
                  />
                </div>
              ) : isPdf ? (
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-2">
                    {document.fileName}
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    PDF documents cannot be previewed directly in the browser
                  </p>
                  <a
                    href={document.fileUrl}
                    download={document.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg text-white font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                </div>
              ) : (
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-2">
                    {document.fileName || 'File'}
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    Click below to download this file
                  </p>
                  <a
                    href={document.fileUrl}
                    download={document.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg text-white font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                </div>
              )}
            </div>
          )}

          {/* No file message */}
          {!document.fileUrl && (
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-center">
              <Image className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                No file attached to this document
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between p-6 border-t border-white/15 bg-slate-800/80">
          <p className="text-xs text-slate-500">
            Last updated: {document.updatedAt
              ? new Date(document.updatedAt).toLocaleDateString()
              : 'Unknown'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

DocumentViewer.displayName = 'DocumentViewer';

export default DocumentViewer;
