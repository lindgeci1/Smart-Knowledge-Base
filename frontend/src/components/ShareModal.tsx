import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/Button";
import toast from "react-hot-toast";
import { apiClient } from "../lib/authClient";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  currentUserEmail?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  currentUserEmail,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Prevent sharing with yourself
    if (currentUserEmail && email.trim().toLowerCase() === currentUserEmail.toLowerCase()) {
      toast.error("You cannot share a document with yourself");
      return;
    }

    setIsSharing(true);
    try {
      const response = await apiClient.post(`/Documents/${documentId}/share`, {
        email: email.trim(),
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      toast.success("Document shared successfully!");
      setEmail("");
      onClose();
    } catch (error: any) {
      console.error("Share error:", error);
      let errorMessage = "Failed to share document";
      
      if (error.response?.data) {
        if (typeof error.response.data === "string") {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Share Document
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Share "{documentName}" with another user
          </p>

          <div className="mb-4">
            <label
              htmlFor="share-email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Email Address
            </label>
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSharing}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={isSharing}>
              {isSharing ? "Sharing..." : "Share"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
