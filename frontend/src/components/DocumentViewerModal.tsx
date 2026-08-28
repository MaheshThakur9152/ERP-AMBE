import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, AlertCircle, FileText, Download } from 'lucide-react';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  url?: string;
  fileName?: string;
  title?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentId,
  url,
  fileName = 'Document',
  title,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveUrl = documentId ? `/api/documents/${documentId}/view` : url || '';
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName || effectiveUrl);
  const isPdf = /\.pdf$/i.test(fileName || effectiveUrl) || !isImage;

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
    }
  }, [isOpen, effectiveUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white select-none">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            <FileText className="w-5 h-5 text-teal-400 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-bold truncate leading-tight">
                {title || fileName}
              </h3>
              {fileName && title && (
                <span className="text-[11px] text-gray-300 font-mono truncate">
                  {fileName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {effectiveUrl && (
              <a
                href={effectiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 flex items-center gap-1.5 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/80 text-gray-300 hover:text-white transition-colors"
              title="Close viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative flex-1 bg-slate-100 flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 z-10 gap-2">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
              <span className="text-xs font-semibold text-gray-600">Loading document preview...</span>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load preview</p>
              <p className="text-xs text-gray-500 mb-4">{error}</p>
              {effectiveUrl && (
                <a
                  href={effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Try Direct Link
                </a>
              )}
            </div>
          ) : !effectiveUrl ? (
            <div className="text-xs text-gray-500">No document URL available.</div>
          ) : isImage ? (
            <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
              <img
                src={effectiveUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded shadow-md"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Failed to load image preview');
                }}
              />
            </div>
          ) : (
            <iframe
              src={effectiveUrl}
              title={fileName}
              className="w-full h-full border-0"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to render PDF preview in browser');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
