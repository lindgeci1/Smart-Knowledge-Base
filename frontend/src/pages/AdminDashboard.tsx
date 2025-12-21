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
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersUsage, setUsersUsage] = useState<Map<string, { overallUsage: number; totalLimit: number }>>(new Map());
  
  // Fetch users usage from backend
  const fetchUsersUsage = async () => {
    try {
      const response = await apiClient.get("/Users/admin/usage");
      const usageData = response.data || [];
      const usageMap = new Map<string, { overallUsage: number; totalLimit: number }>();
      
      usageData.forEach((item: { userId: string; overallUsage: number; totalLimit: number }) => {
        usageMap.set(item.userId, {
          overallUsage: item.overallUsage,
          totalLimit: item.totalLimit
        });
      });
      
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
      const percentage = usage.totalLimit > 0 
        ? Math.min((usage.overallUsage / usage.totalLimit) * 100, 100)
        : 0;
      usageMap.set(userId, {
        userId,
        count: usage.overallUsage,
        percentage: Math.round(percentage),
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

      // Fetch users usage from backend
      await fetchUsersUsage();

      // 1. Load Summaries (Files & Text)
      try {
        const storedSummaries = localStorage.getItem("app_summaries");
        if (storedSummaries) {
          const summaries: Summary[] = JSON.parse(storedSummaries);
          setAllSummaries(summaries);
          setFiles(summaries.filter((s) => s.type === "file"));
          setTexts(summaries.filter((s) => s.type === "text"));
        }
      } catch (error) {
        console.error("Error loading summaries", error);
      }
      // Users data - empty for now, should be fetched from backend if needed
      setUsers([]);
      setIsLoading(false);
    };
    loadData();
  }, [user]);
  const getUserUsage = (userId: string): UserUsage => {
    const usage = userUsageMap.get(userId);
    const backendUsage = usersUsage.get(userId);
    
    if (usage && backendUsage) {
      return {
        ...usage,
        totalLimit: backendUsage.totalLimit
      };
    }
    
    return {
      userId,
      count: 0,
      percentage: 0,
      totalLimit: 100
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
      <AdminSidebar activeView={activeView} setActiveView={setActiveView} />

      <div className="flex-1 md:ml-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {activeView === "dashboard" && (
            <DashboardSection
              stats={{
                users: totalUsers,
                files: files.length,
                texts: texts.length,
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
              onUsersChange={fetchUsersUsage}
            />
          )}

          {activeView === "files" && <FilesSection files={files} />}

          {activeView === "text" && <TextSection texts={texts} />}
        </main>
      </div>
    </div>
  );
}
