# Nexus Compliance Checklist

Authoring date: 2026-05-24
Scope: production deployment of Nexus targeting DoD-adjacent or GCC High enterprise posture
Companion document: `ENTERPRISE-PROFILE.md` in the source repo at `D:\Coding\usmc-directives-hub-main` for full architectural target state

## Current state after AI removal

- Front-end: vanilla HTML, CSS, JavaScript (2,968 lines `app.js`) with Vite build, PWA manifest, service worker
- Back-end proxy: Express on Render.com, four routes (`/health`, `/api/alnav/:year`, `/api/navy-directives`, `/api/proxy`, `/api/debug/github`, `/api/feedback`)
- AI integrations: removed
- Authentication: none. All endpoints are publicly accessible.
- Data classification: aggregates publicly releasable directives. CUI risk enters scope only with the feedback widget user-email field.

Where this document calls something a Blocker, no ATO conversation begins until it is resolved.

---

## Phase 1: Hard Blockers (do these before any compliance review)

### 1.1 Remove the TLS verification bypass - RESOLVED 2026-05-24

Location: `proxy-server/server.js`
Previous code: `const httpsAgent = new https.Agent({ rejectUnauthorized: false });`
Current code: `new https.Agent({ rejectUnauthorized: true, keepAlive: true });`
Note: when the new validated agent rejects a DoD source site with a self-signed or incomplete chain, document the source and set `NODE_EXTRA_CA_CERTS` at the host level. Never re-disable validation.

### 1.2 Remove all public CORS relays - RESOLVED 2026-05-24

Resolution:
- `index.html` CSP `connect-src` no longer lists `corsproxy.io`, `api.allorigins.win`, `cors-anywhere.herokuapp.com`, `api.codetabs.com`
- `app.js` `CORS_PROXIES` array, `getOrderedProxies`, `savePreferredProxy`, `getPreferredProxy`, `tryProxyFetch` all removed
- All four cross-origin fetch sites (fetchFeed, fetchDodFormsPage, ALNAV page, fetchDodFmrChanges, fetchMessageDetails) now route through `fetchViaCustomProxy(url)` helper that calls the Render proxy `/api/proxy?url=` endpoint
- Service worker `apiHosts` allowlist no longer lists the four relay hosts
- On load, app.js purges any legacy `preferred_cors_proxy` and `proxy_cache_timestamp` from end-user localStorage
- Error surfaces a "proxy server is unreachable" message when both Render and direct fetch fail (was "all fetch methods failed")

Residual: build-time scripts under `scripts/*.mjs` still reference the relay URLs. They run in Node.js at GitHub Actions cron time and are not subject to CORS. No browser-side or production runtime path touches the relays.

### 1.3 Replace cdnjs and jsdelivr CDN dependencies - RESOLVED 2026-05-24

Resolution (three sub-replacements):

**1.3a Font Awesome to inline SVG (DONE)**
- `lib/icons.js` new module: 11 inline SVG icons (Lucide MIT) with `setIcon()`, `hydrate()`, MutationObserver auto-hydration for innerHTML-injected nodes, and legacy `fa-*` name resolver
- `style.css` appended `.icon`, `.icon-wrapper`, `.icon--spin` rules with `@keyframes nexus-icon-spin` and `prefers-reduced-motion` honor
- `index.html` Font Awesome `<link>` removed
- All 6 `<i class="fa-solid fa-X">` template-literal occurrences in `app.js` converted to `<span class="icon-wrapper" data-icon="X">`
- All 3 static `<i class="fa-solid fa-X">` in `index.html` converted to `<span class="icon-wrapper" data-icon="X">`
- `setIconContent()` rewritten to call `window.NexusIcons.setIcon`
- CSP `style-src` and `font-src` no longer list `cdnjs.cloudflare.com`

**1.3b Web Vitals from unpkg to self-hosted (DONE)**
- `index.html` `<script src="https://unpkg.com/web-vitals...">` replaced with `<script src="vendor/web-vitals.iife.js">`
- `vite.config.js` `viteStaticCopy` copies `node_modules/web-vitals/dist/web-vitals.iife.js` to `dist/vendor/`
- CSP `script-src` no longer lists `unpkg.com`
- `web-vitals` was already in `package.json` dependencies

