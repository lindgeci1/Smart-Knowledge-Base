import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { RoleRoute } from "./components/guards/RoleRoute";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { UserDashboard } from "./pages/UserDashboard";
import { PackagesPage } from "./pages/PackagesPage";
import { CheckoutPage } from "./pages/CheckoutPage";

// Initialize Stripe
const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51QsjnVQF9XoPB98ZMfSziy8P7CdWek1KBqjPfjj5WhTkrGunPHE4IzJAZcGKWplgMcE8ZmiGJeFP8RfHAGQ5eQOa006MumVCKS";
const stripePromise = loadStripe(stripePublishableKey);

function App() {
  return (
    <AuthProvider>
      <Elements stripe={stripePromise}>
        <Toaster position="top-right" />
        <Router>
          <Routes>
            {/* Public Landing Page (handles its own redirect if logged in) */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes */}
            {/* User Dashboard - users only */}
            <Route
              path="/dashboard"
              element={
                <RoleRoute allowedRoles={["user"]}>
                  <UserDashboard />
                </RoleRoute>
              }
            />

            {/* Packages Page - users only */}
            <Route
              path="/packages"
              element={
                <RoleRoute allowedRoles={["user"]}>
                  <PackagesPage />
                </RoleRoute>
              }
            />

            {/* Checkout Page - users only */}
            <Route
              path="/checkout/:packageId"
              element={
                <RoleRoute allowedRoles={["user"]}>
                  <CheckoutPage />
                </RoleRoute>
              }
            />

            {/* Admin Dashboard - admins only */}
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />

            {/* Catch all - redirect to landing instead of login for better UX */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </Elements>
    </AuthProvider>
  );
}
export { App };
