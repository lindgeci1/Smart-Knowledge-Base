import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { apiClient } from "../../lib/authClient";
import {
  FileText,
  Upload,
  MessageSquare,
  X,
  Loader2,
  Download,
  AlertCircle,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import toast from "react-hot-toast";
import { SummaryPreviewModal } from "../SummaryPreviewModal";
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
  documentName?: string;
}
export function SummarizeSection() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<Summary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "text" | "file">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchSummaries = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [textResponse, fileResponse] = await Promise.all([
        apiClient.get("/Texts/summaries"),
        apiClient.get("/Documents/summaries"),
      ]);

      const textSummaries = textResponse.data || [];
      const fileSummaries = fileResponse.data || [];

      // Helper function to extract timestamp from MongoDB ObjectId
      const getTimestampFromObjectId = (objectId: string): Date => {
        try {
          const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
          return new Date(timestamp);
        } catch {
          return new Date();
        }
      };

      // Map text summaries - these are already filtered to current user by the API
      const mappedTextSummaries: Summary[] = textSummaries.map(
        (item: {
          id: string;
          text?: string;
          textContent?: string;
          textName?: string;
          summary?: string;
          createdAt?: string;
        }) => ({
          id: item.id,
          userId: user.id,
          userName: user.name || user.email || "You",
          type: "text" as const,
          content: item.textContent || item.text || "",
          summary: item.summary || "",
          textName: item.textName || null,
          createdAt: item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
        })
      );

      // Map file summaries - these are already filtered to current user by the API
      const mappedFileSummaries: Summary[] = fileSummaries.map(
        (item: {
          id: string;
          fileName?: string;
          fileType?: string;
          summary?: string;
          documentName?: string;
          createdAt?: string;
        }) => ({
          id: item.id,
          userId: user.id,
          userName: user.name || user.email || "You",
          type: "file" as const,
          content: item.fileName || "",
          filename: item.fileName ? `${item.fileName}.${item.fileType}` : "",
          summary: item.summary || "",
          documentName: item.documentName || null,
          createdAt: item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
        })
      );

      // Combine and sort by creation date (newest first)
      const allSummaries = [
        ...mappedTextSummaries,
        ...mappedFileSummaries,
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setSummaries(allSummaries);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error("Failed to load summaries", error);
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleSummarizeText = async () => {
    if (!textInput.trim() || !user) return;
    if (textInput.length < 50) {
      setError("Text must be at least 50 characters long.");
      return;
    }
    setError(null);
    setIsProcessing(true);

    try {
      await apiClient.post("/Texts", {
        text: textInput,
      });

      setTextInput("");
      await fetchSummaries();
    } catch (error: unknown) {
      console.error("Summarization failed:", error);
      let errorMessage = "Failed to summarize text. Please try again.";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: string } };
        if (axiosError.response?.data) {
          errorMessage =
            typeof axiosError.response.data === "string"
              ? axiosError.response.data
              : errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;

    // Validate file type
    const allowedExtensions = [
      ".pdf",
      ".txt",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
    ];
    const fileExtension = selectedFile.name
      .toLowerCase()
      .substring(selectedFile.name.lastIndexOf("."));
    if (!allowedExtensions.includes(fileExtension)) {
      setError(
        "Unsupported file type. Allowed: PDF, TXT, DOC, DOCX, XLS, XLSX."
      );
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError("File too large. Maximum file size is 5MB.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await apiClient.post("/Documents/upload", formData);

      setSelectedFile(null);
      await fetchSummaries();
    } catch (error: unknown) {
      console.error("File upload failed:", error);

      let errorMessage =
        "Failed to upload and summarize file. Please try again.";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: string | { message?: string } };
        };
        const data = axiosError.response?.data;
        if (data) {
          if (typeof data === "string") {
            if (data.includes("Unsupported file type")) {
              errorMessage =
                "Unsupported file type. Allowed: PDF, TXT, DOC, DOCX, XLS, XLSX.";
            } else if (data.includes("File too large")) {
              errorMessage = "File too large. Maximum file size is 5MB.";
            } else if (
              data.includes("PDF header not found") ||
              data.includes("IOException")
            ) {
              errorMessage =
                "Invalid or corrupted PDF file. Please ensure the file is a valid PDF.";
            } else if (data.includes("Summarization failed")) {
              errorMessage =
                "Failed to generate summary. Please try again with a different file.";
            } else {
              const lines = data.split("\n");
              const firstLine = lines[0]?.trim();
              if (firstLine && firstLine.length < 200) {
                errorMessage = firstLine;
              }
            }
          } else if (typeof data === "object" && "message" in data) {
            errorMessage = data.message || errorMessage;
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviewSummary = (summary: Summary) => {
    setPreviewSummary(summary);
    setIsPreviewOpen(true);
  };

  const handleDownloadSummary = (summary: Summary) => {
    // Use summary content in the downloaded file for both text and file types
    const fileContent = summary.summary || "";
    const blob = new Blob([fileContent], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    if (summary.type === "file") {
      a.download =
        summary.filename?.replace(/\.[^/.]+$/, "-summary.txt") ||
        "file-summary.txt";
    } else {
      // Use TextName as filename, sanitize it for file system
      let filename = summary.textName || "Untitled Summary";
      // Remove invalid characters for filenames
      filename = filename.replace(/[<>:"/\\|?*]/g, "").trim();
      // Limit length and add .txt extension
      if (filename.length > 100) {
        filename = filename.substring(0, 100);
      }
      a.download = `${filename}.txt`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  // Filter summaries based on filter type
  const filteredSummaries = summaries.filter((summary) => {
    if (filterType === "all") return true;
    return summary.type === filterType;
  });

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterType]);

  // Reset delete mode and selection when delete mode is turned off
  useEffect(() => {
    if (!isDeleteMode) {
      setSelectedIds(new Set());
    }
  }, [isDeleteMode]);

  // Handle select/deselect all
  const handleSelectAll = () => {
    if (selectedIds.size === filteredSummaries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSummaries.map((s) => s.id)));
    }
  };

  // Handle individual selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one summary to delete");
      return;
    }

    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one summary to delete");
      return;
    }

    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const ids = Array.from(selectedIds);
      const textIds: string[] = [];
      const fileIds: string[] = [];

      // Separate text and file summaries
      summaries.forEach((summary) => {
        if (ids.includes(summary.id)) {
          if (summary.type === "text") {
            textIds.push(summary.id);
          } else {
            fileIds.push(summary.id);
          }
        }
      });

      // Delete in parallel
      const promises: Promise<any>[] = [];
      if (textIds.length > 0) {
        promises.push(apiClient.delete("/Texts/bulk", { data: textIds }));
      }
      if (fileIds.length > 0) {
        promises.push(apiClient.delete("/Documents/bulk", { data: fileIds }));
      }

      await Promise.all(promises);

      setSelectedIds(new Set());
      setIsDeleteMode(false);
      await fetchSummaries();
      toast.success(`Successfully deleted ${ids.length} summary/summaries`);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast.error("Failed to delete summaries. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-900">
          Admin Summarization
        </h2>
        <button
          onClick={async () => {
            setIsRefreshing(true);
            await fetchSummaries();
            setIsRefreshing(false);
          }}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
          title="Refresh summaries"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab("text")}
              disabled={isProcessing}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${
                activeTab === "text"
                  ? "text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${
                isProcessing
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : "cursor-pointer"
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text Summary
            </button>
            <button
              onClick={() => setActiveTab("file")}
              disabled={isProcessing}
              className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${
                activeTab === "file"
                  ? "text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${
                isProcessing
                  ? "opacity-50 cursor-not-allowed pointer-events-none"
                  : "cursor-pointer"
              }`}
            >
              <Upload className="h-4 w-4 mr-2" />
              File Upload
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {activeTab === "text" ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="text-input"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  Paste your text below
                </label>
                <textarea
                  id="text-input"
                  rows={6}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border resize-none"
                  placeholder="Enter text to summarize (min 50 characters)..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={isProcessing}
                />
                <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                  <span>{textInput.length} characters</span>
                  <span>Min 50 required</span>
                </div>
              </div>
              <button
                onClick={handleSummarizeText}
                disabled={textInput.length < 50 || isProcessing}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 h-10 py-2 px-4"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Summarize Text"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative ${
                  isProcessing
                    ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                    : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  accept=".txt,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      const maxSize = 5 * 1024 * 1024;
                      if (file.size > maxSize) {
                        setError("File too large. Maximum file size is 5MB.");
                        e.target.value = "";
                        return;
                      }
                      const allowedExtensions = [
                        ".pdf",
                        ".txt",
                        ".doc",
                        ".docx",
                        ".xls",
                        ".xlsx",
                      ];
                      const fileExtension = file.name
                        .toLowerCase()
                        .substring(file.name.lastIndexOf("."));
                      if (!allowedExtensions.includes(fileExtension)) {
                        setError(
                          "Unsupported file type. Allowed: PDF, TXT, DOC, DOCX, XLS, XLSX."
                        );
                        e.target.value = "";
                        return;
                      }
                      setError(null);
                    }
                    setSelectedFile(file);
                  }}
                  disabled={isProcessing}
                />
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedFile
                      ? selectedFile.name
                      : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : "PDF, TXT, DOC, DOCX, XLS, XLSX up to 5MB"}
                  </p>
                </div>
              </div>
              {selectedFile && (
                <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-md border border-indigo-100">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-indigo-600 mr-2" />
                    <span className="text-sm text-indigo-900 truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-indigo-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <button
                onClick={handleFileUpload}
                disabled={!selectedFile || isProcessing}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 h-10 py-2 px-4"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing File...
                  </>
                ) : (
                  "Upload & Summarize"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summaries List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent Summaries
            </h3>
            <div className="flex items-center gap-2">
              {isDeleteMode ? (
                <button
                  onClick={() => setIsDeleteMode(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => setIsDeleteMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
              {isDeleteMode && selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete ({selectedIds.size})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  filterType === "all"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("text")}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  filterType === "text"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setFilterType("file")}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  filterType === "file"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                File
              </button>
            </div>
            {isDeleteMode && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                title={selectedIds.size === filteredSummaries.length ? "Deselect all" : "Select all"}
              >
                {selectedIds.size === filteredSummaries.length && filteredSummaries.length > 0 ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                <span>{selectedIds.size === filteredSummaries.length && filteredSummaries.length > 0 ? "Deselect All" : "Select All"}</span>
              </button>
            )}
          </div>
        </div>
        {isLoading && !hasLoadedOnce ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-600" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
            <p className="text-xs text-slate-500 text-center">
              No summaries have been created yet
            </p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-600" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
            <p className="text-xs text-slate-500 text-center">
              No {filterType === "all" ? "" : filterType} summaries found
            </p>
          </div>
        ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto" style={{ maxHeight: '320px' }}>
              {filteredSummaries.map((summary) => (
                <div
                  key={summary.id}
                  className={`group relative bg-white border rounded-lg p-4 hover:shadow-md transition-all ${
                    isDeleteMode && selectedIds.has(summary.id)
                      ? "border-indigo-500 ring-2 ring-indigo-200"
                      : "border-slate-200 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (!isDeleteMode) {
                      handlePreviewSummary(summary);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {isDeleteMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(summary.id);
                        }}
                        className="mt-1 flex-shrink-0"
                      >
                        {selectedIds.has(summary.id) ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    )}
                    <span
                      className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        summary.type === "file"
                          ? "bg-purple-100 text-purple-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {summary.type === "file" ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-900 break-words pr-2">
                          {summary.type === "file"
                            ? summary.documentName || summary.filename || summary.content || "File Summary"
                            : summary.textName || "Untitled Summary"}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSummary(summary);
                          }}
                          className="text-green-600 hover:text-green-700 flex-shrink-0"
                          title="Download summary"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        By {summary.userName} • {formatDate(summary.createdAt)}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {summary.summary}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40" style={{ margin: 0, padding: 0 }} />
          <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 p-4" style={{ margin: 0 }}>
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative z-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Delete Summaries</h3>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedIds.size}
                  </span>{" "}
                  {selectedIds.size === 1 ? "summary" : "summaries"}? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && previewSummary && (
        <SummaryPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewSummary(null);
          }}
          summary={previewSummary}
          onDownload={() => handleDownloadSummary(previewSummary)}
        />
      )}
    </div>
  );
}
