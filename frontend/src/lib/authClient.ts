import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// Use relative path in production (Vercel proxy forwards to backend)
// Use full URL in development (no proxy locally)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Helper functions for JWT cookie management
export function setJwtCookie(jwt: string): void {
  if (!jwt) return;
  // Set cookie with 15 minutes expiration (matches backend JWT expiration)
  document.cookie = `token=${jwt}; path=/; max-age=900; SameSite=Strict`;
}

export function getJwtFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearJwtCookie(): void {
  document.cookie = "token=; path=/; max-age=0;";
}

// Decode JWT to get user info
export function decodeJWT(
  token: string
): { userId: string; role: string } | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);

    // Backend uses "userId" claim and "http://schemas.microsoft.com/ws/2008/06/identity/claims/role" for role
    const roleClaim =
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      decoded.role;

    return {
      userId: decoded.userId,
      username: decoded.username || "",
      role: roleClaim === "1" ? "admin" : "user", // Backend uses 1 for admin, 2 for user
    };
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important: sends cookies (including refresh token)
});
let isHandlingDeactivation = false;

// Request interceptor: Attach JWT from cookie to each request
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const jwt = getJwtFromCookie();
    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token renewal on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 403 - Account deactivated
    if (error.response?.status === 403 && !isHandlingDeactivation) {
      isHandlingDeactivation = true;
      
      // Get the message from the response
      const responseData = error.response.data as { message?: string };
      const message = responseData?.message || "Your account has been deactivated. Please contact an administrator.";
      
      // Show first toast notification
      import("react-hot-toast").then(({ default: toast }) => {
        toast.error(message, { duration: 2000 });
        
        // Show second toast after 1.5 seconds
        setTimeout(() => {
          toast.loading("Logging out...", { duration: 1500 });
        }, 1500);
      });

      // Wait for both toasts to show, then logout
      setTimeout(async () => {
        try {
          // Call logout API to clean up refresh token (HttpOnly cookie)
          const currentJwt = getJwtFromCookie();
          
          if (currentJwt) {
            await axios.post(
              `${API_BASE_URL}/auth/logout`,
              {},
              {
                withCredentials: true,
                headers: {
                  Authorization: `Bearer ${currentJwt}`,
                },
              }
            );
          } else {
            await axios.post(
              `${API_BASE_URL}/auth/logout`,
              {},
              { withCredentials: true }
            );
          }
          
          // Wait a moment for browser to process cookie deletion from server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (logoutError) {
          // Ignore logout errors but still wait
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Clear JWT cookie and local storage
        clearJwtCookie();
        localStorage.removeItem("user_email");
        
        // Redirect to login
        window.location.href = "/login";
      }, 3000);

      return Promise.reject(error);
    }

    // Don't retry auth endpoints
    const isAuthEndpoint =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/renew") ||
      originalRequest?.url?.includes("/auth/logout") ||
      originalRequest?.url?.includes("/auth/forgot-password") ||
      originalRequest?.url?.includes("/auth/verify-reset-code") ||
      originalRequest?.url?.includes("/auth/reset-password");

    // Only handle 401 for non-auth endpoints and if we haven't already retried
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        // Try to renew JWT using refresh token
        const renewResponse = await axios.post(
          `${API_BASE_URL}/auth/renew`,
          {},
          { withCredentials: true }
        );

        const newJwt = renewResponse.data?.Jwt || renewResponse.data?.jwt;
        if (newJwt) {
          setJwtCookie(newJwt);
          // Retry the original request with new JWT
          originalRequest.headers.Authorization = `Bearer ${newJwt}`;
          return apiClient(originalRequest);
        }
      } catch (renewError) {
        // Renew failed - refresh token expired/invalid
        // Call logout API to clean up
        try {
          const currentJwt = getJwtFromCookie();
          if (currentJwt) {
            await axios.post(
              `${API_BASE_URL}/auth/logout`,
              {},
              {
                withCredentials: true,
                headers: {
                  Authorization: `Bearer ${currentJwt}`,
                },
              }
            );
          } else {
            // Even without JWT, try logout (backend handles refresh token cookie)
            await axios.post(
              `${API_BASE_URL}/auth/logout`,
              {},
              { withCredentials: true }
            );
          }
        } catch (logoutError) {
          // Ignore logout errors
        }
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear JWT cookie and redirect to login
        clearJwtCookie();
        window.location.href = "/login";
        return Promise.reject(renewError);
      }
    }

    return Promise.reject(error);
  }
);
