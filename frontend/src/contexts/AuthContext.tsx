import React, { useEffect, useState, createContext } from 'react';
// Types
export type UserRole = 'admin' | 'user';
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
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  updateUserUsage: (increment: number) => void;
  updateUserLimit: (additionalLimit: number) => void;
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
// Mock helpers
const MOCK_DELAY = 800;
const mockUser = (email: string, role: UserRole, name: string): User => ({
  id: Math.random().toString(36).substr(2, 9),
  email,
  name,
  role,
  usageLimit: 100,
  usageCount: 0
});
export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      if (storedToken && storedUser) {
        try {
          // In a real app, we would validate the token with the backend here
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse stored user', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate API call
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Mock validation
        if (password.length < 6) {
          setIsLoading(false);
          reject(new Error('Password must be at least 6 characters'));
          return;
        }
        // Mock successful login
        // For demo purposes, if email contains 'admin', make them admin
        const role: UserRole = email.includes('admin') ? 'admin' : 'user';
        const name = email.split('@')[0];
        // Check if we have a stored user to preserve usage stats across logins for demo
        // In a real app, this comes from DB
        const storedUserStr = localStorage.getItem('auth_user');
        let userToSet: User;
        if (storedUserStr && JSON.parse(storedUserStr).email === email) {
          userToSet = JSON.parse(storedUserStr);
        } else {
          userToSet = mockUser(email, role, name.charAt(0).toUpperCase() + name.slice(1));
        }
        const newToken = 'mock_jwt_token_' + Math.random().toString(36);
        setUser(userToSet);
        setToken(newToken);
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(userToSet));
        setIsLoading(false);
        resolve();
      }, MOCK_DELAY);
    });
  };
  const register = async (name: string, email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    return new Promise<void>(resolve => {
      setTimeout(() => {
        const newUser = mockUser(email, role, name);
        const newToken = 'mock_jwt_token_' + Math.random().toString(36);
        setUser(newUser);
        setToken(newToken);
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        setIsLoading(false);
        resolve();
      }, MOCK_DELAY);
    });
  };
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };
  const updateUserUsage = (increment: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageCount: user.usageCount + increment
    };
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  };
  const updateUserLimit = (additionalLimit: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      usageLimit: user.usageLimit + additionalLimit
    };
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
  };
  return <AuthContext.Provider value={{
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    updateUserUsage,
    updateUserLimit
  }}>
      {children}
    </AuthContext.Provider>;
}