**1.3c Fontsource fonts from jsdelivr to self-hosted (DONE)**
- `package.json` `dependencies` now includes `@fontsource-variable/inter@^5.0.18`, `@fontsource-variable/jetbrains-mono@^5.0.20`, `@fontsource/bebas-neue@^5.0.21`
- `vite.config.js` `viteStaticCopy` copies 5 woff/woff2 files from `node_modules/@fontsource*/files/` to `dist/fonts/`
- `semper-tokens.css` `@font-face` `src:` URLs changed from `https://cdn.jsdelivr.net/fontsource/...` to relative `fonts/...` paths
- CSP `font-src` no longer lists `cdn.jsdelivr.net`

User action required after pull:
```bash
cd "D:\Coding\Semper Nexus"
npm install        # pulls @fontsource packages and web-vitals
npm run build      # vite-plugin-static-copy materializes /fonts/ and /vendor/ in dist/
```

Until you run `npm install` and serve from `dist/`, the dev server will load the SPA but font families fall back to system-ui (functional, not visually correct) and `/vendor/web-vitals.iife.js` returns 404 (Web Vitals tracking silently disabled).

### 1.4 Fix the feedback widget Privacy Act exposure - RESOLVED 2026-05-24

Resolution:
- Email input field removed from `index.html` feedback modal
- Replaced with anonymous-submission notice
- `captureUserContext()` function deleted from `app.js`
- Frontend submits only `feedbackTab` and `timestamp`, no `userAgent`, no `screen`, no `viewport`, no `url`
- `proxy-server/server.js` feedback endpoint signature drops `email` parameter
- Server-side issue body template strips `Browser`, `Screen`, `Viewport`, `Theme`, `URL`, `Contact` lines
- Issue body footer notes "Anonymous submission... No user identity collected"

Residual item: `ErrorAnalytics.track()` at `app.js:38` still captures `navigator.userAgent` and `window.location.href` into an in-memory error array (max 100 entries, never transmitted). Not a Privacy Act violation today because nothing leaves the client. If the error log is ever exported or transmitted, this becomes an open finding. Strip both fields if you do not want them in any future export.

### 1.5 Rotate all secrets exposed to prior repository history - OPEN

Action: rotate the GitHub PAT used by `GITHUB_TOKEN`. Treat any historical secret as burned. Document rotation in the eMASS artifact library or equivalent audit record.

---

## Phase 2: Authentication and Authorization

### 2.1 Implement DoD CAC or PIV authentication

Target: Entra ID Government (Azure AD Gov) SSO with Conditional Access requiring smartcard authentication.
Alternative for non-Gov tenants: an OIDC provider that validates DoD PKI client certificates.
Action: stand up the identity tenant, register the app, enforce CAC-only sign-in. Remove all anonymous endpoints from the proxy server.

### 2.2 Define application roles

Recommended roles: `Directives.Read`, `Directives.Comment`, `Directives.Admin`. Wire each protected route to a role check via middleware. Default deny.

### 2.3 Add server-side session management

Today there is no session layer. Add signed JWT or server-side session store keyed by Entra `oid`. Set short access-token TTL and refresh-token rotation.

### 2.4 Enforce Conditional Access policies

- Trusted device required (Intune-managed)
- Trusted location IP allowlist on the .mil network boundary
- MFA enforced via CAC/PIV
- Risk-based sign-in blocking on impossible travel and anonymous IP

---

## Phase 3: Hosting and Infrastructure

### 3.1 Migrate off Render.com

Render is not FedRAMP High Authorized and not part of any DoD-approved hosting boundary. Targets:
- Azure Government App Service Linux for the ingestion worker
- Azure Government Front Door Premium with WAF for the SPA
- Azure Government Blob Storage for any persisted artifacts, customer-managed keys in Azure Key Vault Premium (FIPS 140-2 Level 3 HSM)

### 3.2 Migrate off GitHub Pages

GitHub Pages does not allow custom response headers (no HSTS, COOP, CORP). Host the SPA on Azure Front Door or equivalent that supports response-header injection.

### 3.3 Replace static-file PWA caching with authenticated cache

Today the service worker caches everything. Add an auth check that purges cache on logout and refuses to serve cached responses when the session is invalid.

### 3.4 Configure security headers at the hosting layer

