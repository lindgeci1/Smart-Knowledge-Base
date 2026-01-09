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
  X,
  File as FileIcon,
  Loader2,
  Zap,
  AlertCircle,
  Download,
  Settings,
  Grid3x3,
  List,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../lib/authClient";
import { FolderSidebar } from "../components/FolderSidebar";
import { SaveLocationModal } from "../components/SaveLocationModal";
import { SummaryPreviewModal } from "../components/SummaryPreviewModal";
import { generateSummaryPDF } from "../utils/pdfGenerator";
import { ChatInterface } from "../components/ChatInterface";

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
  documentName?: string; // For file type - "File Summary of [keyword]"
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
  // Removed folder banner UI; no need to track saved folder separately
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendUsage, setBackendUsage] = useState<number>(0);
  const [backendTotalLimit, setBackendTotalLimit] = useState<number>(100);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeSettingTab, setActiveSettingTab] = useState<
    "profile" | "appearance"
  >("profile");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [isRefreshingSummaries, setIsRefreshingSummaries] = useState(false);
  const [isSavingToFolder, setIsSavingToFolder] = useState(false);
  const [isMovingToFolder, setIsMovingToFolder] = useState(false);
  const [newlyMovedToFolderIds, setNewlyMovedToFolderIds] = useState<
    Set<string>
  >(new Set());
  const [expandFolderId, setExpandFolderId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("Free Plan");
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

      // Helper function to extract timestamp from MongoDB ObjectId
      const getTimestampFromObjectId = (objectId: string): Date => {
        try {
          const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
          return new Date(timestamp);
        } catch {
          return new Date();
        }
      };

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
        createdAt:
          item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
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
        documentName: item.documentName || null,
        createdAt:
          item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
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

  // Function to fetch current plan
  const fetchCurrentPlan = useCallback(async () => {
    if (!user || user.role === "admin") {
      setCurrentPlan("Admin Plan");
      return;
    }
    try {
      const response = await apiClient.get("/Users/current-plan");
      setCurrentPlan(response.data?.planName || "Free Plan");
    } catch (error) {
      console.error("Failed to load current plan", error);
      setCurrentPlan("Free Plan");
    }
  }, [user]);

  // Load summaries and usage on mount
  useEffect(() => {
    fetchSummaries();
    fetchUsage();
    fetchCurrentPlan();
  }, [fetchSummaries, fetchUsage, fetchCurrentPlan]);

  // Refresh plan when component becomes visible or window gains focus (e.g., after payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCurrentPlan();
      }
    };
    const handleFocus = () => {
      fetchCurrentPlan();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchCurrentPlan]);

  // Initialize theme from localStorage on component mount (per user)
  useEffect(() => {
    if (!user) return;
    const themeKey = `theme_${user.id}`;
    const savedTheme =
      (localStorage.getItem(themeKey) as "light" | "dark" | null) || "light";
    setTheme(savedTheme);

    // Apply theme to document
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [user]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showProfileModal || showMoveModal || showSaveModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showProfileModal, showMoveModal, showSaveModal]);

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

      const { summary, documentId, textName } = response.data;

      // Create summary object for immediate display
      const newSummary: Summary = {
        id: documentId,
        userId: user.id,
        userName: user.name,
        type: "text",
        content:
          textInput.substring(0, 50) + (textInput.length > 50 ? "..." : ""),
        summary: summary,
        textName: textName || null,
        createdAt: new Date().toISOString(),
      };

      setCurrentResult(newSummary);
      // Show helper message with summary name
      const summaryName = textName || `text-summary-${new Date().toISOString().split("T")[0]
        }`;
      setHelperMessage(summaryName);
      // no folder banner UI
      setShowSaveModal(true);
      setTextInput("");

      // Don't auto-add to My Summaries - wait for user choice
      // Refresh usage from backend
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

      const { summary, documentId, documentName } = response.data;

      // Create summary object for immediate display
      const newSummary: Summary = {
        id: documentId,
        userId: user.id,
        userName: user.name,
        type: "file",
        content: selectedFile.name,
        filename: selectedFile.name,
        summary: summary,
        documentName: documentName || null,
        createdAt: new Date().toISOString(),
      };

      setCurrentResult(newSummary);
      // Show helper message with document name
      setHelperMessage(documentName || selectedFile.name.replace(/\.[^/.]+$/, ""));
      // no folder banner UI
      setShowSaveModal(true);
      setSelectedFile(null);

      // Don't auto-add to My Summaries - wait for user choice
      // Refresh usage from backend
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
  const handleDownloadSummary = async (summary: Summary) => {
    // Prevent multiple simultaneous downloads
    if (isDownloading) return;

    setIsDownloading(true);

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
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreviewSummary = (summary: Summary) => {
    setPreviewSummary(summary);
    setIsPreviewOpen(true);
  };

  // Toggle selection for summaries
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
    setIsMovingToFolder(true);
    try {
      for (const s of selected) {
        const endpoint =
          s.type === "text" ? `/Texts/${s.id}` : `/Documents/${s.id}`;
        await apiClient.patch(endpoint, { folderId });
      }

      // Refresh summaries first so the moved summaries appear in the folder
      await fetchSummaries();
      setFoldersRefreshKey((k) => k + 1);

      // Auto-expand the folder and trigger glow for ALL moved summaries
      if (folderId) {
        setExpandFolderId(folderId);
        // Add all moved summary IDs to the glow set
        const summaryIds = new Set(selected.map((s) => s.id));
        setNewlyMovedToFolderIds(summaryIds);
        // Remove glow after 3 seconds
        setTimeout(() => {
          setNewlyMovedToFolderIds(new Set());
          setExpandFolderId(null);
        }, 3000);
      }

      const count = selected.length;
      const label = count === 1 ? "summary" : "summaries";
      toast.success(`Moved ${count} ${label} to "${folderName}"`);
      setShowMoveModal(false);
      setIsSelectMode(false);
      setSelectedSummaryIds(new Set());
    } catch (error) {
      toast.error("Failed to move summaries");
      console.error(error);
    } finally {
      setIsMovingToFolder(false);
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
      if (user) {
        const themeKey = `theme_${user.id}`;
        const savedTheme =
          (localStorage.getItem(themeKey) as "light" | "dark" | null) ||
          "light";
        setTheme(savedTheme);
      }
      setShowProfileModal(true);
    } catch (error) {
      console.error("Failed to load profile", error);
      toast.error("Failed to load profile information");
    }
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout();
    // Reset theme after navigation to prevent visible flash
    document.documentElement.classList.remove("dark");
    navigate("/login");
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
  };

  const applyTheme = (themeToApply: "light" | "dark") => {
    if (!user) return;
    const themeKey = `theme_${user.id}`;
    localStorage.setItem(themeKey, themeToApply);
    // Use requestAnimationFrame for smoother theme transition
    requestAnimationFrame(() => {
      if (themeToApply === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  };

  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isUpdatingProfile) return;

    setIsUpdatingProfile(true);

    try {
      await apiClient.put("/Users/profile", {
        username: profileUsername,
      });

      // Fetch updated profile to get the latest username from database
      const profileResponse = await apiClient.get("/Users/profile");
      const updatedUsername = profileResponse.data?.username || profileUsername;

      // Update the user context with the actual username from database
      updateUsername(updatedUsername);
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

    const savedSummaryId = currentResult.id;
    const savedSummaryLabel =
      currentResult.type === "file"
        ? currentResult.filename || "file"
        : currentResult.textName || "text summary";

    setIsSavingToFolder(true);
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

      await fetchSummaries();
      setFoldersRefreshKey((k) => k + 1);

      if (folderId) {
        setExpandFolderId(folderId);
        setNewlyMovedToFolderIds(new Set([savedSummaryId]));
        setTimeout(() => {
          setNewlyMovedToFolderIds(new Set());
          setExpandFolderId(null);
        }, 3000);
      }

      setShowSaveModal(false);
      setHelperMessage(null);
      toast.success(`Moved "${savedSummaryLabel}" to "${folderName}"`);
      // Hide the Summary Ready panel after saving
      setCurrentResult(null);
    } catch (error) {
      toast.error("Failed to save to folder");
      console.error(error);
    } finally {
      setIsSavingToFolder(false);
    }
  };

  const handleSkipToMySummaries = async () => {
    if (!currentResult) return;

    try {
      setShowSaveModal(false);
      setHelperMessage(null);

      // Add to My Summaries list with pulse animation
      setNewlyAddedId(currentResult.id);
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(async () => {
        await fetchSummaries();
      });

      // Remove pulse animation after 3 seconds
      setTimeout(() => {
        setNewlyAddedId(null);
      }, 3000);

      toast.success("Added to My Summaries");
      setCurrentResult(null);
    } catch (error) {
      toast.error("Failed to add to My Summaries");
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
              <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Summarize<span className="text-blue-600">AI</span>
              </span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">
                  {user?.name}
                </span>
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  {currentPlan}
                </span>
              </div>
              <button
                onClick={handleOpenProfileModal}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit profile"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
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
              <div className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:text-blue-300 dark:bg-blue-900">
                {Math.round(usagePercentage)}% Used
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-slate-500">
              <div
                style={{
                  width: `${usagePercentage}%`,
                }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${usagePercentage > 90
                  ? "bg-red-500 dark:bg-red-400"
                  : "bg-blue-500 dark:bg-blue-400"
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
          {/* Left Sidebar: Folders */}
          <div className="md:col-span-1 space-y-6">
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
              onSummaryMovedToFolder={(summaryId, folderId) => {
                setNewlyMovedToFolderIds(
                  (prev) => new Set([...prev, summaryId])
                );
                // Remove glow after 3 seconds
                setTimeout(() => {
                  setNewlyMovedToFolderIds((prev) => {
                    const next = new Set(prev);
                    next.delete(summaryId);
                    return next;
                  });
                }, 3000);
              }}
              newlyMovedToFolderIds={newlyMovedToFolderIds}
              expandFolderId={expandFolderId}
              enableSelectMove
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          </div>

          {/* Center: Text Summary / File Upload Tools */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("text")}
                    disabled={isProcessing}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${activeTab === "text"
                      ? "text-blue-600 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-900/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      } ${isProcessing
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
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${activeTab === "file"
                      ? "text-blue-600 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-900/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      } ${isProcessing
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
                        maxLength={1000}
                      />
                      <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                        <span>{textInput.length} characters</span>
                        <span>Max 1000 characters</span>
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
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative ${isLimitReached
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
                          className="text-blue-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isProcessing}
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

            {/* Result Display intentionally hidden per design request */}
          </div>

          {/* Right: My Summaries */}
          <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              {/* Title row with view toggle */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    My Summaries
                  </h3>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-0.5 px-2.5 rounded-full text-xs font-medium">
                    {summaries.filter((s) => !s.folderId).length}
                  </span>
                </div>
                {/* Right controls: Refresh + View Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        setIsRefreshingSummaries(true);
                        await fetchSummaries();
                      } finally {
                        setIsRefreshingSummaries(false);
                      }
                    }}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Refresh summaries"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshingSummaries ? "animate-spin" : ""
                        }`}
                    />
                  </button>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === "list"
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      title="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === "grid"
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      title="Card view"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons row */}
              {(isSelectMode ||
                summaries.filter((s) => !s.folderId).length > 0) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setIsSelectMode((s) => !s);
                        setSelectedSummaryIds(new Set());
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isSelectMode
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600"
                        }`}
                    >
                      {isSelectMode ? "Cancel" : "Select"}
                    </button>
                    {isSelectMode && (
                      <>
                        <button
                          onClick={() => {
                            const unselectedInFolder = summaries
                              .filter(
                                (s) =>
                                  !s.folderId && !selectedSummaryIds.has(s.id)
                              )
                              .map((s) => s.id);
                            if (unselectedInFolder.length > 0) {
                              setSelectedSummaryIds(
                                new Set([
                                  ...selectedSummaryIds,
                                  ...unselectedInFolder,
                                ])
                              );
                            } else {
                              setSelectedSummaryIds(new Set());
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          {summaries
                            .filter((s) => !s.folderId)
                            .every((s) => selectedSummaryIds.has(s.id))
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                        <button
                          onClick={() => setShowMoveModal(true)}
                          disabled={selectedSummaryIds.size === 0}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedSummaryIds.size === 0
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                        >
                          Move ({selectedSummaryIds.size})
                        </button>
                        {selectedSummaryIds.size > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium ml-1">
                            {selectedSummaryIds.size} selected
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {summaries.filter((s) => !s.folderId).length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-slate-50 dark:bg-slate-700 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    No summaries yet
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Your generated summaries will appear here.
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <div className="space-y-2">
                  {summaries
                    .filter((s) => !s.folderId)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelectMode) toggleSelectSummary(item.id);
                          else handlePreviewSummary(item);
                        }}
                        className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedSummaryIds.has(item.id)
                          ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
                          } ${newlyAddedId === item.id ? "animate-pulse-soft" : ""
                          }`}
                      >
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedSummaryIds.has(item.id)}
                            onChange={() => toggleSelectSummary(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                          />
                        )}
                        <span
                          className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === "file"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            }`}
                        >
                          {item.type === "file" ? (
                            <FileText className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {item.type === "file"
                              ? item.documentName || item.filename || "File Summary"
                              : item.textName || "text summary"}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.summary}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {summaries
                    .filter((s) => !s.folderId)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelectMode) toggleSelectSummary(item.id);
                          else handlePreviewSummary(item);
                        }}
                        className={`group relative bg-white dark:bg-slate-800 border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer flex flex-col h-full ${
                          selectedSummaryIds.has(item.id)
                          ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        } ${newlyAddedId === item.id ? "animate-pulse-soft" : ""}`}
                      >
                        {isSelectMode && (
                          <div className="absolute top-3 right-3 z-10">
                            <input
                              type="checkbox"
                              checked={selectedSummaryIds.has(item.id)}
                              onChange={() => toggleSelectSummary(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-slate-800"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              item.type === "file"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {item.type === "file" ? (
                              <FileText className="h-5 w-5" />
                            ) : (
                              <MessageSquare className="h-5 w-5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1 pr-6">
                            <h4
                              className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"
                              title={
                                item.type === "file"
                                  ? item.documentName || item.filename
                                  : item.textName
                              }
                            >
                              {item.type === "file"
                                ? item.documentName || item.filename || "File Summary"
                                : item.textName || "text summary"}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 flex-1 leading-relaxed">
                          {item.summary}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col sm:flex-row">
            {/* Left Sidebar */}
            <div className="w-full sm:w-48 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-4 sm:p-6 flex sm:flex-col gap-2 sm:space-y-4 overflow-x-auto sm:overflow-y-auto">
              <button
                onClick={() => setActiveSettingTab("profile")}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeSettingTab === "profile"
                  ? "bg-white text-indigo-600 border border-indigo-200"
                  : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                  }`}
              >
                <span>Profile</span>
              </button>
              <button
                onClick={() => setActiveSettingTab("appearance")}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeSettingTab === "appearance"
                  ? "bg-white text-indigo-600 border border-indigo-200"
                  : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                  }`}
              >
                <span>Appearance</span>
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">Settings</h3>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {/* Profile Section */}
                {activeSettingTab === "profile" && (
                  <div className="space-y-6">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Update Username
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
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
                        <label className="block text-sm font-medium text-slate-700">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          disabled
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Appearance Section */}
                {activeSettingTab === "appearance" && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Theme
                      </h4>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={theme === "light"}
                            onChange={() => handleThemeChange("light")}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-slate-700">Light</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={theme === "dark"}
                            onChange={() => handleThemeChange("dark")}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-slate-700">Dark</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (activeSettingTab === "profile") {
                      await handleUpdateProfile();
                    } else {
                      applyTheme(theme);
                    }
                  }}
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Save Location Modal */}
      <SaveLocationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveToFolder}
        isSaving={isSavingToFolder}
        summaries={summaries}
        helperMessage={helperMessage}
        onSkipToMySummaries={handleSkipToMySummaries}
      />

      {/* Move to Folder Modal */}
      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={moveSelectedToFolder}
        isSaving={isMovingToFolder}
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
        isDownloading={isDownloading}
      />

      {/* New Chat Interface */}
      <ChatInterface />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center px-5 pt-5 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">Logout</h3>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 pb-5">
              <p className="text-sm text-slate-600">
                Are you sure you want to logout? You'll need to sign in again to
                access your account.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
