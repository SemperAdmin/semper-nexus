# Refreshing the built-in data files

Several lists in Semper Nexus are not fetched when a user opens the site. They are JavaScript data files under `lib/` that maintainers regenerate with the scripts below and commit. The scripts are Node.js ES modules in `scripts/` and run with the same Node.js version as the build (22). The package has no test suite.

| Script | Command | Writes | Notes |
|---|---|---|---|
| `fetch-fa-checklists.mjs` | `npm run fetch-fa` | `lib/fa-checklists.js` | IGMC functional area checklists |
| `fetch-court-martial.mjs` | `npm run fetch-cmr` | `lib/court-martial-data.js` | Run locally; the source site refuses GitHub Actions runners. Keeps the committed data if the scrape is empty or sharply smaller. |
| `fetch-dodi.mjs` | `npm run fetch-dodi` | `lib/dodi-data.js` | DoD issuances; run locally for the same reason |
| `fetch-dd-forms.mjs` | `npm run fetch-dd-forms` | `lib/dd-forms-data.js` | DD forms listing pages |
| `fetch-secnav.mjs`, `generate-secnav-data.mjs` | `npm run fetch-secnav`, `npm run generate-secnav` | `lib/secnav-data.js` | SECNAV directives |
| `fetch-alnav.mjs`, `generate-alnav-data.mjs` | `npm run fetch-alnav`, `npm run generate-alnav` | `lib/alnav-data.js` | ALNAV messages |
| `fetch-how-to-videos.mjs` | `npm run fetch-videos` | `lib/how-to-videos.js` | Reads a local video catalog that is not part of this repository |

Combined commands:

- `npm run generate-static` runs the SECNAV and ALNAV generators; `npm run update-data` does the same.
- `npm run fetch-static` (also `fetch-all`) runs the FA checklist, court-martial, DoDI and DD forms fetches, then the SECNAV and ALNAV generators.
- `npm run update-vendor` copies DOMPurify and the web-vitals library from `node_modules` into `vendor/`. Run it after updating those dependencies.

## Scheduled refresh

The **Update Static Data** workflow (`.github/workflows/update-fa-checklists.yml`) runs every two days and on demand. It runs `npm run fetch-static` and, if the FA checklist, SECNAV or ALNAV files changed, commits them. Court-martial, DoDI and DD forms data are not committed by that workflow and are refreshed from a workstation.

See [STATIC_DATA.md](../STATIC_DATA.md) and [scripts/README.md](../scripts/README.md) for the per-script behavior.
