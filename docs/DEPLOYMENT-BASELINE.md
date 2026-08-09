# Semper Nexus Deployment Baseline

Established 2026-08-09. Every claim below was verified against the live systems
on that date, not inferred from configuration files.

This document is the reference for what "working" looks like. When something
breaks, compare against these values before changing code.

## Topology

| Component | Location | Serves |
|---|---|---|
| Frontend, cloud.gov | https://nexus.app.cloud.gov | Vite build output (`dist/`), staticfile buildpack, manual `cf push` |
| Frontend, GitHub Pages | https://semperadmin.github.io/semper-nexus/ | Vite build output, published by `deploy-github-pages.yml` |
| API proxy | https://usmc-directives-proxy.onrender.com | `proxy-server/`, Render service `srv-d41g94fgi27c739h1j6g`, free instance |
| Upstream forms source | https://dso.dla.mil/DONNavyForms-RequestService/api/forms/search | DLA DSO, reached only by the proxy |

The proxy is not part of either frontend deploy. It deploys independently from
`proxy-server/` on the Render service.

## Hostname coupling

The proxy hostname appears in three places and all three must agree:

1. `CUSTOM_PROXY_URL` in `app.js`
2. The `connect-src` directive in the `index.html` CSP
3. The Render service name, which determines the `.onrender.com` hostname

Renaming the Render service silently breaks the other two. A mismatch surfaces
in the browser as `TypeError: Failed to fetch` with no status code, and the
affected tab renders empty.

## Verified values, 2026-08-09

- Proxy `/api/health` returns `status`, `timestamp`, `commit`, and `corsAllowlist`.
- CORS allowlist, 8 origins: furby203824.github.io, semperadmin.github.io,
  nexus.github.io, nexus.app.cloud.gov, and localhost/127.0.0.1 on ports 8000
  and 5173. Extend at runtime with the `ALLOWED_ORIGINS` env var, comma
  separated, no code deploy required.
- `/api/navmc-forms?page=1&pageSize=2000` returns HTTP 200 with 824
  NAVMC-numbered forms filtered from 1767 DLA source records.
- Cold start on the free Render instance takes roughly 17 seconds. The
  server-side cache holds for 1 hour, so subsequent requests return instantly.
- Both frontends serve `app.js?v=36` and service worker `v2.5.0-20260809`.

## Health checks

Run these from PowerShell. `curl` there is an alias for `Invoke-WebRequest`,
which rejects curl flag syntax, so call `curl.exe` explicitly and use `-o NUL`
in place of `/dev/null`.

```powershell
# Proxy alive, running current code, allowlist correct
curl.exe -s https://usmc-directives-proxy.onrender.com/api/health

# CORS header actually returned for a given frontend origin
curl.exe -sD - -o NUL -H "Origin: https://nexus.app.cloud.gov" `
  https://usmc-directives-proxy.onrender.com/api/health | findstr /i allow-origin

# Frontend serves the build, not the repository root.
# The first must return 200 and the second must return 404.
curl.exe -s -o NUL -w "%{http_code}`n" https://semperadmin.github.io/semper-nexus/vendor/purify.min.js
curl.exe -s -o NUL -w "%{http_code}`n" https://semperadmin.github.io/semper-nexus/package.json
```

A `package.json` returning 200 from a frontend host means that host is
publishing the repository root. Every asset the build generates is then
missing, starting with `vendor/purify.min.js`, and the sanitizer fails closed
and blanks every card.

## Deploy procedures

### cloud.gov, manual

```powershell
cf login -a api.fr.cloud.gov --sso     # passcode: https://login.fr.cloud.gov/passcode
cf target -o sandbox-usmc -s stephen.shorter
npm ci
npx vite build --base=/                # --base=/ is mandatory, see below
copy deploy\Staticfile dist\           # the buildpack needs this inside dist
cf push
```

`--base=/` is required because `vite.config.js` hard-codes `/semper-nexus/` for
GitHub Pages. Omitting it 404s every asset on cloud.gov.

`deploy/Staticfile` is not copied by the build. `vite.config.js` lists 11
static-copy targets and `Staticfile` is not among them.

### GitHub Pages, automatic

`deploy-github-pages.yml` triggers on push to main, runs `npm ci` and
`npm run build`, and uploads `./dist`. Repository Settings, Pages, Build and
deployment, Source must be set to **GitHub Actions**. Set to "Deploy from a
branch" the workflow still runs and its artifact is discarded.

### Render proxy, automatic on merge

Build Command `npm install`, Start Command `npm start`, Root Directory
`proxy-server`, Auto-Deploy on commit. `render.yaml` declares the same values
and applies only to Blueprint-managed services, so a dashboard-created service
ignores it and the two drift apart silently.

## Data characteristics worth knowing

NAVMC forms are a reference catalog, not dated message traffic. Age distribution
of the 824 records on 2026-08-09:

| Window | Count |
|---|---|
| Last 7 days | 1 |
| 8 to 30 days | 1 |
| 31 to 180 days | 116 |
| 181 to 365 days | 2 |
| Older than a year | 703 |
| No usable date | 1 |

The default 7-day filter would hide 823 of 824, so `navmc`, `dodforms`, `dodi`,
and `igmc` are listed in `DATE_FILTER_EXEMPT_TYPES` and default to All. An
explicit click on any range button overrides that for the rest of the session.

## Failure modes seen in production

| Symptom | Root cause | Check |
|---|---|---|
| One tab empty, others fine | Proxy unreachable or origin missing from the CORS allowlist | `/api/health` with an `Origin` header |
| Every card blank, counts correct | `vendor/purify.min.js` 404, sanitizer failing closed | The red banner at the top of the page, or `typeof window.DOMPurify` |
| A deploy appears to have no effect | Stale service worker serving a cached document | `document.querySelector('script[src*="app.js"]').src` in the console |
| Tab shows a tiny count against a large total | Date filter applied to a reference catalog | The active range button |

Clearing a stuck service worker, run in the page console:

```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).filter(k => k.startsWith('semper-nexus-')).forEach(k => caches.delete(k));
location.reload();
```

Filtering cache keys by prefix matters on semperadmin.github.io, since the
semperscribe app shares that origin and its cache should survive.

## Single-source rules

- DOMPurify and web-vitals come from `node_modules` at build time.
  `package-lock.json` is the source of truth. Committing copies under `vendor/`
  pins production to whatever was committed, so a Dependabot security bump
  reaches `node_modules` and never reaches users.
- Line endings normalize to LF through `.gitattributes`. Windows tooling
  rewrites pulled files as CRLF, which blocks `git am` and inflates diffs.
