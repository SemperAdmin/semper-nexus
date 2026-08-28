#!/usr/bin/env node

/**
 * Fetch Court-Martial Reports from the Marine Corps SJA website
 *
 * Scrapes the monthly General and Special Court-Martial dispositions listing
 * and generates a static JavaScript data file for the application.
 *
 * Source: https://www.sja.marines.mil/Court-Martial-Reports/
 * Target: lib/court-martial-data.js
 *
 * Run locally, not in CI. The site sits behind Akamai and returns HTTP 403 to
 * GitHub Actions runners and other datacenter ranges, the same restriction
 * already documented for the FA checklist fetch.
 *
 *   npm run fetch-cmr
 *
 * Unlike scripts/fetch-fa-checklists.mjs, this script never writes an empty or
 * sharply smaller file. A failed scrape leaves the committed data in place and
 * exits non-zero, because silently replacing a good archive with an empty one
 * is worse than a visibly failed run.
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_URL = 'https://www.sja.marines.mil/Court-Martial-Reports/';
const OUTPUT_FILE = join(__dirname, '../lib/court-martial-data.js');

// A scrape returning fewer than this share of the committed record count is
// treated as partial rather than as real deletions upstream.
const SHRINK_TOLERANCE = 0.8;

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none'
};

async function fetchPage(url) {
  const response = await fetch(url, { headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

/**
 * The listing paginates through a site-generated query parameter, currently
 * smdpage162653. The number is a module id and changes if SJA rebuilds the
 * page, so it is read from the markup rather than hard-coded.
 */
function findPaginationParam(html) {
  const match = html.match(/[?&](smdpage\d+)=/);
  return match ? match[1] : null;
}

function findPageCount(html, param) {
  const pattern = new RegExp(`[?&]${param}=(\\d+)`, 'g');
  let highest = 1;
  let hit;
  while ((hit = pattern.exec(html)) !== null) {
    highest = Math.max(highest, Number(hit[1]));
  }
  return highest;
}

/**
 * Normalize a listing URL. The media.defense.gov paths carry spaces and
 * parentheses, which break when emitted raw into an href.
 */
function normalizeUrl(raw, base) {
  const resolved = new URL(raw, base);
  resolved.pathname = resolved.pathname
    .split('/')
    .map(segment => encodeURIComponent(decodeURIComponent(segment)))
    .join('/');
  return resolved.toString();
}

/**
 * Rows are matched by their title shape rather than by table class, so a DNN
 * theme change does not silently return zero rows. The listing also carries
 * JAGINST enclosures and reference PDFs; only "YYYY Month" titles are
 * dispositions reports.
 */
function parseRows($, html) {
  const rows = [];

  $('tr').each((_, tr) => {
    const anchor = $(tr).find('a[href]').first();
    if (!anchor.length) { return; }

    const title = anchor.text().trim();
    const monthMatch = /^(\d{4})\s+([A-Za-z]+)$/.exec(title);
    if (!monthMatch) { return; }

    const monthName = monthMatch[2].toLowerCase();
    const monthNum = MONTHS[monthName];
    if (!monthNum) { return; }

    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get();
    const dateCell = cells.find(text => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text));
    const descriptionCell = cells.find(text => /court\s*martial/i.test(text) && text !== title);

    rows.push({
      title,
      reportMonth: monthMatch[2],
      reportYear: monthMatch[1],
      period: `${monthMatch[1]}-${String(monthNum).padStart(2, '0')}`,
      publicationDate: dateCell || `${monthNum}/1/${monthMatch[1]}`,
      description: descriptionCell || 'Marine Corps General and Special Court Martial Dispositions',
      url: normalizeUrl(anchor.attr('href'), SOURCE_URL)
    });
  });

  return rows;
}

