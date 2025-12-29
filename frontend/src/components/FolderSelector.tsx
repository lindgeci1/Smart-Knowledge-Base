import { ChevronDown, FolderOpen } from "lucide-react";
import { useFolders } from "../hooks/useFolders";

interface FolderSelectorProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  parentFolderId?: string;
}

export function FolderSelector({
  selectedFolderId,
  onSelectFolder,
  parentFolderId,
}: FolderSelectorProps) {
  const { folders, isLoading } = useFolders();

  // Get folders for the current parent
  const availableFolders = folders.filter(
    (f: any) =>
      f.parentFolderId === parentFolderId ||
      (!f.parentFolderId && !parentFolderId)
  );

  const selectedFolder = folders.find(
    (f: any) => f.folderId === selectedFolderId
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Select Folder (Optional)
      </label>
      <div className="relative">
        <button className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-gray-500" />
            <span className="text-gray-700">
              {selectedFolder ? selectedFolder.name : "Select a folder..."}
            </span>
          </div>
          <ChevronDown size={18} className="text-gray-400" />
        </button>

        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
              selectedFolderId === null ? "bg-blue-50 text-blue-600" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderOpen size={16} />
              Root (No Folder)
            </div>
          </button>

          {isLoading ? (
            <div className="px-4 py-2 text-gray-500 text-sm">
              Loading folders...
            </div>
          ) : availableFolders.length === 0 ? (
            <div className="px-4 py-2 text-gray-500 text-sm">
              No folders available
            </div>
          ) : (
            availableFolders.map((folder: any) => (
              <button
                key={folder.folderId}
                onClick={() => onSelectFolder(folder.folderId)}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${
                  selectedFolderId === folder.folderId
                    ? "bg-blue-50 text-blue-600"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} />
                  <div>
                    <div className="font-medium">{folder.name}</div>
                  </div>
                </div>
                <div className="text-xs bg-gray-200 px-2 py-1 rounded">
                  {folder.itemCount} items
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
