import React, { useState, useEffect } from "react";
import { FileText, Trash2, X, Download, Search, RefreshCw, FileSpreadsheet, Code } from "lucide-react";
import { apiClient } from "../../lib/authClient";
import { downloadData } from "../../utils/downloadUtils";
interface Summary {
  id: string;
  userId: string;
  userName: string;
  type: "text" | "file";
  content: string;
  summary: string;
  createdAt: string;
  filename?: string;
  textName?: string;
}
interface FilesSectionProps {
  files: Summary[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onFilesFetched?: (files: Summary[]) => void;
}
export function FilesSection({
  files: initialFiles,
  loading: externalLoading = false,
  onDataLoaded,
  onFilesFetched,
}: FilesSectionProps) {
  const [files, setFiles] = useState<Summary[]>(initialFiles || []);
  const [filteredFiles, setFilteredFiles] = useState<Summary[]>(
    initialFiles || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingFile, setDeletingFile] = useState<Summary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialFiles && initialFiles.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialFiles && initialFiles.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles);
      setFilteredFiles(initialFiles);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialFiles]);

  // Filter files based on search query (by user email)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFiles(files);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = files.filter((file) =>
        file.userName.toLowerCase().includes(query)
      );
      setFilteredFiles(filtered);
    }
  }, [searchQuery, files]);

  const fetchDocuments = async () => {
    try {
      const response = await apiClient.get("/Documents/admin");
      const documents = response.data.map((doc: any) => ({
        id: doc.id,
        userId: doc.userId,
        userName: doc.userEmail || "Unknown",
        type: "file" as const,
        content: doc.fileName,
        summary: doc.summary,
        createdAt: doc.createdAt,
        filename: doc.fileName,
      }));
      setFiles(documents);
      const hasData = documents.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onFilesFetched) {
        onFilesFetched(documents);
      }
    } catch (error) {
      console.error("Error fetching documents", error);
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  const handleDelete = async () => {
    if (!deletingFile || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Documents/admin/${deletingFile.id}`);
      setFiles(files.filter((f) => f.id !== deletingFile.id));
      setDeletingFile(null);
    } catch (error) {
      console.error("Error deleting document", error);
      alert("Failed to delete document. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  const handleDownload = (file: Summary) => {
    const blob = new Blob([file.summary], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename || "file-summary.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  // Show loading overlay only if we're loading and we know there are records
  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">File Management</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchDocuments();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
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
                filteredFiles.map(f => ({
                  "File Name": f.filename || "N/A",
                  "User": f.userName,
                  Type: f.type,
                  "Created At": new Date(f.createdAt).toLocaleString(),
                })),
                "files",
                "excel"
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span>Excel (CSV)</span>
            </button>
            <button
              onClick={() => downloadData(
                filteredFiles.map(f => ({
                  "File Name": f.filename || "N/A",
                  "User": f.userName,
                  Type: f.type,
                  "Created At": new Date(f.createdAt).toLocaleString(),
                })),
                "files",
                "pdf",
                true
              )}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-red-600" />
              <span>PDF (Text)</span>
            </button>
            <button
              onClick={() => downloadData(filteredFiles, "files", "json")}
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
      {deletingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete File</h3>
              <button
                onClick={() => setDeletingFile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {deletingFile.filename}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingFile(null)}
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
                {isDeleting ? "Deleting..." : "Delete File"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search files by user email..."
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
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredFiles.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {searchQuery.trim() === ""
                      ? "No files uploaded yet"
                      : "No files match your search"}
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-slate-900">
                          {file.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {file.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(file)}
                        className="text-green-600 hover:text-green-900 mr-3"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingFile(file)}
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
