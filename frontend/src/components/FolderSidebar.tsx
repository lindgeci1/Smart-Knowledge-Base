import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Folder,
  RefreshCw,
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
  onPreviewSummary?: (summary: any) => void;
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
  const [dragOverFolder, setDragOverFolder] = useState<string | "root" | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [draggingSummaryId, setDraggingSummaryId] = useState<string | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh folders when signal changes
  useEffect(() => {
    if (refreshKey !== undefined) {
      fetchFolders();
    }
  }, [refreshKey, fetchFolders]);

  // Prevent body scroll when create folder modal is open
  useEffect(() => {
    if (showCreateModal || folderToDelete) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCreateModal, folderToDelete]);

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

  const handleDragOver = (
    e: React.DragEvent,
    folderId: string | "root" | null
  ) => {
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

  useEffect(() => {
    const onWindowDragEnd = () => handleDragEnd();
    window.addEventListener("dragend", onWindowDragEnd);
    return () => window.removeEventListener("dragend", onWindowDragEnd);
  }, []);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-slate-900">Folders</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await fetchFolders();
                  if (onRefresh) onRefresh();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-60"
              disabled={isRefreshing}
              title="Refresh folders"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
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
            onDragOver={(e) => handleDragOver(e, "root")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition font-medium ${
              selectedFolder === null
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-slate-700 hover:bg-slate-50"
            } ${dragOverFolder === "root" ? "ring-2 ring-blue-400" : ""}`}
            onClick={() => {
              onSelectFolder(null);
              setIsCollapsed((prev) => !prev);
            }}
          >
            <Folder size={20} />
            <span className="flex-1">All Items</span>
            <span className="text-xs text-slate-500">
              {isCollapsed ? "Show" : "Hide"}
            </span>
          </div>

          {/* Folders List */}
          {!isCollapsed && (
            <>
              {folders.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">No folders yet</p>
                  <p className="text-xs text-slate-400 mt-1">
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
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "text-slate-700 hover:bg-slate-50"
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
                                className="p-0.5 hover:bg-slate-200 rounded"
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
                            </div>
                            <div className="text-xs font-semibold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md flex-shrink-0">
                              {folder.itemCount || 0}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToDelete(folder.folderId);
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-xl transition flex-shrink-0"
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
                                  onDragEnd={handleDragEnd}
                                  onClick={() =>
                                    onPreviewSummary &&
                                    onPreviewSummary(summary)
                                  }
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer transition"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
