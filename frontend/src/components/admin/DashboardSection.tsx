import React from "react";
import {
  Users,
  File,
  MessageSquare,
  Activity,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
interface DashboardSectionProps {
  stats: {
    users: number;
    files: number;
    texts: number;
    avgUsage?: number;
  };
  userUsageMap: Map<
    string,
    {
      userId: string;
      count: number;
      percentage: number;
      userEmail?: string;
      userName?: string;
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
  // Use avgUsage from stats if provided, otherwise calculate from userUsageMap
  const aggregateUsage =
    stats.avgUsage !== undefined
      ? Math.round(stats.avgUsage)
      : (() => {
          const usageValues = Array.from(userUsageMap.values());
          return usageValues.length > 0
            ? Math.round(
                usageValues.reduce((sum, u) => sum + u.percentage, 0) /
                  usageValues.length
              )
            : 0;
        })();

  // Prepare data for charts
  const summaryData = [
    { name: "Files", value: stats.files, color: "#9333ea" },
    { name: "Texts", value: stats.texts, color: "#3b82f6" },
  ];

  const statsData = [
    { name: "Users", value: stats.users },
    { name: "Files", value: stats.files },
    { name: "Texts", value: stats.texts },
    { name: "Total", value: totalSummaries },
  ];

  // Prepare usage data for line chart (top 3 users by usage)
  // Filter out any users with 0 usage or undefined percentage, and exclude admins
  const usageData = Array.from(userUsageMap.values())
    .filter((u) => u.percentage > 0) // Only show users with actual usage
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3) // Only top 3 users
    .map((u) => ({
      name: u.userEmail
        ? u.userEmail.split("@")[0] // Show username part of email
        : u.userName
        ? u.userName
        : `User ${u.userId.substring(0, 8)}`, // Fallback to truncated userId
      usage: u.percentage,
      count: u.count,
    }));
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Dashboard Overview
        </h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Summary Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={summaryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {summaryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics Bar Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Statistics Overview
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* User Usage Chart - Line Chart */}
        {usageData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Top 3 Users by Usage Percentage
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={usageData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#64748b"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  label={{
                    value: "Usage Percentage",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "#64748b" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number | undefined) => [
                    `${value ?? 0}%`,
                    "Usage",
                  ]}
                  labelFormatter={(label) => `User: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="usage"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 6 }}
                  activeDot={{ r: 8 }}
                  name="Usage %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
