import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, X, UserCheck } from "lucide-react";
import { apiClient } from "../../lib/authClient";
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
interface UsersSectionProps {
  users: UserData[];
  getUserUsage: (userId: string) => UserUsage;
  getUsageColor: (percentage: number) => string;
  onUsersChange?: () => void;
}
export function UsersSection({
  users: _initialUsers,
  getUserUsage,
  getUsageColor,
  onUsersChange,
}: UsersSectionProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [reactivatingUser, setReactivatingUser] = useState<UserData | null>(
    null
  );
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get("/Users/admin");
      const usersData = response.data.map(
        (user: {
          id: string;
          name: string;
          email: string;
          role: string;
          status: string;
          joinedAt: string;
        }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "admin" | "user",
          status: user.status as "active" | "inactive",
          joinedAt: user.joinedAt,
        })
      );
      setUsers(usersData);
      setFilteredUsers(usersData);
      // Refresh usage when users are fetched
      if (onUsersChange) {
        onUsersChange();
      }
    } catch (error) {
      console.error("Error fetching users", error);
    }
  }, [onUsersChange]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleDelete = async () => {
    if (!deletingUser || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Users/admin/${deletingUser.id}`);
      setDeletingUser(null);
      // Refresh users list to get updated status
      await fetchUsers();
    } catch (error) {
      console.error("Error deactivating user", error);
      alert("Failed to deactivate user. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivatingUser || isReactivating) return;
    setIsReactivating(true);
    try {
      await apiClient.post(
        `/Users/admin/${reactivatingUser.id}/reactivate`
      );
      setReactivatingUser(null);
      // Refresh users list to get updated status
      await fetchUsers();
    } catch (error) {
      console.error("Error reactivating user", error);
      alert("Failed to reactivate user. Please try again.");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingUser) return;
    setIsCreatingUser(true);
    setCreateError("");
    try {
      await apiClient.post("/Users/admin", {
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
      });
      await fetchUsers(); // Refresh the list
      setIsCreating(false);
      setNewUser({
        username: "",
        email: "",
        password: "",
      });
      setCreateError("");
    } catch (error: unknown) {
      console.error("Error creating user", error);
      let errorMessage = "Failed to create user. Please try again.";
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
      setCreateError(errorMessage);
    } finally {
      setIsCreatingUser(false);
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-medium mb-4">Create New User</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {createError}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => {
                    setNewUser({ ...newUser, username: e.target.value });
                    setCreateError("");
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value });
                    setCreateError("");
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => {
                    setNewUser({ ...newUser, password: e.target.value });
                    setCreateError("");
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewUser({ username: "", email: "", password: "" });
                  setCreateError("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isCreatingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete User</h3>
              <button
                onClick={() => setDeletingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-slate-900">
                  {deletingUser.name}
                </span>{" "}
                ({deletingUser.email})? The user will not be able to access the
                system until reactivated.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deactivating..." : "Deactivate User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {reactivatingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Reactivate User</h3>
              <button
                onClick={() => setReactivatingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to reactivate{" "}
                <span className="font-semibold text-slate-900">
                  {reactivatingUser.name}
                </span>{" "}
                ({reactivatingUser.email})? The user will be able to access the
                system again.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setReactivatingUser(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={isReactivating}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isReactivating ? "Reactivating..." : "Reactivate User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto">
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
                  Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
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
                filteredUsers.map((userData) => {
                  const usage = getUserUsage(userData.id);
                  return (
                    <tr
                      key={userData.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {userData.name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">
                              {userData.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {userData.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            userData.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {userData.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            userData.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {userData.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 min-w-[80px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-700">
                                {usage.percentage}%
                              </span>
                              <span className="text-xs text-slate-500">
                                {usage.count} / {usage.totalLimit || 100}{" "}
                                credits
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getUsageColor(
                                  usage.percentage
                                )}`}
                                style={{
                                  width: `${usage.percentage}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {userData.status === "inactive" ? (
                            <button
                              onClick={() => setReactivatingUser(userData)}
                              disabled={isReactivating}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Reactivate user"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeletingUser(userData)}
                              disabled={userData.role === "admin"}
                              className={`${
                                userData.role === "admin"
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-900"
                              }`}
                              title={
                                userData.role === "admin"
                                  ? "Cannot deactivate admin users"
                                  : "Deactivate"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
