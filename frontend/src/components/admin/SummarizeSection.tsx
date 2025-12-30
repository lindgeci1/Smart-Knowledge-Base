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
  List,
  Grid3x3,
} from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [previewSummary, setPreviewSummary] = useState<Summary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
          userId: user.userId,
          userName: user.name || user.email || "You",
          type: "text" as const,
          content: item.textContent || item.text || "",
          summary: item.summary || "",
          textName: item.textName || null,
          createdAt: item.createdAt || new Date().toISOString(),
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
          userId: user.userId,
          userName: user.name || user.email || "You",
          type: "file" as const,
          content: item.fileName || "",
          filename: item.fileName ? `${item.fileName}.${item.fileType}` : "",
          summary: item.summary || "",
          documentName: item.documentName || null,
          createdAt: item.createdAt || new Date().toISOString(),
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Recent Summaries
          </h3>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isLoading && !hasLoadedOnce ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (() => {
          // Filter summaries based on active tab
          const filteredSummaries = summaries.filter(
            (summary) => summary.type === activeTab
          );
          
          return filteredSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                {activeTab === "text" ? (
                  <MessageSquare className="h-8 w-8 text-indigo-600" />
                ) : (
                  <Upload className="h-8 w-8 text-indigo-600" />
                )}
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
              <p className="text-xs text-slate-500 text-center">
                {activeTab === "text"
                  ? "No text summaries have been created yet"
                  : "No file summaries have been uploaded yet"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="divide-y divide-slate-200">
              {filteredSummaries.map((summary) => (
              <div
                key={summary.id}
                onClick={() => handlePreviewSummary(summary)}
                className="p-6 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    <span
                      className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
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
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {summary.type === "file"
                            ? summary.documentName || summary.filename || summary.content || "File Summary"
                            : summary.textName || "Untitled Summary"}
                        </h4>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {summary.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        By {summary.userName} • {formatDate(summary.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSummary(summary);
                    }}
                    className="ml-4 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Download summary"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                    {summary.summary}
                  </p>
                </div>
              </div>
              ))}
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSummaries.map((summary) => (
                <div
                  key={summary.id}
                  onClick={() => handlePreviewSummary(summary)}
                  className="group relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3">
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
          );
        })()}
      </div>

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