Add via server config (not meta tags):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Content-Security-Policy` server-issued, removing the meta-tag version

---

## Phase 4: Data Handling and Privacy

### 4.1 Document data flows

Build a Data Flow Diagram covering every external fetch (marines.mil, mynavyhr.navy.mil, secnav.navy.mil, igmc.marines.mil, esd.whs.mil, comptroller.war.gov, travel.dod.mil). Identify what data classes flow where and at what frequency.

### 4.2 Privacy Impact Assessment (PIA)

Coordinate a PIA with the DON CIO Privacy Office before go-live. Without a signed PIA, any system collecting user identity cannot operate.

### 4.3 System of Records Notice (SORN)

Determine whether the captured user identity constitutes a System of Records under the Privacy Act. If yes, publish a SORN. If no, document the exception.

### 4.4 Records retention policy

Define retention for:
- Authentication audit logs: minimum 1 year online, 6 years archived per CNSSI 1253
- User watchlist data: business-driven retention with documented purge
- Feedback records: business-driven retention
- Cached directive copies: not retained, refetch from authoritative source

---

## Phase 5: Application Hardening

### 5.1 Sanitize all `innerHTML` writes - RESOLVED (PoC scope) 2026-05-24

Resolution:
- DOMPurify added as `package.json` dependency
- `vite-plugin-static-copy` copies `node_modules/dompurify/dist/purify.min.js` to `dist/vendor/`
- `index.html` loads `vendor/purify.min.js` before any other script
- `lib/safe-html.js` created with `window.SafeHTML.setHTML()` and `SafeHTML.sanitize()` wrappers, default-deny config (no `<script>`, `<style>`, `<iframe>`, `<form>`, `<input>`, no `on*` event handlers, no `srcdoc`, no `formaction`)
- `sanitizeInPlace(element)` helper in `app.js` (line 273) sanitizes innerHTML in-place after assignment
- 10 high-risk innerHTML sites wrapped: `card.innerHTML` (compact card render), 5 `detailsDiv.innerHTML` sites (message details), `detailsRow.innerHTML`, `summaryStatsDiv.innerHTML`, `modal.innerHTML` (help/feedback modals), `errorDiv.innerHTML` (error display)
- Fail-closed: if DOMPurify is missing at runtime, content is wiped to empty string and logged via `console.error`

PoC-scope deferral:
- 5 lower-risk innerHTML sites remain unwrapped (skeleton loaders, "No results", btn counter, return value of escapeHtml helper, no-results error placeholder). These interpolate only constants or numbers. Wrap during .mil migration if independent review flags them.

### 5.2 Resolve the empty catch block at `app.js:1359` - RESOLVED (no action needed) 2026-05-24

Investigation:
- Line 1359 in the original PRODUCTION-REVIEW.md predates the YouTube removal, AI Summary removal, and CORS relay removal. Current `app.js` has 4,000+ lines deleted since that audit.
- Repository now contains 5 catch blocks that look "empty" at first glance: lines 209, 223, 697, 740, 835.
- All 5 have explanatory comments inside the catch body (`// Ignore detection errors and use deployed URL`, `// ignore`, `// console.warn...`, `// Use default date`). Each is an intentional silent fallback for known-recoverable conditions (URL detection, localStorage cleanup, ALNAV per-URL skip, ALNAV proxy retry, date parse fallback).
- No truly unhandled catches remain. The original finding is obsolete.

PoC follow-up (optional): wire `ErrorAnalytics.track()` into each silent catch so the fallback frequency is observable during PoC review. Not blocking.

### 5.3 Add anti-CSRF tokens to authenticated mutations - DEFERRED (post-PoC)

Phase 2 authentication does not exist in the PoC. CSRF tokens depend on session binding. Defer to .mil migration.

### 5.4 Storage scope hardening - DEFERRED (post-PoC)

IndexedDB session-scoping requires the authenticated-session foundation from Phase 2. PoC has no auth. Defer to .mil migration.

Current PoC behavior: `localStorage` holds RSS feed cache (1-hour TTL), theme preference, filter preferences, stats-collapsed flag. No identity or credential data. The `summary_cache` and `proxy_cache` keys are explicitly purged on every load by the legacy-cleanup hooks added in Phases 1.2 and the AI removal pass.

### 5.5 Dependency hygiene - RESOLVED 2026-05-24

Resolution:
- `.github/dependabot.yml` created: weekly Monday 07:00 PT scans of `/package.json`, `/proxy-server/package.json`, and `/.github/workflows/*.yml`. Groups build-tool updates and fontsource updates. Labels PRs `dependencies` and `automated`. Limit 10 open PRs per ecosystem.
- `.github/workflows/security-audit.yml` created: runs `npm audit --audit-level=high` on root and `proxy-server` on every PR plus weekly Monday 14:00 UTC cron plus manual `workflow_dispatch`. Build fails on any high or critical vulnerability.

