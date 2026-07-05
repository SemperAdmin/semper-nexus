# Security Audit — Semper Nexus

Mode 8 (Security Audit) run per `docs/PROMPT_LIBRARY.md`. Date: 2026-07-05.
No code was changed during this audit (Global Rule 5 / Mode 8 contract). Every
finding cites `file:line` and an evidence tier. Fixes are shown as code but not
applied.

## Scope and context

- Data sensitivity: **none stored** — the app renders public military messages,
  has no auth, no accounts, no server-side user data. This bounds the blast
  radius: the realistic worst case is client-side script execution in a
  visitor's browser or abuse of the open proxies, not data theft.
- Attack surface: (1) two internet-facing CORS proxies — `proxy-server/server.js`
  (Express, on Render) and `cloudflare-worker/worker.js`; (2) the static
  frontend `app.js`, which renders third-party-proxied RSS/HTML into the DOM.
- Trust note: **the README is stale.** It advertises a multi-vendor public
  CORS-proxy fallback chain (corsproxy.io, allorigins.win, …), but the code
  (`app.js:200-214`) routes every cross-origin fetch through a **single
  self-hosted proxy** (`semper-nexus-proxy.onrender.com`; `localhost:3000` in
  dev), and actively purges old public-relay preferences from localStorage
  (`app.js:221-226`). Proxied content is still attacker-influenced — a
  compromised proxy or on-path attacker can tamper with responses — but the
  exposure is one owned endpoint, not an arbitrary third-party relay. The README
  should be corrected to match.

---

## Findings

### 1. Major — SSRF via suffix-match allowlist bypass in the generic proxy

`proxy-server/server.js:520-521`

```js
const urlObj = new URL(targetUrl);
const isAllowed = allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
```

The allowlist (lines 511-518) is matched with `hostname.endsWith(domain)` and
has no leading-dot or exact-match boundary. Most entries are `.mil` (not
publicly registerable, so not exploitable), **but `rss.app` is a commercial
`.app` domain.** `endsWith('rss.app')` matches any hostname ending in that
string with no dot boundary.

**Attack scenario (VERIFIED — logic confirmed against the source):**
1. Attacker registers `myrss.app` (or any `*rss.app`), or finds a hostname
   ending `rss.app`.
2. Attacker requests
   `https://semper-nexus-proxy.onrender.com/api/proxy?url=https://myrss.app/x`.
3. `"myrss.app".endsWith("rss.app")` is `true` → the check passes → the server
   fetches attacker-controlled URL and returns the body to the caller.
4. The proxy is now an **open relay** an attacker can point at their own host:
   laundering requests through the Render egress IP, probing anything
   `rss.app`-suffixed, and — combined with DNS control of the registered
   domain — attempting internal-address rebinding.

**Fix** — match on exact host or a true dot-boundary subdomain:

```js
function hostAllowed(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}
const isAllowed = allowedDomains.some(d => hostAllowed(urlObj.hostname, d));
```

Also reject non-`https:` schemes and non-standard ports explicitly:

```js
if (urlObj.protocol !== 'https:') {
  return res.status(400).json({ error: 'Only https targets allowed' });
}
```

The same `endsWith` pattern exists in `cloudflare-worker/worker.js:142-144`, but
its allowlist is `.mil`-only, so it is **not currently exploitable** — fix it
anyway for defense in depth, since adding one commercial domain later would
silently reintroduce the bypass.

**Residual risk after fix:** low. Proxy still fetches arbitrary paths on the
allowlisted hosts, which is the intended function.

---

### 2. Major — Sanitizer fails open when DOMPurify is absent

`lib/safe-html.js:38-44`

```js
function sanitize(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && ...) {
    return window.DOMPurify.sanitize(html, SAFE_CONFIG);
  }
  warnOnce();
  return html; // PoC fail-open
}
```

`SafeHTML.sanitize` returns input **unchanged** if DOMPurify is not loaded. The
in-place guard in `app.js:275-281` only fails closed when the whole `SafeHTML`
object is missing — if `safe-html.js` loads but `purify.min.js` fails to load
(bad deploy, cache miss, path regression), `SafeHTML.sanitize` exists, returns
raw HTML, and `app.js` treats it as sanitized.

**Attack scenario (VERIFIED — code path confirmed):** DOMPurify asset fails to
load in production → all rendered feed content bypasses sanitization → a
tampering proxy's payload reaches `innerHTML` unfiltered. Currently the CSP
(finding 4) blocks execution, so this is a **latent** XSS gated on one other
control, not live XSS.

