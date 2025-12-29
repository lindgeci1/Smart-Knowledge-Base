import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Folder,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useFolders } from "../hooks/useFolders";
import { FolderCreateModal } from "./FolderCreateModal";
import { apiClient } from "../lib/authClient";
import toast from "react-hot-toast";

interface Summary {
  id: string;
  type: "text" | "file";
  summary: string;
  filename?: string;
  textName?: string;
  folderId?: string;
}

interface FolderSidebarProps {
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onRefresh?: () => void;
  summaries?: Summary[];
  onPreviewSummary?: (summary: Summary) => void;
  refreshKey?: number;
}

export function FolderSidebar({
  selectedFolder,
  onSelectFolder,
  onRefresh,
  summaries = [],
  onPreviewSummary,
  refreshKey,
}: FolderSidebarProps) {
  const { folders, deleteFolder, fetchFolders } = useFolders();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingSummaryId, setDraggingSummaryId] = useState<string | null>(
    null
  );

  // Refresh folders when signal changes
  useEffect(() => {
    if (refreshKey !== undefined) {
      fetchFolders();
    }
  }, [refreshKey, fetchFolders]);

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsDeleting(true);
    try {
      // Get all summaries in this folder
      const folderSummaries = summaries.filter(
        (s) => s.folderId === folderToDelete
      );

      // Move each summary to root (no folder)
      for (const summary of folderSummaries) {
        const endpoint =
          summary.type === "text"
            ? `/Texts/${summary.id}`
            : `/Documents/${summary.id}`;
        await apiClient.patch(endpoint, {
          folderId: "",
        });
      }

      // Now delete the folder
      await deleteFolder(folderToDelete);

      // If the deleted folder was selected, reset to All Items
      if (selectedFolder === folderToDelete) {
        onSelectFolder(null);
      }

      // Refetch folders to update counts
      await fetchFolders();

      // Refresh summaries to reflect folder changes
      if (onRefresh) onRefresh();

      toast.success("Folder deleted and summaries moved to My Summaries");
    } catch (error) {
      toast.error("Failed to delete folder");
      console.error(error);
    } finally {
      setIsDeleting(false);
      setFolderToDelete(null);
    }
  };

  const handleFolderCreated = () => {
    fetchFolders();
    if (onRefresh) onRefresh();
  };

  const toggleFolderExpansion = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Get summaries for a specific folder
  const getFolderSummaries = (folderId: string) => {
    return summaries.filter((s) => s.folderId === folderId);
  };

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, summary: Summary) => {
    e.dataTransfer.setData("summaryId", summary.id);
    e.dataTransfer.setData("summaryType", summary.type);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    setDraggingSummaryId(summary.id);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetFolderId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const summaryId = e.dataTransfer.getData("summaryId");
    const summaryType = e.dataTransfer.getData("summaryType");

    setDragOverFolder(null);

    if (!summaryId || !summaryType) return;

    try {
      const endpoint =
        summaryType === "text"
          ? `/Texts/${summaryId}`
          : `/Documents/${summaryId}`;
      await apiClient.patch(endpoint, {
        folderId: targetFolderId || "",
      });

      toast.success(`Moved to ${targetFolderId ? "folder" : "root"}`);

      if (onRefresh) onRefresh();
      await fetchFolders();
    } catch (error) {
      toast.error("Failed to move item");
      console.error(error);
    }
    setIsDragging(false);
    setDraggingSummaryId(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggingSummaryId(null);
    setDragOverFolder(null);
  };

  return (
    <>
      {isDragging && <div className="fixed inset-0 bg-black/30 z-40" />}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-4 relative z-50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-gray-900">Folders</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFolders()}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition"
              title="Refresh folders"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 hover:bg-blue-100 rounded-xl text-blue-600 transition"
              title="Create new folder"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {/* All Items - Root */}
          <div
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition font-medium ${
              selectedFolder === null
                ? "bg-blue-100 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            } ${dragOverFolder === null ? "ring-2 ring-blue-400" : ""}`}
            onClick={() => {
              onSelectFolder(null);
              setIsCollapsed((prev) => !prev);
            }}
          >
            <Folder size={20} />
            <span className="flex-1">All Items</span>
            <span className="text-xs text-gray-500">
              {isCollapsed ? "Show" : "Hide"}
            </span>
          </div>

          {/* Folders List */}
          {!isCollapsed && (
            <>
              {folders.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">No folders yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Create one to organize
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {folders
                    .filter((folder) => folder && folder.folderId)
                    .map((folder) => {
                      const folderSummaries = getFolderSummaries(
                        folder.folderId
                      );
                      const isExpanded = expandedFolders.has(folder.folderId);

                      return (
                        <div key={folder.folderId}>
                          <div
                            onDragOver={(e) =>
                              handleDragOver(e, folder.folderId)
                            }
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, folder.folderId)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition group ${
                              selectedFolder === folder.folderId
                                ? "bg-blue-50 text-blue-800 ring-2 ring-blue-500 border border-blue-200 shadow-sm"
                                : "text-gray-700 hover:bg-gray-100"
                            } ${
                              dragOverFolder === folder.folderId
                                ? "ring-2 ring-blue-400"
                                : ""
                            }`}
                            onMouseEnter={() => setHoverFolder(folder.folderId)}
                            onMouseLeave={() => setHoverFolder(null)}
                            onClick={() => onSelectFolder(folder.folderId)}
                          >
                            {folder.itemCount > 0 && (
                              <button
                                onClick={(e) =>
                                  toggleFolderExpansion(folder.folderId, e)
                                }
                                className="p-0.5 hover:bg-gray-200 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            )}
                            <Folder size={20} className="flex-shrink-0" />
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
                            <div className="text-xs font-semibold bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md flex-shrink-0">
                              {folder.itemCount || 0}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToDelete(folder.folderId);
                              }}
                              className="p-1.5 hover:bg-red-200 text-red-600 rounded-xl transition flex-shrink-0"
                              title="Delete folder"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          {/* Expanded summaries list */}
                          {isExpanded && folderSummaries.length > 0 && (
                            <div className="ml-8 mt-2 space-y-1">
                              {folderSummaries.map((summary) => (
                                <div
                                  key={summary.id}
                                  draggable
                                  onDragStart={(e) =>
                                    handleDragStart(e, summary)
                                  }
                                  onClick={() =>
                                    onPreviewSummary &&
                                    onPreviewSummary(summary)
                                  }
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl cursor-pointer transition"
                                >
                                  {summary.type === "file" ? (
                                    <FileText
                                      size={14}
                                      className="text-purple-600"
                                    />
                                  ) : (
                                    <MessageSquare
                                      size={14}
                                      className="text-blue-600"
                                    />
                                  )}
                                  <span className="truncate flex-1">
                                    {summary.type === "file"
                                      ? summary.filename
                                      : summary.textName || "text summary"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <FolderCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onFolderCreated={handleFolderCreated}
      />

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Folder</h3>
              <button
                onClick={() => setFolderToDelete(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this folder? Items inside will
                be moved to All Items.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolder}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
