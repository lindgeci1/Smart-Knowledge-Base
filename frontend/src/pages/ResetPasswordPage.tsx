import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Key, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "../lib/authClient";
import { AxiosError } from "axios";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";

  const [email] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const navigate = useNavigate();

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) {
      toast.error("Please enter both email and code");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/auth/verify-reset-code", { email, code });
      setIsCodeVerified(true);
      toast.success("Code verified successfully!");
    } catch (err: unknown) {
      let errorMessage = "Invalid or expired code. Please try again.";

      if (err instanceof AxiosError) {
        // Extract error message from backend response
        const responseData = err.response?.data;
        if (typeof responseData === "string") {
          errorMessage = responseData;
        } else if (responseData && typeof responseData === "object") {
          const data = responseData as { message?: string; error?: string };
          errorMessage = data.message || data.error || errorMessage;
        } else if (err.response?.status === 404) {
          errorMessage = "Invalid email or code. Please check and try again.";
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !code || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      setIsPasswordReset(true);
      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: unknown) {
      let errorMessage = "Failed to reset password. Please try again.";

      if (err instanceof AxiosError) {
        // Extract error message from backend response
        const responseData = err.response?.data;
        if (typeof responseData === "string") {
          errorMessage = responseData;
        } else if (responseData && typeof responseData === "object") {
          const data = responseData as { message?: string; error?: string };
          errorMessage = data.message || data.error || errorMessage;
        } else if (err.response?.status === 404) {
          errorMessage = "Invalid email or code. Please check and try again.";
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100 relative">
        <button
          onClick={() => navigate("/forgot-password")}
          disabled={isPasswordReset}
          className={`absolute top-4 left-4 flex items-center text-slate-500 hover:text-slate-700 transition-colors ${
            isPasswordReset ? "opacity-50 cursor-not-allowed" : ""
          }`}
          title="Go back"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Key className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isCodeVerified
              ? "Enter your new password"
              : "Enter the code sent to your email"}
          </p>
        </div>

        {!isCodeVerified ? (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div>
              <Input
                label="Email address"
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                readOnly
                disabled
                className="bg-slate-50 cursor-not-allowed"
              />
            </div>

            <div>
              <Input
                label="Reset Code"
                type="text"
                required
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  setCode(value);
                }}
                maxLength={6}
                disabled={isLoading || isPasswordReset}
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={isPasswordReset}
              >
                Verify Code
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-slate-600">Didn't receive the code? </span>
              {isPasswordReset ? (
                <span className="font-medium text-slate-400">
                  Request new code
                </span>
              ) : (
                <Link
                  to="/forgot-password"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Request new code
                </Link>
              )}
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div>
              <Input
                label="Email address"
                type="email"
                required
                value={email}
                disabled
                className="bg-slate-50"
              />
            </div>

            <div>
              <Input
                label="Reset Code"
                type="text"
                required
                value={code}
                disabled
                className="bg-slate-50"
              />
            </div>

            <div>
              <PasswordInput
                label="New Password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading || isPasswordReset}
              />
            </div>

            <div>
              <PasswordInput
                label="Confirm New Password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading || isPasswordReset}
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={isPasswordReset}
              >
                Reset Password
              </Button>
            </div>

            <div className="text-center text-sm">
              {isPasswordReset ? (
                <span className="font-medium text-slate-400">
                  Back to Sign in
                </span>
              ) : (
                <Link
                  to="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Back to Sign in
                </Link>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
