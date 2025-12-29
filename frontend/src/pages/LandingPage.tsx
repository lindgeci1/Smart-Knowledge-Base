import React, { useEffect, useState, Component } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { apiClient } from "../lib/authClient";
import {
  Layout,
  Users,
  FileText,
  TrendingUp,
  ArrowRight,
  Zap,
  BarChart3,
  Shield,
  CheckCircle2,
  Play,
} from "lucide-react";
// Animated Counter Component
const Counter = ({
  end,
  duration = 2000,
  label,
}: {
  end: number;
  duration?: number;
  label: string;
}) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    const start = 0;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out quart
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(start + (end - start) * easeOut));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
      <div className="text-4xl font-bold text-slate-900 mb-2 tabular-nums">
        {count.toLocaleString()}
      </div>
      <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
};
// Simple SVG Line Chart Component
const ActivityChart = () => {
  const data = [20, 45, 35, 60, 55, 80, 75, 90, 85, 100];
  const max = Math.max(...data);
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - (val / max) * 80; // Keep some padding at top
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl border border-slate-700">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <div className="text-xs font-medium text-slate-400 flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
          Live Activity
        </div>
      </div>

      {/* Chart Area */}
      <div className="absolute inset-0 pt-16 px-4 pb-4">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1="20"
            x2="100"
            y2="20"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="40"
            x2="100"
            y2="40"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="60"
            x2="100"
            y2="60"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="80"
            x2="100"
            y2="80"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
          />

          {/* Area gradient */}
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area path */}
          <path
            d={`M0,100 L0,${100 - (data[0] / max) * 80} ${points
              .split(" ")
              .map((p) => `L${p}`)
              .join(" ")} L100,100 Z`}
            fill="url(#chartGradient)"
          />

          {/* Line path */}
          <polyline
            points={points}
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-lg"
          />

          {/* Points */}
          {data.map((val, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - (val / max) * 80;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.5"
                fill="#fff"
                className="opacity-0 hover:opacity-100 transition-opacity duration-200"
              />
            );
          })}
        </svg>
      </div>

      {/* Floating Stats Card */}
      <div className="absolute bottom-6 right-6 bg-slate-800/90 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-lg max-w-[140px]">
        <div className="text-xs text-slate-400 mb-1">Total Processed</div>
        <div className="text-lg font-bold text-white flex items-center">
          8,621
          <TrendingUp className="w-4 h-4 text-green-400 ml-2" />
        </div>
      </div>
    </div>
  );
};
export function LandingPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [userCount, setUserCount] = useState(0);
  const [summaryCount, setSummaryCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersResponse, textsResponse, documentsResponse] =
          await Promise.all([
            apiClient.get("/Users/count"),
            apiClient.get("/Texts/count"),
            apiClient.get("/Documents/count"),
          ]);
        setUserCount(usersResponse.data?.count || 0);
        setSummaryCount(textsResponse.data?.count || 0);
        setFileCount(documentsResponse.data?.count || 0);
      } catch (error) {
        console.error("Failed to load stats", error);
        // Keep defaults at 0
      }
    };
    fetchStats();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="bg-blue-600 p-1 sm:p-1.5 rounded-lg">
                <Layout className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                Summarize<span className="text-blue-600">AI</span>
              </span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {isAuthenticated && user ? (
                <>
                  <Link to={user.role === "admin" ? "/admin" : "/dashboard"}>
                    <Button
                      variant="ghost"
                      className="hidden sm:inline-flex text-slate-600 hover:text-slate-900 text-sm"
                    >
                      {user.role === "admin" ? "Admin Dashboard" : "Dashboard"}
                    </Button>
                  </Link>
                  <Link to={user.role === "admin" ? "/admin" : "/dashboard"}>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                      <span className="hidden sm:inline">Go to Dashboard</span>
                      <span className="sm:hidden">Dashboard</span>
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button
                      variant="ghost"
                      className="text-slate-600 hover:text-slate-900 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-6">
            <Zap className="w-4 h-4 mr-2 fill-blue-600" />
            <span>Now powered by Ollama (llama3.2)</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.1]">
            Transform your content into{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              actionable insights
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Stop drowning in documents. Upload files or paste text to get
            instant, accurate summaries powered by advanced AI. Join thousands
            of productive teams today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated && user ? (
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="w-full sm:w-auto"
              >
                <Button className="w-full sm:w-auto h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all hover:scale-105">
                  Go to {user.role === "admin" ? "Admin" : "Your"} Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all hover:scale-105">
                    Start Summarizing Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  {/* <Button variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-slate-200 hover:bg-slate-50 hover:text-slate-900"> */}
                  {/* View Demo */}
                  {/* </Button> */}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Visual / Chart Section */}
        <div className="relative max-w-5xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20"></div>
          <div className="relative bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 aspect-[16/9] sm:aspect-[2/1]">
            <div className="grid grid-cols-1 md:grid-cols-3 h-full">
              {/* Left Panel: Activity List */}
              <div className="hidden md:block col-span-1 border-r border-slate-700/50 bg-slate-900/50 p-6">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Recent Activity
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="bg-blue-500/10 p-2 rounded-md">
                        <FileText className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          Q4 Report.pdf
                        </div>
                        <div className="text-xs text-slate-500">
                          Processed just now
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel: Chart */}
              <div className="col-span-1 md:col-span-2 p-6 relative">
                <div className="h-full w-full">
                  <ActivityChart />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Trusted by data-driven teams
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Our platform handles millions of words every day, helping
              professionals save thousands of hours in reading time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Counter end={userCount} label="Active Users" />
            <Counter end={summaryCount} label="Summaries Generated" />
            <Counter end={fileCount} label="Files Processed" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Lightning Fast</h3>
            <p className="text-slate-600 leading-relaxed">
              Get summaries in seconds, not minutes. Our optimized processing
              pipeline handles large documents with ease.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Enterprise Secure
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Your data is encrypted at rest and in transit. We never use your
              data to train our models without permission.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Insight Analytics
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Track your usage and see how much time you're saving. Detailed
              analytics for admins and users.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="bg-slate-900 p-1.5 rounded-lg">
              <Layout className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Summarize<span className="text-blue-600">AI</span>
            </span>
          </div>
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} SummarizeAI Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
