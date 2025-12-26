import React from "react";
import { Users, File, MessageSquare, Activity, TrendingUp, RefreshCw } from "lucide-react";
interface DashboardSectionProps {
  stats: {
    users: number;
    files: number;
    texts: number;
  };
  userUsageMap: Map<
    string,
    {
      userId: string;
      count: number;
      percentage: number;
    }
  >;
  onRefresh?: () => void;
}
export function DashboardSection({
  stats,
  userUsageMap,
  onRefresh,
}: DashboardSectionProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };
  // Calculate total summaries
  const totalSummaries = stats.files + stats.texts;
  // Calculate aggregate usage (average percentage across all users)
  const usageValues = Array.from(userUsageMap.values());
  const aggregateUsage =
    usageValues.length > 0
      ? Math.round(
          usageValues.reduce((sum, u) => sum + u.percentage, 0) /
            usageValues.length
        )
      : 0;
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Total Users
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {stats.users}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Total Summaries
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {totalSummaries}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <File className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Files Uploaded
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {stats.files}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Text Summaries
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {stats.texts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Avg Usage
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {aggregateUsage}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          Welcome to the Admin Portal
        </h3>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Use the sidebar navigation to manage users, files, and text summaries.
          You can perform CRUD operations in each respective section.
        </p>
      </div>
    </div>
  );
}
