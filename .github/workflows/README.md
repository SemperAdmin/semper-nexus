# GitHub Actions Workflows

Automated deployment and data-fetch workflows for the Nexus repository.

## Available workflows

### `deploy-proxy-server.yml`

Deploys the proxy server to Render when changes land in `proxy-server/`.

**Triggers:**
- Push to `main` or `master` affecting `proxy-server/**`
- Manual trigger via Actions UI

### `update-fa-checklists.yml`

Daily refresh of FA Checklist static data file.

### `keep-alive.yml`

Optional ping to the proxy server to defeat Render free-tier cold starts.

## Required repository secrets

After AI integrations were removed, the secret surface is small:

| Secret | Purpose | Required |
|--------|---------|----------|
| `GITHUB_TOKEN` | Feedback widget issue creation (proxy server env) | Optional |
| `RENDER_API_KEY` | Render API-based deployments (auto-deploy works without it) | Optional |
| `RENDER_SERVICE_ID` | Pair with `RENDER_API_KEY` | Optional |

Note: `GITHUB_TOKEN` here refers to a manually-issued PAT used by the proxy server at runtime, not the automatic `${{ secrets.GITHUB_TOKEN }}` injected into workflow context.

## Adding a secret

1. Repository -> Settings -> Secrets and variables -> Actions
2. Click **New repository secret**
3. Enter name and value
4. Save

## Quick start: Render auto-deploy without Actions

Render's GitHub integration auto-deploys on push to `main` without any workflow file. This is the simplest path. The `deploy-proxy-server.yml` workflow exists for cases where you want explicit Action-triggered deploys with additional pre-deploy steps.

## Manual local deployment

```bash
cd proxy-server
export GITHUB_TOKEN="your_pat_here"
npm install
npm start
```

## Troubleshooting

**Workflow failed:** Check the Actions tab for logs.

**Secret not found:** Confirm exact name match in repository settings.

**Render deployment skipped:** Ensure file changes are under `proxy-server/**` to trigger the path filter.

## Reference

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Render documentation](https://render.com/docs)
