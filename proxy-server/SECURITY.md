# Security Guide for Nexus Proxy Server

## Status: no secrets

The proxy server holds no credentials. It reads two environment variables, and neither is a secret:

- `PORT` - listening port.
- `ALLOWED_ORIGINS` - optional comma-separated list of extra CORS origins.

The feedback widget and its `GITHUB_TOKEN` were removed. The `/api/debug/github` route went with them. Remove any `GITHUB_TOKEN` or `GITHUB_REPO` variable still set in the Render dashboard, and revoke the token it held at https://github.com/settings/tokens.

There are no Google API keys, no Gemini integration, and no AI summary storage in this build.

## Adding a secret later

- Read it from an environment variable only. No hardcoded keys.
- Never return any part of it from a route. A prefix is enough to identify a token.
- Put authentication in front of any route using it.

## Generic proxy route

`/api/proxy` fetches only https URLs on the standard port for hosts in `PROXY_ALLOWED_DOMAINS`. Every redirect hop passes the same check, so an allowlisted host is not able to forward the request elsewhere. Keep the list to official sources.

## Production deployment checklist

1. Set environment variables on the host. Never commit secrets to the repository.
2. Keep TLS verification on. `server.js` sets `rejectUnauthorized: true` on its https agent. Never turn it off.
3. Confirm the CORS allowlist in `server.js` matches your deployed origin. The current default is `https://nexus.github.io`.
4. Apply the rate limiter (already in place, 100 requests per 15-minute window).
5. Restrict firewall ingress to the configured `PORT` only.
6. Enable HTTPS with a real certificate at the hosting layer. Render terminates TLS by default.
7. Run `npm audit` before every deploy. Patch criticals before promotion.

## Monitoring

- Subscribe to GitHub Dependabot alerts for the proxy server `package.json`.
- Monitor Render service logs for unhandled exceptions and 4xx/5xx spikes.
- Set up uptime monitoring (UptimeRobot, Statuscake) hitting `/health` every 5 minutes.

## Incident response

The service holds no credential today. If one is added and later exposed:
1. Revoke it at the issuer immediately.
2. Replace it in the Render dashboard and in GitHub Actions repository secrets.
3. Review the issuer's audit log for use you did not make.
4. Rotate any other credential reachable from the same workstation.
