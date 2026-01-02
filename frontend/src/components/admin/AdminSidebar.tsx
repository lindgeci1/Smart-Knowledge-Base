import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  LogOut,
  Shield,
  Zap,
  Package,
  CreditCard,
  X,
  Folder,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { apiClient } from "../../lib/authClient";
interface AdminSidebarProps {
  activeView:
    | "dashboard"
    | "users"
    | "files"
    | "text"
    | "summarize"
    | "packages"
    | "payments"
    | "folders"
    | "activations";
  setActiveView: (
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
  ) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}
export function AdminSidebar({
  activeView,
  setActiveView,
  isOpen = false,
  onClose,
  onLogout,
}: AdminSidebarProps) {
  const { logout, user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await apiClient.get("/Activation/admin/pending");
        const pending = response.data.filter(
          (req: { status: string }) => req.status === "pending"
        ).length;
        setPendingCount(pending);
      } catch (error) {
        console.error("Error fetching pending activation requests", error);
      }
    };

    if (user) {
      fetchPendingCount();
      // Refresh every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "summarize",
      label: "Summarize",
      icon: Zap,
    },
    {
      id: "users",
      label: "Users",
      icon: Users,
    },
    {
      id: "files",
      label: "Files",
      icon: FileText,
    },
    {
      id: "text",
      label: "Text Summaries",
      icon: MessageSquare,
    },
    {
      id: "packages",
      label: "Packages",
      icon: Package,
    },
    {
      id: "payments",
      label: "Payments",
      icon: CreditCard,
    },
    {
      id: "folders",
      label: "Folders",
      icon: Folder,
    },
    {
      id: "activations",
      label: "Activation Requests",
      icon: UserCheck,
    },
  ] as const;
  return (
    <>
      {/* Mobile sidebar */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button for mobile */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Admin<span className="text-indigo-400"> Panel</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-slate-400">System Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeView === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </div>
              {item.id === "activations" && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout || logout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 h-screen fixed left-0 top-0 text-white">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center">
          <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Admin<span className="text-indigo-400"> Panel</span>
          </span>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-slate-400">System Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeView === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </div>
              {item.id === "activations" && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout || logout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
