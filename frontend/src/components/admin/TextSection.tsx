import React, { useState, useEffect } from "react";
import { MessageSquare, Trash2, Plus, Edit2, X, Download } from "lucide-react";
import { Button } from "../ui/Button";
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
  onUpdate?: () => void;
}
export function TextSection({
  texts: initialTexts,
  onUpdate,
}: TextSectionProps) {
  const [texts, setTexts] = useState(initialTexts);

  // Update local state when props change
  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);
  const [editingText, setEditingText] = useState<Summary | null>(null);
  const [deletingText, setDeletingText] = useState<Summary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createData, setCreateData] = useState({
    content: "",
    summary: "",
  });
  const handleDelete = async () => {
    if (!deletingText) return;
    try {
      await apiClient.delete(`/Documents/text/${deletingText.id}`);
      setTexts(texts.filter((t) => t.id !== deletingText.id));
      setDeletingText(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to delete text", error);
      alert("Failed to delete text summary. Please try again.");
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
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newText: Summary = {
      id: Math.random().toString(36).substr(2, 9),
      userId: "admin",
      userName: "Admin User",
      type: "text",
      content: createData.content,
      summary: createData.summary,
      createdAt: new Date().toISOString(),
    };
    setTexts([newText, ...texts]);
    setIsCreating(false);
    setCreateData({
      content: "",
      summary: "",
    });
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingText) return;
    try {
      await apiClient.put(`/Documents/text/${editingText.id}`, {
        text: editingText.content,
        summary: editingText.summary,
      });
      setTexts(texts.map((t) => (t.id === editingText.id ? editingText : t)));
      setEditingText(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to update text", error);
      alert("Failed to update text summary. Please try again.");
    }
  };
  const startEdit = (text: Summary) => {
    setEditingText({
      ...text,
    });
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Text Summaries</h2>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Summary
        </Button>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create Text Summary</h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setCreateData({
                    content: "",
                    summary: "",
                  });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Content Preview
                </label>
                <textarea
                  placeholder="Enter the original text content..."
                  value={createData.content}
                  onChange={(e) =>
                    setCreateData({
                      ...createData,
                      content: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Summary
                </label>
                <textarea
                  placeholder="Enter the summary..."
                  value={createData.summary}
                  onChange={(e) =>
                    setCreateData({
                      ...createData,
                      summary: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setCreateData({
                      content: "",
                      summary: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Summary</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingText && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Text Summary</h3>
              <button
                onClick={() => setEditingText(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Content Preview
                </label>
                <textarea
                  value={editingText.content}
                  onChange={(e) =>
                    setEditingText({
                      ...editingText,
                      content: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Summary
                </label>
                <textarea
                  value={editingText.summary}
                  onChange={(e) =>
                    setEditingText({
                      ...editingText,
                      summary: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingText(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingText(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Summary
              </Button>
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
                        onClick={() => startEdit(text)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
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
