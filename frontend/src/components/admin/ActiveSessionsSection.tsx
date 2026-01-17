import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
  Code,
  X,
  Trash2,
  Clock,
  CheckCircle,
} from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface ActiveSession {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isExpired: boolean;
}

interface ActiveSessionsSectionProps {
  sessions: ActiveSession[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onSessionsFetched?: (sessions: ActiveSession[]) => void;
}

export function ActiveSessionsSection({
  sessions: initialSessions,
  loading: externalLoading = false,
  onDataLoaded,
  onSessionsFetched,
}: ActiveSessionsSectionProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>(
    initialSessions || []
  );
  const [filteredSessions, setFilteredSessions] = useState<ActiveSession[]>(
    initialSessions || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeletingExpired, setIsDeletingExpired] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    initialSessions && initialSessions.length > 0
  );
  const [hasRecords, setHasRecords] = useState(
    initialSessions && initialSessions.length > 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with parent data when it changes
  useEffect(() => {
    if (initialSessions && initialSessions.length > 0) {
      setSessions(initialSessions);
      setFilteredSessions(initialSessions);
      setHasLoadedOnce(true);
      setHasRecords(true);
    }
  }, [initialSessions]);

  const fetchSessions = async () => {
    try {
      const response = await apiClient.get("/auth/admin/sessions");
      const sessionsData = response.data.map(
        (session: {
          id: string;
          userId: string;
          userEmail: string;
          userName: string;
          createdAt: string;
          updatedAt: string;
          expiresAt: string;
          isExpired: boolean;
        }) => ({
          id: session.id,
          userId: session.userId,
          userEmail: session.userEmail,
          userName: session.userName,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          expiresAt: session.expiresAt,
          isExpired: session.isExpired,
        })
      );

      setSessions(sessionsData);
      setFilteredSessions(sessionsData);
      setHasRecords(sessionsData.length > 0);
      setHasLoadedOnce(true);

      if (onSessionsFetched) {
        onSessionsFetched(sessionsData);
      }

      if (onDataLoaded) {
        onDataLoaded(sessionsData.length > 0);
      }
    } catch (error) {
      console.error("Error fetching active sessions", error);
      toast.error("Failed to load active sessions");
      if (onDataLoaded) {
        onDataLoaded(false);
      }
    }
  };

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLoading, hasLoadedOnce]);

  // Filter sessions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sessions.filter(
      (session) =>
        session.userEmail.toLowerCase().includes(query) ||
        session.userName.toLowerCase().includes(query) ||
        session.userId.toLowerCase().includes(query)
    );
    setFilteredSessions(filtered);
  }, [searchQuery, sessions]);

  const handleDeleteExpired = async () => {
    if (isDeletingExpired) return;
    setIsDeletingExpired(true);
    try {
      const response = await apiClient.delete("/auth/admin/sessions/expired");
      const message =
        typeof response.data === "string"
          ? response.data
          : response.data?.message || "Expired sessions deleted successfully";
      toast.success(message);
      await fetchSessions();
    } catch (error: unknown) {
      console.error("Error deleting expired sessions", error);
      let errorMessage = "Failed to delete expired sessions. Please try again.";
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
      setIsDeletingExpired(false);
    }
  };

  const getStatusBadge = (isExpired: boolean) => {
    if (isExpired) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </span>
    );
  };

  const showLoading = externalLoading && (hasRecords || !hasLoadedOnce);

  const handleDownload = (format: "excel" | "pdf" | "json") => {
    if (format === "excel" || format === "pdf") {
      const data = filteredSessions.map((session) => ({
        "User Email": session.userEmail,
        "User Name": session.userName,
        Status: session.isExpired ? "Expired" : "Active",
        "Created At": new Date(session.createdAt).toLocaleString(),
        "Last Updated": new Date(session.updatedAt).toLocaleString(),
        "Expires At": new Date(session.expiresAt).toLocaleString(),
      }));
      downloadData(data, "active-sessions", format, format === "pdf");
    } else {
      downloadData(filteredSessions, "active-sessions", format);
    }
  };

  const expiredCount = sessions.filter((s) => s.isExpired).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Active Sessions
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchSessions();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
          {expiredCount > 0 && (
            <button
              onClick={handleDeleteExpired}
              disabled={isDeletingExpired}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              title="Delete expired sessions"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clean Expired ({expiredCount})</span>
            </button>
          )}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-slate-300">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleDownload("excel")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-md"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>Excel (CSV)</span>
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-red-600" />
                <span>PDF (Text)</span>
              </button>
              <button
                onClick={() => handleDownload("json")}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-md"
              >
                <Code className="h-4 w-4 text-blue-600" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by email, name, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto relative flex-1">
          {showLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Expires At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredSessions.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="h-8 w-8 text-indigo-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-1">No records</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery.trim() === ""
                          ? "No active sessions found."
                          : "No sessions match your search"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{session.userName}</div>
                      <div className="text-xs text-slate-500">{session.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(session.isExpired)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(session.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(session.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(session.expiresAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
