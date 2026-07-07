# cloud.gov Deployment - Semper Nexus Frontend

Last verified: 2026-07-07. Build tested against main at commit 448dd7b.

## Architecture

- Static frontend (this repo, built by Vite into `dist/`) deploys to cloud.gov via the staticfile buildpack.
- The API proxy (`proxy-server/`) stays on Render at `https://semper-nexus-proxy.onrender.com`. It is NOT part of this cf push.
- The proxy CORS allowlist in `proxy-server/server.js` must contain your cloud.gov route. `https://nexus.app.cloud.gov` has been added. If your app name or route differs, update line 36 and redeploy the proxy on Render.

## Prerequisites

1. cloud.gov account with an org and space you own. Sandbox spaces work for testing.
2. cf CLI v8 installed. Windows installer: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html
3. Node 20+ and npm installed locally.

## Deploy Steps (run from the repo root)

```powershell
# 1. Log in. cloud.gov uses SSO - this opens a browser for a one-time passcode.
cf login -a api.fr.cloud.gov --sso

# 2. Target your org and space. List them with: cf orgs / cf spaces
cf target -o YOUR-ORG -s YOUR-SPACE

# 3. Clean install and production build.
#    --base=/ is REQUIRED. vite.config.js hard-codes /semper-nexus/ for
#    GitHub Pages, which 404s every asset on cloud.gov.
npm ci
npx vite build --base=/

# 4. The staticfile buildpack requires a Staticfile inside the pushed directory.
copy deploy\Staticfile dist\

# 5. Push. Reads manifest.yml, serves dist/ at https://nexus.app.cloud.gov
cf push
```

## Post-Deploy Verification

1. Open `https://nexus.app.cloud.gov` - page loads, no 404s in DevTools Network tab.
2. Trigger a directive search - confirm calls to `semper-nexus-proxy.onrender.com` return 200, not CORS errors.
3. Check the PWA installs and the service worker registers (DevTools > Application).

## Known Constraints

- App name `nexus` in manifest.yml must be unique within cloud.gov routing. If taken, change `name:` and add the new route to the proxy CORS list.
- GitHub Pages deployment is unaffected. Its workflow builds with the default `/semper-nexus/` base.
- The index.html CSP already permits `connect-src` to the Render proxy, so no CSP change is needed for cloud.gov.
- cloud.gov sandbox spaces expire and apps get stopped - production use requires a funded org.
