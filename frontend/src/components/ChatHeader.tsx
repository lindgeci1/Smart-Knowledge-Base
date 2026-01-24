import React, { useEffect, useState, useRef } from "react";
import { Menu, X, FileText, ChevronDown, Lock, Check, Bot, Sparkles } from "lucide-react";
import { Document } from "../types/chat";

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
  isChatActive,
}: ChatHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (doc: Document | null) => {
    onSelectDocument(doc);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-20 gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Document Selector */}
        <div className="relative flex-1 max-w-lg" ref={dropdownRef}>
          <button
            onClick={() =>
              !isDocumentLocked &&
              isChatActive &&
              setIsDropdownOpen(!isDropdownOpen)
            }
            disabled={isDocumentLocked || !isChatActive}
            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
              isDocumentLocked
                ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed"
                : !isChatActive
                ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-900 dark:text-white shadow-sm hover:shadow"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {selectedDocument ? (
                <>
                  <div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded">
                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="font-semibold text-sm truncate">
                    {selectedDocument.name}
                  </span>
                </>
              ) : (
                <>
                  {isChatActive ? (
                    <>
                      <div className={`p-1 rounded ${isDocumentLocked ? "bg-slate-100 dark:bg-slate-700" : "bg-indigo-100 dark:bg-indigo-900/30"}`}>
                        <Sparkles className={`h-4 w-4 ${isDocumentLocked ? "text-slate-400" : "text-indigo-600 dark:text-indigo-400"}`} />
                      </div>
                      <span
                        className={`font-semibold text-sm truncate ${
                          isDocumentLocked ? "text-slate-500 dark:text-slate-400" : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        AI Knowledge Base (RAG)
                      </span>
                    </>
                  ) : (
                    <>
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                       <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ready to chat</span>
                    </>
                  )}
                </>
              )}
            </div>

            {isDocumentLocked ? (
              <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {/* Helper Text */}
          <div className="mt-1.5 px-1 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="truncate">
              {isDocumentLocked
                ? selectedDocument
                  ? "Locked to specific document context"
                  : "Locked to full knowledge base context"
                : !isChatActive
                ? "Start a new chat to begin"
                : selectedDocument
                ? "Focusing on this document"
                : "Searching all your documents"}
            </span>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 text-left"
              >
                <div className="w-5 flex justify-center">
                  {!selectedDocument && (
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                  <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                   <span className="text-slate-900 dark:text-white font-semibold block">Full Knowledge Base</span>
                   <span className="text-xs text-slate-500 dark:text-slate-400">Search across all documents</span>
                </div>
              </button>
              
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                Specific Documents
              </div>
              
              {availableDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                >
                  <div className="w-5 flex justify-center">
                    {selectedDocument?.id === doc.id && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <FileText className={`h-4 w-4 ${selectedDocument?.id === doc.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="truncate font-medium">{doc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-l border-slate-200 dark:border-slate-700 pl-3 ml-2">
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close chat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}