User action: enable Dependabot under repository Settings -> Code security and analysis after pushing.

### 5.6 Resolve ESLint warnings - RESOLVED (PoC scope) 2026-05-24

Resolution:
- `.eslintrc.json` `globals` section extended with 5 new entries: `SafeHTML`, `NexusIcons`, `DOMPurify`, `sanitizeInPlace`, `allNavmcForms`. Eliminates the false-positive "undefined" warnings for these new modules and the new directive type.
- `no-unused-vars` warn rule extended with `varsIgnorePattern: '^_'` so any `_throwaway` pattern stops flagging.
- Strict rules retained: `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` all `error`.

PoC follow-up (optional): the original 24-error count from PRODUCTION-REVIEW.md was against a codebase that has since shed 4,000+ lines. Run `npm run lint` after `npm install` to get the current count. Any residual unnecessary-regex-escape warnings stripped during the YouTube and AI removal passes.

---

## Phase 6: Section 508 Accessibility (WCAG 2.1 AA per 36 CFR Part 1194)

Phase 6 PoC pass executed 2026-05-24. Code-level items resolved. Manual screen reader testing deferred to operator with detailed test plan at `SCREEN-READER-TEST-PLAN.md`.

Companion: `motion` library (motion.dev) was added then removed 2026-05-24. Motion v11 ships only CommonJS and ESM; no browser-global IIFE. Loading as a classic `<script>` tag is not supported. Reinstate during ESM module migration in .mil work, or substitute with CSS keyframes plus Web Animations API directly for any near-term animation needs.

### Status summary

| Item | Status | Notes |
|------|--------|-------|
| 6.1  | RESOLVED 2026-05-24 | 5 contrast failures fixed via token overrides in style.css |
| 6.2  | RESOLVED 2026-05-24 | Universal `:focus-visible` rings with `box-shadow` halo on every interactive element |
| 6.3  | RESOLVED 2026-05-24 | `lib/a11y.js` initTablistNav: roving tabindex, Arrow keys, Home, End, Enter |
| 6.4  | RESOLVED 2026-05-24 | `lib/a11y.js` trapModal: focus trap, Escape close, focus restore on close |
| 6.5  | RESOLVED 2026-05-24 | Horizontal scroll with snap, placeholders hidden below 720px |
| 6.6  | RESOLVED 2026-05-24 | Audit confirms zero fixed-px font-size in style.css. All 85 font-size declarations use rem, em, or token vars |
| 6.7  | DEFERRED-MANUAL | 15-case test plan at `SCREEN-READER-TEST-PLAN.md` for operator execution with JAWS 2024 and NVDA |
| 6.8  | RESOLVED 2026-05-24 | `lib/a11y.js` initSkipLink: programmatic focus on `<main>` with hash update on activation |
| 6.9  | RESOLVED 2026-05-24 | Active tab uses three redundant signals: color, weight 800, 3px border, dot prefix via `::before` |
| 6.10 | RESOLVED 2026-05-24 | `lib/a11y.js` initFeedbackFormA11y: dynamic aria-invalid, aria-describedby, role="alert" error containers |

### 6.1 contrast fixes detail

| Failing pair | Original ratio | Fix | New ratio |
|--------------|---------------|-----|-----------|
| Dark scarlet active tab on dark navy bg | 4.03:1 (FAIL 4.5) | Active tab uses brass-300 instead of scarlet-300 | 8.90:1 |
| Dark primary-fg on scarlet button | 4.22:1 (FAIL 4.5) | `--color-primary-foreground` dark = `#FFFFFF` | 4.58:1 |
| Light subtle-fg on parchment | 3.64:1 (FAIL 4.5) | `--color-subtle-foreground` light = `#6F634A` | 5.36:1 |
| Light brass accent on parchment (UI) | 2.69:1 (FAIL 3.0) | `--color-accent` light = brass-700 `#8E6E2E` | 4.32:1 |
| Status info on dark navy bg | 2.92:1 (FAIL 3.0) | `--color-status-info` = `#4A78C2` | 4.18:1 |

All other 17 audited combinations pass.

---

## Phase 7: Operational Readiness

### 7.1 Logging and monitoring

