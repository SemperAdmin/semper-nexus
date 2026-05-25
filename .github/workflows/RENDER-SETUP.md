# Setting Up Automated Deployment to Render.com

Guide for deploying the Nexus proxy server to Render.com with GitHub Actions integration.

## Prerequisites

Only one optional secret is required after the AI summary removal:

- `GITHUB_TOKEN` - PAT for the feedback widget to file issues. Required only if you want the feedback button to work.

## Step 1: Create Render account

1. Go to https://render.com and sign in with GitHub.
2. Authorize Render to access your repositories.

## Step 2: Create the Web Service

1. Click **New +** -> **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Connect your repository `furby203824/Nexus`.
4. Click **Connect**.

## Step 3: Configure service settings

- **Name:** `semper-nexus-proxy` (or your preferred name)
- **Region:** closest to your users (Oregon USA, Ohio USA)
- **Branch:** `main`
- **Root Directory:** `proxy-server`
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** Free for low traffic, Starter ($7/mo) for production

## Step 4: Set environment variables

In the **Environment** section, add only what you need:

| Key | Value | Required |
|-----|-------|----------|
| `GITHUB_TOKEN` | PAT with `repo` scope | Only if feedback widget is active |
| `GITHUB_REPO` | `furby203824/Nexus` | Defaulted in code, override if forked |
| `NODE_ENV` | `production` | Recommended |

## Step 5: Deploy

Click **Create Web Service**. Render will:

1. Clone your repository.
2. Install dependencies in `proxy-server/`.
3. Start the server with `npm start`.
4. Assign a URL like `https://semper-nexus-proxy.onrender.com`.

First deployment takes 2-3 minutes.

## Step 6: Wire the frontend

Update `app.js`:

```javascript
const CUSTOM_PROXY_URL = "https://semper-nexus-proxy.onrender.com";
```

Commit and push.

## Step 7: Enable auto-deploy

Render auto-deploys on push to `main` by default. Confirm at Service -> Settings -> Auto-Deploy.

## Step 8: Test the deployment

```bash
RENDER_URL="https://semper-nexus-proxy.onrender.com"

# 1. Health check
curl "$RENDER_URL/health"
# Expected: {"status":"ok","timestamp":"..."}

# 2. ALNAV proxy
curl "$RENDER_URL/api/alnav/2025"

# 3. Feedback endpoint (POST, requires GITHUB_TOKEN configured)
curl -X POST "$RENDER_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"type":"bug","title":"Test","description":"Test"}'
```

## Common issues

**503 on `/api/feedback`:** `GITHUB_TOKEN` not set in Render. Add it and restart.

**Build failed:** Check Render logs. Confirm Node version compatibility.

**Service will not start:** Confirm the code uses `process.env.PORT` (it does).

## Free tier limitations

- Free services sleep after 15 minutes of inactivity. First request takes 30-60 seconds to wake.
- 750 hours/month across all services.
- Upgrade to Starter ($7/mo) to eliminate cold starts in production.

## Local test before deploy

```bash
cd proxy-server
export GITHUB_TOKEN="your_pat_here"
export GITHUB_REPO="furby203824/Nexus"
npm install
npm start
# Server listens on http://localhost:3000
```

---

**Last Updated:** 2026-05-24
**Status:** Render deployment ready, AI integrations removed
