// Auth and Axios helper for SmartKB Razor pages
const DEFAULT_API_BASE = "http://localhost:5074/api";
const envBase =
  (window?.env && window.env.VITE_API_BASE_URL) || DEFAULT_API_BASE;
const apiBaseUrl = envBase.replace(/\/+$/, "");

// Create axios instance
const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

function setJwtCookie(jwt) {
  if (!jwt) return;
  document.cookie = `token=${jwt}; path=/; max-age=900;`;
}

function clearJwtCookie() {
  document.cookie = "token=; path=/; max-age=0;";
}

export function getJwtFromCookie() {
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function showSessionExpiredModal() {
  // Check if modal already exists
  if (document.getElementById("sessionExpiredModal")) {
    return;
  }

  const modalHTML = `
    <div id="sessionExpiredModal" class="modal-overlay">
      <div class="session-expired-card">
        <div class="session-expired-header">
          <div class="session-expired-warning-icon"></div>
          <h2 class="session-expired-title">Session Expired</h2>
        </div>
        <div class="session-expired-body">
          <p class="session-expired-message">Your session has expired.<br>You will now be redirected to login...</p>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  const modal = document.getElementById("sessionExpiredModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

// Attach token on each request
apiClient.interceptors.request.use((config) => {
  const jwt = getJwtFromCookie();
  if (jwt) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${jwt}`;
  }
  config.withCredentials = true;
  return config;
});

// Renew on 401 and retry once
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const requestUrl = (original.url || "").toLowerCase();
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/renew") ||
      requestUrl.includes("/auth/logout");

    // Only handle 401 for non-auth endpoints and if we haven't already retried
    if (
      error.response?.status === 401 &&
      !original.__isRetryRequest &&
      !isAuthEndpoint
    ) {
      original.__isRetryRequest = true;
      try {
        // Try to renew JWT using refresh token
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
        // Renew failed - refresh token expired/invalid
        // Show session expired modal
        showSessionExpiredModal();

        // Call logout API to clean up refresh token in DB
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
          // ignore logout errors - backend will handle cleanup
        }
        // Clear JWT cookie and redirect to login after a short delay
        clearJwtCookie();
        setTimeout(() => {
          window.location.replace("/login");
        }, 2000);
        return Promise.reject(renewError);
      }
    }

    // For auth endpoints or other errors, just reject normally
    // Don't clear cookies or redirect - let the calling code handle it
    return Promise.reject(error);
  }
);

export async function login(email, password) {
  const res = await apiClient.post("/auth/login", { email, password });
  const jwt = res.data?.jwt || res.data?.Jwt;
  setJwtCookie(jwt);
  return res;
}

export async function register(email, password) {
  return apiClient.post("/auth/register", { email, password });
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // ignore errors
  } finally {
    clearJwtCookie();
    window.location.replace("/login");
  }
}

export { apiClient, setJwtCookie, clearJwtCookie, apiBaseUrl };
