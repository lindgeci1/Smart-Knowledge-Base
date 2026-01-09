import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import {
  Menu,
  X,
  Bot,
  SquarePen,
  Trash2,
  Lock,
  ChevronDown,
  Send,
  Loader2,
  MessageSquare,
  FileText,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { DashboardSection } from "../components/admin/DashboardSection";
import { UsersSection } from "../components/admin/UsersSection";
import { FilesSection } from "../components/admin/FilesSection";
import { TextSection } from "../components/admin/TextSection";
import { SummarizeSection } from "../components/admin/SummarizeSection";
import { PackagesSection } from "../components/admin/PackagesSection";
import { PaymentsSection } from "../components/admin/PaymentsSection";
import { FoldersSection } from "../components/admin/FoldersSection";
import { ActivationRequestsSection } from "../components/admin/ActivationRequestsSection";
import { apiClient } from "../lib/authClient";
// Types
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
interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  joinedAt: string;
}
interface UserUsage {
  userId: string;
  count: number;
  percentage: number;
  totalLimit?: number;
  userEmail?: string;
  userName?: string;
}
interface PackageData {
  id?: string;
  name: string;
  description: string;
  price: number;
  priceType: string;
  summaryLimit: number | null;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
interface PaymentData {
  userId: string;
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  status: string;
  declineReason?: string;
  paymentMethod: string;
  billingEmail?: string;
  billingName?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  createdAt: string;
  paidAt?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isNew?: boolean;
}

interface ChatSession {
  chatId: string;
  title: string;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
}

const Typewriter = ({ text }: { text: string }) => {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplay((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 15); // Speed of typing
    return () => clearInterval(timer);
  }, [text]);

