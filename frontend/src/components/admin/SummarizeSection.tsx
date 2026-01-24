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
  ChevronDown,
  ChevronRight
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
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false);


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

      const getTimestampFromObjectId = (objectId: string): Date => {
        try {
          const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
          return new Date(timestamp);
        } catch {
          return new Date();
        }
      };

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
      const pdf = generateSummaryPDF({
        summary,
        title,
        documentSource,
        authorEmail: user?.email || "Unknown"
      });

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const downloadFilename = `${filename}-${new Date().toISOString().split("T")[0]}.pdf`;
      
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = downloadFilename;
      link.setAttribute('download', downloadFilename);
      
      document.body.appendChild(link);
      link.click();
      
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

  const filteredSummaries = summaries.filter((summary) => {
    if (summary.folderId) return false;
    
    if (filterType !== "all" && summary.type !== filterType) return false;
    
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterType, searchQuery]);

  useEffect(() => {
    if (!isDeleteMode) {
      setSelectedIds(new Set());
    }
  }, [isDeleteMode]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSummaries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSummaries.map((s) => s.id)));
    }
  };

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

      summaries.forEach((summary) => {
        if (ids.includes(summary.id)) {
          if (summary.type === "text") {
            textIds.push(summary.id);
          } else {
            fileIds.push(summary.id);
          }
        }
      });

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
    await fetchSummaries();
    setFoldersRefreshKey((k) => k + 1);

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
      setIsDeleteMode(false);
      setSelectedIds(new Set());
      await fetchSummaries();
      setFoldersRefreshKey(k => k + 1);

      if (folderId) {
        setExpandFolderId(folderId);
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
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Summarization Hub
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div
            className={
              isFoldersCollapsed
                ? "bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden"
                : "bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col lg:h-[calc(100vh-250px)] lg:overflow-y-auto"
            }
          >
            <FolderSidebar
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              summaries={summaries}
              onPreviewSummary={handlePreviewSummary}
              onRefresh={fetchSummaries}
              refreshKey={foldersRefreshKey}
              onSummaryMovedToFolder={handleSummaryMovedToFolder}
              newlyMovedToFolderIds={newlyMovedToFolderIds}
              expandFolderId={expandFolderId}
              variant="admin"
              enableSelectMove
              onCollapsedChange={setIsFoldersCollapsed}
            />
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white shadow-sm rounded-lg border border-slate-200">
            <button 
              className="px-4 sm:px-6 py-3 border-b border-slate-200 w-full flex justify-between items-center"
              onClick={() => setIsInputCollapsed(!isInputCollapsed)}
            >
              <h3 className="text-base font-semibold text-slate-800">
                Create New Summary
              </h3>
              {isInputCollapsed ? <ChevronRight className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
            </button>

            {!isInputCollapsed && (
              <div className="p-6">
                <div className="flex p-1 bg-slate-200/60 rounded-lg w-full border border-slate-200/50 mb-6">
                  <button
                    onClick={() => setActiveTab("text")}
                    disabled={isProcessing}
                    className={`flex-1 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === "text"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
                      }`}
                  >
                    <MessageSquare className={`h-4 w-4 ${activeTab === "text" ? "text-indigo-600" : "text-slate-400"}`} />
                    Text
                  </button>
                  <button
                    onClick={() => setActiveTab("file")}
                    disabled={isProcessing}
                    className={`flex-1 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === "file"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
                      }`}
                  >
                    <Upload className={`h-4 w-4 ${activeTab === "file" ? "text-indigo-600" : "text-slate-400"}`} />
                    File
                  </button>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start shadow-sm">
                    <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                {activeTab === "text" ? (
                  <div className="space-y-4">
                    <textarea
                      className="w-full h-40 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border resize-y transition-shadow"
                      placeholder="Enter text to summarize (min 50 characters)..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={isProcessing}
                    />
                    <div className="flex justify-between items-center">
                       <p className="text-xs text-slate-400">{textInput.length} chars</p>
                       <button
                        onClick={handleSummarizeText}
                        disabled={textInput.length < 50 || isProcessing}
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow h-10 py-2 px-6"
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`group h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${isProcessing
                        ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                        : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
                        }`}
                    >
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        accept=".txt,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        disabled={isProcessing}
                      />
                      <div className="flex flex-col items-center pointer-events-none w-full px-4">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">
                          {selectedFile ? selectedFile.name : "Drop or click to upload"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Max 5MB. PDF, DOCX, TXT..."}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || isProcessing}
                        className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow h-10 py-2 px-6"
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                        Recent Activity
                    </h3>
                    <div className="flex items-center gap-2">
                        {isDeleteMode ? (
                            <>
                                <button onClick={() => setShowMoveModal(true)} disabled={selectedIds.size === 0} className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                                    Move ({selectedIds.size})
                                </button>
                                <button onClick={handleBulkDelete} disabled={isDeleting || selectedIds.size === 0} className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                                    Delete ({selectedIds.size})
                                </button>
                                <button onClick={() => setIsDeleteMode(false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300">
                                    Done
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsDeleteMode(true)} className="text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 text-xs font-medium flex items-center gap-1">
                                <CheckSquare className="h-4 w-4" />
                                Select
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:max-w-xs">
                        <input
                        type="text"
                        placeholder="Search summaries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setFilterType("all")} className={`px-3 py-1 text-xs font-medium rounded-md ${filterType === "all" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}>All</button>
                        <button onClick={() => setFilterType("text")} className={`px-3 py-1 text-xs font-medium rounded-md ${filterType === "text" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}>Text</button>
                        <button onClick={() => setFilterType("file")} className={`px-3 py-1 text-xs font-medium rounded-md ${filterType === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"}`}>File</button>
                    </div>
                </div>
            </div>
            
            <div className="p-6 lg:overflow-y-auto lg:max-h-[calc(100vh-550px)]">
                  {isLoading && !hasLoadedOnce ? (
                    <div className="text-center py-20"><Loader2 className="h-8 w-8 mx-auto animate-spin text-indigo-600" /></div>
                  ) : filteredSummaries.length === 0 ? (
                    <div className="text-center py-20">
                      <Folder className="h-12 w-12 mx-auto text-slate-300" />
                      <p className="mt-4 font-medium text-slate-800">No summaries found</p>
                      <p className="mt-1 text-sm text-slate-500">{searchQuery ? "Try a different search." : "Create a new summary above."}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredSummaries.map((summary) => (
                        <div
                          key={summary.id}
                          className={`group relative bg-white border rounded-lg p-4 transition-all flex flex-col ${isDeleteMode ? 'cursor-pointer' : ''} ${selectedIds.has(summary.id) ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-slate-200 hover:shadow-md hover:border-indigo-300"}`}
                          onClick={() => isDeleteMode && handleToggleSelect(summary.id)}
                        >
                            {isDeleteMode && (
                                <div className={`absolute top-3 right-3 h-5 w-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(summary.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"}`}>
                                    {selectedIds.has(summary.id) && <CheckSquare className="h-3 w-3" />}
                                </div>
                            )}
                            <div className="flex items-start gap-3"  onClick={() => !isDeleteMode && handlePreviewSummary(summary)}>
                                <div className={`mt-1 h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center ${summary.type === 'file' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                    {summary.type === 'file' ? <FileText className="h-4 w-4 text-purple-600" /> : <MessageSquare className="h-4 w-4 text-blue-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-800 break-words line-clamp-2 cursor-pointer">
                                    {summary.type === "file" ? summary.documentName || summary.filename : summary.textName || "Untitled"}
                                    </h4>
                                    <p className="text-xs text-slate-500">{formatDate(summary.createdAt)}</p>
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-600 line-clamp-3 flex-1">
                                {summary.summary}
                            </p>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                    <p className="text-xs text-slate-500">by {summary.userName}</p>
                               </div>
                               <button
                                    onClick={(e) => { e.stopPropagation(); handleDownloadSummary(summary); }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Download"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </div>
        </div>
      </div>

      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={handleMoveSummaries}
        isSaving={isMoving}
        summaries={summaries}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
              <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
              <p className="text-slate-600 my-4">Delete {selectedIds.size} item(s)? This cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleConfirmDelete} className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg shadow-sm">Delete</button>
              </div>
            </div>
        </div>
      )}

      {isPreviewOpen && previewSummary && (
        <SummaryPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            summary={previewSummary}
            onDownload={() => handleDownloadSummary(previewSummary)}
        />
      )}

      <ChatInterface />
    </div>
  );
}
