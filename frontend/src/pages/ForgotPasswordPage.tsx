import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Mail, ArrowLeft } from "lucide-react";
import { apiClient } from "../lib/authClient";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await apiClient.post("/auth/forgot-password", { email });
      setIsSubmitted(true);
    } catch (err: any) {
      // Check if it's a network error (backend down)
      if (
        err.code === "ERR_NETWORK" ||
        err.message?.includes("Network Error")
      ) {
        setError("Unable to connect to server. Please try again later.");
      } else {
        setError(err.message || "Failed to send reset link. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100 relative">
        <button
          onClick={() => navigate("/login")}
          className="absolute top-4 left-4 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
          title="Go back to login"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Mail className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Forgot Password
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isSubmitted
              ? "Check your email for reset instructions"
              : "Enter your email address and we'll send you a link to reset your password"}
          </p>
        </div>

        {!isSubmitted ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <Input
                label="Email address"
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Send Reset Link
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-slate-600">Remember your password? </span>
              <Link
                to="/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">
                If an account exists with that email, we've sent password reset
                instructions.
              </p>
            </div>

            <div className="text-center text-sm">
              <span className="text-slate-600">Didn't receive the email? </span>
              <button
                onClick={() => setIsSubmitted(false)}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Try again
              </button>
            </div>

            <div className="text-center">
              <Link
                to={`/reset-password?email=${encodeURIComponent(email)}`}
                className="inline-block mt-4"
              >
                <Button type="button" className="w-full">
                  Enter Reset Code
                </Button>
              </Link>
            </div>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Back to Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
