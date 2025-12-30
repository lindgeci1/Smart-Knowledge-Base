import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Trash2,
  X,
  Download,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Code,
} from "lucide-react";
import { apiClient } from "../../lib/authClient";
import { downloadData } from "../../utils/downloadUtils";
import toast from "react-hot-toast";
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
interface TextSectionProps {
  texts: Summary[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onTextsFetched?: (texts: Summary[]) => void;
}
export function TextSection({
  texts: initialTexts,
  loading: externalLoading = false,
  onDataLoaded,
  onTextsFetched,
}: TextSectionProps) {
  const [texts, setTexts] = useState<Summary[]>(initialTexts || []);
  const [filteredTexts, setFilteredTexts] = useState<Summary[]>(
    initialTexts || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingText, setDeletingText] = useState<Summary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialTexts && initialTexts.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialTexts && initialTexts.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialTexts && initialTexts.length > 0) {
      setTexts(initialTexts);
      setFilteredTexts(initialTexts);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialTexts]);

  // Filter texts based on search query (by user email)
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTexts(texts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = texts.filter((text) =>
        text.userName.toLowerCase().includes(query)
      );
      setFilteredTexts(filtered);
    }
  }, [searchQuery, texts]);

  const fetchTextSummaries = async () => {
    try {
      const response = await apiClient.get("/Texts/admin/summaries");
      const summaries = response.data.map((text: any) => ({
        id: text.id,
        userId: text.userId,
        userName: text.userEmail || "Unknown",
        type: "text" as const,
        content: "",
        summary: text.summary,
        textName: text.textName || null,
        createdAt: text.createdAt,
      }));
      setTexts(summaries);
      const hasData = summaries.length > 0;
      setHasRecords(hasData);
      setHasLoadedOnce(true);
      if (onDataLoaded) {
        onDataLoaded(hasData);
      }
      if (onTextsFetched) {
        onTextsFetched(summaries);
      }
    } catch (error) {
      console.error("Error fetching text summaries", error);
      setHasLoadedOnce(true);
      setHasRecords(false);
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchTextSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  const handleDelete = async () => {
    if (!deletingText || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Texts/admin/${deletingText.id}`);
      setTexts(texts.filter((t) => t.id !== deletingText.id));
      setDeletingText(null);
      toast.success("Text summary deleted successfully");
    } catch (error) {
      console.error("Error deleting text summary", error);
      toast.error("Failed to delete text summary. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  const handleDownload = (text: Summary) => {
    // Use summary content in the downloaded file
    const fileContent = text.summary || "";
    const blob = new Blob([fileContent], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    // Use TextName as filename, sanitize it for file system
    let filename = text.textName || "Untitled Summary";
    // Remove invalid characters for filenames
    filename = filename.replace(/[<>:"/\\|?*]/g, "").trim();
    // Limit length and add .txt extension
    if (filename.length > 100) {
      filename = filename.substring(0, 100);
    }
    a.download = `${filename}.txt`;
    
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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Text Summaries
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchTextSummaries();
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
                onClick={() =>
                  downloadData(
                    filteredTexts.map((t) => ({
                      User: t.userName,
                      Type: t.type,
                      "Created At": new Date(t.createdAt).toLocaleString(),
                    })),
                    "text-summaries",
                    "excel"
                  )
                }
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>Excel (CSV)</span>
              </button>
              <button
                onClick={() =>
                  downloadData(
                    filteredTexts.map((t) => ({
                      User: t.userName,
                      Type: t.type,
                      "Created At": new Date(t.createdAt).toLocaleString(),
                    })),
                    "text-summaries",
                    "pdf"
                  )
                }
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-red-600" />
                <span>PDF (Text)</span>
              </button>
              <button
                onClick={() =>
                  downloadData(filteredTexts, "text-summaries", "json")
                }
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
      {deletingText && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Text Summary</h3>
              <button
                onClick={() => setDeletingText(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this text summary? This action
                cannot be undone.
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs text-slate-500 line-clamp-2">
                  {deletingText.textName || "Untitled Summary"}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingText(null)}
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
                {isDeleting ? "Deleting..." : "Delete Summary"}
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
              placeholder="Search text summaries by user email..."
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
                  Text Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
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
              {filteredTexts.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {searchQuery.trim() === ""
                      ? "No summaries yet"
                      : "No summaries match your search"}
                  </td>
                </tr>
              ) : (
                filteredTexts.map((text) => (
                  <tr key={text.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-900">
                          {text.textName || "Untitled Summary"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {text.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(text.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(text)}
                        className="text-green-600 hover:text-green-900 mr-3"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingText(text)}
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
