import React, { useEffect, useState, useRef } from 'react';
import { Menu, X, FileText, ChevronDown, Lock, Check } from 'lucide-react';
import { Document } from '../types/chat';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onClose: () => void;
  selectedDocument: Document | null;
  availableDocuments: Document[];
  onSelectDocument: (doc: Document | null) => void;
  isDocumentLocked: boolean;
  isChatActive: boolean;
}

export function ChatHeader({
  onToggleSidebar,
  onClose,
  selectedDocument,
  availableDocuments,
  onSelectDocument,
  isDocumentLocked,
  isChatActive
}: ChatHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (doc: Document | null) => {
    onSelectDocument(doc);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white z-20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Document Selector */}
        <div className="relative flex-1 max-w-md" ref={dropdownRef}>
          <button
            onClick={() => !isDocumentLocked && isChatActive && setIsDropdownOpen(!isDropdownOpen)}
            disabled={isDocumentLocked || !isChatActive}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-left transition-all text-sm ${
              isDocumentLocked
                ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                : !isChatActive
                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border-slate-300 hover:border-blue-400 text-slate-900 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {selectedDocument ? (
                <>
                  <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate font-medium">{selectedDocument.name}</span>
                </>
              ) : (
                <>
                  <span className="h-4 w-4 flex items-center justify-center text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  </span>
                  <span className="truncate text-slate-500">
                    {isChatActive ? 'Select a document...' : 'Start a chat first'}
                  </span>
                </>
              )}
            </div>

            {isDocumentLocked ? (
              <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {/* Helper Text */}
          <div className="mt-1 px-0 text-xs text-slate-400">
            <span className="block text-left">
              {isDocumentLocked
                ? 'Context locked to selected document'
                : !isChatActive
                ? 'Create a new chat to select context'
                : 'Select a document to give Summy context'}
            </span>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
              {availableDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-4 flex justify-center">
                    {selectedDocument?.id === doc.id && (
                      <Check className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{doc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        className="p-1.5 ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="Close chat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