**Fix** — a security control must fail closed:

```js
function sanitize(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html, SAFE_CONFIG);
  }
  warnOnce();
  return '';               // fail closed: render nothing rather than unsanitized HTML
}
```

**Residual risk after fix:** low — a missing sanitizer degrades to blank
content (visible, reportable) instead of silent XSS exposure.

---

### 3. Major — `onclick` is explicitly allowlisted in the sanitizer

`lib/safe-html.js:15-22`

`ALLOWED_ATTR` includes `'onclick'`, while `FORBID_ATTR` (line 25) lists
`onerror/onload/onmouseover/onfocus/onblur` but **not** `onclick`. Feed-derived
markup containing an `onclick` handler therefore survives DOMPurify.

**Attack scenario (VERIFIED — config confirmed):** a tampering proxy injects
`<button onclick="…">` into a message subject → survives sanitization →
executes on click **if** the CSP ever permits inline handlers. Under the current
CSP (`script-src 'self'`) inline `onclick` will not execute, so this is again a
defense-in-depth gap gated on the CSP, not live XSS today.

**Fix** — remove `'onclick'` from `ALLOWED_ATTR` and add it to `FORBID_ATTR`.
If the app needs its own click handlers, attach them with `addEventListener`
after sanitization, keyed off the `data-*` attributes already allowlisted — do
not carry executable attributes through the sanitizer.

**Residual risk after fix:** low.

---

### 3b. Minor (latent) — `sanitizeInPlace()` call pasted inside a template literal is a no-op

`app.js:2319-2343` (`toggleDetails`, `mcpub` branch)

```js
detailsDiv.innerHTML = `
  <div class="mcpub-details">
    <h4>Publication Details</h4>
    ${message.pdfUrl ? `
sanitizeInPlace(detailsDiv);          // <-- line 2323: this is HTML text, not code
      <div class="pdf-download">
        <a href="${message.pdfUrl}" ...>
```

The intended `sanitizeInPlace(detailsDiv)` call is **inside the backtick
template string**, so it renders as literal text and never executes. This branch
assigns `detailsDiv.innerHTML` from `message.pdfUrl`, `message.id`, and
`message.mcpubInfo.subject` — all derived from proxy-fetched HTML — with **no
sanitization** (contrast the `maradmin` branch at 2316, which sanitizes
correctly). The same broken paste appears in the sibling branch around 2379.

**Reachability (VERIFIED):** `toggleDetails` (2277) and `toggleCompactDetails`
(2240) currently have **no callers** — the compact render never wires a
details-toggle button — so this is **unreachable dead code today**. It is a
latent XSS the moment anyone re-wires message details, and it proves the
"assign-then-sanitize" convention is not mechanically enforced.

**Fix:** move the call outside the template (after the `innerHTML =` statement),
or delete the dead `toggleDetails`/`mcpub` rendering path entirely.

**Residual risk after fix:** low.

---

### 4. Minor — CORS `Access-Control-Allow-Origin` reflects arbitrary origins (Worker)

`cloudflare-worker/worker.js:24-31`, used at 40, 53, 73, 104, 168

```js
function corsHeaders(origin) {
  return { 'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0], ... };
}
```

`ALLOWED_ORIGINS` (lines 12-15) is declared but never enforced — the request's
`Origin` is reflected verbatim. Any website can call the Worker cross-origin.
Because the Worker sets no credentials and serves only public content, impact is
limited to the Worker functioning as an **open proxy for its allowlisted upstream
domains** (bandwidth/abuse), not data disclosure.

**Fix:**

```js
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin', ... };
}
```

(The Express server at `server.js:32-46` already uses a proper `cors()` origin
allowlist — this finding is Worker-only.)

**Residual risk after fix:** low.

---

### 5. Minor — Unauthenticated debug endpoint leaks token metadata

`proxy-server/server.js:82-139` (`GET /api/debug/github`)

The endpoint is public (rate-limited only) and returns, when a token is
configured: `tokenPrefix` (first 7 chars of `GITHUB_TOKEN`, line 85), whether a
token exists, the target repo, and the repo `permissions` (`admin/push/pull`,
lines 118-123). The full token is not exposed, but confirming a token exists,
its type prefix, and its privilege level is reconnaissance an attacker does not
need handed to them.

Note: the feedback feature that used this token was removed for compliance
(`server.js:559`), so `GITHUB_TOKEN` and this whole debug route may now be dead
code.

**Fix:** delete the route (and the token handling at 15-22) if the feedback
feature is gone; otherwise gate it behind an auth check and drop the
`tokenPrefix`/`permissions` fields.

**Residual risk after fix:** none once removed.

---

### 6. Minor — Vulnerable transitive dependencies in the proxy

`proxy-server/package.json` / `package-lock.json`

`npm audit` reports two **high**-severity transitive packages, both with fixes
available:

| Package | Installed | Fixed in | Via | Advisory |
|---|---|---|---|---|
| `form-data` | 4.0.5 | ≥4.0.6 | axios | GHSA-hmw2-7cc7-3qxx (CRLF injection in multipart) |
| `undici` | 7.26.0 | ≥7.28.0 | cheerio | GHSA-vmh5-mc38-953g (TLS validation bypass) + others |

Reachability is limited — the proxy makes only outbound `GET` requests, so the
`form-data` multipart path is not exercised, and `undici`'s SOCKS5/WebSocket
paths are not used. Still, pinned-version CVEs against a running service should
be cleared.

The root frontend `package.json` declares `dompurify@^3.1.6`; the lockfile
resolves it to **3.4.5**, which carries multiple moderate advisories fixed in
≥3.4.9 — bump it, since DOMPurify is the app's primary XSS control (and the
control that gates findings 2 and 3). Note DOMPurify is only present in built
output — `vendor/purify.min.js` is generated by `vite-plugin-static-copy` at
build time and does not exist in the source tree, so raw-source runs have no
sanitizer at all; this is exactly the fail-open condition finding 2 addresses.

