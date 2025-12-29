import { FileText, MessageSquare, Download, Calendar } from "lucide-react";
import { Button } from "./ui/Button";

interface SummaryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    id: string;
    type: "text" | "file";
    summary: string;
    filename?: string;
    textName?: string;
    createdAt: string;
    content?: string;
  } | null;
  onDownload?: () => void;
}

export function SummaryPreviewModal({
  isOpen,
  onClose,
  summary,
  onDownload,
}: SummaryPreviewModalProps) {
  if (!isOpen || !summary) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                summary.type === "file"
                  ? "bg-purple-100 text-purple-600"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              {summary.type === "file" ? (
                <FileText className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {summary.type === "file"
                  ? summary.filename
                  : summary.textName || "Text Summary"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <Calendar className="h-3 w-3" />
                {formatDate(summary.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
                title="Download"
                aria-label="Download"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Original Content */}
            {summary.content && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Original Content
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap break-words break-all max-w-full overflow-x-auto">
                  {summary.content}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Summary
              </h3>
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap break-words break-all max-w-full overflow-x-auto">
                {summary.summary}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200">
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full rounded-lg"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
