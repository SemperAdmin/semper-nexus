const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

// Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
// NO HARDCODED KEYS - Security requirement
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHub Personal Access Token for creating issues
const GITHUB_REPO = process.env.GITHUB_REPO || "furby203824/Nexus"; // GitHub repo (owner/repo)

if (!GITHUB_TOKEN) {
  console.error('❌ WARNING: GITHUB_TOKEN environment variable is not set');
  console.error('   Feedback widget will not be able to create GitHub issues');
  console.error('   Create a GitHub Personal Access Token with repo scope');
}

// Trust proxy - Required for Render.com and other hosting platforms
// Allows rate limiting to work correctly with X-Forwarded-For headers
app.set('trust proxy', true);

// Enable CORS for your GitHub Pages site
// CORS allowlist. furby203824.github.io is the PoC deploy target.
// nexus.github.io is reserved for the Semper Admin migration.
// localhost entries cover local dev with Vite/static servers on common ports.
app.use(cors({
  origin: [
    'https://furby203824.github.io',
    'https://nexus.github.io',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Enable JSON body parsing
app.use(express.json());

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// TLS-validated outbound agent. DoD trust store applies via NODE_EXTRA_CA_CERTS
// at the host level if the source site presents a DoD-issued certificate the
// platform does not trust by default. Never disable rejectUnauthorized.
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  keepAlive: true
});

// Health check endpoint - exposed at both /health and /api/health
// /api/health alias keeps the URL shape consistent with other API routes,
// useful for Render health probes and frontend uptime checks.
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to test GitHub API configuration
app.get('/api/debug/github', async (req, res) => {
  const results = {
    tokenConfigured: !!GITHUB_TOKEN,
    tokenPrefix: GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 7) + '...' : 'NOT SET',
    repoConfigured: !!GITHUB_REPO,
    repo: GITHUB_REPO || 'NOT SET',
    testPayload: null,
    apiTest: null
  };

  // Create a test payload to show what would be sent
  results.testPayload = {
    title: '[BUG REPORT] Test feedback',
    body: '## User Feedback\n\n**Type:** Bug Report\n\n**Description:**\nThis is a test.\n\n---\n\n## Context\n- **Browser:** Test\n\n---\n*This issue was automatically created via the in-app feedback widget.*'
  };

  // Test GitHub API if token is configured
  if (GITHUB_TOKEN && GITHUB_REPO) {
    try {
      // Test authentication by getting repo info
      const response = await axios.get(
        `https://api.github.com/repos/${GITHUB_REPO}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 10000
        }
      );

      results.apiTest = {
        success: true,
        repoExists: true,
        repoName: response.data.full_name,
        hasIssues: response.data.has_issues,
        permissions: {
          // Only expose relevant permissions for debugging
          admin: response.data.permissions?.admin || false,
          push: response.data.permissions?.push || false,
          pull: response.data.permissions?.pull || false
        }
      };
    } catch (error) {
      results.apiTest = {
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message
      };
    }
  } else {
    results.apiTest = { success: false, error: 'Token or repo not configured' };
  }

  res.json(results);
});

// Proxy endpoint for ALNAV
app.get('/api/alnav/:year', async (req, res) => {
  const year = req.params.year;
  const url = `https://www.mynavyhr.navy.mil/References/Messages/ALNAV-${year}/`;

  console.log(`Fetching ALNAV for year ${year}...`);

  try {
    const response = await axios.get(url, {
      httpsAgent,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    res.type('html').send(response.data);
  } catch (error) {
    console.error(`Error fetching ALNAV: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch ALNAV data',
      message: error.message,
      url: url
    });
  }
});

// Proxy endpoint for SECNAV/OPNAV directives
app.get('/api/navy-directives', async (req, res) => {
  const url = 'https://www.secnav.navy.mil/doni/Directives/Forms/Secnav%20Current.aspx';

  console.log('Fetching SECNAV/OPNAV directives...');

  try {
    const response = await axios.get(url, {
      httpsAgent,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    res.type('html').send(response.data);
  } catch (error) {
    console.error(`Error fetching SECNAV: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch SECNAV data',
      message: error.message,
      url: url
    });
  }
});

// NAVMC Forms via DLA DSO DON Forms API
// Source SPA: https://dso.dla.mil/DONForms/?search=NAVMC
// Backend API: https://dso.dla.mil/DONNavyForms-RequestService/api/forms/search
//
// DLA returns ~1764 records for SearchQuery=NAVMC across all DLA-indexed
// fields (formNumber, formTitle, command). Most are blank-formNumber or
// warehouse products with command=NAVMC but non-NAVMC formNumbers. To
// surface only real NAVMC-numbered Marine Corps forms, this route paginates
// every page server-side, filters strictly on formNumber prefix, and caches
// the filtered list in memory with a TTL.
//
// Debug mode: append ?debug=1 to return cache metadata + the first item of
// the filtered list so field shape can be verified without redeploying.

const NAVMC_UPSTREAM_BASE = 'https://dso.dla.mil/DONNavyForms-RequestService/api/forms/search';
const NAVMC_UPSTREAM_PAGE_SIZE = 100; // DLA caps at 100 per page
const NAVMC_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let navmcCache = {
  fetchedAt: 0,
  items: null,
  totalUpstream: 0,
  inFlight: null
};

function buildNavmcUpstream(page, pageSize) {
  return `${NAVMC_UPSTREAM_BASE}?SearchQuery=NAVMC&Page=${page}&PageSize=${pageSize}&SortBy=FormNumber&SortOrder=Ascending`;
}

async function fetchUpstreamPage(page, pageSize) {
  const url = buildNavmcUpstream(page, pageSize);
  const response = await axios.get(url, {
    httpsAgent,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Nexus-Proxy/2.0 (PoC; +https://github.com/furby203824/Nexus)'
    }
  });
  return response.data || {};
}

async function refreshNavmcCache() {
  // Probe page 1 to discover totalCount, then fetch remaining pages in parallel.
  // 18 pages × 100 records ≈ 1764 records. Parallel keeps total latency under
  // a few seconds. DLA returns full payloads, so memory cost is bounded.
  console.log('[NAVMC] Refreshing cache - fetching all pages from DLA');
  const t0 = Date.now();

  const first = await fetchUpstreamPage(1, NAVMC_UPSTREAM_PAGE_SIZE);
  const totalCount = first.totalCount || 0;
  const totalPages = first.totalPages || 0;
  const firstCollection = Array.isArray(first.collection) ? first.collection : [];

  const remainingPages = [];
  for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

  const remainingResults = await Promise.all(
    remainingPages.map(p => fetchUpstreamPage(p, NAVMC_UPSTREAM_PAGE_SIZE)
      .catch(err => {
        console.error(`[NAVMC] Page ${p} failed: ${err.message}`);
        return { collection: [] };
      })
    )
  );

  const allRecords = [
    ...firstCollection,
    ...remainingResults.flatMap(r => Array.isArray(r.collection) ? r.collection : [])
  ];

  // Strict filter: formNumber must begin with NAVMC.
  // Also exclude status==='Canceled' - obsolete entries do not belong in
  // an active reference list. ~50% of DLA records carry this status.
  const navmcOnly = allRecords.filter(f => {
    const fn = (f?.formNumber || '').toUpperCase().trim();
    if (!fn.startsWith('NAVMC')) return false;
    const status = (f?.status || '').toLowerCase();
    if (status === 'canceled') return false;
    return true;
  });

  // Deduplicate by formNumber. When two records share a formNumber, prefer
  // the Active status entry. Tiebreak on newest creationDate. This collapses
  // the DigitalProduct + WarehouseProduct duplicates DLA indexes separately.
  const byFormNumber = new Map();
  for (const rec of navmcOnly) {
    const key = (rec.formNumber || '').toUpperCase().trim();
    const existing = byFormNumber.get(key);
    if (!existing) {
      byFormNumber.set(key, rec);
      continue;
    }
    const existingActive = existing.status === 'Active';
    const recActive = rec.status === 'Active';
    if (recActive && !existingActive) {
      byFormNumber.set(key, rec);
    } else if (recActive === existingActive) {
      // Same status. Keep newer creationDate.
      const existingDate = new Date(existing.creationDate || 0).getTime();
      const recDate = new Date(rec.creationDate || 0).getTime();
      if (recDate > existingDate) byFormNumber.set(key, rec);
    }
  }
  const deduped = Array.from(byFormNumber.values());

  navmcCache = {
    fetchedAt: Date.now(),
    items: deduped,
    totalUpstream: totalCount,
    inFlight: null
  };

  console.log(`[NAVMC] Cache refreshed in ${Date.now() - t0}ms - ${deduped.length} unique NAVMC-numbered (${navmcOnly.length} pre-dedup) of ${allRecords.length} fetched (${totalCount} reported)`);
  return navmcCache;
}

async function getNavmcCache(forceRefresh) {
  const fresh = navmcCache.items && (Date.now() - navmcCache.fetchedAt) < NAVMC_CACHE_TTL_MS;
  if (fresh && !forceRefresh) return navmcCache;

  // Coalesce concurrent refreshes - only one upstream scan at a time.
  if (navmcCache.inFlight) return navmcCache.inFlight;

  navmcCache.inFlight = refreshNavmcCache().finally(() => {
    if (navmcCache.inFlight) navmcCache.inFlight = null;
  });
  return navmcCache.inFlight;
}

app.get('/api/navmc-forms', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 100, 2000);
  const debug = req.query.debug === '1';
  const forceRefresh = req.query.refresh === '1';

  try {
    const cache = await getNavmcCache(forceRefresh);
    const items = cache.items || [];

    if (debug) {
      return res.json({
        upstream: buildNavmcUpstream(1, NAVMC_UPSTREAM_PAGE_SIZE),
        cacheAgeMs: Date.now() - cache.fetchedAt,
        cacheTtlMs: NAVMC_CACHE_TTL_MS,
        totalUpstream: cache.totalUpstream,
        filteredCount: items.length,
        sampleItemKeys: items[0] ? Object.keys(items[0]) : [],
        sampleItem: items[0] || null
      });
    }

    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    res.json({
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      sourceCount: cache.totalUpstream,
      filteredCount: totalCount,
      cacheAgeMs: Date.now() - cache.fetchedAt,
      collection: slice
    });
  } catch (error) {
    console.error(`[NAVMC] Error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch NAVMC forms',
      message: error.message
    });
  }
});

// DoDI Issuances scraper
// Source: https://www.esd.whs.mil/Directives/issuances/dodi/
// Page is a DNN ASP.NET table with all issuances on one page (~1000 rows).
// Parse with cheerio, cache 1 hour, serve paginated subsets.

const DODI_UPSTREAM_URL = 'https://www.esd.whs.mil/Directives/issuances/dodi/';
const DODI_BASE_URL = 'https://www.esd.whs.mil';
const DODI_CACHE_TTL_MS = 60 * 60 * 1000;

let dodiCache = {
  fetchedAt: 0,
  items: null,
  inFlight: null
};

async function refreshDodiCache() {
  const t0 = Date.now();
  console.log('[DODI] Refreshing cache - fetching from esd.whs.mil');

  const response = await axios.get(DODI_UPSTREAM_URL, {
    httpsAgent,
    timeout: 60000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  const items = [];

  // Each issuance row carries class dnnGridItem or dnnGridAltItem.
  // Cells in order: Issuance #, Issuance Date, Subject, CH #, CH Date,
  // Related Memo, OPR.
  $('tr.dnnGridItem, tr.dnnGridAltItem').each((_, row) => {
    const cells = $(row).find('> td');
    if (cells.length < 7) return;

    const linkEl = cells.eq(0).find('a').first();
    const id = (linkEl.text() || cells.eq(0).text() || '').trim().replace(/\s+/g, ' ');
    if (!id) return;

    let link = (linkEl.attr('href') || '').trim();
    if (link.startsWith('/')) link = DODI_BASE_URL + link;

    const issuanceDate = cells.eq(1).text().trim();
    const subject = cells.eq(2).text().trim().replace(/\s+/g, ' ');
    const chNumber = cells.eq(3).text().trim().replace(/\s+/g, ' ');
    const chDate = cells.eq(4).text().trim();
    const relatedMemo = cells.eq(5).text().trim().replace(/\s+/g, ' ');
    const opr = cells.eq(6).text().trim().replace(/\s+/g, ' ');

    items.push({
      id,
      link,
      issuanceDate,
      subject,
      chNumber,
      chDate,
      relatedMemo,
      opr
    });
  });

  dodiCache = {
    fetchedAt: Date.now(),
    items,
    inFlight: null
  };

  console.log(`[DODI] Cache refreshed in ${Date.now() - t0}ms - ${items.length} issuances`);
  return dodiCache;
}

async function getDodiCache(forceRefresh) {
  const fresh = dodiCache.items && (Date.now() - dodiCache.fetchedAt) < DODI_CACHE_TTL_MS;
  if (fresh && !forceRefresh) return dodiCache;
  if (dodiCache.inFlight) return dodiCache.inFlight;
  dodiCache.inFlight = refreshDodiCache().finally(() => {
    if (dodiCache.inFlight) dodiCache.inFlight = null;
  });
  return dodiCache.inFlight;
}

app.get('/api/dodi', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 100, 2000);
  const debug = req.query.debug === '1';
  const forceRefresh = req.query.refresh === '1';

  try {
    const cache = await getDodiCache(forceRefresh);
    const items = cache.items || [];

    if (debug) {
      return res.json({
        upstream: DODI_UPSTREAM_URL,
        cacheAgeMs: Date.now() - cache.fetchedAt,
        cacheTtlMs: DODI_CACHE_TTL_MS,
        totalCount: items.length,
        sampleItem: items[0] || null,
        sampleItem10: items[10] || null,
        sampleItem100: items[100] || null
      });
    }

    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    res.json({
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      cacheAgeMs: Date.now() - cache.fetchedAt,
      collection: slice
    });
  } catch (error) {
    console.error(`[DODI] Error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch DoDI issuances',
      message: error.message
    });
  }
});

// Generic proxy endpoint (use with caution)
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Whitelist allowed domains for security
  const allowedDomains = [
    'mynavyhr.navy.mil',
    'secnav.navy.mil',
    'navy.mil',
    'marines.mil',        // USMC RSS feeds (MARADMIN, MCPUB, ALMAR)
    'rss.app',            // RSS feed proxy for ALNAV, SECNAV
    'travel.dod.mil'      // DoD JTR (Joint Travel Regulations)
  ];

  let urlObj;
  try {
    urlObj = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }

  // Only proxy https targets on the standard port. A non-default port would let
  // the allowlisted hosts be used for internal port scanning / service probing.
  if (urlObj.protocol !== 'https:' || urlObj.port !== '') {
    return res.status(400).json({ error: 'Only https targets on the standard port are allowed' });
  }

  // Exact host or true dot-boundary subdomain match. A bare endsWith() would
  // treat any hostname ending in the allowlisted string as allowed, so a
  // commercial suffix like "rss.app" would match an attacker-registered
  // "myrss.app" and turn this route into an open relay.
  const isAllowed = allowedDomains.some(domain =>
    urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return res.status(403).json({
      error: 'Domain not allowed',
      allowedDomains: allowedDomains
    });
  }

  console.log(`Proxying request to: ${targetUrl}`);

  try {
    const response = await axios.get(targetUrl, {
      httpsAgent,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,application/rss+xml'
      }
    });

    // Detect content type from response or URL
    const contentType = response.headers['content-type'] ||
                       (targetUrl.includes('.xml') || targetUrl.includes('/rss') || targetUrl.includes('rss.')
                         ? 'application/xml'
                         : 'text/html');

    res.type(contentType).send(response.data);
  } catch (error) {
    console.error(`Error proxying request: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch data',
      message: error.message,
      url: targetUrl
    });
  }
});

// Feedback endpoint removed for compliance - see PRIVACY_POLICY.md and TERMS_OF_SERVICE.md

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`GitHub debug: http://localhost:${PORT}/api/debug/github`);
  console.log(`ALNAV endpoint: http://localhost:${PORT}/api/alnav/2025`);
  console.log(`SECNAV endpoint: http://localhost:${PORT}/api/navy-directives`);
  console.log(`NAVMC Forms endpoint: http://localhost:${PORT}/api/navmc-forms?page=1&pageSize=100`);
});