**Fix:** `cd proxy-server && npm audit fix` and bump `dompurify` in root; re-run
`npm audit` to confirm the high/moderate counts drop; redeploy.

**Residual risk after fix:** low; re-audit on a schedule (Dependabot is already
configured at `.github/dependabot.yml`).

---

### 7. Informational — Local markdown rendered without sanitization

`app.js:3046-3055` (`loadLegalDocument` → `markdownToHtml` → `modalBody.innerHTML`)

The Privacy/Terms modal fetches a **same-origin** committed `.md` file, converts
it with a hand-rolled `markdownToHtml`, and assigns the result to `innerHTML`
with no `sanitizeInPlace` call (unlike every feed-render path). The source is a
trusted repo file, so this is not exploitable today; flagged because it is the
one `innerHTML` sink that skips the sanitize convention, and would become a
vector if these documents ever became user- or fetch-sourced.

**Fix:** call `sanitizeInPlace(modalBody)` after line 3055 for consistency.

---

### 8. Informational — Service worker persistently caches proxy/API responses

`service-worker.js:96-114, 168-190`

`networkFirst` caches any `ok` response from the proxy and upstream data hosts
into `CACHE_NAME`. Host matching is strict (`hostname === host || endsWith('.' +
host)`, line 112 — no substring bypass, good). These responses are consumed only
as parsed data, never served as documents, so no document-level XSS is
introduced; but a single tampered proxy response is **persisted across sessions
and offline**, extending the durability of a one-time tampering event.

**Fix:** exclude proxy API responses from the persistent cache, or attach a short
TTL / integrity check. Low priority given the data is public.

---

## What is already done well

- **CSP is strong** (`index.html:7-28`): `script-src 'self'` (no `unsafe-inline`
  for scripts), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  scoped `connect-src`. This is the control that downgrades findings 2 and 3
  from live XSS to latent — it is doing real work.
- Feed content is sanitized in place after every `innerHTML` assignment on the
  render path (`app.js:2216`, `2230`, `2435`), and `escapeHtml` (2270-2274)
  uses the correct `textContent` round-trip.
- localStorage feed caches re-render through the same sanitized path — no raw
  re-injection of cached data.
- The Express server pins `rejectUnauthorized: true` (`server.js:69`), rate
  limits `/api/` (55-64), and uses a real CORS allowlist (32-46).

---

## Fix these three first

1. **Finding 1 (SSRF suffix bypass, `rss.app`)** — it is live and exploitable
   today with no other control gating it, turning a public service into an open
   relay. One-line boundary fix.
2. **Finding 2 (fail-open sanitizer)** — it silently disables the primary XSS
   control on any deploy where the DOMPurify asset goes missing; a security
   control that fails open is the highest-leverage latent risk. One-line fix.
3. **Finding 6 (dependency CVEs)** — cheapest possible remediation
   (`npm audit fix` + a version bump), clears the high-severity items flagged on
   the default branch, and unblocks a clean re-audit baseline.

Findings 3, 4, 5, and 7 are defense-in-depth and cleanup; batch them into the
same PR as the fixes above.
