import React, { useState, useEffect } from "react";
import { MessageSquare, Trash2, X, Download } from "lucide-react";
import { apiClient } from "../../lib/authClient";
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
interface TextSectionProps {
  texts: Summary[];
}
export function TextSection({ texts: initialTexts }: TextSectionProps) {
  const [texts, setTexts] = useState<Summary[]>([]);
  const [deletingText, setDeletingText] = useState<Summary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTextSummaries();
  }, []);

  const fetchTextSummaries = async () => {
    try {
      const response = await apiClient.get("/Texts/admin/summaries");
      const summaries = response.data.map((text: any) => ({
        id: text.id,
        userId: text.userId,
        userName: text.userEmail || "Unknown",
        type: "text" as const,
        content: text.text,
        summary: text.summary,
        createdAt: text.createdAt,
      }));
      setTexts(summaries);
    } catch (error) {
      console.error("Error fetching text summaries", error);
    }
  };

  const handleDelete = async () => {
    if (!deletingText || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/Texts/admin/${deletingText.id}`);
      setTexts(texts.filter((t) => t.id !== deletingText.id));
      setDeletingText(null);
    } catch (error) {
      console.error("Error deleting text summary", error);
      alert("Failed to delete text summary. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  const handleDownload = (text: Summary) => {
    const blob = new Blob([text.summary], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `text-summary-${
      new Date(text.createdAt).toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Text Summaries</h2>
      </div>

      {/* Delete Modal */}
      {deletingText && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Text Summary</h3>
              <button
                onClick={() => setDeletingText(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this text summary? This action
                cannot be undone.
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs text-slate-500 line-clamp-2">
                  {deletingText.content}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingText(null)}
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
                {isDeleting ? "Deleting..." : "Delete Summary"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {texts.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No summaries yet
                  </td>
                </tr>
              ) : (
                texts.map((text) => (
                  <tr key={text.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm text-slate-500 max-w-[200px] truncate">
                          {text.content}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {text.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(text.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(text)}
                        className="text-green-600 hover:text-green-900 mr-3"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingText(text)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