async function scrapeAllPages() {
  const cheerio = await import('cheerio');

  console.log('[Court-Martial] Fetching page 1:', SOURCE_URL);
  const firstHtml = await fetchPage(SOURCE_URL);

  const param = findPaginationParam(firstHtml);
  const pageCount = param ? findPageCount(firstHtml, param) : 1;
  console.log(`[Court-Martial] Pagination parameter: ${param || 'none found'}, pages: ${pageCount}`);

  const collected = [];
  const seen = new Set();

  const absorb = html => {
    for (const row of parseRows(cheerio.load(html), html)) {
      if (seen.has(row.period)) { continue; }
      seen.add(row.period);
      collected.push(row);
    }
  };

  absorb(firstHtml);

  for (let page = 2; page <= pageCount; page++) {
    const url = `${SOURCE_URL}?${param}=${page}`;
    console.log(`[Court-Martial] Fetching page ${page}`);
    absorb(await fetchPage(url));
    // Courtesy delay. The listing is small and there is no reason to hammer it.
    await new Promise(resolve => setTimeout(resolve, 400));
  }

  collected.sort((a, b) => b.period.localeCompare(a.period));
  return collected;
}

async function existingRecordCount() {
  try {
    const current = await readFile(OUTPUT_FILE, 'utf-8');
    const match = current.match(/totalRecords:\s*(\d+)/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

async function generateDataFile(reports) {
  const now = new Date().toISOString();
  const coverage = reports.length
    ? `${reports[reports.length - 1].period} through ${reports[0].period}`
    : 'none';

  const fileContent = `/**
 * Court-Martial Reports Data
 *
 * Auto-generated from the Marine Corps Office of the Judge Advocate listing
 * Source: ${SOURCE_URL}
 * Generated: ${now}
 * Total Records: ${reports.length}
 *
 * Each record is one monthly General and Special Court-Martial dispositions
 * report. The listing also carries JAGINST enclosures and reference PDFs;
 * those are a different kind of document and are excluded.
 *
 * This file is automatically generated by scripts/fetch-court-martial.mjs
 * DO NOT EDIT MANUALLY
 */

// Court-martial report data structure
const COURT_MARTIAL_REPORTS = ${JSON.stringify(reports, null, 2)};

const COURT_MARTIAL_META = {
  sourceUrl: '${SOURCE_URL}',
  generatedAt: '${now}',
  totalRecords: ${reports.length},
  lastUpdate: '${now}',
  coverage: '${coverage}'
};

// Export for use in application
if (typeof window !== 'undefined') {
  window.COURT_MARTIAL_REPORTS = COURT_MARTIAL_REPORTS;
  window.COURT_MARTIAL_META = COURT_MARTIAL_META;
}

// Also support module exports for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COURT_MARTIAL_REPORTS,
    COURT_MARTIAL_META
  };
}
`;

  await writeFile(OUTPUT_FILE, fileContent, 'utf-8');
  console.log(`[Court-Martial] Data file written to: ${OUTPUT_FILE}`);
  console.log(`[Court-Martial] Total records: ${reports.length} (${coverage})`);
}

async function main() {
  console.log('[Court-Martial] Starting fetch process...');

  let reports;
  try {
    reports = await scrapeAllPages();
  } catch (error) {
    console.error('[Court-Martial] Fetch failed:', error.message);
    console.error('[Court-Martial] Existing data left untouched. Run this from a workstation, not CI.');
    process.exit(1);
  }

  const previous = await existingRecordCount();

  if (reports.length === 0) {
    console.error('[Court-Martial] Parsed zero reports. Existing data left untouched.');
    console.error('[Court-Martial] The listing markup likely changed. Check parseRows against the live page.');
    process.exit(1);
  }

  if (previous > 0 && reports.length < previous * SHRINK_TOLERANCE) {
    console.error(`[Court-Martial] Parsed ${reports.length} reports against ${previous} committed.`);
    console.error('[Court-Martial] That drop looks like a partial scrape. Existing data left untouched.');
    console.error('[Court-Martial] Re-run, and if the listing genuinely shrank, delete the data file first.');
    process.exit(1);
  }

  await generateDataFile(reports);
  console.log('[Court-Martial] Complete');
}

main();
