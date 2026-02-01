import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import type { LoginTwoFactorRequired } from "../contexts/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [step2FA, setStep2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const { login, loginWithGoogle, loginWithTwoFactor, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const twoFa = err as LoginTwoFactorRequired & Error;
      if (twoFa?.requiresTwoFactor && twoFa?.tempToken) {
        setTempToken(twoFa.tempToken);
        setStep2FA(true);
        setTwoFactorCode("");
        return;
      }
      if (
        err.message?.includes("ERR_CONNECTION_REFUSED") ||
        err.message?.includes("Network Error") ||
        err.code === "ERR_NETWORK"
      ) {
        setError("Unable to connect to server. Please try again later.");
      } else if (
        err.message?.includes("401") ||
        err.message?.includes("Invalid")
      ) {
        setError("Invalid email or password");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!tempToken || twoFactorCode.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    try {
      await loginWithTwoFactor(tempToken, twoFactorCode);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid code. Please try again.");
    }
  };

  if (step2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-slate-100 relative">
          <button
            onClick={() => {
              setStep2FA(false);
              setTempToken("");
              setTwoFactorCode("");
              setError("");
            }}
            className="absolute top-4 left-4 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
            title="Back to sign in"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            <span className="text-sm">Back</span>
          </button>
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
              Two-factor authentication
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleTwoFactorSubmit}>
            <div className="space-y-4">
              <Input
                label="Verification code"
                type="text"
                required
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Verify and sign in
            </Button>
          </form>
        </div>
      </div>
    );
  }

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
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to access your dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              required
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />

            <PasswordInput
              label="Password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            {/* Custom Google button (same style as GitHub, centered icon + text); official Google button overlaid transparently so clicks still trigger Google sign-in */}
            <div className="relative w-full max-w-[320px] h-[42px]">
              <button
                type="button"
                className="w-full h-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md pointer-events-none"
                aria-hidden
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              <div className="absolute inset-0 flex justify-center items-center opacity-0 [&>div]:!min-w-[320px] [&_iframe]:!min-w-[320px]" style={{ pointerEvents: "auto" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (!credentialResponse?.credential) return;
                    setError("");
                    try {
                      await loginWithGoogle(credentialResponse.credential);
                      navigate(from, { replace: true });
                    } catch (err: any) {
                      setError(err.message || "Google sign-in failed.");
                    }
                  }}
                  onError={() => {
                    setError("Google sign-in was cancelled or failed.");
                  }}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  width="320"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const clientId = (import.meta as any).env?.VITE_GITHUB_CLIENT_ID_LOCAL ?? (import.meta as any).env?.VITE_GITHUB_CLIENT_ID;
                if (!clientId) {
                  setError("GitHub sign-in is not configured.");
                  return;
                }
                setError("");
                const redirectUri = `${window.location.origin}/auth/github/callback`;
                window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=github`;
              }}
              className="w-full max-w-[320px] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-slate-600">Don't have an account? </span>
            <Link
              to="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
