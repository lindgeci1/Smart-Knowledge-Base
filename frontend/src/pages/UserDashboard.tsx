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
  Settings,
  Grid3x3,
  List,
  RefreshCw,
  Users,
  ChevronRight,
  Sparkles,
  CreditCard
} from "lucide-react";
import { apiClient } from "../lib/authClient";
import { FolderSidebar } from "../components/FolderSidebar";
import { SaveLocationModal } from "../components/SaveLocationModal";
import { SummaryPreviewModal } from "../components/SummaryPreviewModal";
import { ShareModal } from "../components/ShareModal";
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
  sharedBy?: string; // Email of user who shared this document
  isShared?: boolean; // Whether this is a shared document
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDocumentForShare, setSelectedDocumentForShare] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sharedDocuments, setSharedDocuments] = useState<Summary[]>([]);
  const [activeSection, setActiveSection] = useState<"my" | "shared">("my");

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

  // Function to fetch shared documents
  const fetchSharedDocuments = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.get("/Documents/shared");
      const sharedDocs = response.data || [];

      const getTimestampFromObjectId = (objectId: string): Date => {
        try {
          const timestamp = parseInt(objectId.substring(0, 8), 16) * 1000;
          return new Date(timestamp);
        } catch {
          return new Date();
        }
      };

      const mappedSharedDocuments: Summary[] = sharedDocs.map((item: any) => ({
        id: item.id,
        userId: user.id,
        userName: item.sharedBy || "Unknown",
        type: "file" as const,
        content: item.fileName || "",
        filename: item.fileName ? `${item.fileName}.${item.fileType}` : "",
        summary: item.summary || "",
        documentName: item.documentName || null,
        createdAt:
          item.sharedAt || getTimestampFromObjectId(item.id).toISOString(),
        folderId: item.folderId || undefined,
        sharedBy: item.sharedBy,
        isShared: true,
      }));

      setSharedDocuments(mappedSharedDocuments);
    } catch (error) {
      console.error("Failed to load shared documents", error);
      setSharedDocuments([]);
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
    fetchSharedDocuments();
    fetchUsage();
    fetchCurrentPlan();
  }, [fetchSummaries, fetchSharedDocuments, fetchUsage, fetchCurrentPlan]);

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
      const summaryName = textName || `text-summary-${new Date().toISOString().split("T")[0]}`;
      setHelperMessage(summaryName);
      setShowSaveModal(true);
      setTextInput("");
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
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await apiClient.post("/Documents/upload", formData);
      const { summary, documentId, documentName } = response.data;

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
      setHelperMessage(documentName || selectedFile.name.replace(/\.[^/.]+$/, ""));
      setShowSaveModal(true);
      setSelectedFile(null);
      await fetchUsage();
    } catch (error: any) {
      console.error("File upload failed:", error);
      let errorMessage = "Failed to upload and summarize file. Please try again.";
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === "string") {
          if (data.includes("Unsupported file type")) {
            errorMessage = "Unsupported file type. Allowed: PDF, TXT, DOC, DOCX, XLS, XLSX.";
          } else if (data.includes("File too large")) {
            errorMessage = "File too large. Maximum file size is 5MB.";
          } else if (
            data.includes("PDF header not found") ||
            data.includes("IOException")
          ) {
            errorMessage = "Invalid or corrupted PDF file. Please ensure the file is a valid PDF.";
          } else if (data.includes("Summarization failed")) {
            errorMessage = "Failed to generate summary. Please try again with a different file.";
          } else {
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
    if (isDownloading) return;
    setIsDownloading(true);

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
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreviewSummary = (summary: Summary) => {
    setPreviewSummary(summary);
    setIsPreviewOpen(true);
  };

  const handleShareDocument = (summary: Summary) => {
    if (summary.type !== "file") return;
    const documentName = summary.documentName || summary.filename || "Document";
    setSelectedDocumentForShare({ id: summary.id, name: documentName });
    setShowShareModal(true);
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
    setIsMovingToFolder(true);
    try {
      for (const s of selected) {
        const endpoint =
          s.type === "text" ? `/Texts/${s.id}` : `/Documents/${s.id}`;
        await apiClient.patch(endpoint, { folderId });
      }

      await fetchSummaries();
      setFoldersRefreshKey((k) => k + 1);

      if (folderId) {
        setExpandFolderId(folderId);
        const summaryIds = new Set(selected.map((s) => s.id));
        setNewlyMovedToFolderIds(summaryIds);
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

      const profileResponse = await apiClient.get("/Users/profile");
      const updatedUsername = profileResponse.data?.username || profileUsername;

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

      setNewlyAddedId(currentResult.id);
      requestAnimationFrame(async () => {
        await fetchSummaries();
      });

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Summarize<span className="text-indigo-600 dark:text-indigo-400">AI</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user?.name}
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {currentPlan}
                </span>
              </div>
              <button
                onClick={handleOpenProfileModal}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all duration-200"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your documents and generate new insights.</p>
          </div>
        </div>

        {/* Usage Stats Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap className="h-32 w-32 text-indigo-600 dark:text-indigo-400" />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-6 relative z-10">
            <div className="w-full sm:max-w-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                  Credits & Usage
                </h2>
              </div>
              
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{currentUsage}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400 mb-1.5">/ {limit} credits used</span>
              </div>

              <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  style={{ width: `${usagePercentage}%` }}
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
                    isLimitReached ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                />
              </div>
            </div>

            <Button
              onClick={() => navigate("/packages")}
              className="w-full sm:w-auto bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-700 border-0 shadow-lg shadow-indigo-500/20"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
          
          {isLimitReached && (
             <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Limit reached.</span> Please upgrade to continue generating summaries.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sidebar: Folders */}
          <div className="lg:col-span-3 space-y-6">
            <FolderSidebar
              selectedFolder={
                activeTab === "text" ? selectedFolderText : selectedFolder
              }
              onSelectFolder={
                activeTab === "text" ? setSelectedFolderText : setSelectedFolder
              }
              summaries={summaries}
              onPreviewSummary={handlePreviewSummary}
              onRefresh={() => fetchSummaries()}
              refreshKey={foldersRefreshKey}
              onSummaryMovedToFolder={(summaryId, folderId) => {
                setNewlyMovedToFolderIds((prev) => new Set([...prev, summaryId]));
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

          {/* Center: Tools */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 pb-0">
                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl mb-6">
                  <button
                    onClick={() => setActiveTab("text")}
                    disabled={isProcessing}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                      activeTab === "text"
                        ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Text Input
                  </button>
                  <button
                    onClick={() => setActiveTab("file")}
                    disabled={isProcessing}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                      activeTab === "file"
                        ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Upload className="h-4 w-4" />
                    File Upload
                  </button>
                </div>
              </div>

              <div className="px-6 pb-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30 flex items-center animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {activeTab === "text" ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative">
                      <textarea
                        rows={8}
                        className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shadow-inner focus:border-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm p-4 resize-none transition-all placeholder:text-slate-400"
                        placeholder="Paste your text here to summarize..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        disabled={isLimitReached}
                        maxLength={1000}
                      />
                      <div className="absolute bottom-3 right-3 text-xs font-medium text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-md backdrop-blur-sm">
                        {textInput.length} / 1000
                      </div>
                    </div>
                    <Button
                      onClick={handleSummarizeText}
                      disabled={textInput.length < 50 || isProcessing || isLimitReached}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-none h-11"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Summarize Text (10 credits)
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 relative group ${
                        isLimitReached
                          ? "border-slate-200 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed"
                          : "border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                      }`}
                    >
                      <input
                        type="file"
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
                            const allowedExtensions = [".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx"];
                            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
                            if (!allowedExtensions.includes(fileExtension)) {
                              setError("Unsupported file type.");
                              e.target.value = "";
                              return;
                            }
                            setError(null);
                          }
                          setSelectedFile(file);
                        }}
                        disabled={isLimitReached || isProcessing}
                      />
                      <div className="flex flex-col items-center pointer-events-none">
                        <div className="h-14 w-14 bg-white dark:bg-slate-700 shadow-sm rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                          {selectedFile ? (
                             <FileText className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                             <Upload className="h-7 w-7 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1">
                          {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedFile 
                            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                            : "PDF, TXT, DOCX up to 5MB"
                          }
                        </p>
                      </div>
                    </div>

                    {selectedFile && (
                      <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center flex-shrink-0">
                               <FileIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate font-medium">
                               {selectedFile.name}
                            </span>
                         </div>
                         <button
                            onClick={() => setSelectedFile(null)}
                            disabled={isProcessing}
                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-600"
                         >
                            <X className="h-4 w-4" />
                         </button>
                      </div>
                    )}

                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isProcessing || isLimitReached}
                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Upload & Summarize"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Lists */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-[450px] overflow-hidden">
             {/* Header */}
             <div className="border-b border-slate-100 dark:border-slate-700/50">
               <div className="flex p-2 gap-1">
                 <button
                    onClick={() => setActiveSection("my")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeSection === "my"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                 >
                    My Summaries
                    <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                       {summaries.filter(s => !s.folderId).length}
                    </span>
                 </button>
                 <button
                    onClick={() => setActiveSection("shared")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeSection === "shared"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                 >
                    Shared
                    <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                       {sharedDocuments.length}
                    </span>
                 </button>
               </div>
               
               <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-1">
                     <button
                       onClick={() => setViewMode("list")}
                       className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600"}`}
                     >
                        <List className="h-4 w-4" />
                     </button>
                     <button
                       onClick={() => setViewMode("grid")}
                       className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600"}`}
                     >
                        <Grid3x3 className="h-4 w-4" />
                     </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     {activeSection === "my" && (
                        <button
                          onClick={() => {
                             setIsSelectMode(!isSelectMode);
                             setSelectedSummaryIds(new Set());
                          }}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                             isSelectMode ? "text-red-600 bg-red-50" : "text-indigo-600 hover:bg-indigo-50"
                          }`}
                        >
                           {isSelectMode ? "Cancel" : "Select"}
                        </button>
                     )}
                     <button
                        onClick={async () => {
                           setIsRefreshingSummaries(true);
                           if (activeSection === "my") await fetchSummaries();
                           else await fetchSharedDocuments();
                           setIsRefreshingSummaries(false);
                        }}
                        className={`p-1.5 text-slate-400 hover:text-indigo-600 transition-colors ${isRefreshingSummaries ? "animate-spin" : ""}`}
                     >
                        <RefreshCw className="h-4 w-4" />
                     </button>
                  </div>
               </div>
               
               {isSelectMode && activeSection === "my" && (
                  <div className="px-4 pb-3 flex items-center gap-2 animate-in slide-in-from-top-2">
                     <button
                        onClick={() => setShowMoveModal(true)}
                        disabled={selectedSummaryIds.size === 0}
                        className="flex-1 bg-indigo-600 text-white text-xs font-medium py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                        Move Selected ({selectedSummaryIds.size})
                     </button>
                     <button
                        onClick={() => {
                           const visibleIds = summaries.filter(s => !s.folderId).map(s => s.id);
                           const allSelected = visibleIds.every(id => selectedSummaryIds.has(id));
                           if (allSelected) setSelectedSummaryIds(new Set());
                           else setSelectedSummaryIds(new Set(visibleIds));
                        }}
                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                     >
                        All
                     </button>
                  </div>
               )}
             </div>

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Content Logic matching original but with styled components */}
                {activeSection === "shared" ? (
                   sharedDocuments.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                         <Users className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                         <p className="text-sm text-slate-500">No shared documents</p>
                      </div>
                   ) : viewMode === "list" ? (
                      <div className="space-y-2">
                         {sharedDocuments.map(item => (
                            <div key={item.id} onClick={() => handlePreviewSummary(item)} className="group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-all">
                               <div className="mt-1 h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 text-purple-600 dark:text-purple-400">
                                  <FileText className="h-4 w-4" />
                               </div>
                               <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.documentName || "File Summary"}</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">By {item.sharedBy}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{item.summary}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 gap-3">
                         {sharedDocuments.map(item => (
                            <div key={item.id} onClick={() => handlePreviewSummary(item)} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md cursor-pointer transition-all">
                               <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-purple-600" />
                                  <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded font-medium">Shared</span>
                               </div>
                               <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">{item.documentName}</h4>
                               <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">{item.summary}</p>
                            </div>
                         ))}
                      </div>
                   )
                ) : (
                   /* My Summaries Logic */
                   summaries.filter(s => !s.folderId).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                         <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-full mb-3">
                            <Clock className="h-6 w-6 text-slate-400" />
                         </div>
                         <p className="text-sm font-medium text-slate-900 dark:text-white">No summaries yet</p>
                         <p className="text-xs text-slate-500 mt-1 max-w-[150px]">Your generated content will appear here</p>
                      </div>
                   ) : viewMode === "list" ? (
                      <div className="space-y-2">
                         {summaries.filter(s => !s.folderId).map(item => (
                            <div
                               key={item.id}
                               onClick={() => isSelectMode ? toggleSelectSummary(item.id) : handlePreviewSummary(item)}
                               className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                  selectedSummaryIds.has(item.id)
                                  ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
                                  : "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                               } ${newlyAddedId === item.id ? "ring-2 ring-green-500 ring-offset-2" : ""}`}
                            >
                               {isSelectMode && (
                                  <div className="absolute top-3 right-3">
                                     <div className={`h-4 w-4 rounded border flex items-center justify-center ${
                                        selectedSummaryIds.has(item.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
                                     }`}>
                                        {selectedSummaryIds.has(item.id) && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                                     </div>
                                  </div>
                               )}
                               <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  item.type === 'file' 
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                               }`}>
                                  {item.type === 'file' ? <FileText className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                               </div>
                               <div className="flex-1 min-w-0 pr-6">
                                  <div className="flex justify-between items-start">
                                     <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {item.type === "file" ? item.documentName || item.filename : item.textName}
                                     </h4>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center">
                                     {formatDate(item.createdAt)}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed opacity-90">
                                     {item.summary}
                                  </p>
                               </div>
                               {!isSelectMode && <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 absolute right-3 top-1/2 -translate-y-1/2 transition-opacity" />}
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 gap-3">
                         {summaries.filter(s => !s.folderId).map(item => (
                            <div
                               key={item.id}
                               onClick={() => isSelectMode ? toggleSelectSummary(item.id) : handlePreviewSummary(item)}
                               className={`relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                                  selectedSummaryIds.has(item.id)
                                  ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-400"
                                  : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800"
                               }`}
                            >
                               {isSelectMode && (
                                  <div className={`absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                     selectedSummaryIds.has(item.id) ? "border-indigo-600 bg-indigo-600" : "border-slate-200"
                                  }`}>
                                     {selectedSummaryIds.has(item.id) && <div className="h-2 w-2 bg-white rounded-full" />}
                                  </div>
                               )}
                               <div className="flex items-center gap-2 mb-2">
                                  <span className={`h-6 w-6 rounded flex items-center justify-center ${
                                     item.type === 'file' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                  }`}>
                                     {item.type === 'file' ? <FileText className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{formatDate(item.createdAt)}</span>
                                </div>
                               <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                                  {item.type === "file" ? item.documentName || item.filename : item.textName}
                               </h4>
                               <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                  {item.summary}
                               </p>
                            </div>
                         ))}
                      </div>
                   )
                )}
             </div>
          </div>
        </div>
      </main>

      {/* Modals remain mostly unchanged in structure but inherit base styles */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col sm:flex-row border border-slate-200 dark:border-slate-700">
            {/* Left Sidebar */}
            <div className="w-full sm:w-56 bg-slate-50 dark:bg-slate-900/50 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-700 p-4 sm:p-6 flex sm:flex-col gap-2">
              <button
                onClick={() => setActiveSettingTab("profile")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeSettingTab === "profile"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50"
                  }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveSettingTab("appearance")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeSettingTab === "appearance"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50"
                  }`}
              >
                Appearance
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h3>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {activeSettingTab === "profile" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs">
                      Personal Information
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Username
                        </label>
                        <input
                          type="text"
                          value={profileUsername}
                          onChange={(e) => setProfileUsername(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          disabled
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingTab === "appearance" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Interface Theme
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div 
                           onClick={() => handleThemeChange("light")}
                           className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${
                              theme === 'light' 
                              ? 'border-indigo-600 bg-indigo-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                           }`}
                        >
                           <div className="h-20 w-full bg-slate-100 rounded-lg shadow-sm border border-slate-200" />
                           <span className={`text-sm font-medium ${theme === 'light' ? 'text-indigo-700' : 'text-slate-600'}`}>Light Mode</span>
                        </div>
                        <div 
                           onClick={() => handleThemeChange("dark")}
                           className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${
                              theme === 'dark' 
                              ? 'border-indigo-600 bg-indigo-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                           }`}
                        >
                           <div className="h-20 w-full bg-slate-800 rounded-lg shadow-sm border border-slate-700" />
                           <span className={`text-sm font-medium ${theme === 'dark' ? 'text-indigo-700' : 'text-slate-600'}`}>Dark Mode</span>
                        </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900/30 flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
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
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center shadow-md shadow-indigo-200 dark:shadow-none transition-all"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
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

      <SaveLocationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveToFolder}
        isSaving={isSavingToFolder}
        summaries={summaries}
        helperMessage={helperMessage}
        onSkipToMySummaries={handleSkipToMySummaries}
      />

      <SaveLocationModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onSave={moveSelectedToFolder}
        isSaving={isMovingToFolder}
        summaries={summaries}
      />

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
        onShare={() => {
          if (previewSummary) {
            setIsPreviewOpen(false);
            setPreviewSummary(null);
            handleShareDocument(previewSummary);
          }
        }}
      />

      {selectedDocumentForShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedDocumentForShare(null);
          }}
          documentId={selectedDocumentForShare.id}
          documentName={selectedDocumentForShare.name}
          currentUserEmail={user?.email}
        />
      )}

      <ChatInterface />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-700">
            <div className="text-center mb-6">
              <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <LogOut className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirm Logout</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to end your session? You will need to sign in again.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 dark:shadow-none"
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