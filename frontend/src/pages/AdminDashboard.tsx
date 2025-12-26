import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { DashboardSection } from "../components/admin/DashboardSection";
import { UsersSection } from "../components/admin/UsersSection";
import { FilesSection } from "../components/admin/FilesSection";
import { TextSection } from "../components/admin/TextSection";
import { SummarizeSection } from "../components/admin/SummarizeSection";
import { PackagesSection } from "../components/admin/PackagesSection";
import { PaymentsSection } from "../components/admin/PaymentsSection";
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
  totalLimit?: number;
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
export function AdminDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract section from pathname
  const getActiveViewFromPath = (): "dashboard" | "users" | "files" | "text" | "summarize" | "packages" | "payments" => {
    const path = location.pathname;
    if (path === "/admin") return "dashboard";
    if (path === "/admin/users") return "users";
    if (path === "/admin/files") return "files";
    if (path === "/admin/text") return "text";
    if (path === "/admin/summarize") return "summarize";
    if (path === "/admin/packages") return "packages";
    if (path === "/admin/payments") return "payments";
    return "dashboard";
  };
  
  const activeView = getActiveViewFromPath();
  const [users, setUsers] = useState<UserData[]>([]);
  const [files, setFiles] = useState<Summary[]>([]);
  const [texts, setTexts] = useState<Summary[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersUsage, setUsersUsage] = useState<
    Map<string, { overallUsage: number; totalLimit: number }>
  >(new Map());

  // Lazy loading states per tab
  const [loadingStates, setLoadingStates] = useState<{
    users: { loading: boolean; hasData: boolean };
    files: { loading: boolean; hasData: boolean };
    text: { loading: boolean; hasData: boolean };
    packages: { loading: boolean; hasData: boolean };
    payments: { loading: boolean; hasData: boolean };
  }>({
    users: { loading: false, hasData: false },
    files: { loading: false, hasData: false },
    text: { loading: false, hasData: false },
    packages: { loading: false, hasData: false },
    payments: { loading: false, hasData: false },
  });

  // Fetch users usage from backend
  const fetchUsersUsage = async () => {
    try {
      const response = await apiClient.get("/Users/admin/usage");
      const usageData = response.data || [];
      const usageMap = new Map<
        string,
        { overallUsage: number; totalLimit: number }
      >();

      usageData.forEach(
        (item: {
          userId: string;
          overallUsage: number;
          totalLimit: number;
        }) => {
          usageMap.set(item.userId, {
            overallUsage: item.overallUsage,
            totalLimit: item.totalLimit,
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

      setIsLoading(false);
    };
    loadData();
  }, [user]);

  // Trigger lazy loading when URL section changes
  useEffect(() => {
    if (activeView === "users" && !loadingStates.users.hasData && !loadingStates.users.loading) {
      setLoadingStates((prev) => ({
        ...prev,
        users: { loading: true, hasData: false },
      }));
    } else if (activeView === "files" && !loadingStates.files.hasData && !loadingStates.files.loading) {
      setLoadingStates((prev) => ({
        ...prev,
        files: { loading: true, hasData: false },
      }));
    } else if (activeView === "text" && !loadingStates.text.hasData && !loadingStates.text.loading) {
      setLoadingStates((prev) => ({
        ...prev,
        text: { loading: true, hasData: false },
      }));
    } else if (activeView === "packages" && !loadingStates.packages.hasData && !loadingStates.packages.loading) {
      setLoadingStates((prev) => ({
        ...prev,
        packages: { loading: true, hasData: false },
      }));
    } else if (activeView === "payments" && !loadingStates.payments.hasData && !loadingStates.payments.loading) {
      setLoadingStates((prev) => ({
        ...prev,
        payments: { loading: true, hasData: false },
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
    }
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
      <AdminSidebar activeView={activeView} setActiveView={handleTabChange} />

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
              onRefresh={async () => {
                // Refresh all dashboard data
                try {
                  const response = await apiClient.get("/Users/admin/total-users");
                  setTotalUsers(response.data.count || 0);
                } catch (error) {
                  console.error("Error loading total users", error);
                }
                await fetchUsersUsage();
              }}
            />
          )}

          {activeView === "summarize" && <SummarizeSection />}

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
        </main>
      </div>
    </div>
  );
}
