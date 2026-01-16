import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Share2,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
  Code,
  X,
} from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface SharedDocument {
  shareId: string;
  documentId: string;
  documentName: string;
  fileName: string;
  fileType: string;
  summary: string;
  sharedByEmail: string;
  sharedByName: string;
  sharedWithEmail: string;
  sharedWithUserId?: string;
  sharedWithName: string;
  sharedAt: string;
}

interface FileSharingSectionProps {
  sharedDocuments?: SharedDocument[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onSharedDocumentsFetched?: (documents: SharedDocument[]) => void;
}

export function FileSharingSection({
  sharedDocuments: initialSharedDocuments,
  loading: externalLoading = false,
  onDataLoaded,
  onSharedDocumentsFetched,
}: FileSharingSectionProps) {
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>(initialSharedDocuments || []);
  const [filteredDocuments, setFilteredDocuments] = useState<SharedDocument[]>(initialSharedDocuments || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingShare, setDeletingShare] = useState<SharedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialSharedDocuments && initialSharedDocuments.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialSharedDocuments && initialSharedDocuments.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialSharedDocuments && initialSharedDocuments.length > 0) {
      setSharedDocuments(initialSharedDocuments);
      setFilteredDocuments(initialSharedDocuments);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialSharedDocuments]);

  const fetchSharedDocuments = async () => {
    try {
      const response = await apiClient.get("/Documents/admin/shared");
      const documents = response.data || [];
      setSharedDocuments(documents);
      setFilteredDocuments(documents);
      const hasData = documents.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onSharedDocumentsFetched) {
        onSharedDocumentsFetched(documents);
      }
    } catch (error) {
      console.error("Error fetching shared documents", error);
      toast.error("Failed to load shared documents");
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchSharedDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  // Filter shared documents based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocuments(sharedDocuments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sharedDocuments.filter(
      (doc) =>
        doc.documentName.toLowerCase().includes(query) ||
        doc.sharedByEmail.toLowerCase().includes(query) ||
        doc.sharedWithEmail.toLowerCase().includes(query) ||
        doc.sharedByName.toLowerCase().includes(query) ||
        doc.sharedWithName.toLowerCase().includes(query)
    );
    setFilteredDocuments(filtered);
  }, [searchQuery, sharedDocuments]);

  const handleDeleteShare = async () => {
    if (!deletingShare || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Documents/admin/shared/${deletingShare.shareId}`);
      setDeletingShare(null);
      await fetchSharedDocuments();
      toast.success("Share removed successfully");
    } catch (error: unknown) {
      console.error("Error deleting share", error);
      let errorMessage = "Failed to remove share. Please try again.";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string } | string };
        };
        if (axiosError.response?.data) {
          if (typeof axiosError.response.data === "string") {
            errorMessage = axiosError.response.data;
          } else if (axiosError.response.data.message) {
            errorMessage = axiosError.response.data.message;
          }
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  const handleDownload = (format: "excel" | "pdf" | "json") => {
    if (format === "excel" || format === "pdf") {
      const data = filteredDocuments.map((doc) => ({
        "Document Name": doc.documentName,
        "Shared By": `${doc.sharedByName} (${doc.sharedByEmail})`,
        "Shared With": `${doc.sharedWithName} (${doc.sharedWithEmail})`,
        "Shared At": new Date(doc.sharedAt).toLocaleDateString(),
      }));
      downloadData(data, "file-sharing", format, format === "pdf");
    } else {
      downloadData(filteredDocuments, "file-sharing", format);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          File Sharing
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchSharedDocuments();
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
                onClick={() => handleDownload("excel")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>Excel (CSV)</span>
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-red-600" />
                <span>PDF (Text)</span>
              </button>
              <button
                onClick={() => handleDownload("json")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-md"
              >
                <Code className="h-4 w-4 text-blue-600" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shared Documents Table */}
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by document name, shared by, or shared with..."
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
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Shared By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Shared With
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Shared At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredDocuments.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <Share2 className="h-8 w-8 text-indigo-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery.trim() === ""
                          ? "No shared documents have been created yet"
                          : "No shared documents match your search"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((share) => (
                  <tr key={share.shareId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-slate-900 truncate max-w-xs" title={share.documentName}>
                          {share.documentName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      <div>{share.sharedByName}</div>
                      <div className="text-xs text-slate-500">{share.sharedByEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      <div>{share.sharedWithName}</div>
                      <div className="text-xs text-slate-500">{share.sharedWithEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(share.sharedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setDeletingShare(share)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Remove share"
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

      {/* Delete Share Modal */}
      {deletingShare && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Remove Share</h3>
                <button
                  onClick={() => setDeletingShare(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to remove the share for{" "}
                  <span className="font-semibold text-slate-900">
                    "{deletingShare.documentName}"
                  </span>{" "}
                  with {deletingShare.sharedWithName} ({deletingShare.sharedWithEmail})? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setDeletingShare(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteShare}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? "Removing..." : "Remove Share"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
