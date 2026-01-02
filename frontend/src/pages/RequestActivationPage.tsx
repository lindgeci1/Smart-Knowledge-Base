import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { apiClient } from "../lib/authClient";
import { UserCheck, ArrowLeft, Mail, FileText } from "lucide-react";
import toast from "react-hot-toast";

export function RequestActivationPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/Activation/request", {
        email: email.trim(),
      });

      // Show success notification
      toast.success("Activation request submitted successfully! We'll review your request and get back to you soon.", {
        duration: 6000,
      });

      // Small delay to ensure toast is visible, then redirect
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
    } catch (err: any) {
      console.error("Activation request error:", err);
      
      let errorMessage = "Failed to submit activation request. Please try again.";
      
      if (err.response?.data) {
        if (typeof err.response.data === "string") {
          errorMessage = err.response.data;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100 relative">
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
          title="Go back to home"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <UserCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Request Account Activation
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Submit a request to have your account reactivated. Our administrators will review your request.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Request Type
              </label>
              <Input
                type="text"
                value="Account Activation Request"
                disabled
                className="bg-slate-50 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">
                This request is for account reactivation
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Submit Request
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-slate-600">Remember your credentials? </span>
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign in here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

