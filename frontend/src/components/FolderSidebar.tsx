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
  Search,
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
import { SaveLocationModal } from "./SaveLocationModal";
import { apiClient } from "../lib/authClient";
import toast from "react-hot-toast";

interface Summary {
  id: string;
  type: "text" | "file";
  summary: string;
  filename?: string;
  textName?: string;
  folderId?: string;
  userId: string;
  userName: string;
  createdAt: string;
  content: string; // or optional if not always needed, but UserDashboard has it required
  documentName?: string;
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
  variant?: "default" | "admin";
  enableDragDrop?: boolean;
  enableSelectMove?: boolean;
}

function SummaryItem({
  summary,
  onPreviewSummary,
  newlyMovedToFolderIds,
  isSelectable,
  isSelected,
  onToggleSelect,
}: {
  summary: Summary;
  onPreviewSummary?: (summary: Summary) => void;
  newlyMovedToFolderIds?: Set<string>;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (summaryId: string) => void;
}) {
  const handleClick = () => {
    if (isSelectable && onToggleSelect) {
      onToggleSelect(summary.id);
      return;
    }
    if (onPreviewSummary) {
      onPreviewSummary(summary);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg transition hover:bg-slate-100 ${
        isSelectable ? "cursor-pointer" : "cursor-default"
      } ${
        newlyMovedToFolderIds?.has(summary.id) ? "animate-pulse-soft" : ""
      }`}
    >
      {isSelectable && (
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggleSelect && onToggleSelect(summary.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      )}
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
      className={`flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg cursor-grab active:cursor-grabbing transition hover:bg-slate-100 ${isDragging ? "opacity-50" : ""
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

function FolderItem({
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
  isSelectMode,
  selectedSummaryIds,
  onToggleSelectSummary,
}: {
  folderId: string;
  folder: Folder;
  isExpanded: boolean;
  folderSummaries: Summary[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string) => void;
  onToggleExpansion: (folderId: string) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onPreviewSummary?: (summary: Summary) => void;
  newlyMovedToFolderIds?: Set<string>;
  isSelectMode?: boolean;
  selectedSummaryIds?: Set<string>;
  onToggleSelectSummary?: (summaryId: string) => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-lg cursor-pointer transition group ${
          selectedFolder === folderId
            ? "bg-slate-100 text-slate-900 border border-slate-300"
            : "text-slate-900 hover:bg-slate-50 border border-transparent"
        }`}
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

      {isExpanded && folderSummaries.length > 0 && (
        <div className="ml-8 mt-2 space-y-1">
          {folderSummaries.map((summary) => (
            <SummaryItem
              key={summary.id}
              summary={summary}
              onPreviewSummary={onPreviewSummary}
              newlyMovedToFolderIds={newlyMovedToFolderIds}
              isSelectable={isSelectMode}
              isSelected={selectedSummaryIds?.has(summary.id)}
              onToggleSelect={onToggleSelectSummary}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  onToggleExpansion: (folderId: string) => void;
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
        className={`flex items-center gap-2 px-3 py-1 rounded-lg cursor-pointer transition group ${selectedFolder === folderId
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
  variant = "default",
  enableDragDrop = false,
  enableSelectMove = false,
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<Set<string>>(
    new Set()
  );
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isMovingToFolder, setIsMovingToFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
          ? ` and moved ${movedCount} ${movedCount === 1 ? "summary" : "summaries"
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

  // Effect to expand folders on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setExpandedFolders(new Set());
      return;
    }

    const query = searchQuery.toLowerCase();
    const newExpanded = new Set<string>();

    folders.forEach((folder) => {
      const folderSummaries = folderSummariesMap.get(folder.folderId) || [];
      const nameMatch = folder.name.toLowerCase().includes(query);
      const hasMatchingSummary = folderSummaries.some((s) => {
        const name = s.type === "file" ? s.filename : s.textName;
        return (
          name?.toLowerCase().includes(query)
        );
      });

      if (nameMatch || hasMatchingSummary) {
        newExpanded.add(folder.folderId);
      }
    });

    if (newExpanded.size > 0) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        newExpanded.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [searchQuery, folders, folderSummariesMap]);

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

      // Skip if moving to the same folder
      if (sourceFolderId === targetFolderId) {
        setActiveId(null);
        return;
      }

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

  const toggleSelectSummary = (summaryId: string) => {
    setSelectedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(summaryId)) {
        next.delete(summaryId);
      } else {
        next.add(summaryId);
      }
      return next;
    });
  };

  const moveSelectedToFolder = async (folderId: string, folderName: string) => {
    const selected = summaries.filter((s) => selectedSummaryIds.has(s.id));
    if (selected.length === 0) return;
    setIsMovingToFolder(true);
    try {
      let movedCount = 0;
      for (const summary of selected) {
        if (summary.folderId === folderId) {
          continue;
        }
        const endpoint =
          summary.type === "text"
            ? `/Texts/${summary.id}`
            : `/Documents/${summary.id}`;
        await apiClient.patch(endpoint, { folderId });
        movedCount += 1;
      }

      await fetchFolders();
      if (onRefresh) onRefresh();

      if (folderId) {
        setExpandedFolders((prev) => new Set([...prev, folderId]));
        onSelectFolder(folderId);
        selected.forEach((summary) => {
          if (onSummaryMovedToFolder) {
            onSummaryMovedToFolder(summary.id, folderId);
          }
        });
      }

      if (movedCount > 0) {
        const label = movedCount === 1 ? "summary" : "summaries";
        toast.success(`Moved ${movedCount} ${label} to "${folderName}"`);
      } else {
        toast.success("Nothing to move");
      }

      setShowMoveModal(false);
      setIsSelectMode(false);
      setSelectedSummaryIds(new Set());
    } catch (error) {
      toast.error("Failed to move summaries");
      console.error(error);
    } finally {
      setIsMovingToFolder(false);
    }
  };

  // Define styles based on variant
  const containerStyles =
    variant === "admin"
      ? "h-full bg-slate-50 p-4 sm:p-6 space-y-4 relative"
      : "bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 relative";

  const headerStyles =
    variant === "admin"
      ? "flex items-center justify-between mb-4 pb-4 border-b border-slate-200"
      : "flex items-center justify-between mb-6";

  const titleStyles =
    variant === "admin"
      ? "text-lg font-semibold text-slate-800"
      : "text-lg font-medium text-slate-900";

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter((folder) => {
      const nameMatch = folder.name.toLowerCase().includes(query);
      const summaries = folderSummariesMap.get(folder.folderId) || [];
      const contentMatch = summaries.some((s) => {
        const name = s.type === "file" ? s.filename : s.textName;
        return (
          name?.toLowerCase().includes(query)
        );
      });
      return nameMatch || contentMatch;
    });
  }, [folders, searchQuery, folderSummariesMap]);

  const getFilteredSummaries = (folderId: string) => {
    const all = folderSummariesMap.get(folderId) || [];
    if (!searchQuery.trim()) return all;
    const query = searchQuery.toLowerCase();
    return all.filter((s) => {
      const name = s.type === "file" ? s.filename : s.textName;
      return (
        name?.toLowerCase().includes(query)
      );
    });
  };

  const sidebarContent = (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <h3 className={titleStyles}>Folders</h3>
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
            disabled={folders.length >= 7}
            className={`p-2 rounded-xl transition ${
              folders.length >= 7
                ? "text-slate-400 cursor-not-allowed opacity-50"
                : "hover:bg-blue-100 text-blue-600"
            }`}
            title={
              folders.length >= 7
                ? "Maximum number of folders reached"
                : "Create new folder"
            }
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search folders and summaries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      {enableSelectMove && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setIsSelectMode((prev) => {
                const next = !prev;
                if (next) {
                  setExpandedFolders(new Set(folderSummariesMap.keys()));
                  setIsCollapsed(false);
                }
                return next;
              });
              setSelectedSummaryIds(new Set());
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isSelectMode
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
            }`}
          >
            {isSelectMode ? "Cancel" : "Select"}
          </button>
          {isSelectMode && (
            <>
              <button
                onClick={() => setShowMoveModal(true)}
                disabled={selectedSummaryIds.size === 0}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedSummaryIds.size === 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Move ({selectedSummaryIds.size})
              </button>
              {selectedSummaryIds.size > 0 && (
                <span className="text-xs text-blue-600 font-medium ml-1">
                  {selectedSummaryIds.size} selected
                </span>
              )}
            </>
          )}
        </div>
      )}

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
            setExpandedFolders(new Set());
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
            ) : filteredFolders.length === 0 && searchQuery.trim() ? (
              <div className="px-4 py-8 text-center">
                <div className="flex justify-center mb-2">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500">No summaries with this name</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFolders
                  .filter((folder) => folder && folder.folderId)
                  .map((folder) => {
                    const folderSummaries = getFilteredSummaries(folder.folderId);
                    const isExpanded = expandedFolders.has(folder.folderId);

                    if (!enableDragDrop) {
                      return (
                        <FolderItem
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
                          isSelectMode={enableSelectMove && isSelectMode}
                          selectedSummaryIds={selectedSummaryIds}
                          onToggleSelectSummary={toggleSelectSummary}
                        />
                      );
                    }

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
  );

  return (
    <>
      {/* Dark backdrop overlay when dragging */}
      {enableDragDrop && activeId && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-40" />
      )}
      {enableDragDrop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {sidebarContent}
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
      ) : (
        sidebarContent
      )}

      <FolderCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onFolderCreated={handleFolderCreated}
      />

      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={moveSelectedToFolder}
        isSaving={isMovingToFolder}
        summaries={summaries}
      />

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div
          className="fixed bg-black/60 dark:bg-black/80 z-[100] flex items-center justify-center p-4"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem'
          }}
        >
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Delete Folder</h3>
              <button
                onClick={() => setFolderToDelete(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-300">
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
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600"
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