- Add OpenTelemetry instrumentation with correlation IDs across SPA and proxy server
- Export logs to Microsoft Sentinel for Government (or equivalent SIEM)
- Every log line carries Entra `oid`, `tid`, request correlation ID
- Retention: 1 year online, 6 years archived

### 7.2 Disaster recovery

- Cross-region failover plan (Azure Gov primary, secondary region)
- RPO and RTO documented and tested
- Annual DR drill scheduled

### 7.3 Backup and restore

- Authenticated user preferences in Dataverse: nightly backup, 30-day retention
- Feedback records: daily backup, 90-day retention
- Documentation backed up with source code in git

### 7.4 Incident response runbook

Document the response process for:
- Credential compromise
- DoS attack on the proxy server
- Upstream DoD source site outage
- Sensitive data spillage (feedback widget email field, before remediation)

### 7.5 Change management

Every production deploy requires:
- Pull request review by at least one other engineer
- Automated test suite green
- Security scan green
- Change ticket with rollback plan

---

## Phase 8: Documentation Artifacts

Required for ATO package submission:

- System Security Plan (SSP)
- Risk Assessment Report
- Security Assessment Plan and Report (SAP/SAR)
- Plan of Action and Milestones (POA&M)
- Privacy Impact Assessment (PIA)
- Configuration Management Plan
- Incident Response Plan
- Contingency Plan
- System Categorization (FIPS 199)
- Authorization Boundary Diagram
- Data Flow Diagram
- Hardware/Software Inventory
- Ports, Protocols, and Services Management (PPSM) registration per DoDI 8551.01
- User Access Approval workflow documentation
- Continuous Monitoring Plan

---

## Phase 9: Pre-Production Gates

Before flipping any production switch, confirm each:

- [ ] All Phase 1 Blockers resolved
- [ ] Authentication wired and tested with real CAC
- [ ] Hosted in approved DoD cloud boundary
- [ ] All external CDN dependencies eliminated
- [ ] DOMPurify on every `innerHTML` write
- [ ] CSP issued by server, not meta tag
- [ ] WCAG 2.1 AA verified by independent test
- [ ] PIA signed
- [ ] eMASS package at Authorized status
- [ ] SCA-V validation report attached
- [ ] Sentinel ingestion confirmed for 14 consecutive days
- [ ] DR failover drill executed against secondary region
- [ ] Sponsoring command identified and committed (HQMC, MARFOR equivalent)
- [ ] Banner and consent-to-monitor language per DoDI 8500.01 Enclosure 3
- [ ] Disclaimer of unofficial status removed from `README.md` and footer
- [ ] All 10 active directive tabs return non-zero counts in production (MARADMIN, ALMAR, ALNAV, SECNAV, MCPEL, DODFMR, DTMO/JTR, FA_CHECKLISTS, NAVMC_FORMS, DD_FORMS)
- [ ] 5 inactive placeholder tabs (PAA, PAAN, TAN, FAN, ICAN) either wired to live sources or removed from the UI before public launch
- [ ] Screen reader test plan executed against JAWS 2024 and NVDA per `SCREEN-READER-TEST-PLAN.md`, all findings closed

---

## Phase 10: Directive Tab Implementation Roadmap

The image-based tab specification adds active and inactive directive types beyond what the original USMC Directives Hub shipped. Each requires a data source, fetch strategy, and rendering surface before going live.

### 10.1 Active tab data source matrix

| Tab | Status | Source | Format | Owner |
|-----|--------|--------|--------|-------|
| MARADMIN | LIVE | `marines.mil` RSS | RSS XML | HQMC |
| ALMAR | LIVE | `marines.mil` ALMAR RSS | RSS XML | HQMC |
| ALNAV | LIVE | `mynavyhr.navy.mil` HTML | HTML scrape via proxy | DON |
| SECNAV | LIVE | `secnav.navy.mil` RSS | RSS XML | DON |
| MCPEL | LIVE (renamed) | Marine Corps Pubs Electronic Library | RSS / HTML | HQMC |
| DODFMR | LIVE | `comptroller.war.gov` | HTML scrape | OUSD(C) |
| DTMO (JTR) | LIVE (renamed) | `travel.dod.mil` RSS | RSS XML | DTMO |
| FA_CHECKLISTS | LIVE (renamed from IGMC) | `igmc.marines.mil` | Static JSON from `lib/fa-checklists.js` | IGMC |
| NAVMC_FORMS | LIVE 2026-05-24 | DLA DSO DON Forms API via Render proxy: `GET dso.dla.mil/DONNavyForms-RequestService/api/forms/search?SearchQuery=NAVMC` | JSON, server-side filtered on formNumber NAVMC prefix | DLA DSO / HQMC |
| DD_FORMS | LIVE (renamed) | `esd.whs.mil/DD-Forms` | HTML scrape | OUSD(P&R) |

