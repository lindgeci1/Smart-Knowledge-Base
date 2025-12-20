import React, { useEffect, useState, createElement } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import {
  Layout,
  FileText,
  Upload,
  MessageSquare,
  LogOut,
  Clock,
  CheckCircle2,
  X,
  File as FileIcon,
  Loader2,
  Zap,
  AlertCircle,
  Download,
} from "lucide-react";
import { apiClient } from "../lib/authClient";
// Types
interface Summary {
  id: string;
  userId: string;
  userName: string;
  type: "text" | "file";
  content: string; // Original text or filename
  summary: string;
  createdAt: string;
  filename?: string; // Only for file type
}
export function UserDashboard() {
  const { user, logout, updateUserUsage } = useAuth();
  const navigate = useNavigate();
  // State
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [currentResult, setCurrentResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Usage calculations
  const usageCost = 10;
  const currentUsage = user?.usageCount || 0;
  const limit = user?.usageLimit || 100;
  const usagePercentage = Math.min((currentUsage / limit) * 100, 100);
  const isLimitReached = currentUsage + usageCost > limit;
  // Load summaries on mount from backend APIs
  useEffect(() => {
    if (!user) return;
    const loadSummaries = async () => {
      try {
        setIsProcessing(true);
        // Fetch both documents and texts from backend
        const [documentsRes, textsRes] = await Promise.all([
          apiClient.get("/Documents/my-documents"),
          apiClient.get("/Documents/my-texts"),
        ]);

        const documents: Summary[] = (documentsRes.data || []).map(
          (d: any) => ({
            id: d.id,
            userId: d.userId,
            userName: user.name,
            type: "file" as const,
            content: d.content,
            filename: d.filename,
            summary: d.summary,
            createdAt: d.createdAt,
          })
        );

        const texts: Summary[] = (textsRes.data || []).map((t: any) => ({
          id: t.id,
          userId: t.userId,
          userName: user.name,
          type: "text" as const,
          content: t.content,
          summary: t.summary,
          createdAt: t.createdAt,
        }));

        // Combine and sort by date desc
        const allSummaries = [...documents, ...texts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setSummaries(allSummaries);
      } catch (error) {
        console.error("Failed to load summaries from backend", error);
        // Fallback to localStorage if API fails
        try {
          const stored = localStorage.getItem("app_summaries");
          if (stored) {
            const allSummaries: Summary[] = JSON.parse(stored);
            const userSummaries = allSummaries
              .filter((s) => s.userId === user.id)
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              );
            setSummaries(userSummaries);
          }
        } catch (localError) {
          console.error(
            "Failed to load summaries from localStorage",
            localError
          );
        }
      } finally {
        setIsProcessing(false);
      }
    };
    loadSummaries();
  }, [user]);
  const saveSummary = (newSummary: Summary) => {
    // Update local state immediately (optimistic update)
    setSummaries((prev) => [newSummary, ...prev]);
    setCurrentResult(newSummary);
    // Also save to localStorage as backup
    try {
      const stored = localStorage.getItem("app_summaries");
      const allSummaries: Summary[] = stored ? JSON.parse(stored) : [];
      const updated = [newSummary, ...allSummaries];
      localStorage.setItem("app_summaries", JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save summary to localStorage", error);
    }
  };
  const handleSummarizeText = async () => {
    if (!textInput.trim() || !user) return;
    if (isLimitReached) {
      setError("Usage limit reached. Please upgrade to continue.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      const response = await apiClient.post("/Documents/add-text", {
        text: textInput.trim(),
      });

      const { summary, documentId } = response.data;

      const newSummary: Summary = {
        id: documentId || Math.random().toString(36).substr(2, 9),
        userId: user.id,
        userName: user.name,
        type: "text",
        content:
          textInput.substring(0, 50) + (textInput.length > 50 ? "..." : ""),
        summary: summary,
        createdAt: new Date().toISOString(),
      };

      saveSummary(newSummary);
      updateUserUsage(usageCost);
      setTextInput("");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Failed to summarize text";
      setError(errorMessage);
      console.error("Summarization error:", err);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;
    if (isLimitReached) {
      setError("Usage limit reached. Please upgrade to continue.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await apiClient.post("/Documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { summary, documentId } = response.data;

      const newSummary: Summary = {
        id: documentId || Math.random().toString(36).substr(2, 9),
        userId: user.id,
        userName: user.name,
        type: "file",
        content: selectedFile.name,
        filename: selectedFile.name,
        summary: summary,
        createdAt: new Date().toISOString(),
      };

      saveSummary(newSummary);
      updateUserUsage(usageCost);
      setSelectedFile(null);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data ||
        err.message ||
        "Failed to upload and summarize file";
      setError(errorMessage);
      console.error("File upload error:", err);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleDownloadSummary = (summary: Summary) => {
    const blob = new Blob([summary.summary], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    if (summary.type === "file") {
      a.download =
        summary.filename?.replace(/\.[^/.]+$/, "-summary.txt") ||
        "file-summary.txt";
    } else {
      a.download = `text-summary-${
        new Date(summary.createdAt).toISOString().split("T")[0]
      }.txt`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-blue-600 p-1.5 rounded-lg mr-2">
                <Layout className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                Summarize<span className="text-blue-600">AI</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900">
                  {user?.name}
                </span>
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  Standard Plan
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={logout}
                className="text-slate-500 hover:text-red-600"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Usage Stats Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center">
                <Zap className="h-5 w-5 text-yellow-500 mr-2" />
                Usage Limit
              </h2>
              <p className="text-sm text-slate-500">
                You have used{" "}
                <span className="font-medium text-slate-900">
                  {currentUsage}
                </span>{" "}
                of <span className="font-medium text-slate-900">{limit}</span>{" "}
                credits
              </p>
            </div>
            <Button
              onClick={() => navigate("/packages")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
            >
              Add more / Upgrade
            </Button>
          </div>

          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                {Math.round(usagePercentage)}% Used
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
              <div
                style={{
                  width: `${usagePercentage}%`,
                }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                  usagePercentage > 90 ? "bg-red-500" : "bg-blue-500"
                }`}
              ></div>
            </div>
          </div>

          {isLimitReached && (
            <div className="mt-2 flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-100">
              <AlertCircle className="h-4 w-4 mr-2" />
              You have reached your usage limit. Please upgrade to continue
              generating summaries.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Tools */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("text")}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${
                      activeTab === "text"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Text Summary
                  </button>
                  <button
                    onClick={() => setActiveTab("file")}
                    className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${
                      activeTab === "file"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    File Upload
                  </button>
                </div>
              </div>

              <div className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {error}
                  </div>
                )}

                {activeTab === "text" ? (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="text-input"
                        className="block text-sm font-medium text-slate-700 mb-2"
                      >
                        Paste your text below
                      </label>
                      <textarea
                        id="text-input"
                        rows={6}
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border resize-none"
                        placeholder="Enter text to summarize (min 50 characters)..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        disabled={isLimitReached}
                      />
                      <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                        <span>{textInput.length} characters</span>
                        <span>Min 50 required</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleSummarizeText}
                      disabled={
                        textInput.length < 50 || isProcessing || isLimitReached
                      }
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Summarize Text (10 credits)"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors relative ${
                        isLimitReached
                          ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        accept=".txt,.pdf,.doc,.docx"
                        onChange={(e) =>
                          setSelectedFile(e.target.files?.[0] || null)
                        }
                        disabled={isLimitReached}
                      />
                      <div className="flex flex-col items-center">
                        <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                          <Upload className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          {selectedFile
                            ? selectedFile.name
                            : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedFile
                            ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                            : "TXT, PDF, DOC up to 10MB"}
                        </p>
                      </div>
                    </div>
                    {selectedFile && (
                      <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md border border-blue-100">
                        <div className="flex items-center">
                          <FileIcon className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="text-sm text-blue-900 truncate max-w-[200px]">
                            {selectedFile.name}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isProcessing || isLimitReached}
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing File...
                        </>
                      ) : (
                        "Upload & Summarize (10 credits)"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Result Display */}
            {currentResult && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-slate-900 flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                    Summary Ready
                  </h3>
                  <span className="text-xs text-slate-500">Just now</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-slate-700 leading-relaxed">
                    {currentResult.summary}
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(currentResult.summary);
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full max-h-[calc(100vh-8rem)]">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">
                  My Summaries
                </h3>
                <span className="bg-slate-100 text-slate-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                  {summaries.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {summaries.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-900">
                      No summaries yet
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Your generated summaries will appear here.
                    </p>
                  </div>
                ) : (
                  summaries.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center flex-1">
                          <span
                            className={`h-8 w-8 rounded-lg flex items-center justify-center mr-3 ${
                              item.type === "file"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {item.type === "file" ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-900 truncate">
                              {item.type === "file"
                                ? item.filename
                                : "Text Analysis"}
                            </h4>
                            <p className="text-xs text-slate-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadSummary(item)}
                          className="text-green-600 hover:text-green-700 ml-2"
                          title="Download summary"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 pl-11">
                        {item.summary}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
