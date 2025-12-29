import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { UserPlus, ArrowLeft } from "lucide-react";
import { apiClient } from "../lib/authClient";
export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsValidating(true);

    try {
      // Check username availability
      const usernameResponse = await apiClient.post("/Users/check-username", {
        username,
      });
      if (usernameResponse.data.exists) {
        setError("This username is already taken");
        setIsValidating(false);
        return;
      }

      // Check email availability
      const emailResponse = await apiClient.post("/Users/check-email", {
        email,
      });
      if (emailResponse.data.exists) {
        setError("This email is already registered");
        setIsValidating(false);
        return;
      }

      // If both validations pass, register
      await register(email, username, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsValidating(false);
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
            <UserPlus className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Get started with our platform today
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Username"
              type="text"
              required
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading || isValidating}
            />

            <Input
              label="Email address"
              type="email"
              required
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || isValidating}
            />

            <PasswordInput
              label="Password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || isValidating}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 text-center">{error}</div>
          )}

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading || isValidating}
            disabled={isLoading || isValidating}
          >
            Create Account
          </Button>

          <div className="text-center text-sm">
            <span className="text-slate-600">Already have an account? </span>
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
