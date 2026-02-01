import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Loader2 } from "lucide-react";

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGitHub } = useAuth();
  const [error, setError] = useState("");
  const submittedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(errorParam === "access_denied" ? "GitHub sign-in was cancelled." : "GitHub sign-in failed.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    if (!code) {
      setError("Missing code from GitHub.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    // Prevent double submission (React Strict Mode / remounts). OAuth codes are single-use.
    if (submittedRef.current) return;
    submittedRef.current = true;

    const redirectUri = `${window.location.origin}/auth/github/callback`;
    loginWithGitHub(code, redirectUri)
      .then(() => {
        navigate("/dashboard", { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message || "GitHub sign-in failed.");
        setTimeout(() => navigate("/login"), 3000);
      });
  }, [searchParams, navigate, loginWithGitHub]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-sm text-slate-500 mt-2">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-4 text-slate-600">Completing GitHub sign-in...</p>
          </>
        )}
      </div>
    </div>
  );
}
