# Security Guide for Nexus Proxy Server

## Status: minimal external secrets

After AI summary removal, the only secret required by the proxy server is:

- `GITHUB_TOKEN` - GitHub Personal Access Token used by the feedback widget to file issues against `furby203824/Nexus`. Optional. If unset, the feedback endpoint returns 503.

There are no Google API keys, no Gemini integration, and no AI summary storage in this build.

## API key handling

- All secrets are read from environment variables only. No hardcoded keys.
- For Render.com deployment, set the variable in the Render dashboard under Environment.
- For GitHub Actions deployment automation, store in repository Settings -> Secrets -> Actions and inject via the workflow `env:` block.
- Rotate the `GITHUB_TOKEN` at least quarterly. Revoke and replace immediately on suspected exposure at https://github.com/settings/tokens.

## Production deployment checklist

1. Set environment variables on the host. Never commit secrets to the repository.
2. Replace the TLS verification bypass at `server.js` line `new https.Agent({ rejectUnauthorized: false })` with a proper trust chain. The bypass is a hard compliance blocker for any DoD-adjacent deployment.
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

If `GITHUB_TOKEN` is compromised:
1. Revoke immediately at https://github.com/settings/tokens.
2. Generate a fresh PAT with `repo` scope only.
3. Update the secret in Render dashboard and in GitHub Actions repository secrets.
4. Review the GitHub issue audit log for unauthorized issue creation.
5. Rotate any other credentials reachable from the same workstation as a precaution.
