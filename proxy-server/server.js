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
app.use(cors({
  origin: ['https://nexus.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'],
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
// Cross-origin not allowed by the upstream (no CORS header), so we proxy and
// filter server-side to return only NAVMC-numbered forms.
//
// Debug mode: append ?debug=1 to return the raw upstream payload (first item
// plus key inventory) so field names can be verified without redeploying.
app.get('/api/navmc-forms', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 100, 100);
  const debug = req.query.debug === '1';
  // Sort by FormNumber Ascending so NAVMC-prefixed forms cluster on early
  // pages. CreationDate Descending surfaces warehouse products tagged with
  // command=NAVMC but with non-NAVMC form numbers (USSF, JFOL, etc.).
  const upstream = `https://dso.dla.mil/DONNavyForms-RequestService/api/forms/search?SearchQuery=NAVMC&Page=${page}&PageSize=${pageSize}&SortBy=FormNumber&SortOrder=Ascending`;

  try {
    const response = await axios.get(upstream, {
      httpsAgent,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Nexus-Proxy/2.0 (PoC; +https://github.com/furby203824/Nexus)'
      }
    });

    const data = response.data || {};
    const all = Array.isArray(data.collection) ? data.collection : [];

    // Debug short-circuit. Returns full first item + top-level key list so we
    // can identify the real field name for the NAVMC identifier.
    if (debug) {
      const sample = all[0] || null;
      return res.json({
        upstream,
        upstreamKeys: Object.keys(data),
        sampleItemKeys: sample ? Object.keys(sample) : [],
        sampleItem: sample,
        totalCount: data.totalCount || 0,
        sourceCount: all.length
      });
    }

    // Strict filter: formNumber must begin with NAVMC. The upstream returns
    // 1764 records tagged command=NAVMC, but most have non-NAVMC formNumbers
    // (USSF, JFOL warehouse products). Marines expect to see actual
    // NAVMC-numbered forms in this tab.
    const navmcOnly = all.filter(f => {
      const fn = (f?.formNumber || '').toUpperCase().trim();
      return fn.startsWith('NAVMC');
    });

    res.json({
      page: data.pageIndex || page,
      pageSize: data.pageSize || pageSize,
      totalCount: data.totalCount || 0,
      totalPages: data.totalPages || 0,
      hasNextPage: !!data.hasNextPage,
      sourceCount: all.length,
      filteredCount: navmcOnly.length,
      collection: navmcOnly
    });
  } catch (error) {
    console.error(`Error fetching NAVMC forms: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch NAVMC forms',
      message: error.message,
      upstream
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

  const urlObj = new URL(targetUrl);
  const isAllowed = allowedDomains.some(domain => urlObj.hostname.endsWith(domain));

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

// Feedback endpoint - Create GitHub issues from user feedback
app.post('/api/feedback', async (req, res) => {
  // Check if GitHub token is configured
  if (!GITHUB_TOKEN) {
    return res.status(503).json({
      success: false,
      error: 'Feedback service not configured',
      message: 'Server administrator must set GITHUB_TOKEN environment variable'
    });
  }

  try {
    const { type, title, description, context = {} } = req.body;

    // Validate required fields
    if (!type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, title, and description are required'
      });
    }

    // Sanitize and truncate inputs
    const sanitizeString = (str) => {
      if (!str) return '';
      // Remove null bytes and control characters except newlines and tabs
      return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    };

    const sanitizedTitle = sanitizeString(title).substring(0, 200); // GitHub limit is 256, leave room for prefix
    const sanitizedDescription = sanitizeString(description).substring(0, 50000); // GitHub body limit is 65536

    // Format type for display
    const typeDisplay = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      ux: 'UX Suggestion'
    }[type] || 'Feedback';

    // Anonymous issue body. Only feedbackTab and server-side timestamp are
    // recorded for context. No email, browser, IP, viewport, URL, or device
    // identifier is captured or persisted. Privacy Act compliance baseline.
    const feedbackTab = sanitizeString(context.feedbackTab).substring(0, 32) || 'Unknown';
    const issueBody = `## User Feedback

**Type:** ${typeDisplay}

**Description:**
${sanitizedDescription}

---

## Context
- **Feedback Tab:** ${feedbackTab}
- **Timestamp:** ${new Date().toISOString()}

---
*Anonymous submission via the in-app feedback widget. No user identity collected.*`;

    const issueTitle = `[${typeDisplay.toUpperCase()}] ${sanitizedTitle}`;

    console.log('Creating GitHub issue:', {
      repo: GITHUB_REPO,
      titleLength: issueTitle.length,
      bodyLength: issueBody.length
    });

    // Create GitHub issue (without labels to avoid validation errors if labels don't exist)
    const response = await axios.post(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        title: issueTitle,
        body: issueBody
      },
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`✅ Feedback issue created: ${response.data.html_url}`);

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      issueUrl: response.data.html_url,
      issueNumber: response.data.number
    });

  } catch (error) {
    console.error('GitHub API error:', error.message);

    if (error.response) {
      console.error('GitHub API Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data, null, 2)
      });

      return res.status(error.response.status).json({
        success: false,
        error: 'Failed to create GitHub issue',
        message: error.response.data?.message || error.message,
        details: error.response.data?.errors || error.response.data
      });
    }

    console.error('Non-API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`GitHub debug: http://localhost:${PORT}/api/debug/github`);
  console.log(`ALNAV endpoint: http://localhost:${PORT}/api/alnav/2025`);
  console.log(`SECNAV endpoint: http://localhost:${PORT}/api/navy-directives`);
  console.log(`NAVMC Forms endpoint: http://localhost:${PORT}/api/navmc-forms?page=1&pageSize=100`);
  console.log(`Feedback endpoint: POST http://localhost:${PORT}/api/feedback`);
});
