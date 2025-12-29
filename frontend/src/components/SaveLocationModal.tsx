import { useState, useEffect } from "react";
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

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleSave = () => {
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6">
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

        <div className="p-6">
          {/* Helper Message */}
          {helperMessage && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
          )}

          {!showCreateNew ? (
            <>
              <div className="space-y-2 mb-4">
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
                    const itemsInFolder = (summaries || []).filter(
                      (s) => s.folderId === folder.folderId
                    );
                    const isExpanded = !!expandedFolders[folder.folderId];
                    return (
                      <div key={folder.folderId} className="space-y-1">
                        <div
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                            selectedFolderId === folder.folderId
                              ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-500"
                              : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                          }`}
                        >
                          <button
                            onClick={() => toggleExpanded(folder.folderId)}
                            className="p-1 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </button>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(folder.folderId);
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <Folder
                              size={20}
                              className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate text-gray-900 dark:text-slate-100">
                                {folder.name}
                              </div>
                            </div>
                            <div className="text-xs bg-slate-200 dark:bg-slate-600 dark:text-slate-200 px-2 py-1 rounded-md flex-shrink-0">
                              {folder.itemCount ?? itemsInFolder.length}
                            </div>
                          </div>
                        </div>
                        {isExpanded && itemsInFolder.length > 0 && (
                          <div className="ml-8 mb-2 space-y-1">
                            {itemsInFolder.slice(0, 5).map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2"
                              >
                                <span className="h-5 w-5 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300">
                                  {it.type === "file" ? (
                                    <FileText size={12} />
                                  ) : (
                                    <MessageSquare size={12} />
                                  )}
                                </span>
                                <span className="truncate">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition"
              >
                <FolderPlus size={18} />
                Create New Folder
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Q4 Reports"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCreateNew(false)}
                  variant="secondary"
                  className="flex-1 rounded-xl"
                  disabled={isCreatingFolder}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNewFolder}
                  className="flex-1 rounded-xl"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                >
                  {isCreatingFolder ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {!showCreateNew && (
          <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-b-xl space-y-3">
            {/* Skip to My Summaries button - only show when onSkipToMySummaries is provided */}
            {onSkipToMySummaries && (
              <button
                onClick={onSkipToMySummaries}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                disabled={isSaving}
              >
                Skip to My Summaries
              </button>
            )}

            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="secondary"
                className="flex-1 rounded-xl"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 rounded-xl"
                disabled={isSaving || !selectedFolderId}
              >
                {isSaving ? "Saving..." : "Save Here"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
