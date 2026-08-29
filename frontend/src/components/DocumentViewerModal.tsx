import React, { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, Loader2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { fetchWithRetry, getApiUrl } from '@/lib/apiClient';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isImageType, setIsImageType] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Keep ref of active blob URL to revoke cleanly
  const currentBlobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Compute primary target URL
  const targetUrl = documentId ? `/api/documents/${documentId}/view` : url || '';

  useEffect(() => {
    // Abort any prior in-flight fetch
    if (abortControllerRef.current) {
      console.warn('[KYCPreview] Aborting prior in-flight request');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!isOpen || !targetUrl) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function loadDocument() {
      setLoading(true);
      setError(null);

      console.log(`[KYCPreview] Request start - documentId: ${documentId || 'none'}, fileName: ${fileName}, targetUrl: ${targetUrl}`);

      try {
        // Use shared fetchWithRetry which automatically attaches in-memory access token,
        // credentials: 'include', and coordinates single-flight 401 refresh + retry
        const res = await fetchWithRetry(targetUrl, {
          method: 'GET',
          signal: abortController.signal,
          skipErrorToast: true,
        });

        console.log(`[KYCPreview] HTTP status: ${res.status} ${res.statusText}`);

        if (!res.ok) {
          // If direct url fallback exists and differs, try it
          if (url && url !== targetUrl) {
            console.log(`[KYCPreview] Trying fallback URL: ${url}`);
            const fallbackRes = await fetchWithRetry(url, { signal: abortController.signal, skipErrorToast: true });
            if (fallbackRes.ok) {
              const fallbackBlob = await fallbackRes.blob();
              const newBlobUrl = URL.createObjectURL(fallbackBlob);
              if (currentBlobUrlRef.current) {
                console.log(`[KYCPreview] Revoking previous blob: ${currentBlobUrlRef.current}`);
                URL.revokeObjectURL(currentBlobUrlRef.current);
              }
              currentBlobUrlRef.current = newBlobUrl;
              setBlobUrl(newBlobUrl);
              setIsImageType(fallbackBlob.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName));
              setLoading(false);
              return;
            }
          }
          throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        const blob = await res.blob();
        console.log(`[KYCPreview] Blob received - size: ${blob.size} bytes, content-type: ${contentType || blob.type}`);

        if (blob.size === 0) {
          throw new Error('Received empty document stream (0 bytes)');
        }

        // Create new blob object URL
        const newBlobUrl = URL.createObjectURL(blob);
        console.log(`[KYCPreview] Created new blob URL: ${newBlobUrl}`);

        // Revoke previous blob only after new one is ready
        if (currentBlobUrlRef.current) {
          console.log(`[KYCPreview] Revoking previous blob: ${currentBlobUrlRef.current}`);
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }
        currentBlobUrlRef.current = newBlobUrl;

        const isImg =
          contentType.startsWith('image/') ||
          blob.type.startsWith('image/') ||
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName || targetUrl);

        setBlobUrl(newBlobUrl);
        setIsImageType(isImg);
        setLoading(false);
        console.log(`[KYCPreview] Final preview src assigned: ${newBlobUrl} (isImage: ${isImg})`);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[KYCPreview] Fetch aborted by subsequent request or close');
          return;
        }
        console.error('[KYCPreview] Document fetch error:', err);
        // Explicitly clear blobUrl and do NOT fallback to raw cross-origin URL
        setBlobUrl(null);
        setError(err.message || 'Failed to load document preview');
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, targetUrl, documentId, url, fileName, retryKey]);

  // Clean up blob URL on modal unmount or close
  useEffect(() => {
    if (!isOpen && currentBlobUrlRef.current) {
      console.log(`[KYCPreview] Modal closed. Revoking active blob: ${currentBlobUrlRef.current}`);
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
      setBlobUrl(null);
    }
  }, [isOpen]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
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
            {blobUrl && (
              <a
                href={blobUrl}
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
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/80 text-gray-300 hover:text-white transition-colors cursor-pointer"
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
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Preview
              </button>
            </div>
          ) : !blobUrl ? (
            <div className="text-xs text-gray-500">No document preview loaded.</div>
          ) : isImageType ? (
            <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
              <img
                src={blobUrl}
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
              src={blobUrl}
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
