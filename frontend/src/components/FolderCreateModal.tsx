import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderPlus, X } from 'lucide-react';
import { useFolders } from '../hooks/useFolders';

interface FolderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: Updated props to match what FolderSidebar passes (onFolderCreated)
  onFolderCreated?: (folder: { folderId: string; name: string }) => void;
  // Kept for backward compatibility if used elsewhere
  onCreate?: (name: string) => void;
  parentFolderName?: string;
}

export function FolderCreateModal({
  isOpen,
  onClose,
  onFolderCreated,
  onCreate,
  parentFolderName
}: FolderCreateModalProps) {
  // FIX: Use the hook to handle creation logic internally
  const { createFolder } = useFolders();
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    // Legacy path: if parent provides onCreate, use it
    if (onCreate) {
      onCreate(folderName.trim());
      onClose();
      return;
    }

    // FIX: New path using internal hook (matches FolderSidebar usage)
    setIsLoading(true);
    try {
      const newFolder = await createFolder(folderName.trim());
      if (newFolder && onFolderCreated) {
        onFolderCreated(newFolder);
      }
      onClose();
    } catch (error) {
      console.error("Failed to create folder", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // FIX: createPortal ensures the modal exists outside the Sidebar's transform context,
  // allowing the backdrop blur to cover the ENTIRE screen (all the way to the top).
  return createPortal(
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
              <FolderPlus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="space-y-1 w-full">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                New Folder
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {parentFolderName 
                  ? `Create a subfolder inside "${parentFolderName}"`
                  : "Create a new top-level folder"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                autoFocus
                disabled={isLoading}
              />
              
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!folderName.trim() || isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body // Portal target
  );
}