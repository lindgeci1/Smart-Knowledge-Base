import { FileText, MessageSquare, Download, Calendar, Loader2, Share2, Trash2 } from "lucide-react";
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
    documentName?: string;
    createdAt: string;
    content?: string;
  } | null;
  onDownload?: () => void;
  isDownloading?: boolean;
  onShare?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}

export function SummaryPreviewModal({
  isOpen,
  onClose,
  summary,
  onDownload,
  isDownloading = false,
  onShare,
  onDelete,
  deleteDisabled = false,
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
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4"
      style={{ margin: 0 }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span
              className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                summary.type === "file"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              }`}
            >
              {summary.type === "file" ? (
                <FileText className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 break-words leading-tight">
                {summary.type === "file"
                  ? summary.documentName || summary.filename || "File Summary"
                  : summary.textName || "Text Summary"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <Calendar className="h-3 w-3" />
                {formatDate(summary.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onShare && summary.type === "file" && (
              <button
                onClick={onShare}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                title="Share"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={deleteDisabled}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Move to Trash"
                aria-label="Move to Trash"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                disabled={isDownloading}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download"
                aria-label="Download"
              >
                {isDownloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          <div className="space-y-6">
            {/* Original Content */}
            {summary.content && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Original Content{summary.type === "file" ? " (file)" : ""}
                </h3>
                <div
                  className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words border border-slate-300 dark:border-slate-600 max-h-[40vh] overflow-y-auto"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {summary.content}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Summary
              </h3>
              <div
                className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words border border-slate-300 dark:border-slate-600"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {summary.summary}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-300 dark:border-slate-700">
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
