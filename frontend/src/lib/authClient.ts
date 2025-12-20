import type { AxiosInstance, AxiosResponse, AxiosRequestHeaders } from "axios";
import axios from "axios";

// --- API base URL (mirrors backend wwwroot/js/auth.js logic) ---
// Use HTTPS on the correct Kestrel port from launchSettings (7202)
const DEFAULT_API_BASE = "http://localhost:5074/api";

const envBase =
  // Vite-style env first
  (import.meta as any).env?.VITE_API_BASE_URL ||
  // Fallback to window.env (for parity with Razor pages helper)
  (typeof window !== "undefined" && (window as any).env?.VITE_API_BASE_URL) ||
  DEFAULT_API_BASE;

export const apiBaseUrl = envBase.replace(/\/+$/, "");

// --- JWT cookie helpers (same name & behaviour as Razor pages) ---
const TOKEN_COOKIE_NAME = "token";

export function setJwtCookie(jwt: string | null | undefined) {
  if (!jwt || typeof document === "undefined") return;
  // 15 minutes (900 seconds) same as backend JWT expiry
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(
    jwt
  )}; path=/; max-age=900;`;
}

export function clearJwtCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; path=/; max-age=0;`;
}

export function getJwtFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + TOKEN_COOKIE_NAME + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// --- Axios client with interceptors (copied from auth.js behaviour) ---
const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

// Attach token on each request from cookie
apiClient.interceptors.request.use((config) => {
  const jwt = getJwtFromCookie();
  if (jwt) {
    const headers: AxiosRequestHeaders =
      (config.headers as AxiosRequestHeaders) || {};
    headers.Authorization = `Bearer ${jwt}`;
    config.headers = headers;
  }
  config.withCredentials = true;
  return config;
});

// Renew on 401 and retry once (same logic as backend auth.js)
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: any) => {
    const original: any = error.config || {};
    const requestUrl = (original.url || "").toLowerCase();
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/renew") ||
      requestUrl.includes("/auth/logout");

    if (
      error.response?.status === 401 &&
      !original.__isRetryRequest &&
      !isAuthEndpoint
    ) {
      original.__isRetryRequest = true;
      try {
        const renewRes = await axios.post(
          `${apiBaseUrl}/auth/renew`,
          {},
          { withCredentials: true }
        );
        const newJwt = renewRes.data?.jwt || renewRes.data?.Jwt;
        if (newJwt) {
          setJwtCookie(newJwt);
          // Retry the original request with new JWT
          return apiClient(original);
        }
      } catch (renewError) {
        // Renew failed – try to log out on backend and then clear cookie
        try {
          const currentJwt = getJwtFromCookie();
          if (currentJwt) {
            await axios.post(
              `${apiBaseUrl}/auth/logout`,
              {},
              {
                withCredentials: true,
                headers: {
                  Authorization: `Bearer ${currentJwt}`,
                },
              }
            );
          }
        } catch {
          // ignore logout errors
        }
        clearJwtCookie();
        return Promise.reject(renewError);
      }
    }

    return Promise.reject(error);
  }
);

// --- Low-level auth API wrappers (mirroring wwwroot/js/auth.js) ---
export async function loginRequest(email: string, password: string) {
  const res = await apiClient.post("/auth/login", { email, password });
  const jwt: string | undefined = res.data?.jwt || res.data?.Jwt;
  if (jwt) {
    setJwtCookie(jwt);
  }
  return { res, jwt };
}

export async function registerRequest(email: string, password: string) {
  return apiClient.post("/auth/register", { email, password });
}

export async function logoutRequest() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // ignore errors
  } finally {
    clearJwtCookie();
  }
}

// --- JWT decode helper (used to derive role from token) ---
export interface JwtPayload {
  userId?: string;
  // ClaimTypes.Role -> "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string;
  [key: string]: unknown;
}

export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch (err) {
    console.error("Failed to decode JWT", err);
    return null;
  }
}

export { apiClient };

