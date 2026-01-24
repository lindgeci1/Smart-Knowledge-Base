import React, { useState, useEffect } from 'react';
import { Share2, X, Mail } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  documentName?: string;
  isLoading?: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  onConfirm,
  documentName,
  isLoading = false
}: ShareModalProps) {
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (cleanEmail) {
      // FIX: robust check to prevent "is not a function" crash
      if (typeof onConfirm === 'function') {
        onConfirm(cleanEmail);
      } else {
        console.error("ShareModal Error: The 'onConfirm' prop was not passed from the parent component.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="
          relative 
          w-full max-w-[85%] sm:max-w-sm 
          bg-white dark:bg-slate-800 
          rounded-xl shadow-2xl 
          border border-slate-200 dark:border-slate-700 
          transform transition-all 
          animate-in zoom-in-95 duration-200
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
              <Share2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="space-y-1 w-full">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Share via Email
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-words">
                {documentName 
                  ? `Enter an email address to share "${documentName}"`
                  : "Enter an email address to share this chat"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!email.trim() || isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? "Sending..." : "Share"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}