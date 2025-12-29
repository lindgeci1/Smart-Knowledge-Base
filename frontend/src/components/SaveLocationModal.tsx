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
}

export function SaveLocationModal({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  summaries = [],
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
      const newFolder = await createFolder(newFolderName, "");
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
    <div className="fixed inset-0 w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Save To Folder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {!showCreateNew ? (
            <>
              <div className="space-y-2 mb-4">
                {isLoading ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    Loading folders...
                  </div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No folders yet</p>
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
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border-2 ${
                            selectedFolderId === folder.folderId
                              ? "bg-blue-100 border-blue-500"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                          }`}
                        >
                          <button
                            onClick={() => toggleExpanded(folder.folderId)}
                            className="p-1 rounded-md hover:bg-gray-200 text-gray-600"
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
                              className="text-blue-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {folder.name}
                              </div>
                              {folder.description && (
                                <div className="text-xs text-gray-500 truncate">
                                  {folder.description}
                                </div>
                              )}
                            </div>
                            <div className="text-xs bg-gray-200 px-2 py-1 rounded-md flex-shrink-0">
                              {folder.itemCount ?? itemsInFolder.length}
                            </div>
                          </div>
                        </div>
                        {isExpanded && itemsInFolder.length > 0 && (
                          <div className="ml-8 mb-2 space-y-1">
                            {itemsInFolder.slice(0, 5).map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                              >
                                <span className="h-5 w-5 flex items-center justify-center rounded-md bg-gray-100 text-gray-600">
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
                              <div className="text-[11px] text-gray-500 px-3">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
              >
                <FolderPlus size={18} />
                Create New Folder
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
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
        )}
      </div>
    </div>
  );
}
