import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

type ToastListener = (toast: ToastMessage) => void;
const listeners: Set<ToastListener> = new Set();

export const toast = {
  success: (message: string) => {
    const t: ToastMessage = { id: `toast-${Date.now()}`, type: 'success', message };
    listeners.forEach((l) => l(t));
  },
  error: (message: string) => {
    const t: ToastMessage = { id: `toast-${Date.now()}`, type: 'error', message };
    listeners.forEach((l) => l(t));
  },
  info: (message: string) => {
    const t: ToastMessage = { id: `toast-${Date.now()}`, type: 'info', message };
    listeners.forEach((l) => l(t));
  },
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleAdd = (t: ToastMessage) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== t.id));
      }, 4000);
    };

    listeners.add(handleAdd);
    return () => {
      listeners.delete(handleAdd);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-xl border text-xs font-semibold transition-all transform animate-in slide-in-from-bottom-2 ${
            t.type === 'success'
              ? 'bg-emerald-900 border-emerald-700 text-emerald-100'
              : t.type === 'error'
              ? 'bg-red-900 border-red-700 text-red-100'
              : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {t.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="p-1 hover:opacity-75 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
