import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { getJwtFromCookie } from '../../lib/authClient';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({
  children
}: ProtectedRouteProps) {
  const {
    isAuthenticated,
    isLoading
  } = useAuth();
  const location = useLocation();

  // Check if JWT cookie exists (additional check for URL access)
  const jwtCookie = getJwtFromCookie();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // If no JWT cookie and not authenticated, redirect to login
  if (!jwtCookie && !isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // If authenticated, allow access
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback: if cookie exists but user not loaded, show loading
  if (jwtCookie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // No cookie and not authenticated
  return (
    <Navigate 
      to="/login" 
      state={{ from: location }} 
      replace 
    />
  );
}