  return <>{display}</>;
};

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract section from pathname
  const getActiveViewFromPath = ():
    | "dashboard"
    | "users"
    | "files"
    | "text"
    | "summarize"
    | "packages"
    | "payments"
    | "folders"
    | "activations" => {
    const path = location.pathname;
    if (path === "/admin") return "dashboard";
    if (path === "/admin/users") return "users";
    if (path === "/admin/files") return "files";
    if (path === "/admin/text") return "text";
    if (path === "/admin/summarize") return "summarize";
    if (path === "/admin/packages") return "packages";
    if (path === "/admin/payments") return "payments";
    if (path === "/admin/folders") return "folders";
    if (path === "/admin/activations") return "activations";
    return "dashboard";
  };

  const activeView = getActiveViewFromPath();
  const [users, setUsers] = useState<UserData[]>([]);
  const [files, setFiles] = useState<Summary[]>([]);
  const [texts, setTexts] = useState<Summary[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [activationRequests, setActivationRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [textCount, setTextCount] = useState(0);
  const [avgUsage, setAvgUsage] = useState(0);
  const [usersUsage, setUsersUsage] = useState<
    Map<
      string,
      {
        overallUsage: number;
        totalLimit: number;
        userEmail?: string;
        userName?: string;
      }
    >
  >(new Map());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatDocumentId, setSelectedChatDocumentId] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mySummaries, setMySummaries] = useState<Summary[]>([]);
  const [isRefreshingChats, setIsRefreshingChats] = useState(false);

  // Lazy loading states per tab
  const [loadingStates, setLoadingStates] = useState<{
    users: { loading: boolean; hasData: boolean };
    files: { loading: boolean; hasData: boolean };
    text: { loading: boolean; hasData: boolean };
    packages: { loading: boolean; hasData: boolean };
    payments: { loading: boolean; hasData: boolean };
    folders: { loading: boolean; hasData: boolean };
    activations: { loading: boolean; hasData: boolean };
  }>({
    users: { loading: false, hasData: false },
    files: { loading: false, hasData: false },
    text: { loading: false, hasData: false },
    packages: { loading: false, hasData: false },
    payments: { loading: false, hasData: false },
    folders: { loading: false, hasData: false },
    activations: { loading: false, hasData: false },
  });

  // Fetch users usage from backend
  const fetchUsersUsage = async () => {
    try {
      const response = await apiClient.get("/Users/admin/usage");
      const usageData = response.data || [];
      const usageMap = new Map<
        string,
        {
          overallUsage: number;
          totalLimit: number;
          userEmail?: string;
          userName?: string;
        }
      >();

      usageData.forEach(
        (item: {
          userId: string;
          overallUsage: number;
          totalLimit: number;
          userEmail?: string;
          userName?: string;
        }) => {
          usageMap.set(item.userId, {
            overallUsage: item.overallUsage,
            totalLimit: item.totalLimit,
            userEmail: item.userEmail,
            userName: item.userName,
          });
        }
      );

      setUsersUsage(usageMap);
    } catch (error) {
      console.error("Error fetching users usage", error);
      setUsersUsage(new Map());
    }
  };

  // Calculate usage statistics per user from backend
  const userUsageMap = useMemo(() => {
    const usageMap = new Map<string, UserUsage>();

    // Use backend usage data
    usersUsage.forEach((usage, userId) => {
      const percentage =
        usage.totalLimit > 0
          ? Math.min((usage.overallUsage / usage.totalLimit) * 100, 100)
          : 0;
      usageMap.set(userId, {
        userId,
        count: usage.overallUsage,
        percentage: Math.round(percentage),
        userEmail: usage.userEmail,
        userName: usage.userName,
      });
    });

    return usageMap;
  }, [usersUsage]);
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      // Fetch total users count from API
      try {
        const response = await apiClient.get("/Users/admin/total-users");
        setTotalUsers(response.data.count || 0);
      } catch (error) {
        console.error("Error loading total users", error);
      }

      // Fetch file summaries count from API
      try {
        const response = await apiClient.get("/Documents/admin/count");
        setFileCount(response.data.count || 0);
      } catch (error) {
        console.error("Error loading file summaries count", error);
      }

      // Fetch text summaries count from API
      try {
        const response = await apiClient.get("/Texts/admin/count");
        setTextCount(response.data.count || 0);
      } catch (error) {
        console.error("Error loading text summaries count", error);
      }

      // Fetch average usage percentage from API
      try {
        const response = await apiClient.get("/Users/admin/avg-usage");
        setAvgUsage(response.data.averagePercentage || 0);
      } catch (error) {
        console.error("Error loading average usage", error);
      }

      // Fetch users usage from backend
      await fetchUsersUsage();

      setIsLoading(false);
    };
    loadData();
  }, [user]);

  // Fetch my summaries for chat context
  const fetchMySummaries = async () => {
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

      const mappedTextSummaries: Summary[] = textSummaries.map((item: any) => ({
        id: item.id,
        userId: user?.id || "",
        userName: user?.name || "",
        type: "text",
        content: item.text || "",
        summary: item.summary || "",
        textName: item.textName || "text summary",
        createdAt: item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
        folderId: item.folderId || undefined,
      }));

      const mappedFileSummaries: Summary[] = fileSummaries.map((item: any) => ({
        id: item.id,
        userId: user?.id || "",
        userName: user?.name || "",
        type: "file",
        content: item.fileName || "",
        filename: item.fileName ? `${item.fileName}.${item.fileType}` : "",
        summary: item.summary || "",
        documentName: item.documentName || null,
        createdAt: item.createdAt || getTimestampFromObjectId(item.id).toISOString(),
        folderId: item.folderId || undefined,
      }));

      const allSummaries = [...mappedTextSummaries, ...mappedFileSummaries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setMySummaries(allSummaries);
    } catch (error) {
      console.error("Failed to load my summaries", error);
    }
  };

  useEffect(() => {
    if (activeView === "summarize") {
      fetchMySummaries();
    }
  }, [activeView]);

  // Chat Functions
  const fetchChatSessions = async () => {
    setIsRefreshingChats(true);
    try {
      const response = await apiClient.get("/Chat/GetAllChats");
      setChatSessions(response.data);
    } catch (error) {
      console.error("Failed to fetch chat sessions", error);
    } finally {
      setIsRefreshingChats(false);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await apiClient.post("/Chat/CreateChat", {
        title: "New Chat",
      });
      const newSession = response.data;
      setChatSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.chatId || newSession.ChatId);
      setChatMessages([]);
      setSelectedChatDocumentId("");
      setIsChatSidebarOpen(false);
    } catch (error) {
      toast.error("Failed to create new chat");
    }
  };

  const loadChatSession = async (sessionId: string) => {
    try {
      setCurrentSessionId(sessionId);
      const response = await apiClient.get(`/Chat/GetAllMessages/${sessionId}`);
      setChatMessages(response.data);

      const session = chatSessions.find((s) => s.chatId === sessionId);
      setSelectedChatDocumentId(session?.documentId || "");
      setIsChatSidebarOpen(false);
    } catch (error) {
      toast.error("Failed to load chat messages");
    }
  };

  const initiateDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      await apiClient.delete(`/Chat/DeleteChat/${chatToDelete}`);
      setChatSessions((prev) => prev.filter((c) => c.chatId !== chatToDelete));
      if (currentSessionId === chatToDelete) {
        setCurrentSessionId(null);
        setChatMessages([]);
        setSelectedChatDocumentId("");
      }
      toast.success("Chat deleted");
    } catch (error) {
      toast.error("Failed to delete chat");
    } finally {
      setChatToDelete(null);
    }
  };

  useEffect(() => {
    if (isChatOpen) {
      fetchChatSessions();
    }
  }, [isChatOpen]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentSessionId) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await apiClient.post(
        `/Chat/CreateMessage/${currentSessionId}`,
        {
          message: userMsg,
          documentId: selectedChatDocumentId || null,
        }
      );

      setChatMessages((prev) => [...prev, { ...response.data, isNew: true }]);

      const currentSession = chatSessions.find(
        (c) => c.chatId === currentSessionId
      );
      if (
        currentSession?.title === "New Chat" ||
        (!currentSession?.documentId && selectedChatDocumentId)
      ) {
        fetchChatSessions();
        if (!currentSession?.documentId && selectedChatDocumentId) {
          setChatSessions((prev) =>
            prev.map((s) =>
              s.chatId === currentSessionId
                ? { ...s, documentId: selectedChatDocumentId }
                : s
            )
          );
        }
      }
    } catch (error) {
      toast.error("Failed to get response");
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
    setChatMessages((prev) => prev.map((msg) => ({ ...msg, isNew: false })));
  };

  // Trigger lazy loading when URL section changes
  useEffect(() => {
    if (
      activeView === "users" &&
      !loadingStates.users.hasData &&
      !loadingStates.users.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        users: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "files" &&
      !loadingStates.files.hasData &&
      !loadingStates.files.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        files: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "text" &&
      !loadingStates.text.hasData &&
      !loadingStates.text.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        text: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "packages" &&
      !loadingStates.packages.hasData &&
      !loadingStates.packages.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        packages: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "payments" &&
      !loadingStates.payments.hasData &&
      !loadingStates.payments.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        payments: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "folders" &&
      !loadingStates.folders.hasData &&
      !loadingStates.folders.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        folders: { loading: true, hasData: false },
      }));
    } else if (
      activeView === "activations" &&
      !loadingStates.activations.hasData &&
      !loadingStates.activations.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        activations: { loading: true, hasData: false },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Handle tab change with lazy loading and navigation
  const handleTabChange = (
    view:
      | "dashboard"
      | "users"
      | "files"
      | "text"
      | "summarize"
      | "packages"
      | "payments"
      | "folders"
      | "activations"
    ) => {
    // Navigate to the appropriate route
    if (view === "dashboard") {
      navigate("/admin");
    } else {
      navigate(`/admin/${view}`);
    }

    // Only trigger lazy loading for data tabs (not dashboard or summarize) if not loaded before
    if (
      view === "users" &&
      !loadingStates.users.hasData &&
      !loadingStates.users.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        users: { loading: true, hasData: false },
      }));
    } else if (
      view === "files" &&
      !loadingStates.files.hasData &&
      !loadingStates.files.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        files: { loading: true, hasData: false },
      }));
    } else if (
      view === "text" &&
      !loadingStates.text.hasData &&
      !loadingStates.text.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        text: { loading: true, hasData: false },
      }));
    } else if (
      view === "packages" &&
      !loadingStates.packages.hasData &&
      !loadingStates.packages.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        packages: { loading: true, hasData: false },
      }));
    } else if (
      view === "payments" &&
      !loadingStates.payments.hasData &&
      !loadingStates.payments.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        payments: { loading: true, hasData: false },
      }));
    } else if (
      view === "folders" &&
      !loadingStates.folders.hasData &&
      !loadingStates.folders.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        folders: { loading: true, hasData: false },
      }));
    } else if (
      view === "activations" &&
      !loadingStates.activations.hasData &&
      !loadingStates.activations.loading
    ) {
      setLoadingStates((prev) => ({
        ...prev,
        activations: { loading: true, hasData: false },
      }));
    }
  };

  const handleLogoutConfirm = async () => {
    await logout();
    // Reset theme after navigation to prevent visible flash
    document.documentElement.classList.remove("dark");
    navigate("/login");
  };

  const getUserUsage = (userId: string): UserUsage => {
    const usage = userUsageMap.get(userId);
    const backendUsage = usersUsage.get(userId);

    if (usage && backendUsage) {
      return {
        ...usage,
        totalLimit: backendUsage.totalLimit,
      };
    }

    return {
      userId,
      count: 0,
      percentage: 0,
      totalLimit: 100,
    };
  };
  const getUsageColor = (percentage: number): string => {
    if (percentage >= 80) return "bg-red-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
        aria-label="Toggle menu"
      >
        {isSidebarOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        activeView={activeView}
        setActiveView={(view) => {
          handleTabChange(view);
          setIsSidebarOpen(false); // Close sidebar on mobile after navigation
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <div className="flex-1 md:ml-64 w-full">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pt-16 md:pt-8">
          {activeView === "dashboard" && (
            <DashboardSection
              stats={{
                users: totalUsers,
                files: fileCount,
                texts: textCount,
                avgUsage: avgUsage,
              }}
              userUsageMap={userUsageMap}
              onRefresh={async () => {
                // Refresh all dashboard data
                try {
                  const response = await apiClient.get(
                    "/Users/admin/total-users"
                  );
                  setTotalUsers(response.data.count || 0);
                } catch (error) {
                  console.error("Error loading total users", error);
                }

                // Refresh file summaries count
                try {
                  const response = await apiClient.get(
                    "/Documents/admin/count"
                  );
                  setFileCount(response.data.count || 0);
                } catch (error) {
                  console.error("Error loading file summaries count", error);
                }

                // Refresh text summaries count
                try {
                  const response = await apiClient.get("/Texts/admin/count");
                  setTextCount(response.data.count || 0);
                } catch (error) {
                  console.error("Error loading text summaries count", error);
                }

                // Refresh average usage percentage
                try {
                  const response = await apiClient.get(
                    "/Users/admin/avg-usage"
                  );
                  setAvgUsage(response.data.averagePercentage || 0);
                } catch (error) {
                  console.error("Error loading average usage", error);
                }

                await fetchUsersUsage();
              }}
            />
          )}

          {activeView === "summarize" && (
            <>
              <SummarizeSection />
              {/* Chat Button */}
              <div className="fixed bottom-8 right-8 z-40">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                >
                  <Bot size={24} />
                  <span className="font-medium hidden sm:inline">Chat with AI</span>
                </button>
              </div>

              {/* Chat Modal */}
              {isChatOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-lg shadow-xl overflow-hidden flex h-[85vh] border border-slate-200 dark:border-slate-800 relative">
                    {/* Mobile Sidebar Overlay */}
                    {isChatSidebarOpen && (
                      <div
                        className="absolute inset-0 bg-black/20 z-20 md:hidden"
                        onClick={() => setIsChatSidebarOpen(false)}
                      />
                    )}

                    {/* Left Sidebar: Chat History */}
                    <div
                      className={`absolute md:relative z-30 h-full w-[85%] sm:w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out ${
                        isChatSidebarOpen
                          ? "translate-x-0 shadow-2xl"
                          : "-translate-x-full md:translate-x-0"
                      }`}
                    >
                      <div className="pl-5 pr-3 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 gap-3">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                          Conversations
                        </h3>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={createNewChat}
                            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                            title="New Chat"
                          >
                            <SquarePen size={16} />
                          </button>
                          <button
                            onClick={fetchChatSessions}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Refresh conversations"
                          >
                            <RefreshCw size={16} className={isRefreshingChats ? "animate-spin" : ""} />
                          </button>
                        
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {chatSessions.map((session) => (
                          <button
                            key={session.chatId}
                            onClick={() => loadChatSession(session.chatId || "")}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex justify-between items-center group border ${
                              currentSessionId === session.chatId
                                ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-medium"
                                : "bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                            }`}
                          >
                            <span className="truncate flex-1 pr-2">
                              {session.title}
                            </span>
                            <span
                              onClick={(e) =>
                                initiateDeleteChat(session.chatId || "", e)
                              }
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded transition-all"
                              title="Delete chat"
                            >
                              <Trash2 size={13} />
                            </span>
                          </button>
                        ))}
                        {chatSessions.length === 0 && (
                          <div className="text-center py-12 text-sm text-slate-400 italic">
                            No conversations yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Main Chat Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Header with Document Selector */}
                      <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-3xl">
                          <button
                            onClick={() => setIsChatSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-md transition-colors"
                          >
                            <Menu size={20} />
                          </button>

                          <div className="flex-1 max-w-[160px] sm:max-w-md flex flex-col min-w-0 relative">
                            <div className="relative group">
                              <button
                                onClick={() => {
                                  if (
                                    !(
                                      !currentSessionId ||
                                      !!chatSessions.find(
                                        (s) => s.chatId === currentSessionId
                                      )?.documentId
                                    )
                                  ) {
                                    setIsDropdownOpen(!isDropdownOpen);
                                  }
                                }}
                                className={`w-full text-left pl-3 pr-8 py-1.5 text-sm border rounded-md outline-none transition-all truncate flex items-center ${
                                  !currentSessionId ||
                                  !!chatSessions.find(
                                    (s) => s.chatId === currentSessionId
                                  )?.documentId
                                    ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 font-medium cursor-not-allowed"
                                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer"
                                }`}
                              >
                                <span className="truncate block w-full flex items-center gap-2">
                                  {selectedChatDocumentId
                                    ? (() => {
                                        const s = mySummaries.find(
                                          (s) => s.id === selectedChatDocumentId
                                        );
                                        return s ? (
                                          <>
                                            {s.type === "file" ? (
                                              <FileText
                                                size={14}
                                                className="text-purple-500 flex-shrink-0"
                                              />
                                            ) : (
                                              <MessageSquare
                                                size={14}
                                                className="text-blue-500 flex-shrink-0"
                                              />
                                            )}
                                            <span className="truncate">
                                              {s.type === "file"
                                                ? s.filename
                                                : s.textName || "Text Summary"}
                                            </span>
                                          </>
                                        ) : (
                                          "Select a document..."
                                        );
                                      })()
                                    : "Select a document to start chat..."}
                                </span>
                              </button>

                              {isDropdownOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsDropdownOpen(false)}
                                  />
                                  <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                                    <button
                                      onClick={() => {
                                        setSelectedChatDocumentId("");
                                        setIsDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700/50"
                                    >
                                      General Chat (No Document Context)
                                    </button>
                                    {mySummaries.map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => {
                                          setSelectedChatDocumentId(s.id);
                                          setIsDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2 truncate"
                                      >
                                        {s.type === "file" ? (
                                          <FileText
                                            size={14}
                                            className="text-purple-500 flex-shrink-0"
                                          />
                                        ) : (
                                          <MessageSquare
                                            size={14}
                                            className="text-blue-500 flex-shrink-0"
                                          />
                                        )}
                                        <span className="truncate">
                                          {s.type === "file"
                                            ? s.filename
                                            : s.textName || "Text Summary"}
                                        </span>
                                      </button>
                                    ))}
                                    {mySummaries.length === 0 && (
                                      <div className="px-3 py-2 text-sm text-slate-400 italic text-center">
                                        No documents found
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                {!!chatSessions.find(
                                  (s) => s.chatId === currentSessionId
                                )?.documentId ? (
                                  <Lock size={12} />
                                ) : (
                                  <ChevronDown size={14} />
                                )}
                              </div>
                            </div>
                            {currentSessionId && (
                              <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium truncate">
                                {!!chatSessions.find(
                                  (s) => s.chatId === currentSessionId
                                )?.documentId
                                  ? "Context locked to selected document"
                                  : "Select a document to give Summy context"}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={handleCloseChat}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                          <X size={24} />
                        </button>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 scroll-smooth">
                        {!currentSessionId ? (
                          <div className="h-full flex flex-col items-center justify-center p-4 sm:p-8 text-center">
                            <div className="bg-white dark:bg-slate-800 p-5 sm:p-8 rounded-full mb-4 sm:mb-6 shadow-sm border border-slate-100 dark:border-slate-700">
                              <Bot className="text-blue-600 dark:text-blue-400 h-10 w-10 sm:h-16 sm:w-16" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 sm:mb-3">
                              Welcome to Summy AI
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 sm:mb-8 text-sm sm:text-lg leading-relaxed">
                              I can help you analyze your documents, answer
                              questions, or just chat. Select a conversation
                              history or start a new one.
                            </p>
                            <button
                              onClick={createNewChat}
                              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200/50 dark:shadow-none transition-all hover:scale-105 flex items-center gap-3 text-base"
                            >
                              <SquarePen size={20} />
                              Start New Conversation
                            </button>
                          </div>
                        ) : (
                          <>
                            {chatMessages.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                                <MessageSquare
                                  size={48}
                                  className="text-slate-300 dark:text-slate-600 mb-4"
                                />
                                <p className="text-slate-500 dark:text-slate-400 font-medium">
                                  {selectedChatDocumentId
                                    ? "Ask Summy anything about the selected document..."
                                    : "Start typing to chat with Summy..."}
                                </p>
                              </div>
                            )}
                            {chatMessages.map((msg, idx) => (
                              <div
                                key={idx}
                                className={`flex ${
                                  msg.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                                    msg.role === "user"
                                      ? "bg-blue-600 text-white rounded-br-none"
                                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none"
                                  }`}
                                >
                                  {msg.role === "assistant" && msg.isNew ? (
                                    <Typewriter text={msg.content} />
                                  ) : (
                                    msg.content
                                  )}
                                </div>
                              </div>
                            ))}
                            {isChatLoading && (
                              <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                                  <span className="text-xs text-slate-400 font-medium">
                                    Summy is thinking...
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Input */}
                      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex gap-2 sm:gap-3 relative items-center">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleSendMessage()
                            }
                            placeholder={
                              !currentSessionId
                                ? "Create a chat to start..."
                                : !selectedChatDocumentId
                                ? "Please select a document above..."
                                : "Type your message here..."
                            }
                            disabled={
                              !currentSessionId || !selectedChatDocumentId
                            }
                            className="flex-1 px-4 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-400 disabled:cursor-not-allowed shadow-sm text-sm"
                            autoFocus
                          />
                          <button
                            onClick={handleSendMessage}
                            disabled={
                              !chatInput.trim() ||
                              isChatLoading ||
                              !currentSessionId ||
                              !selectedChatDocumentId
                            }
                            className="p-2 sm:px-4 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center flex-shrink-0"
                          >
                            {isChatLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Send className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeView === "users" && (
            <UsersSection
              users={users}
              getUserUsage={getUserUsage}
              getUsageColor={getUsageColor}
              onUsersChange={fetchUsersUsage}
              loading={loadingStates.users.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  users: { loading: false, hasData },
                }));
              }}
              onUsersFetched={(fetchedUsers) => {
                setUsers(fetchedUsers);
              }}
            />
          )}

          {activeView === "files" && (
            <FilesSection
              files={files}
              loading={loadingStates.files.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  files: { loading: false, hasData },
                }));
              }}
              onFilesFetched={(fetchedFiles) => {
                setFiles(fetchedFiles);
              }}
            />
          )}

          {activeView === "text" && (
            <TextSection
              texts={texts}
              loading={loadingStates.text.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  text: { loading: false, hasData },
                }));
              }}
              onTextsFetched={(fetchedTexts) => {
                setTexts(fetchedTexts);
              }}
            />
          )}

          {activeView === "packages" && (
            <PackagesSection
              packages={packages}
              loading={loadingStates.packages.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  packages: { loading: false, hasData },
                }));
              }}
              onPackagesFetched={(fetchedPackages) => {
                setPackages(fetchedPackages);
              }}
            />
          )}

          {activeView === "payments" && (
            <PaymentsSection
              payments={payments}
              loading={loadingStates.payments.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  payments: { loading: false, hasData },
                }));
              }}
              onPaymentsFetched={(fetchedPayments) => {
                setPayments(fetchedPayments);
              }}
            />
          )}

          {activeView === "folders" && (
            <FoldersSection
              folders={folders}
              loading={loadingStates.folders.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  folders: { loading: false, hasData },
                }));
              }}
              onFoldersFetched={(fetchedFolders) => {
                setFolders(fetchedFolders);
              }}
            />
          )}

          {activeView === "activations" && (
            <ActivationRequestsSection
              requests={activationRequests}
              loading={loadingStates.activations.loading}
              onDataLoaded={(hasData) => {
                setLoadingStates((prev) => ({
                  ...prev,
                  activations: { loading: false, hasData },
                }));
              }}
              onRequestsFetched={(fetchedRequests) => {
                setActivationRequests(fetchedRequests);
              }}
            />
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-slate-900">Logout</h3>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to logout? You'll need to sign in again to
                access your account.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Delete Chat
              </h3>
              <button
                onClick={() => setChatToDelete(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setChatToDelete(null)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">
                Cancel
              </button>
              <button onClick={confirmDeleteChat} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
