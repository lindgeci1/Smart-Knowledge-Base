import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../lib/authClient";
import toast from "react-hot-toast";

export interface Folder {
  id: string;
  folderId: string;
  name: string;
  parentFolderId?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all folders
  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/Folder");
      const mapped = (response.data || []).map((f: any) => ({
        ...f,
        // Normalize id -> folderId because backend may return either
        folderId: f.folderId ?? f.id,
      }));
      setFolders(mapped);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to fetch folders";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create folder
  const createFolder = useCallback(
    async (name: string, parentFolderId?: string) => {
      try {
        const response = await apiClient.post("/Folder", {
          name,
          parentFolderId,
        });
        setFolders((prev) => [...prev, response.data]);
        return response.data;
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.message || 
          (typeof err.response?.data === 'string' ? err.response.data : null) ||
          "Failed to create folder";
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      }
    },
    []
  );

  // Update folder
  const updateFolder = useCallback(async (folderId: string, name?: string) => {
    try {
      const response = await apiClient.put(`/Folder/${folderId}`, {
        name,
      });
      setFolders((prev) =>
        prev.map((f) => (f.folderId === folderId ? response.data : f))
      );
      toast.success("Folder updated successfully");
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to update folder";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  // Delete folder
  const deleteFolder = useCallback(async (folderId: string) => {
    try {
      await apiClient.delete(`/Folder/${folderId}`);
      setFolders((prev) => prev.filter((f) => f.folderId !== folderId));
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to delete folder";
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  // Load folders on mount
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return {
    folders,
    isLoading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
