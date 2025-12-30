import React, { useEffect, useState, createContext, ReactNode } from "react";
import {
  apiClient,
  getJwtFromCookie,
  setJwtCookie,
  clearJwtCookie,
  decodeJWT,
} from "../lib/authClient";

// Types
export type UserRole = "admin" | "user";
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  usageLimit: number;
  usageCount: number;
}
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserUsage: (increment: number) => void;
  updateUserLimit: (additionalLimit: number) => void;
  updateUsername: (newUsername: string) => void;
}
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Helper to get email from localStorage
const getStoredEmail = (): string => {
  try {
    return localStorage.getItem("user_email") || "";
  } catch {
    return "";
  }
};

// Helper to store email in localStorage
const storeEmail = (email: string): void => {
  try {
    localStorage.setItem("user_email", email);
  } catch {
    // Ignore localStorage errors
  }
};

// Helper to create user object from JWT
const createUserFromJWT = (jwt: string): User | null => {
  const decoded = decodeJWT(jwt);
  if (!decoded) return null;

  return {
    id: decoded.userId,
    email: getStoredEmail(), // Get email from localStorage
    name: decoded.username || "",
    role: decoded.role,
    usageLimit: 100,
    usageCount: 0,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state from JWT cookie
  useEffect(() => {
    const initAuth = async () => {
      try {
        const jwt = getJwtFromCookie();
        if (jwt) {
          const userFromJWT = createUserFromJWT(jwt);
          if (userFromJWT) {
            setToken(jwt);
            setUser(userFromJWT);
          } else {
            // Invalid JWT, clear cookie
            clearJwtCookie();
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth", error);
        clearJwtCookie();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const jwt = response.data?.Jwt || response.data?.jwt;

      if (!jwt) {
        throw new Error("No token received from server");
      }

      // Store JWT in cookie
      setJwtCookie(jwt);

      // Decode JWT to get user info
      const userFromJWT = createUserFromJWT(jwt);
      if (!userFromJWT) {
        throw new Error("Failed to decode token");
      }

      // Update user email from login (backend doesn't return it, but we know it)
      userFromJWT.email = email;
      storeEmail(email); // Store email in localStorage

      setToken(jwt);
      setUser(userFromJWT);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);

      // Check for network errors
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error")
      ) {
        throw new Error("Network Error");
      }

      // Check for 401 Unauthorized
      if (error.response?.status === 401) {
        throw new Error("Invalid email or password");
      }

      // Other errors
      const message = error.response?.data || error.message || "Login failed";
      throw new Error(typeof message === "string" ? message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/register", {
        email,
        username,
        password,
      });

      // After registration, automatically login
      await login(email, password);
    } catch (error: any) {
      clearJwtCookie();
      setToken(null);
      setUser(null);

      // Check for network errors
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error")
      ) {
        throw new Error("Network Error");
      }

      // Other errors
      const message =
        error.response?.data || error.message || "Registration failed";
      throw new Error(
        typeof message === "string" ? message : "Failed to create account"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout API to clean up refresh token
      await apiClient.post("/auth/logout");
    } catch (error) {
      // Ignore logout errors - cleanup anyway
    } finally {
      // Clear local state
      clearJwtCookie();
      localStorage.removeItem("user_email"); // Clear stored email
      setUser(null);
      setToken(null);
    }
  };
  const updateUserUsage = (increment: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageCount: user.usageCount + increment,
    };
    setUser(updatedUser);
  };

  const updateUserLimit = (additionalLimit: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageLimit: user.usageLimit + additionalLimit,
    };
    setUser(updatedUser);
  };

  const updateUsername = (newUsername: string) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      name: newUsername,
    };
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUserUsage,
        updateUserLimit,
        updateUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
