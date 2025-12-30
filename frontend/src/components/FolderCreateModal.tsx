import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/Button";
import { useFolders } from "../hooks/useFolders";

interface FolderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated?: (folder?: { folderId: string; name: string }) => void;
}

export function FolderCreateModal({
  isOpen,
  onClose,
  onFolderCreated,
}: FolderCreateModalProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { createFolder } = useFolders();

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Folder name is required");
      return;
    }

    setIsLoading(true);
    try {
      const newFolder = await createFolder(name);
      setName("");
      // Use requestAnimationFrame for smoother UI updates
      requestAnimationFrame(() => {
        onFolderCreated?.(newFolder);
        onClose();
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create New Folder</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project Reports"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="flex-1"
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? "Creating..." : "Create Folder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
