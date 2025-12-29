import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
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
  onSummaryMovedToFolder?: (summaryId: string, folderId: string) => void;
  newlyMovedToFolderIds?: Set<string>;
  expandFolderId?: string | null;
}

// Draggable Summary Item Component
function DraggableSummary({
  summary,
  onPreviewSummary,
  newlyMovedToFolderIds,
}: {
  summary: Summary;
  onPreviewSummary?: (summary: Summary) => void;
  newlyMovedToFolderIds?: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `summary-${summary.id}`,
      data: {
        type: "summary",
        summaryId: summary.id,
        summaryType: summary.type,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onPreviewSummary && onPreviewSummary(summary)}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg cursor-grab active:cursor-grabbing transition hover:bg-slate-100 ${
        isDragging ? "opacity-50" : ""
      } ${newlyMovedToFolderIds?.has(summary.id) ? "animate-pulse-soft" : ""}`}
    >
      {summary.type === "file" ? (
        <FileText size={14} className="text-purple-600" />
      ) : (
        <MessageSquare size={14} className="text-blue-600" />
      )}
      <span className="truncate flex-1">
        {summary.type === "file"
          ? summary.filename
          : summary.textName || "text summary"}
      </span>
    </div>
  );
}

interface Folder {
  folderId: string;
  name: string;
  itemCount: number;
}

// Droppable Folder Component
function DroppableFolder({
  folderId,
  folder,
  isExpanded,
  folderSummaries,
  selectedFolder,
  onSelectFolder,
  onToggleExpansion,
  onDeleteFolder,
  onPreviewSummary,
  newlyMovedToFolderIds,
}: {
  folderId: string;
  folder: Folder;
  isExpanded: boolean;
  folderSummaries: Summary[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onPreviewSummary?: (summary: Summary) => void;
  newlyMovedToFolderIds?: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folderId}`,
    data: {
      type: "folder",
      folderId: folderId,
    },
  });

  return (
    <div ref={setNodeRef}>
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-lg cursor-pointer transition group ${
          selectedFolder === folderId
            ? "bg-slate-100 text-slate-900 border border-slate-300"
            : "text-slate-900 hover:bg-slate-50 border border-transparent"
        } ${isOver ? "bg-slate-50" : ""}`}
        onClick={() => {
          if (selectedFolder !== folderId) {
            onSelectFolder(folderId);
          }
          onToggleExpansion(folderId);
        }}
      >
        <span className="p-0.5 rounded text-slate-600">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Folder size={16} className="flex-shrink-0 text-slate-800" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{folder.name}</div>
        </div>
        <div className="text-xs font-semibold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md flex-shrink-0">
          {folder.itemCount || 0}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFolder(folderId, folder.name);
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
            <DraggableSummary
              key={summary.id}
              summary={summary}
              onPreviewSummary={onPreviewSummary}
              newlyMovedToFolderIds={newlyMovedToFolderIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderSidebar({
  selectedFolder,
  onSelectFolder,
  onRefresh,
  summaries = [],
  onPreviewSummary,
  refreshKey,
  onSummaryMovedToFolder,
  newlyMovedToFolderIds = new Set(),
  expandFolderId = null,
}: FolderSidebarProps) {
  const { folders, deleteFolder, fetchFolders } = useFolders();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [folderToDeleteName, setFolderToDeleteName] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for better drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

  // Refresh folders when signal changes
  useEffect(() => {
    if (refreshKey !== undefined) {
      fetchFolders();
    }
  }, [refreshKey, fetchFolders]);

  // Auto-expand folder when expandFolderId prop changes
  useEffect(() => {
    if (expandFolderId) {
      setExpandedFolders((prev) => new Set([...prev, expandFolderId]));
      onSelectFolder(expandFolderId);
    }
  }, [expandFolderId, onSelectFolder]);

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
      const folderName =
        folderToDeleteName ||
        folders.find((f) => f.folderId === folderToDelete)?.name ||
        "folder";
      const movedCount = folderSummaries.length;

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

      const movedText =
        movedCount > 0
          ? ` and moved ${movedCount} ${
              movedCount === 1 ? "summary" : "summaries"
            } to My Summaries`
          : "";
      toast.success(`Deleted "${folderName}"${movedText}`);
    } catch (error) {
      toast.error("Failed to delete folder");
      console.error(error);
    } finally {
      setIsDeleting(false);
      setFolderToDelete(null);
      setFolderToDeleteName(null);
    }
  };

  const handleFolderCreated = (folder?: { folderId: string; name: string }) => {
    requestAnimationFrame(() => {
      fetchFolders();
      if (onRefresh) onRefresh();
      if (folder?.name) {
        toast.success(`Created folder "${folder.name}"`);
      }
    });
  };

  const toggleFolderExpansion = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderId)) {
        newExpanded.delete(folderId);
      } else {
        newExpanded.add(folderId);
      }
      return newExpanded;
    });
  }, []);

  // Memoize folder summaries map to avoid filtering on every render
  const folderSummariesMap = useMemo(() => {
    const map = new Map<string, Summary[]>();
    summaries.forEach((s) => {
      if (s.folderId) {
        if (!map.has(s.folderId)) {
          map.set(s.folderId, []);
        }
        const folderSummaries = map.get(s.folderId);
        if (folderSummaries) {
          folderSummaries.push(s);
        }
      }
    });
    return map;
  }, [summaries]);

  // Get summaries for a specific folder (memoized)
  const getFolderSummaries = useCallback(
    (folderId: string) => {
      return folderSummariesMap.get(folderId) || [];
    },
    [folderSummariesMap]
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active) {
      setActiveId(null);
      return;
    }

    const activeData = active.data.current as {
      type?: string;
      summaryId?: string;
      summaryType?: string;
    };
    const overData = over.data.current as { type?: string; folderId?: string };

    // Only handle summary to folder drops
    if (activeData?.type === "summary" && overData?.type === "folder") {
      const summaryId = activeData.summaryId;
      const summaryType = activeData.summaryType;
      const targetFolderId = overData.folderId;
      const movedSummary = summaries.find((s) => s.id === summaryId);
      const sourceFolderId = movedSummary?.folderId || null;
      const summaryLabel = movedSummary
        ? movedSummary.type === "file"
          ? movedSummary.filename || "file"
          : movedSummary.textName || "text summary"
        : "item";
      const sourceFolderName = sourceFolderId
        ? folders.find((f) => f.folderId === sourceFolderId)?.name || "folder"
        : "All Items";
      const targetFolderName = targetFolderId
        ? folders.find((f) => f.folderId === targetFolderId)?.name || "folder"
        : "All Items";

      try {
        const endpoint =
          summaryType === "text"
            ? `/Texts/${summaryId}`
            : `/Documents/${summaryId}`;
        await apiClient.patch(endpoint, {
          folderId: targetFolderId || "",
        });

        // Refresh summaries first so the moved summary appears in the folder
        if (onRefresh) {
          onRefresh();
        }
        await fetchFolders();

        // If moving to a folder (not root), auto-expand it and trigger glow
        if (targetFolderId && summaryId) {
          // Auto-expand the target folder
          setExpandedFolders((prev) => new Set([...prev, targetFolderId]));
          // Select the folder to show it
          onSelectFolder(targetFolderId);
          // Trigger glow effect callback after a small delay to ensure summary is in the list
          setTimeout(() => {
            if (onSummaryMovedToFolder && summaryId) {
              onSummaryMovedToFolder(summaryId, targetFolderId);
            }
          }, 100);
        }

        toast.success(
          `Moved "${summaryLabel}" from ${sourceFolderName} to ${targetFolderName}`
        );
      } catch (error) {
        toast.error("Failed to move item");
        console.error(error);
      }
    }

    setActiveId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Get the dragged summary for the overlay
  const draggedSummary = activeId
    ? summaries.find((s) => `summary-${s.id}` === activeId)
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 relative z-50">
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer ${
                selectedFolder === null
                  ? "bg-slate-100 text-slate-900 border border-slate-300"
                  : "text-slate-900 hover:bg-slate-50 border border-transparent"
              }`}
              onClick={() => {
                onSelectFolder(null);
                setIsCollapsed((prev) => !prev);
              }}
            >
              <Folder size={18} className="text-slate-700" />
              <span className="flex-1">All Items</span>
              <span className="text-xs text-slate-600">
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
                          <DroppableFolder
                            key={folder.folderId}
                            folderId={folder.folderId}
                            folder={folder}
                            isExpanded={isExpanded}
                            folderSummaries={folderSummaries}
                            selectedFolder={selectedFolder}
                            onSelectFolder={onSelectFolder}
                            onToggleExpansion={toggleFolderExpansion}
                            onDeleteFolder={(id, name) => {
                              setFolderToDelete(id);
                              setFolderToDeleteName(name);
                            }}
                            onPreviewSummary={onPreviewSummary}
                            newlyMovedToFolderIds={newlyMovedToFolderIds}
                          />
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Drag Overlay - Shows the item being dragged */}
        <DragOverlay>
          {draggedSummary ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white rounded-xl shadow-lg border border-slate-200 opacity-90">
              {draggedSummary.type === "file" ? (
                <FileText size={14} className="text-purple-600" />
              ) : (
                <MessageSquare size={14} className="text-blue-600" />
              )}
              <span className="truncate flex-1">
                {draggedSummary.type === "file"
                  ? draggedSummary.filename
                  : draggedSummary.textName || "text summary"}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
                Are you sure you want to delete
                {folderToDeleteName
                  ? ` "${folderToDeleteName}"`
                  : " this folder"}
                ? Items inside will be moved to All Items.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setFolderToDelete(null);
                  setFolderToDeleteName(null);
                }}
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
