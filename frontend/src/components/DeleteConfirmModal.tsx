import React from 'react';
import { AlertTriangle, X } from 'lucide-react';


interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string; // Optional custom message for folder or chat
  confirmLabel?: string; // Optional label for the confirm button
  cancelLabel?: string; // Optional label for the cancel button
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel"
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-red-50 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {title ? `Delete ${title}?` : "Delete Conversation?"}
          </h3>
          <p className="text-sm text-slate-600 mb-5">
            {message
              ? message
              : title
                ? `Are you sure you want to delete "${title}"? This action cannot be undone.`
                : 'Are you sure you want to delete this conversation? This action cannot be undone.'}
          </p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
