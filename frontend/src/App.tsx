import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoleRoute } from './components/guards/RoleRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';
import { PackagesPage } from './pages/PackagesPage';
function App() {
  return <AuthProvider>
      <Router>
        <Routes>
          {/* Public Landing Page (handles its own redirect if logged in) */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          {/* User Dashboard - users only */}
          <Route path="/dashboard" element={<RoleRoute allowedRoles={['user']}>
                <UserDashboard />
              </RoleRoute>} />

          {/* Packages Page - users only */}
          <Route path="/packages" element={<RoleRoute allowedRoles={['user']}>
                <PackagesPage />
              </RoleRoute>} />

          {/* Admin Dashboard - admins only */}
          <Route path="/admin" element={<RoleRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </RoleRoute>} />

          {/* Catch all - redirect to landing instead of login for better UX */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>;
}
export { App };