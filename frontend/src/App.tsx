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
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { UserDashboard } from "./pages/UserDashboard";
import { PackagesPage } from "./pages/PackagesPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { RequestActivationPage } from "./pages/RequestActivationPage";

// Initialize Stripe
const stripePublishableKey = (import.meta as any).env
  ?.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.error(
    "VITE_STRIPE_PUBLISHABLE_KEY is not set in environment variables"
  );
}

const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

function App() {
  return (
    <AuthProvider>
      <Elements stripe={stripePromise}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: "#0f172a", // slate-900
              color: "#ffffff",
              borderRadius: "0.75rem", // rounded-xl
              padding: "1rem 1.25rem",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid rgba(148, 163, 184, 0.1)", // subtle border
              fontSize: "0.875rem",
              fontWeight: "500",
              maxWidth: "420px",
            },
            success: {
              iconTheme: {
                primary: "#10b981", // green-500
                secondary: "#ffffff",
              },
              style: {
                background: "#0f172a", // slate-900
                color: "#ffffff",
                borderLeft: "4px solid #10b981", // green accent
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444", // red-500
                secondary: "#ffffff",
              },
              style: {
                background: "#0f172a", // slate-900
                color: "#ffffff",
                borderLeft: "4px solid #ef4444", // red accent
              },
            },
          }}
        />
        <Router>
          <Routes>
            {/* Public Landing Page (handles its own redirect if logged in) */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/request-activation" element={<RequestActivationPage />} />

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

            {/* Admin Dashboard Routes - admins only */}
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/files"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/text"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/summarize"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/packages"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/payments"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/folders"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/activations"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/sharing"
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
