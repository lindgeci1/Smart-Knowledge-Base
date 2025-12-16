import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}
export function RoleRoute({
  children,
  allowedRoles
}: RoleRouteProps) {
  const {
    user,
    isAuthenticated,
    isLoading
  } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{
      from: location
    }} replace />;
  }
  if (user && !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
}