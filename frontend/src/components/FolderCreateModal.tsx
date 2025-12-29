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
    <div className="fixed inset-0 w-screen h-screen bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-semibold">Create New Folder</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project Reports"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
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
