# GitHub OAuth + Deployment (Render, Vercel, Docker)

## 1. Create GitHub OAuth App

1. Go to **GitHub** → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**  
   Or: https://github.com/settings/developers → OAuth Apps → New OAuth App

2. Fill in:
   - **Application name:** e.g. SmartKB (or your app name)
   - **Homepage URL:**  
     - Local: `http://localhost:5173`  
     - Production: `https://smart-knowledge-base.vercel.app` (or your frontend URL)
   - **Authorization callback URL:** GitHub allows **only one** URL per OAuth App. So you need **two** OAuth Apps (see below): one for production, one for local.

3. Click **Register application**. Copy the **Client ID**. Click **Generate a new client secret** and copy the **Client secret** (you won’t see it again).

---

## 1b. Two OAuth Apps (production + local)

Because GitHub allows **only one** Authorization callback URL per app, create **two** OAuth Apps and use different credentials per environment:

| App | Application name | Homepage URL | Authorization callback URL |
|-----|------------------|--------------|----------------------------|
| **Production** | e.g. SmartKB | `https://smart-knowledge-base.vercel.app` | `https://smart-knowledge-base.vercel.app/auth/github/callback` |
| **Local / dev** | e.g. SmartKB (Local) | `http://localhost:5173` | `http://localhost:5173/auth/github/callback` |

- **Local:** In your backend `.env` and frontend `.env`, use the **Client ID** and **Client secret** from the **Local** OAuth App.
- **Render + Vercel:** In Render (backend) and Vercel (frontend) env vars, use the **Client ID** and **Client secret** from the **Production** OAuth App.

No code changes: the app just reads whatever `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `VITE_GITHUB_CLIENT_ID` are set in each environment.

---

## 2. What to add where

### Backend (Render or any backend host)

Set these **environment variables** (no code or Docker change needed):

| Variable | Value | Required |
|----------|--------|----------|
| `GITHUB_CLIENT_ID` | Your GitHub OAuth **Client ID** | Yes, for GitHub login |
| `GITHUB_CLIENT_SECRET` | Your GitHub OAuth **Client secret** | Yes, for GitHub login |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | Yes, if you use Google login |
| `JWT_KEY` | Your JWT signing key | Yes |
| `MONGODB_CONNECTION_STRING` | MongoDB connection string | Yes |
| `MONGODB_DATABASE_NAME` | Database name | Yes |
| `FRONTEND_URL` | Frontend origin(s), e.g. `https://smart-knowledge-base.vercel.app` | Yes, for CORS |

- **Render:** Dashboard → your **Web Service** → **Environment** → Add each variable.
- **Other backend hosts:** Use their env / config UI and add the same names and values.

You do **not** need to install anything extra for GitHub: the backend uses the built-in `HttpClient` (and `IHttpClientFactory`). No new NuGet packages or Docker layers are required.

---

### Frontend (Vercel)

Set these **environment variables** in Vercel:

| Variable | Value | Environment |
|----------|--------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | Production (and Preview if you use it) |
| `VITE_GITHUB_CLIENT_ID` | Your GitHub OAuth **Client ID** (not the secret) | Production (and Preview if you use it) |
| `VITE_API_BASE_URL` | Your backend API URL (e.g. `https://your-app.onrender.com/api`) | Production / Preview if you call API from client |

- **Vercel:** Project → **Settings** → **Environment Variables** → Add each variable, then **redeploy** the frontend so they take effect.

The **Client secret** must **never** be in the frontend or in Vite env; it stays only on the backend.

---

### Backend Dockerfile

You do **not** need to add any new installs or download anything for GitHub OAuth.

- The app uses:
  - `HttpClient` / `IHttpClientFactory` (built into ASP.NET Core)
  - `System.Text.Json` (built-in)
- No extra NuGet packages were added for GitHub.

So your existing **Dockerfile** is fine. If you later add other providers (e.g. Microsoft), you still only need env vars; no Docker changes unless you add a new NuGet package.

If your backend is running as a **Docker container** on Render (or elsewhere), set the same backend env vars in the **Render (or host) environment** for that service; Docker doesn’t need a separate step.

---

## 3. Callback URL summary

| Environment | Callback URL |
|-------------|----------------|
| Local frontend | `http://localhost:5173/auth/github/callback` |
| Vercel (production) | `https://smart-knowledge-base.vercel.app/auth/github/callback` |

Each GitHub OAuth App has exactly one **Authorization callback URL** (see section 1b for using two apps). The frontend redirects users to GitHub, then GitHub redirects back to this callback; the frontend sends the `code` to your backend, which exchanges it for an access token and completes sign-in.

---

## 4. Flow (same as Google: one account per email)

- **New GitHub user:** Backend creates a user (email from GitHub, `GitHubId` set), then issues JWT.
- **Existing email (same as GitHub):** Backend finds user by email, sets `GitHubId` (links), then issues JWT.
- **Already linked GitHub:** Backend finds user by `GitHubId`, issues JWT.

No duplicate accounts; one account per email, link by email.
