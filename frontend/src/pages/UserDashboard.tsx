import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import toast from "react-hot-toast";
import {
  Layout,
  FileText,
  Upload,
  MessageSquare,
  LogOut,
  Clock,
  CheckCircle2,
  X,
  File as FileIcon,
  Loader2,
  Zap,
  AlertCircle,
  Download,
  Settings,
  FolderOpen,
} from "lucide-react";
import { apiClient } from "../lib/authClient";
import { FolderSidebar } from "../components/FolderSidebar";
import { SaveLocationModal } from "../components/SaveLocationModal";
import { SummaryPreviewModal } from "../components/SummaryPreviewModal";
// Types
interface Summary {
  id: string;
  userId: string;
  userName: string;
  type: "text" | "file";
  content: string; // Original text or filename
  summary: string;
  createdAt: string;
  filename?: string; // Only for file type
  textName?: string; // For text type - always "text summary"
  folderId?: string; // Folder assignment
}
export function UserDashboard() {
  const { user, logout, updateUsername } = useAuth();
  const navigate = useNavigate();
  // State
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFolderText, setSelectedFolderText] = useState<string | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<Summary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<Set<string>>(
    new Set()
  );
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [foldersRefreshKey, setFoldersRefreshKey] = useState(0);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [currentResult, setCurrentResult] = useState<Summary | null>(null);
  const [currentResultFolder, setCurrentResultFolder] = useState<string | null>(
    null
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendUsage, setBackendUsage] = useState<number>(0);
  const [backendTotalLimit, setBackendTotalLimit] = useState<number>(100);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Function to fetch usage from backend
  const fetchUsage = useCallback(async () => {
    if (!user || user.role === "admin") return; // Don't fetch usage for admins
    try {
      const response = await apiClient.get("/Users/usage");
      setBackendUsage(response.data?.overallUsage || 0);
      setBackendTotalLimit(response.data?.totalLimit || 100);
    } catch (error) {
      console.error("Failed to load usage", error);
      setBackendUsage(0);
      setBackendTotalLimit(100);
    }
  }, [user]);

  // Function to fetch summaries from backend
  const fetchSummaries = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch both text and file summaries
      const [textResponse, fileResponse] = await Promise.all([
        apiClient.get("/Texts/summaries"),
        apiClient.get("/Documents/summaries"),
      ]);

      const textSummaries = textResponse.data || [];
      const fileSummaries = fileResponse.data || [];

      // Map text summaries
      const mappedTextSummaries: Summary[] = textSummaries.map((item: any) => ({
        id: item.id,
        userId: user.id,
        userName: user.name,
        type: "text" as const,
        // Keep full original content for modal preview
        content: item.text || "",
        summary: item.summary || "",
        textName: item.textName || "text summary",
        createdAt: item.createdAt || new Date().toISOString(),
        folderId: item.folderId || undefined,
      }));

      // Map file summaries
      const mappedFileSummaries: Summary[] = fileSummaries.map((item: any) => ({
        id: item.id,
        userId: user.id,
        userName: user.name,
        type: "file" as const,
        content: item.fileName || "",
        filename: item.fileName ? `${item.fileName}.${item.fileType}` : "",
        summary: item.summary || "",
        createdAt: new Date().toISOString(), // Documents don't have CreatedAt field, use current time as fallback
        folderId: item.folderId || undefined,
      }));

      // Combine and sort by creation date (newest first)
      const allSummaries = [
        ...mappedTextSummaries,
        ...mappedFileSummaries,
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setSummaries(allSummaries);
    } catch (error) {
      console.error("Failed to load summaries", error);
    }
  }, [user]);

  // Usage calculations - use backend data for users, frontend for admins
  const usageCost = 10;
  const currentUsage =
    user?.role === "admin" ? user?.usageCount || 0 : backendUsage;
  const limit =
    user?.role === "admin" ? user?.usageLimit || 100 : backendTotalLimit;
  const usagePercentage =
    limit > 0 ? Math.min((currentUsage / limit) * 100, 100) : 0;
  const isLimitReached = currentUsage + usageCost > limit;

  // Load summaries and usage on mount
  useEffect(() => {
    fetchSummaries();
    fetchUsage();
  }, [fetchSummaries, fetchUsage]);
  const handleSummarizeText = async () => {
    if (!textInput.trim() || !user) return;
    if (textInput.length < 50) {
      setError("Text must be at least 50 characters long.");
      return;
    }
    if (isLimitReached) {
      setError("Usage limit reached. Please upgrade to continue.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      // Call backend API to summarize text
      const response = await apiClient.post("/Texts", {
        text: textInput,
      });

      const { summary, documentId } = response.data;

      // Create summary object for immediate display
      const newSummary: Summary = {
        id: documentId,
        userId: user.id,
        userName: user.name,
        type: "text",
        content:
          textInput.substring(0, 50) + (textInput.length > 50 ? "..." : ""),
        summary: summary,
        textName: "text summary",
        createdAt: new Date().toISOString(),
      };

      setCurrentResult(newSummary);
      setCurrentResultFolder(null);
      setShowSaveModal(true);
      setTextInput("");

      // Refresh summaries list and usage from backend
      await fetchSummaries();
      await fetchUsage();
    } catch (error: any) {
      console.error("Summarization failed:", error);
      setError(
        error.response?.data ||
          error.message ||
          "Failed to summarize text. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };
  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;
    if (isLimitReached) {
      setError("Usage limit reached. Please upgrade to continue.");
      return;
    }

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
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > maxSize) {
      setError("File too large. Maximum file size is 5MB.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Call backend API to upload and summarize file
      // Don't set Content-Type header - axios will set it automatically with boundary for FormData
      const response = await apiClient.post("/Documents/upload", formData);

      const { summary, documentId } = response.data;

      // Create summary object for immediate display
      const newSummary: Summary = {
        id: documentId,
        userId: user.id,
        userName: user.name,
        type: "file",
        content: selectedFile.name,
        filename: selectedFile.name,
        summary: summary,
        createdAt: new Date().toISOString(),
      };

      setCurrentResult(newSummary);
      setCurrentResultFolder(null);
      setShowSaveModal(true);
      setSelectedFile(null);

      // Refresh summaries list and usage from backend
      await fetchSummaries();
      await fetchUsage();
    } catch (error: any) {
      console.error("File upload failed:", error);

      // Extract user-friendly error message
      let errorMessage =
        "Failed to upload and summarize file. Please try again.";

      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === "string") {
          // If it's a string, check if it contains the actual error message
          // Backend errors might be in the string format
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
            // Try to extract first line of error message for user-friendly display
            const lines = data.split("\n");
            const firstLine = lines[0]?.trim();
            if (firstLine && firstLine.length < 200) {
              errorMessage = firstLine;
            }
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
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
      a.download = `text-summary-${
        new Date(summary.createdAt).toISOString().split("T")[0]
      }.txt`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreviewSummary = (summary: Summary) => {
    setPreviewSummary(summary);
    setIsPreviewOpen(true);
  };

  const toggleSelectSummary = (id: string) => {
    setSelectedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveSelectedToFolder = async (folderId: string, folderName: string) => {
    const selected = summaries.filter((s) => selectedSummaryIds.has(s.id));
    try {
      for (const s of selected) {
        const endpoint =
          s.type === "text" ? `/Texts/${s.id}` : `/Documents/${s.id}`;
        await apiClient.patch(endpoint, { folderId });
      }
      toast.success(`Moved ${selected.length} to "${folderName}"`);
      setShowMoveModal(false);
      setIsSelectMode(false);
      setSelectedSummaryIds(new Set());
      await fetchSummaries();
      setFoldersRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error("Failed to move summaries");
      console.error(error);
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

  const handleOpenProfileModal = async () => {
    try {
      const response = await apiClient.get("/Users/profile");
      setProfileUsername(response.data.username);
      setProfileEmail(response.data.email);
      setShowProfileModal(true);
    } catch (error) {
      console.error("Failed to load profile", error);
      toast.error("Failed to load profile information");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdatingProfile) return;

    setIsUpdatingProfile(true);

    try {
      await apiClient.put("/Users/profile", {
        username: profileUsername,
      });
      // Update the user context immediately
      updateUsername(profileUsername);
      toast.success("Profile updated successfully!");
      setShowProfileModal(false);
    } catch (error: unknown) {
      let errorMessage = "Failed to update profile. Please try again.";
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
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveToFolder = async (folderId: string, folderName: string) => {
    if (!currentResult) return;

    try {
      // Update the document with the folder ID
      if (currentResult.type === "text") {
        await apiClient.patch(`/Texts/${currentResult.id}`, {
          folderId: folderId,
        });
      } else {
        await apiClient.patch(`/Documents/${currentResult.id}`, {
          folderId: folderId,
        });
      }

      setCurrentResultFolder(folderName);
      setShowSaveModal(false);
      toast.success(`Saved to "${folderName}" folder`);
      await fetchSummaries();
      setFoldersRefreshKey((k) => k + 1);
      // Hide the Summary Ready panel after saving
      setCurrentResult(null);
      setCurrentResultFolder("");
    } catch (error) {
      toast.error("Failed to save to folder");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-blue-600 p-1.5 rounded-lg mr-2">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                Summarize<span className="text-blue-600">AI</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">
                  {user?.name}
                </span>
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  Standard Plan
                </span>
              </div>
              <button
                onClick={handleOpenProfileModal}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit profile"
              >
                <Settings className="h-5 w-5" />
              </button>
              <Button
                variant="ghost"
                onClick={logout}
                className="text-slate-500 hover:text-red-600"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Usage Stats Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                Usage Limit
              </h2>
              <p className="text-sm text-slate-500">
                You have used{" "}
                <span className="font-medium text-slate-900">
                  {currentUsage}
                </span>{" "}
                of <span className="font-medium text-slate-900">{limit}</span>{" "}
                credits
              </p>
            </div>
            <Button
              onClick={() => navigate("/packages")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
            >
              Add more / Upgrade
            </Button>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                {Math.round(usagePercentage)}% Used
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
              <div
                style={{
                  width: `${usagePercentage}%`,
                }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                  usagePercentage > 90 ? "bg-red-500" : "bg-blue-500"
                }`}
              ></div>
            </div>
          </div>

          {isLimitReached && (
            <div className="mt-2 flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-100">
              <AlertCircle className="h-4 w-4 mr-2" />
              You have reached your usage limit. Please upgrade to continue
              generating summaries.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Sidebar: Folders & Summaries */}
          <div className="md:col-span-1 order-2 md:order-1 space-y-6">
            <FolderSidebar
              selectedFolder={
                activeTab === "text" ? selectedFolderText : selectedFolder
              }
              onSelectFolder={
                activeTab === "text" ? setSelectedFolderText : setSelectedFolder
              }
              summaries={summaries}
              onPreviewSummary={handlePreviewSummary}
              onRefresh={() => {
                fetchSummaries();
              }}
              refreshKey={foldersRefreshKey}
            />

            {/* My Summaries */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col max-h-[calc(100vh-8rem)]">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">
                  My Summaries
                </h3>
                <span className="bg-slate-100 text-slate-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                  {summaries.filter((s) => !s.folderId).length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsSelectMode((s) => !s);
                      setSelectedSummaryIds(new Set());
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${
                      isSelectMode
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                    }`}
                  >
                    {isSelectMode ? "Cancel" : "Select"}
                  </button>
                  {isSelectMode && (
                    <button
                      onClick={() => setShowMoveModal(true)}
                      disabled={selectedSummaryIds.size === 0}
                      className={`px-3 py-1.5 text-xs rounded-lg ${
                        selectedSummaryIds.size === 0
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Move to Folder
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {summaries.filter((s) => !s.folderId).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900">
                      No summaries yet
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Your generated summaries will appear here.
                    </p>
                  </div>
                ) : (
                  summaries
                    .filter((s) => !s.folderId)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelectMode) toggleSelectSummary(item.id);
                          else handlePreviewSummary(item);
                        }}
                        className={`group relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                          selectedSummaryIds.has(item.id)
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center flex-1">
                            {isSelectMode && (
                              <span
                                className={`h-5 w-5 mr-2 rounded-full border ${
                                  selectedSummaryIds.has(item.id)
                                    ? "bg-blue-600 border-blue-600"
                                    : "bg-white border-slate-300"
                                } flex items-center justify-center`}
                              >
                                {selectedSummaryIds.has(item.id) ? "✓" : ""}
                              </span>
                            )}
                            <span
                              className={`h-8 w-8 rounded-lg flex items-center justify-center mr-3 ${
                                item.type === "file"
                                  ? "bg-purple-100 text-purple-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {item.type === "file" ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-slate-900 truncate">
                                {item.type === "file"
                                  ? item.filename
                                  : item.textName || "text summary"}
                              </h4>
                              <p className="text-xs text-slate-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(item.createdAt)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadSummary(item);
                            }}
                            className="text-green-600 hover:text-green-700 ml-2"
                            title="Download summary"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 pl-11">
                          {item.summary}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Center: Tools & Results */}
          <div className="md:col-span-2 space-y-6 order-1 md:order-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("text")}
                    disabled={isProcessing}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${
                      activeTab === "text"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border resize-none"
                        placeholder="Enter text to summarize (min 50 characters)..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        disabled={isLimitReached}
                      />
                      <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                        <span>{textInput.length} characters</span>
                        <span>Min 50 required</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleSummarizeText}
                      disabled={
                        textInput.length < 50 || isProcessing || isLimitReached
                      }
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Summarize Text (10 credits)"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative ${
                        isLimitReached
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
                            // Validate file size (5MB limit)
                            const maxSize = 5 * 1024 * 1024;
                            if (file.size > maxSize) {
                              setError(
                                "File too large. Maximum file size is 5MB."
                              );
                              e.target.value = "";
                              return;
                            }
                            // Validate file type
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
                        disabled={isLimitReached || isProcessing}
                      />
                      <div className="flex flex-col items-center">
                        <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
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
                      <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md border border-blue-100">
                        <div className="flex items-center">
                          <FileIcon className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="text-sm text-blue-900 truncate max-w-[200px]">
                            {selectedFile.name}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isProcessing || isLimitReached}
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing File...
                        </>
                      ) : (
                        "Upload & Summarize (10 credits)"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Result Display */}
            {currentResult && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-slate-900 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                    Summary Ready
                  </h3>
                  <span className="text-xs text-slate-500">Just now</span>
                </div>

                {currentResultFolder && (
                  <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <FolderOpen size={16} className="text-blue-600" />
                    <span className="text-sm text-blue-700">
                      Saved in <strong>{currentResultFolder}</strong>
                    </span>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="ml-auto text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-slate-700 leading-relaxed">
                    {currentResult.summary}
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(currentResult.summary);
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                  {!currentResultFolder && (
                    <Button
                      onClick={() => setShowSaveModal(true)}
                      className="flex-1"
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Save to Folder
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-slate-900">
                Edit Profile
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  disabled
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Profile"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Save Location Modal */}
      <SaveLocationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveToFolder}
        summaries={summaries}
      />

      {/* Move to Folder Modal */}
      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={moveSelectedToFolder}
        summaries={summaries}
      />

      {/* Summary Preview Modal */}
      <SummaryPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewSummary(null);
        }}
        summary={previewSummary}
        onDownload={() => {
          if (previewSummary) {
            handleDownloadSummary(previewSummary);
          }
        }}
      />
    </div>
  );
}
