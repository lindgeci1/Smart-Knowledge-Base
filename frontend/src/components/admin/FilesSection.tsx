import React, { useState, useEffect } from "react";
import { FileText, Trash2, Upload, Edit2, X, Download } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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
interface FilesSectionProps {
  files: Summary[];
  onUpdate?: () => void;
}
export function FilesSection({
  files: initialFiles,
  onUpdate,
}: FilesSectionProps) {
  const [files, setFiles] = useState(initialFiles);

  // Update local state when props change
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);
  const [editingFile, setEditingFile] = useState<Summary | null>(null);
  const [deletingFile, setDeletingFile] = useState<Summary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState({
    filename: "",
    summary: "",
  });
  const handleDelete = async () => {
    if (!deletingFile) return;
    try {
      await apiClient.delete(`/Documents/document/${deletingFile.id}`);
      setFiles(files.filter((f) => f.id !== deletingFile.id));
      setDeletingFile(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to delete document", error);
      alert("Failed to delete document. Please try again.");
    }
  };
  const handleDownload = (file: Summary) => {
    const blob = new Blob([file.summary], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename || "file-summary.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFile: Summary = {
      id: Math.random().toString(36).substr(2, 9),
      userId: "admin",
      userName: "Admin User",
      type: "file",
      content: uploadData.filename,
      filename: uploadData.filename,
      summary: uploadData.summary,
      createdAt: new Date().toISOString(),
    };
    setFiles([newFile, ...files]);
    setIsUploading(false);
    setUploadData({
      filename: "",
      summary: "",
    });
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;
    try {
      await apiClient.put(`/Documents/document/${editingFile.id}`, {
        summary: editingFile.summary,
      });
      setFiles(files.map((f) => (f.id === editingFile.id ? editingFile : f)));
      setEditingFile(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to update document", error);
      alert("Failed to update document. Please try again.");
    }
  };
  const startEdit = (file: Summary) => {
    setEditingFile({
      ...file,
    });
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">File Management</h2>
        <Button onClick={() => setIsUploading(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload File
        </Button>
      </div>

      {/* Upload Modal */}
      {isUploading && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-medium mb-4">Upload New File</h3>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <Input
              label="Filename"
              placeholder="document.pdf"
              value={uploadData.filename}
              onChange={(e) =>
                setUploadData({
                  ...uploadData,
                  filename: e.target.value,
                })
              }
              required
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Summary
              </label>
              <textarea
                placeholder="Enter the summary for this file..."
                value={uploadData.summary}
                onChange={(e) =>
                  setUploadData({
                    ...uploadData,
                    summary: e.target.value,
                  })
                }
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsUploading(false);
                  setUploadData({
                    filename: "",
                    summary: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Upload File</Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit File</h3>
              <button
                onClick={() => setEditingFile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <Input
                label="Filename"
                value={editingFile.filename || ""}
                onChange={(e) =>
                  setEditingFile({
                    ...editingFile,
                    filename: e.target.value,
                    content: e.target.value,
                  })
                }
                required
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Summary
                </label>
                <textarea
                  value={editingFile.summary}
                  onChange={(e) =>
                    setEditingFile({
                      ...editingFile,
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
                  onClick={() => setEditingFile(null)}
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
      {deletingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete File</h3>
              <button
                onClick={() => setDeletingFile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {deletingFile.filename}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingFile(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete File
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
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Uploaded By
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
              {files.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No files uploaded yet
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-slate-900">
                          {file.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {file.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(file)}
                        className="text-green-600 hover:text-green-900 mr-3"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => startEdit(file)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingFile(file)}
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
