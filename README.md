# Semper Nexus

Monitors Marine Corps, Navy and Department of Defense directives, messages and forms in one searchable list. Built for Marines and the administrators who track them.

**Live:** https://nexus.app.cloud.gov
**Also at:** https://semperadmin.github.io/semper-nexus/

## What it does

- Lists MARADMINs, ALMARs, ALNAVs, SECNAVs, MCPUBs, DoD FMR changes, JTR updates, IGMC functional area checklists, NAVMC forms, DoD issuances, DD forms and court-martial reports, one tab for each plus an "All" view.
- Searches by message number, subject or keyword, and filters by date range (today, this week, 2 weeks, this month, 60, 90 or 180 days, or all).
- Opens the source document for each entry.
- Keeps the last results in your browser so the site still opens when you are offline.
- Switches between light and dark themes and installs as an app on a phone or desktop.

## Using it

Open the live site in a current browser. No account or CAC is needed. Pick a tab, search or filter, and select **Refresh** to fetch the latest entries. Five additional tabs (PAA, PAAN, TAN, FAN, ICAN) link out to an internal site that requires a .mil network and CAC sign-in.

Some lists (SECNAV, ALNAV, DD forms, DoD issuances, court-martial reports, IGMC checklists) are built into the site as data files refreshed by maintainers rather than fetched when you open it. See [docs/DATA-REFRESH.md](docs/DATA-REFRESH.md).

## Privacy and security

- Searching and filtering happen in your browser. Search terms are never sent anywhere.
- To get around browser cross-origin limits, the app asks a small relay server (the "proxy", hosted on Render at `usmc-directives-proxy.onrender.com`) to fetch public pages for it. The request carries only the address of the public page or feed to retrieve (for example a MARADMIN feed or a directive page) and returns the result. For some feeds the app first tries the official site directly. Public third-party CORS proxies are not used.
- Because those requests come from your browser, the official sites (marines.mil, navy.mil, travel.dod.mil, comptroller.war.gov) and the proxy host see ordinary request details such as your IP address.
- The Feedback link opens an external form that needs a .mil network.
- The browser stores cached feed results, your theme, tab and date-filter choice, and a service worker cache of the site files and fetched data. No cookies. The performance library is bundled with the site and only writes to the browser console.
- The Content Security Policy limits connections to the site itself, the proxy and the official source sites it lists, and blocks scripts, fonts and frames from anywhere else.
- The hosting platforms (cloud.gov and GitHub Pages) keep standard web server access logs, such as IP address, time, requested page and browser type, for operations and security. Semper Admin does not add tracking of its own.

See the [Privacy Policy](PRIVACY_POLICY.md), [Terms of Service](TERMS_OF_SERVICE.md) and [Security](SECURITY.md).

## Development

Requires Node.js 22 (the version the build workflows use) and npm.

```bash
npm ci
npm run dev
npm run build
npm run preview
```

`npm run lint` and `npm run format` check and fix the code. There is no automated test suite. Scripts that refresh the built-in data files are described in [docs/DATA-REFRESH.md](docs/DATA-REFRESH.md).

The proxy is a separate Node.js 20 service in `proxy-server/`; see its [README](proxy-server/README.md).

## Deployment

| Environment | URL | How |
|---|---|---|
| cloud.gov | https://nexus.app.cloud.gov | `manifest.yml` (staticfile buildpack, serves `dist`); manual **Deploy to cloud.gov** workflow, which builds with `vite build --base=/`; sandbox managed by the private cloudgov-redeploy repository |
| GitHub Pages | https://semperadmin.github.io/semper-nexus/ | `deploy-github-pages.yml` on push to `main`; served under `/semper-nexus/` |
| API proxy | https://usmc-directives-proxy.onrender.com | `proxy-server/` on Render, described by `proxy-server/render.yaml`; `deploy-proxy-server.yml` on pushes that change `proxy-server/`; `keep-alive.yml` pings it on a schedule |

Both frontends must serve the Vite build output (`dist`), not the repository root. The proxy is a runtime dependency: if it is asleep or down, tabs that rely on it show a retry message.

## Documentation

- [docs/CLOUDGOV-DEPLOY.md](docs/CLOUDGOV-DEPLOY.md): manual cloud.gov deploy steps and post-deploy checks.
- [docs/DEPLOYMENT-BASELINE.md](docs/DEPLOYMENT-BASELINE.md): deployment topology, health checks and known failure modes.
- [docs/DATA-REFRESH.md](docs/DATA-REFRESH.md): scripts that refresh the built-in data files.

## Feedback and support

[Open an issue](https://github.com/SemperAdmin/semper-nexus/issues), or use **Feedback** in the app from a .mil network. Report security problems as described in [SECURITY.md](SECURITY.md).

## License and disclaimer

MIT (see [LICENSE](LICENSE)).

> This is an independent tool built to help Marines with administrative
> work. It is not an official Department of the Navy or U.S. Marine Corps
> system and is not endorsed by, affiliated with, or approved by either.
> Always confirm requirements against the current governing orders.

## Part of Semper Admin

One of the tools in the Semper Admin suite. Start at the
[Semper Admin Portal](https://semper-admin-portal.app.cloud.gov) for the
full set.
