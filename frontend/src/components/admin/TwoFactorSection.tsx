import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Shield, ShieldOff, Download, FileSpreadsheet, FileText, Code } from "lucide-react";
import { apiClient } from "../../lib/authClient";
import toast from "react-hot-toast";
import { downloadData } from "../../utils/downloadUtils";

interface TwoFactorUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  joinedAt: string;
  twoFactorEnabled: boolean;
}

interface TwoFactorSectionProps {
  users: TwoFactorUser[];
  loading?: boolean;
  onDataLoaded?: (hasData: boolean) => void;
  onUsersFetched?: (users: TwoFactorUser[]) => void;
}

export function TwoFactorSection({
  users: initialUsers,
  loading: externalLoading = false,
  onDataLoaded,
  onUsersFetched,
}: TwoFactorSectionProps) {
  const [users, setUsers] = useState<TwoFactorUser[]>(initialUsers || []);
  const [filteredUsers, setFilteredUsers] = useState<TwoFactorUser[]>(initialUsers || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(initialUsers?.length > 0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialUsers?.length > 0) {
      setUsers(initialUsers);
      setFilteredUsers(initialUsers);
      setHasLoadedOnce(true);
    }
  }, [initialUsers]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get("/Users/admin");
      const usersData: TwoFactorUser[] = (response.data || []).map(
        (u: {
          id: string;
          name: string;
          email: string;
          role: string;
          status: string;
          joinedAt: string;
          twoFactorEnabled?: boolean;
        }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role as "admin" | "user",
          status: u.status as "active" | "inactive",
          joinedAt: u.joinedAt,
          twoFactorEnabled: !!u.twoFactorEnabled,
        })
      );
      setUsers(usersData);
      setFilteredUsers(usersData);
      setHasLoadedOnce(true);
      onDataLoaded?.(usersData.length > 0);
      onUsersFetched?.(usersData);
    } catch (error) {
      console.error("Error fetching 2FA users", error);
      toast.error("Failed to load users");
      setHasLoadedOnce(true);
      onDataLoaded?.(false);
    }
  }, [onDataLoaded, onUsersFetched]);

  useEffect(() => {
    if (externalLoading && !hasLoadedOnce) {
      fetchUsers();
    }
  }, [externalLoading, hasLoadedOnce, fetchUsers]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, users]);

  const showLoading = externalLoading && (users.length > 0 || !hasLoadedOnce);

  const handleDownload = (format: "excel" | "pdf" | "json") => {
    if (format === "excel" || format === "pdf") {
      const data = filteredUsers.map((u) => ({
        User: u.name,
        Email: u.email,
        Role: u.role,
        Status: u.status,
        "2FA": u.twoFactorEnabled ? "Enabled" : "Disabled",
        "Joined At": new Date(u.joinedAt).toLocaleDateString(),
      }));
      downloadData(data, "2fa-status", format, format === "pdf");
    } else {
      downloadData(
        filteredUsers.map((u) => ({
          ...u,
          twoFactorEnabled: u.twoFactorEnabled,
        })),
        "2fa-status",
        format
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2FA Status
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await fetchUsers();
              setIsRefreshing(false);
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
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

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by name or email..."
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          )}
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  2FA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsers.length === 0 && !showLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    {searchQuery.trim() === ""
                      ? "No users found"
                      : "No users match your search"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                          {u.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">
                            {u.name}
                          </div>
                          <div className="text-sm text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          u.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {u.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
                          <Shield className="h-3.5 w-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                          <ShieldOff className="h-3.5 w-3.5" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(u.joinedAt).toLocaleDateString()}
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
