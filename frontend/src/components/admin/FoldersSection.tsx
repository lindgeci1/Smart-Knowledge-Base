import React, { useState, useEffect } from "react";
import { Folder, Trash2, X, Search, RefreshCw, Download, FileSpreadsheet, FileText, Code } from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface FolderData {
  id: string;
  name: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FoldersSectionProps {
  folders: FolderData[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onFoldersFetched?: (folders: FolderData[]) => void;
}

export function FoldersSection({
  folders: initialFolders,
  loading: externalLoading = false,
  onDataLoaded,
  onFoldersFetched,
}: FoldersSectionProps) {
  const [folders, setFolders] = useState<FolderData[]>(initialFolders || []);
  const [filteredFolders, setFilteredFolders] = useState<FolderData[]>(
    initialFolders || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<FolderData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialFolders && initialFolders.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialFolders && initialFolders.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialFolders && initialFolders.length > 0) {
      setFolders(initialFolders);
      setFilteredFolders(initialFolders);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialFolders]);

  // Filter folders based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFolders(folders);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = folders.filter(
        (folder) =>
          folder.name.toLowerCase().includes(query) ||
          folder.userName.toLowerCase().includes(query) ||
          folder.userEmail.toLowerCase().includes(query)
      );
      setFilteredFolders(filtered);
    }
  }, [searchQuery, folders]);

  const fetchFolders = async () => {
    try {
      const response = await apiClient.get("/Folder/admin");
      const foldersData = response.data.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        userId: folder.userId,
        userName: folder.userName || "Unknown",
        userEmail: folder.userEmail || "Unknown",
        itemCount: folder.itemCount || 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      }));
      setFolders(foldersData);
      setFilteredFolders(foldersData);
      const hasData = foldersData.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onFoldersFetched) {
        onFoldersFetched(foldersData);
      }
    } catch (error) {
      console.error("Error fetching folders", error);
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  const handleDelete = async () => {
    if (!deletingFolder || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Folder/admin/${deletingFolder.id}`);
      setFolders(folders.filter((f) => f.id !== deletingFolder.id));
      setDeletingFolder(null);
      toast.success("Folder deleted successfully");
    } catch (error) {
      console.error("Error deleting folder", error);
      toast.error("Failed to delete folder. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Show loading overlay only if we're loading and we know there are records
  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Folders Management
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchFolders();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-300">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <button
              onClick={() => downloadData(
                filteredFolders.map(f => ({
                  "Folder Name": f.name || "N/A",
                  "Owner": f.userName,
                  "Email": f.userEmail,
                  "Items": f.itemCount,
                  "Created At": new Date(f.createdAt).toLocaleString(),
                })),
                "folders",
                "excel"
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span>Excel (CSV)</span>
            </button>
            <button
              onClick={() => downloadData(
                filteredFolders.map(f => ({
                  "Folder Name": f.name || "N/A",
                  "Owner": f.userName,
                  "Email": f.userEmail,
                  "Items": f.itemCount,
                  "Created At": new Date(f.createdAt).toLocaleString(),
                })),
                "folders",
                "pdf",
                true
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-red-600" />
              <span>PDF (Text)</span>
            </button>
            <button
              onClick={() => downloadData(filteredFolders, "folders", "json")}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-md"
            >
              <Code className="h-4 w-4 text-blue-600" />
              <span>JSON</span>
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deletingFolder && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Folder</h3>
              <button
                onClick={() => setDeletingFolder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {deletingFolder.name}
                </span>
                ? Items inside will be moved to root. This action cannot be
                undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search folders by name, user name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto relative flex-1">
          {showLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Folder Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredFolders.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <Folder className="h-8 w-8 text-indigo-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery.trim() === ""
                          ? "No folders have been created yet"
                          : "No folders match your search"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFolders.map((folder) => (
                  <tr key={folder.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Folder className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-slate-900">
                          {folder.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{folder.userName}</div>
                      <div className="text-xs text-slate-500">{folder.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {folder.itemCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(folder.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setDeletingFolder(folder)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

