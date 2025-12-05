'use client';

import { useDialogStore } from '@/context/DialogStore';
import { useEffect, useState } from 'react';

export default function Dialog() {
  const { dialog, closeDialog, setLoading } = useDialogStore();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (dialog.isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [dialog.isOpen]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await dialog.onConfirm?.();
      closeDialog();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    dialog.onCancel?.();
    closeDialog();
  };

  if (!dialog.isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
          isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className={`px-6 py-4 border-b ${dialog.isDangerous ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700 bg-slate-800/50'}`}>
            <h2 className={`text-lg font-bold ${dialog.isDangerous ? 'text-red-400' : 'text-white'}`}>
              {dialog.title}
            </h2>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-300 text-sm leading-relaxed">{dialog.message}</p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-800/30 border-t border-slate-700 flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              disabled={dialog.isLoading}
              className="px-4 py-2 text-gray-300 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {dialog.cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={dialog.isLoading}
              className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                dialog.isDangerous
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/30'
                  : 'bg-lime-500 hover:bg-lime-600 text-black shadow-lg hover:shadow-lime-500/30'
              }`}
            >
              {dialog.isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{dialog.confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
