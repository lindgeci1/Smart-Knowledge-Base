import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { DashboardSection } from "../components/admin/DashboardSection";
import { UsersSection } from "../components/admin/UsersSection";
import { FilesSection } from "../components/admin/FilesSection";
import { TextSection } from "../components/admin/TextSection";
import { SummarizeSection } from "../components/admin/SummarizeSection";
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
}
export function AdminDashboard() {
  const { user } = useAuth();
  // State
  const [activeView, setActiveView] = useState<
    "dashboard" | "users" | "files" | "text" | "summarize"
  >("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [files, setFiles] = useState<Summary[]>([]);
  const [texts, setTexts] = useState<Summary[]>([]);
  const [allSummaries, setAllSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    files: 0,
    texts: 0,
  });
  // Calculate usage statistics per user
  const userUsageMap = useMemo(() => {
    const usageMap = new Map<string, UserUsage>();
    // Count summaries per user
    const userCounts = new Map<string, number>();
    allSummaries.forEach((summary) => {
      const count = userCounts.get(summary.userId) || 0;
      userCounts.set(summary.userId, count + 10); // Assuming 10 points per summary
    });
    // Calculate total for percentage
    const maxPerUser = 100; // Default limit for visualization
    // Build usage map
    userCounts.forEach((count, userId) => {
      const percentage = Math.min((count / maxPerUser) * 100, 100);
      usageMap.set(userId, {
        userId,
        count,
        percentage: Math.round(percentage),
      });
    });
    return usageMap;
  }, [allSummaries]);
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load Stats and Summaries (Files & Text) from backend APIs
      const [statsRes, documentsRes, textsRes] = await Promise.all([
        apiClient.get("/Documents/stats"),
        apiClient.get("/Documents/all-documents"),
        apiClient.get("/Documents/all-texts"),
      ]);

      // Update stats from API
      if (statsRes.data) {
        setStats({
          users: statsRes.data.totalUsers || 0,
          files: statsRes.data.totalFiles || 0,
          texts: statsRes.data.totalTexts || 0,
        });
      }

      const documents: Summary[] = (documentsRes.data || []).map((d: any) => ({
        id: d.id,
        userId: d.userId,
        userName: d.userId, // We'll need to fetch user names separately if needed
        type: "file" as const,
        content: d.content,
        filename: d.filename,
        summary: d.summary,
        createdAt: d.createdAt,
      }));

      const texts: Summary[] = (textsRes.data || []).map((t: any) => ({
        id: t.id,
        userId: t.userId,
        userName: t.userId, // We'll need to fetch user names separately if needed
        type: "text" as const,
        content: t.content,
        summary: t.summary,
        createdAt: t.createdAt,
      }));

      const allSummaries = [...documents, ...texts];
      setAllSummaries(allSummaries);
      setFiles(documents);
      setTexts(texts);
    } catch (error) {
      console.error("Error loading summaries from backend", error);
      // Fallback to localStorage if API fails
      try {
        const storedSummaries = localStorage.getItem("app_summaries");
        if (storedSummaries) {
          const summaries: Summary[] = JSON.parse(storedSummaries);
          setAllSummaries(summaries);
          setFiles(summaries.filter((s) => s.type === "file"));
          setTexts(summaries.filter((s) => s.type === "text"));
        }
      } catch (localError) {
        console.error("Error loading summaries from localStorage", localError);
      }
    }

    // 2. Mock Users Data
    const mockUsers: UserData[] = [
      {
        id: "1",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
        status: "active",
        joinedAt: "2023-11-01T10:00:00Z",
      },
      {
        id: "2",
        name: "Sarah Johnson",
        email: "sarah@example.com",
        role: "user",
        status: "active",
        joinedAt: "2023-11-05T14:30:00Z",
      },
      {
        id: "3",
        name: "Michael Chen",
        email: "michael@example.com",
        role: "user",
        status: "inactive",
        joinedAt: "2023-11-12T09:15:00Z",
      },
      {
        id: "4",
        name: "Emma Davis",
        email: "emma@example.com",
        role: "user",
        status: "active",
        joinedAt: "2023-11-20T16:45:00Z",
      },
      {
        id: "5",
        name: "James Wilson",
        email: "james@example.com",
        role: "user",
        status: "active",
        joinedAt: "2023-12-01T11:20:00Z",
      },
    ];
    if (user && !mockUsers.find((u) => u.email === user.email)) {
      mockUsers.unshift({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: "active",
        joinedAt: new Date().toISOString(),
      });
    }
    setUsers(mockUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Refresh function to reload data after edits/deletes
  const refreshData = async () => {
    await loadData();
  };
  const getUserUsage = (userId: string): UserUsage => {
    return (
      userUsageMap.get(userId) || {
        userId,
        count: 0,
        percentage: 0,
      }
    );
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
      <AdminSidebar activeView={activeView} setActiveView={setActiveView} />

      <div className="flex-1 md:ml-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {activeView === "dashboard" && (
            <DashboardSection
              stats={{
                users: stats.users,
                files: stats.files,
                texts: stats.texts,
              }}
              userUsageMap={userUsageMap}
            />
          )}

          {activeView === "summarize" && <SummarizeSection />}

          {activeView === "users" && (
            <UsersSection
              users={users}
              getUserUsage={getUserUsage}
              getUsageColor={getUsageColor}
            />
          )}

          {activeView === "files" && (
            <FilesSection files={files} onUpdate={refreshData} />
          )}

          {activeView === "text" && (
            <TextSection texts={texts} onUpdate={refreshData} />
          )}
        </main>
      </div>
    </div>
  );
}
