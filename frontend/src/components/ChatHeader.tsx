import { useEffect, useState, useRef } from "react";
import {
  Menu,
  X,
  ChevronDown,
  Lock,
  Check,
  Headphones,
  Play,
} from "lucide-react";
import { Document } from "../types/chat";

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onClose: () => void;
  selectedDocument: Document | null;
  availableDocuments: Document[];
  onSelectDocument: (doc: Document | null) => void;
  isDocumentLocked: boolean;
  isChatActive: boolean;
  onGeneratePodcast?: (doc: Document) => void;
  onOpenPodcast?: (doc: Document) => void;
  isGeneratingPodcast?: boolean;
  cachedPodcastUrl?: string | null;
}

export function ChatHeader({
  onToggleSidebar,
  onClose,
  selectedDocument,
  availableDocuments,
  onSelectDocument,
  isDocumentLocked,
  isChatActive,
  onGeneratePodcast,
  onOpenPodcast,
  isGeneratingPodcast,
  cachedPodcastUrl,
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
    <div className="flex items-center px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-20 gap-2 sm:gap-3">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Document Selector + Podcast button */}
        <div className="relative flex-1 max-w-[62vw] sm:max-w-lg flex items-center gap-2" ref={dropdownRef}>
          <button
            onClick={() =>
              !isDocumentLocked &&
              isChatActive &&
              setIsDropdownOpen(!isDropdownOpen)
            }
            disabled={isDocumentLocked || !isChatActive}
            className={`w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-left transition-all ${
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
                  {/* FIX: Removed 'truncate', added 'break-words whitespace-normal' to allow text wrapping */}
                  <span className="font-semibold text-[13px] sm:text-sm break-words whitespace-normal">
                    {selectedDocument.name}
                  </span>
                </>
              ) : (
                <>
                  {isChatActive ? (
                    <>
                      {/* FIX: Removed 'truncate', added 'break-words whitespace-normal' */}
                      <span
                        className={`font-semibold text-[13px] sm:text-sm break-words whitespace-normal ${
                          isDocumentLocked ? "text-slate-500 dark:text-slate-400" : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        AI Knowledge Base
                      </span>
                    </>
                  ) : (
                    <>
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1 flex-shrink-0" />
                       <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Ready to chat</span>
                    </>
                  )}
                </>
              )}
            </div>

            {isDocumentLocked ? (
              <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
            ) : (
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {/* Podcast generator: disabled in RAG mode; one-click for selected doc */}
          <div className="relative flex-shrink-0 group">
            <button
              type="button"
              onClick={() => {
                if (!selectedDocument) return;
                if (isGeneratingPodcast) return;
                // If a cached URL exists, open instantly; otherwise generate.
                if (cachedPodcastUrl && onOpenPodcast) {
                  onOpenPodcast(selectedDocument);
                  return;
                }
                if (!onGeneratePodcast) return;
                onGeneratePodcast(selectedDocument);
              }}
              disabled={
                !selectedDocument ||
                !!isGeneratingPodcast ||
                (!cachedPodcastUrl && !onGeneratePodcast) ||
                (!!cachedPodcastUrl && !onOpenPodcast)
              }
              className={`h-[40px] w-[40px] sm:h-[46px] sm:w-[46px] inline-flex items-center justify-center rounded-xl border transition-colors ${
                !selectedDocument
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-300 cursor-not-allowed"
                  : (!cachedPodcastUrl && !onGeneratePodcast) || (cachedPodcastUrl && !onOpenPodcast)
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-400 cursor-not-allowed"
                  : isGeneratingPodcast
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-400 cursor-not-allowed"
                  : cachedPodcastUrl
                  ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-400"
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400"
              }`}
              aria-label={cachedPodcastUrl ? "Open saved podcast" : "Generate podcast"}
            >
              <Headphones className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Logo/indicator (no text) when cached */}
            {selectedDocument && !!cachedPodcastUrl && (
              <div
                className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-900 flex items-center justify-center shadow-sm"
                aria-hidden="true"
              >
                <Play className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </div>
            )}

            {/* Custom hover tooltip (replaces the default browser title tooltip) */}
            {/* NOTE: render *below* the button so it never goes off-screen at top */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 z-50">
              <div className="ml-auto mr-3 h-2 w-2 rotate-45 bg-white/95 dark:bg-slate-900/95 border-l border-t border-slate-200/70 dark:border-slate-700/70 -mb-1" />
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 shadow-xl w-[260px] sm:w-[320px]">
                <div className="text-xs font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-normal leading-snug">
                  {cachedPodcastUrl ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)] dark:shadow-[0_0_0_4px_rgba(16,185,129,0.10)]" />
                      <span>Podcast ready</span>
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-emerald-700 dark:text-emerald-300">Load conversation</span>
                    </>
                  ) : !selectedDocument ? (
                    <span className="text-slate-600 dark:text-slate-300">
                      Audio not available in AI mode.
                    </span>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.14)] dark:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]" />
                      <span>Generate podcast</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Helper text removed (rely on hover tooltip) */}

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 text-left"
              >
                <div className="w-5 flex justify-center flex-shrink-0">
                  {!selectedDocument && (
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  )}
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
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-left"
                >
                  <div className="w-5 flex justify-center flex-shrink-0">
                    {selectedDocument?.id === doc.id && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  {/* FIX: Removed 'truncate', added 'break-words whitespace-normal' to dropdown items */}
                  <span className="font-medium break-words whitespace-normal">{doc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-l border-slate-200 dark:border-slate-700 pl-3 sm:pl-3 ml-3 sm:ml-2">
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