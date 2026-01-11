import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { apiClient } from "../../lib/authClient";
import {
  MessageSquare,
  Upload,
  AlertCircle,
  FileText,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Folder,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { SummaryPreviewModal } from "../SummaryPreviewModal";
import { FolderSidebar } from "../FolderSidebar";
import { SaveLocationModal } from "../SaveLocationModal";
import { generateSummaryPDF } from "../../utils/pdfGenerator";
import { ChatInterface } from "../ChatInterface";
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
  folderId?: string;
}
export function SummarizeSection() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<Summary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "text" | "file">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Folder Sidebar State
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [foldersRefreshKey, setFoldersRefreshKey] = useState(0);
  const [newlyMovedToFolderIds, setNewlyMovedToFolderIds] = useState<Set<string>>(new Set());
  const [expandFolderId, setExpandFolderId] = useState<string | null>(null);

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
          folderId?: string;
        }) => ({
          id: item.id,
          userId: user.id,
          userName: user.name || user.email || "You",
          type: "text" as const,
          content: item.textContent || item.text || "",
          summary: item.summary || "",
          textName: item.textName || null,
          createdAt: item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
          folderId: item.folderId || undefined,
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
          folderId?: string;
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
          folderId: item.folderId || undefined,
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
      return allSummaries;
    } catch (error) {
      console.error("Failed to load summaries", error);
      setHasLoadedOnce(true);
      return [];
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
      const latestSummaries = await fetchSummaries();

      // Animate the new (top) item
      if (latestSummaries && latestSummaries.length > 0) {
        setNewlyAddedId(latestSummaries[0].id);
        setTimeout(() => setNewlyAddedId(null), 3000);
      }
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
      const latestSummaries = await fetchSummaries();

      // Animate the new item
      if (latestSummaries && latestSummaries.length > 0) {
        setNewlyAddedId(latestSummaries[0].id);
        setTimeout(() => setNewlyAddedId(null), 3000);
      }
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
    // Build title and filename based on type
    let title = "";
    let filename = "";
    let documentSource = "";

    if (summary.type === "file") {
      title = summary.documentName || "File Summary";
      documentSource = summary.filename || "N/A";
      filename = summary.documentName?.replace(/\s+/g, "-").toLowerCase() || "document";
    } else {
      title = summary.textName || "Text Summary";
      documentSource = summary.textName || "N/A";
      filename = summary.textName?.replace(/\s+/g, "-").toLowerCase() || "content";
    }

    filename = filename.replace(/[<>:"/\\|?*]/g, "").trim();
    if (filename.length > 100) {
      filename = filename.substring(0, 100);
    }

    try {
      // Generate PDF using the template
      const pdf = generateSummaryPDF({
        summary,
        title,
        documentSource,
        authorEmail: user?.email || "Unknown"
      });

      // Create blob and download URL for better mobile compatibility
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const downloadFilename = `${filename}-${new Date().toISOString().split("T")[0]}.pdf`;
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = downloadFilename;
      link.setAttribute('download', downloadFilename); // Force download attribute
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
      
      toast.success('Summary downloaded as PDF', { id: 'pdf-download' });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download summary", { id: 'pdf-download' });
    }
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

  // Filter summaries based on filter type and search query
  const filteredSummaries = summaries.filter((summary) => {
    if (summary.folderId) return false; // Hide items in folders
    
    // Filter by type
    if (filterType !== "all" && summary.type !== filterType) return false;
    
    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const searchableText = [
        summary.textName || "",
        summary.documentName || "",
        summary.filename || "",
        summary.summary || "",
        summary.userName || "",
      ].join(" ").toLowerCase();
      
      return searchableText.includes(query);
    }
    
    return true;
  });

  // Reset selection when filter or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterType, searchQuery]);

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

  const handleSummaryMovedToFolder = async (summaryId: string, folderId: string) => {
    // Refresh summaries to reflect move
    await fetchSummaries();
    setFoldersRefreshKey((k) => k + 1);

    // Auto expand the folder
    if (folderId) {
      setExpandFolderId(folderId);
    }

    setNewlyMovedToFolderIds((prev) => new Set([...prev, summaryId]));
    setTimeout(() => {
      setNewlyMovedToFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(summaryId);
        return next;
      });
      if (folderId) {
        setExpandFolderId(null);
      }
    }, 3000);
  };

  const handleMoveSummaries = async (folderId: string) => {
    if (selectedIds.size === 0) return;

    setIsMoving(true);
    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        const summary = summaries.find(s => s.id === id);
        if (!summary) return;

        const endpoint = summary.type === "text"
          ? `/Texts/${id}`
          : `/Documents/${id}`;

        await apiClient.patch(endpoint, {
          folderId: folderId || "",
        });
      });

      await Promise.all(promises);

      toast.success(`Moved ${selectedIds.size} summaries`);
      setShowMoveModal(false);
      setIsDeleteMode(false); // Exit selection mode
      setSelectedIds(new Set());
      await fetchSummaries();
      setFoldersRefreshKey(k => k + 1);

      // Auto expand target folder
      if (folderId) {
        setExpandFolderId(folderId);
        // Add glow effect to all moved items
        setNewlyMovedToFolderIds(new Set(Array.from(selectedIds)));
        setTimeout(() => {
          setNewlyMovedToFolderIds(new Set());
          setExpandFolderId(null);
        }, 3000);
      }

    } catch (error) {
      console.error("Failed to move summaries", error);
      toast.error("Failed to move summaries");
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Summarization
        </h2>
      </div>

      {/* Main Content: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel: Folders */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col lg:h-[calc(100vh-250px)] lg:overflow-y-auto">
            <FolderSidebar
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              summaries={summaries}
              onPreviewSummary={handlePreviewSummary}
              onRefresh={() => {
                fetchSummaries();
              }}
              refreshKey={foldersRefreshKey}
              onSummaryMovedToFolder={handleSummaryMovedToFolder}
              newlyMovedToFolderIds={newlyMovedToFolderIds}
              expandFolderId={expandFolderId}
              variant="admin"
              //enableDragDrop
              enableSelectMove
            />
          </div>
        </div>

        {/* Right Panel: Input and Activity */}
        <div className="lg:col-span-3 space-y-6">

          {/* Input Section */}
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
              <div className="flex p-1 bg-slate-200/60 rounded-lg w-full border border-slate-200/50">
                <button
                  onClick={() => setActiveTab("text")}
                  disabled={isProcessing}
                  className={`flex-1 px-3 sm:px-4 md:px-6 py-2.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${activeTab === "text"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
                    }`}
                >
                  <MessageSquare className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${activeTab === "text" ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">Text Summary</span>
                </button>
                <button
                  onClick={() => setActiveTab("file")}
                  disabled={isProcessing}
                  className={`flex-1 px-3 sm:px-4 md:px-6 py-2.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${activeTab === "file"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
                    }`}
                >
                  <Upload className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${activeTab === "file" ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">File Upload</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start shadow-sm">
                  <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

                  {activeTab === "text" ? (
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="text-input"
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          Core Content
                        </label>
                        <div className="relative">
                          <textarea
                            id="text-input"
                            className="w-full h-40 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border resize-none transition-shadow"
                            placeholder="Enter text to summarize (min 50 characters)..."
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            disabled={isProcessing}
                          />
                          <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
                            {textInput.length} chars
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleSummarizeText}
                          disabled={textInput.length < 50 || isProcessing}
                          className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow h-10 py-2 px-6"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Generate Summary"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="file-upload"
                          className="block text-sm font-medium text-slate-700 mb-2"
                        >
                          File Upload
                        </label>
                        <div
                          className={`group h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${isProcessing
                            ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                            : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
                            }`}
                        >
                          <input
                            type="file"
                            id="file-upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
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
                          <div className="flex flex-col items-center pointer-events-none w-full px-3 sm:px-4">
                            <div className="h-12 w-12 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform flex-shrink-0">
                              <Upload className="h-6 w-6 text-indigo-600" />
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 mb-1">
                              {selectedFile ? "Selected file:" : "Drop your document here"}
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 mb-1 break-words line-clamp-2 w-full">
                              {selectedFile
                                ? selectedFile.name
                                : ""}
                            </p>
                            <p className="text-xs text-slate-500">
                              {selectedFile
                                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                                : "Supports PDF, TXT, DOC..."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleFileUpload}
                          disabled={!selectedFile || isProcessing}
                          className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow h-10 py-2 px-6"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Upload & Summarize"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col lg:max-h-[calc(100vh-450px)]">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col gap-4 flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Recent Activity
                  </h3>
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setFilterType("all")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === "all"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType("text")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === "text"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      Text
                    </button>
                    <button
                      onClick={() => setFilterType("file")}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === "file"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      File
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isDeleteMode ? (
                  <>
                    <button
                      onClick={() => {
                        if (selectedIds.size > 0) {
                          setShowMoveModal(true);
                        }
                      }}
                      disabled={selectedIds.size === 0}
                      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      Move ({selectedIds.size})
                    </button>

                    {selectedIds.size > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? "..." : `Delete (${selectedIds.size})`}
                      </button>
                    )}
                    <button
                      onClick={() => setIsDeleteMode(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsDeleteMode(true)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 text-xs font-medium flex items-center gap-1"
                    title="Manage items"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Select
                  </button>
                )}
                {isDeleteMode && (
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                  >
                    {selectedIds.size === filteredSummaries.length && filteredSummaries.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                )}
                </div>
              </div>
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="Search summaries by name, content, or user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
              </div>
            </div>
            <div className="py-4 px-6 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
                  {isLoading && !hasLoadedOnce ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <span className="ml-3 text-slate-500">Loading data...</span>
                    </div>
                  ) : summaries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-medium">No results found</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-xs">
                        Start by summarizing text or uploading a file above.
                      </p>
                    </div>
                  ) : filteredSummaries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Folder className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-slate-900 font-medium">No matching records found</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-xs">
                        Check your folders just in case, or try a different filter.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredSummaries.slice(0, 50).map((summary) => ( // limit to 50 for performance
                        <div
                          key={summary.id}
                          className={`group relative bg-white border rounded-lg px-4 py-3 hover:shadow-md transition-all cursor-pointer flex flex-col gap-1 ${isDeleteMode && selectedIds.has(summary.id)
                            ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10"
                            : newlyAddedId === summary.id
                              ? "animate-pulse-soft border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20"
                              : "border-slate-200 hover:border-indigo-300"
                            }`}
                          onClick={() => {
                            if (!isDeleteMode) {
                              handlePreviewSummary(summary);
                            } else {
                              handleToggleSelect(summary.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {isDeleteMode && (
                                <button
                                  className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(summary.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white hover:border-indigo-400"
                                    }`}
                                >
                                  {selectedIds.has(summary.id) && <CheckSquare className="h-3 w-3" />}
                                </button>
                              )}
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${summary.type === "file" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                }`}>
                                {summary.type === "file" ? <FileText className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                              </div>
                            </div>

                            {!isDeleteMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSummary(summary);
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <h4 className="text-sm font-semibold text-slate-900 break-words line-clamp-2">
                              {summary.type === "file"
                                ? summary.documentName || summary.filename || summary.content || "File Summary"
                                : summary.textName || "Untitled Summary"}
                            </h4>
                            <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1.5">
                              <span className="font-medium text-slate-500">{summary.userName}</span>
                              <span className="text-slate-300">•</span>
                              <span>{formatDate(summary.createdAt)}</span>
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {summary.summary}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              {filteredSummaries.length > 50 && (
                <div className="pt-4 text-center border-t border-slate-100">
                  <span className="text-xs text-slate-400">Showing 50 of {filteredSummaries.length} recent items</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Move to Folder Modal */}
      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={handleMoveSummaries}
        isSaving={isMoving}
        summaries={summaries}
      />

      {/* Delete Confirmation Modal */}
      {
        showDeleteConfirm && (
          <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 z-[60] flex items-center justify-center" style={{ margin: 0, padding: 0, width: '100vw', height: '100vh' }}>
            {/* Simple inline modal implementation for admin */}
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full m-4 p-6 animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Deletion</h3>
              <p className="text-slate-600 mb-6">Are you sure you want to delete {selectedIds.size} selected item(s)? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Preview Modal */}
      {
        isPreviewOpen && previewSummary && (
          <SummaryPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => {
              setIsPreviewOpen(false);
            }}
            summary={previewSummary}
            onDownload={() => handleDownloadSummary(previewSummary)}
          />
        )
      }

      {/* Chat Interface - Only visible in Summarize section */}
      <ChatInterface />
    </div>
  );
}