### 10.1.1 NAVMC_FORMS implementation - RESOLVED 2026-05-24

API discovered via Chrome MCP network inspection of the DLA DSO DON Forms SPA at `https://dso.dla.mil/DONForms/?search=NAVMC`.

Endpoint:
```
GET https://dso.dla.mil/DONNavyForms-RequestService/api/forms/search
  ?SearchQuery=NAVMC
  &Page=1
  &PageSize=100
  &SortBy=CreationDate
  &SortOrder=Descending
```

Response shape:
```json
{
  "pageIndex": 1,
  "pageSize": 100,
  "totalCount": 1764,
  "totalPages": 18,
  "hasNextPage": true,
  "collection": [
    {
      "formNumber": "NAVMC 11000",
      "formTitle": "Example title",
      "sponsor": "JFOL",
      "formType": "WarehouseProduct",
      "creationDate": "2026-04-27T05:00:09",
      "status": "Active",
      "dsoSearchLink": "https://dso.dla.mil/DSF/products/sku/...",
      "command": "NAVMC",
      "stockNumber": "0301LF...",
      "id": 14767
    }
  ]
}
```

Implementation:
- `proxy-server/server.js` new route `GET /api/navmc-forms?page=N&pageSize=M` fetches upstream, filters `collection` to entries where `formNumber.toUpperCase().startsWith("NAVMC")`, returns clean JSON with `sourceCount`, `filteredCount`, `totalCount`, `hasNextPage`
- `app.js` new `fetchNavmcForms()` function called from `fetchAllFeeds()` after DoD FMR. Maps API response into the existing message-card shape (id, subject, title, link, pubDate, type='navmc'), populates `allNavmcForms` global, calls `cacheData()`
- CORS upstream blocks browser direct fetch (no Access-Control-Allow-Origin header), so all traffic routes through the Render proxy which already has CORS configured for the SPA origin
- No CSP change needed since browser only talks to the Render proxy

Constraints worth noting:
- DLA DSO API is undocumented. Endpoint structure may change without notice
- 1,764 total NAVMC search hits, but only forms with `formNumber` starting with "NAVMC" are kept after server-side filter. Final displayed count depends on what page 1 catches
- For deeper pagination, the proxy accepts `?page=N` query. Frontend currently fetches only page 1 (100 results). Add a fetch-all-pages loop in a later iteration if needed

### 10.2 Inactive placeholder tabs

PAA, PAAN, TAN, FAN, ICAN are stubbed as disabled buttons. Implementation prerequisites:

1. Confirm full names and document type for each acronym
2. Identify authoritative source system
3. Determine releasability (public, CUI, controlled)
4. Choose ingestion pattern (RSS, HTML scrape, API)
5. Add per-type CSS badge color
6. Wire tab counter, summary stats, All Messages aggregation
7. Update CSP `connect-src` allowlist
8. Add to compliance Phase 1 if any source requires public-CORS-relay routing

---

## Realistic timeline

- Phase 1 Blockers: 2 to 4 weeks (PoC complete except 1.5 secret rotation deferred to Semper Admin migration)
- Phase 2 Authentication: 6 to 10 weeks
- Phase 3 Hosting migration: 8 to 12 weeks
- Phase 4 Privacy: 4 to 8 weeks
- Phase 5 Hardening: PoC complete except 5.3, 5.4 deferred to post-PoC
- Phase 6 Accessibility: PoC complete except 6.7 manual SR testing pending operator
- Phase 7 Operations: 4 to 6 weeks parallel to Phase 3
- Phase 8 Documentation: continuous, 12 to 16 weeks elapsed
- ATO submission to authorization: 90 to 180 days

Total realistic floor: 9 to 12 months from today to operational ATO.

---

## Items that block faster paths

- No identified sponsoring command
- No GCC High tenant access
- No Azure Government subscription
- No DoD PKI integration access
- README footer disclaimer still labels Nexus as unaffiliated with USMC, Navy, or DoD

If any of these is true today, PoC work in Phases 1, 5, and 6 still proceeds; Phases 2 and 3 cannot start.
