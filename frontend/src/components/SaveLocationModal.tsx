import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Button } from "./ui/Button";
import { useFolders } from "../hooks/useFolders";

interface ModalSummary {
  id: string;
  type: "text" | "file";
  content?: string;
  filename?: string;
  textName?: string;
  folderId?: string;
  createdAt?: string;
}

interface SaveLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderId: string, folderName: string) => void;
  isSaving?: boolean;
  summaries?: ModalSummary[];
  helperMessage?: string | null;
  onSkipToMySummaries?: () => void;
}

export function SaveLocationModal({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  summaries = [],
  helperMessage = null,
  onSkipToMySummaries,
}: SaveLocationModalProps) {
  const { folders, createFolder, fetchFolders, isLoading } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(null);
      setShowCreateNew(false);
      setNewFolderName("");

      // Refresh folders when opening to ensure latest list
      fetchFolders();
    }
  }, [isOpen, fetchFolders]);

  const handleCreateNewFolder = async () => {
    if (!newFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    setIsCreatingFolder(true);
    try {
      const newFolder = await createFolder(newFolderName);
      setSelectedFolderId(newFolder.folderId);
      setNewFolderName("");
      setShowCreateNew(false);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedFolderId) {
      alert("Please select a folder");
      return;
    }

    const selectedFolder = folders.find(
      (f: any) => f.folderId === selectedFolderId
    );
    if (selectedFolder) {
      onSave(selectedFolderId, selectedFolder.name);
    }
  }, [selectedFolderId, folders, onSave]);

  const selectedFolderObj = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find((f: any) => f.folderId === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Memoize folder items count to avoid recalculating on every render
  const folderItemsMap = useMemo(() => {
    const map = new Map<string, number>();
    (summaries || []).forEach((s) => {
      if (s.folderId) {
        map.set(s.folderId, (map.get(s.folderId) || 0) + 1);
      }
    });
    return map;
  }, [summaries]);

  // Memoize items in folder to avoid filtering on every render
  const getItemsInFolder = useCallback(
    (folderId: string) => {
      return (summaries || []).filter((s) => s.folderId === folderId);
    },
    [summaries]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100]" style={{ margin: 0, padding: 0, width: '100vw', height: '100vh' }}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full m-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Save To Folder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {/* Helper Message */}
          {helperMessage ? (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your{" "}
                <span className="font-medium italic">"{helperMessage}"</span>{" "}
                has been generated!
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                Do you want to save it in one of your folders or send it to My
                Summaries?
              </p>
            </div>
          ) : (
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Select a folder below to save your item. You can also create a
                new folder.
              </p>
            </div>
          )}

          {!showCreateNew ? (
            <>
              <div className="space-y-1.5 mb-3">
                {isLoading ? (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">
                    Loading folders...
                  </div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder
                      size={32}
                      className="mx-auto text-gray-400 dark:text-slate-500 mb-2"
                    />
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      No folders yet
                    </p>
                  </div>
                ) : (
                  folders.map((folder: any) => {
                    const itemsInFolder = getItemsInFolder(folder.folderId);
                    const isExpanded = !!expandedFolders[folder.folderId];
                    const isSelected = selectedFolderId === folder.folderId;
                    return (
                      <div key={folder.folderId} className="space-y-1">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-slate-200 dark:bg-slate-600 border border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100"
                              : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 border border-transparent"
                          }`}
                          onClick={() => {
                            setSelectedFolderId(folder.folderId);
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(folder.folderId);
                            }}
                            className="p-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 flex-shrink-0"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Folder
                              size={16}
                              className="text-slate-800 dark:text-slate-200 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate text-gray-900 dark:text-slate-100">
                                {folder.name}
                              </div>
                            </div>
                            <div className="text-xs bg-slate-200 dark:bg-slate-600 dark:text-slate-200 px-2 py-0.5 rounded-md flex-shrink-0">
                              {folder.itemCount ??
                                folderItemsMap.get(folder.folderId) ??
                                0}
                            </div>
                          </div>
                        </div>
                        {isExpanded && itemsInFolder.length > 0 && (
                          <div className="ml-8 mb-2 space-y-1">
                            {itemsInFolder.slice(0, 5).map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-1.5"
                              >
                                <span className="h-5 w-5 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300">
                                  {it.type === "file" ? (
                                    <FileText size={12} />
                                  ) : (
                                    <MessageSquare size={12} />
                                  )}
                                </span>
                                <span className="whitespace-normal break-words text-left leading-tight">
                                  {it.type === "file"
                                    ? it.filename || it.content || "file"
                                    : it.textName || "text summary"}
                                </span>
                              </div>
                            ))}
                            {itemsInFolder.length > 5 && (
                              <div className="text-[11px] text-gray-500 dark:text-slate-400 px-3">
                                +{itemsInFolder.length - 5} more…
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => setShowCreateNew(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <FolderPlus size={18} />
                Create New Folder
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Q4 Reports"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-200"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateNew(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-60"
                  disabled={isCreatingFolder}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewFolder}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-200 dark:text-slate-900 border border-transparent rounded-lg hover:bg-slate-800 dark:hover:bg-white transition disabled:opacity-60"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                >
                  {isCreatingFolder ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>

        {!showCreateNew && (
          <div className="px-5 pb-5 pt-4 bg-slate-50 dark:bg-slate-800 rounded-b-xl space-y-2.5">
            {/* Skip to My Summaries button - only show when onSkipToMySummaries is provided */}
            {onSkipToMySummaries && (
              <button
                onClick={onSkipToMySummaries}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                disabled={isSaving}
              >
                Skip to My Summaries
              </button>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-60"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-200 dark:text-slate-900 border border-transparent rounded-lg hover:bg-slate-800 dark:hover:bg-white transition disabled:opacity-60"
                disabled={isSaving || !selectedFolderId}
              >
                {isSaving
                  ? "Saving..."
                  : selectedFolderObj?.name
                  ? `Save in ${selectedFolderObj.name}`
                  : "Save Here"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
