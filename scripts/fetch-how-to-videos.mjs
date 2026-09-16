#!/usr/bin/env node

/**
 * Generate the Nexus how-to video list from the Vanguard asset database
 *
 * Reads the Semper Admin video catalog (SQLite, data/vanguard.db inside the
 * Vanguard Asset Manager folder), keeps every title that starts with
 * "Nexus, ", strips that prefix, and writes lib/how-to-videos.js. The app
 * lists the result in the header How-To modal and in the per-tab chip under
 * the tab row.
 *
 * Source: E:\Videos\Video Database\Video Database\data\vanguard.db
 *         (override with a path argument or the VANGUARD_DB variable)
 * Target: lib/how-to-videos.js
 *
 *   npm run fetch-videos
 *   npm run fetch-videos -- "D:\somewhere\vanguard.db"
 *
 * Local only: the database lives on one workstation, never in CI. Like the
 * other fetch scripts, this one never writes an empty or sharply smaller
 * file. A failed read leaves the committed data in place and exits non-zero.
 *
 * node:sqlite ships with Node 22.13 and newer.
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DB_PATH = 'E:\\Videos\\Video Database\\Video Database\\data\\vanguard.db';
const DB_PATH = process.argv[2] || process.env.VANGUARD_DB || DEFAULT_DB_PATH;
const OUTPUT_FILE = join(__dirname, '../lib/how-to-videos.js');

// Titles are stored as "Nexus, <topic>". The prefix is the catalog's series
// marker, not part of the topic, so it is dropped: "Nexus, Nexus on Your
// Phone" ships as "Nexus on Your Phone".
const TITLE_PREFIX = /^nexus,\s*/i;

// A read returning fewer than this share of the committed record count is
// treated as a wrong database rather than as real deletions upstream.
const SHRINK_TOLERANCE = 0.8;

/**
 * Where each video sits in the app, keyed by the cleaned title in lowercase.
 *
 *   group  'start' lists under Getting Started, 'tab' under Tab by Tab
 *   order  display order inside the group
 *   tabs   data-type values of the tabs that show this video as their chip
 *
 * A video missing from this map still ships: it lands in Getting Started with
 * no chip, and the run prints a warning so the map gets extended when a new
 * video is recorded.
 */
const VIDEO_MAP = {
  'find any directive in a minute':               { group: 'start', order: 1, tabs: ['maradmin', 'almar', 'alnav', 'secnav'] },
  'search across every source at once':           { group: 'start', order: 2, tabs: ['all'] },
  'what it pulls and how current it is':          { group: 'start', order: 3, tabs: [] },
  'nexus on your phone':                          { group: 'start', order: 4, tabs: [] },
  'inspection prep with fa checklists and mcpel': { group: 'tab',   order: 1, tabs: ['mcpub', 'igmc'] },
  'dodfmr and jtr changes':                       { group: 'tab',   order: 2, tabs: ['dodfmr', 'jtr'] },
  'navmc forms by number and by name':            { group: 'tab',   order: 3, tabs: ['navmc'] },
  'dod issuances and dd forms':                   { group: 'tab',   order: 4, tabs: ['dodi', 'dodforms'] },
  'court-martial reports by month':               { group: 'tab',   order: 5, tabs: ['cmr'] },
  'the cac tabs':                                 { group: 'tab',   order: 6, tabs: ['paa', 'paan', 'tan', 'fan', 'ican'] }
};

const GROUP_ORDER = { start: 0, tab: 1 };

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function firstHttpUrl(...candidates) {
  const hit = candidates.find(isHttpUrl);
  return hit ? hit.trim() : null;
}

function isYouTubeUrl(value) {
  return isHttpUrl(value) && /youtu\.?be/i.test(value);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The YouTube description opens with the full title, then one paragraph that
 * starts "We're going to cover three things: ...". That paragraph is the best
 * one-line summary the catalog has, so it becomes the modal's blurb.
 */
function summaryFromDescription(description) {
  if (typeof description !== 'string') { return null; }
  const paragraphs = description
    .split(/\r?\n\s*\r?\n/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const candidate = paragraphs.find((part, index) => index > 0 && !/^chapters:/i.test(part));
  if (!candidate) { return null; }
  let summary = candidate.replace(/^we(?:'|\u2019)re going to cover (?:\w+ )?things?:\s*/i, '');
  summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  if (!/[.!?]$/.test(summary)) { summary += '.'; }
  return summary;
}

/**
 * The description's chapter list ends with the outro timestamp, which is the
 * closest thing the catalog has to a running time.
 */
function approxMinutesFromDescription(description) {
  if (typeof description !== 'string') { return null; }
  let seconds = 0;
  const pattern = /^(\d{1,2}):(\d{2})\s+\S/gm;
  let hit;
  while ((hit = pattern.exec(description)) !== null) {
    seconds = Math.max(seconds, Number(hit[1]) * 60 + Number(hit[2]));
  }
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

function mediaIdFromUrl(url) {
  if (!isHttpUrl(url)) { return null; }
  const hit = url.match(/[?&]Id=([A-Za-z0-9]+)/i);
  return hit ? hit[1] : null;
}

function readRows(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT _id AS rowId,
             Title AS title,
             [Video Title] AS videoTitle,
             Recorded AS recorded,
             MarineNet AS marinenetDate,
             [MarineNet URL] AS marinenetUrl,
             [YT URL] AS ytUrl,
             [UploadedTY URL] AS uploadedTyUrl,
             [UploadedTY Description] AS description
      FROM assets
      WHERE Title LIKE 'Nexus,%'
      ORDER BY _id
    `).all();
  } finally {
    db.close();
  }
}

function buildRecords(rows) {
  const records = [];

  for (const row of rows) {
    const title = String(row.title || '').replace(TITLE_PREFIX, '').trim();
    if (!title) {
      console.warn(`[How-To Videos] Row ${row.rowId} has an empty title after the prefix. Skipped.`);
      continue;
    }

    const marinenetUrl = firstHttpUrl(row.marinenetUrl);
    const youtubeCandidates = [row.ytUrl, row.uploadedTyUrl].filter(isYouTubeUrl);
    const youtubeUrl = firstHttpUrl(...youtubeCandidates);

    if (!marinenetUrl && !youtubeUrl) {
      console.warn(`[How-To Videos] "${title}" has no MarineNet or YouTube URL yet. Skipped.`);
      continue;
    }

    const placement = VIDEO_MAP[title.toLowerCase()];
    if (!placement) {
      console.warn(`[How-To Videos] "${title}" is not in VIDEO_MAP. Listed under Getting Started with no tab chip.`);
    }

    records.push({
      id: slugify(title),
      title,
      group: placement ? placement.group : 'start',
      order: placement ? placement.order : 999,
      tabs: placement ? placement.tabs : [],
      approxMinutes: approxMinutesFromDescription(row.description),
      summary: summaryFromDescription(row.description),
      recorded: row.recorded || null,
      marinenetId: mediaIdFromUrl(marinenetUrl),
      marinenetUrl,
      youtubeUrl
    });
  }

  records.sort((a, b) =>
    (GROUP_ORDER[a.group] - GROUP_ORDER[b.group]) ||
    (a.order - b.order) ||
    a.title.localeCompare(b.title)
  );

  return records;
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

async function generateDataFile(videos) {
  const now = new Date().toISOString();
  const withYouTube = videos.filter(video => video.youtubeUrl).length;

  const fileContent = `/**
 * Nexus How-To Videos
 *
 * Auto-generated from the Vanguard asset database (Semper Admin video
 * catalog). Every title that starts with "Nexus, " is included with that
 * prefix removed.
 * Generated: ${now}
 * Total Records: ${videos.length}
 * With YouTube URL: ${withYouTube}
 *
 * The app lists these in the header How-To modal (group 'start' under
 * Getting Started, 'tab' under Tab by Tab) and shows each video as a chip
 * under the tab row for the tabs named in its tabs array. MarineNet links
 * need a CAC on a .mil network; a YouTube link appears once the upload
 * exists in the catalog.
 *
 * This file is automatically generated by scripts/fetch-how-to-videos.mjs
 * DO NOT EDIT MANUALLY
 */

// How-to video data structure
const HOW_TO_VIDEOS = ${JSON.stringify(videos, null, 2)};

const HOW_TO_VIDEOS_META = {
  source: 'Vanguard asset database (data/vanguard.db), assets table, titles starting "Nexus, "',
  generatedAt: '${now}',
  totalRecords: ${videos.length},
  withYouTube: ${withYouTube},
  lastUpdate: '${now}'
};

// Export for use in application
if (typeof window !== 'undefined') {
  window.HOW_TO_VIDEOS = HOW_TO_VIDEOS;
  window.HOW_TO_VIDEOS_META = HOW_TO_VIDEOS_META;
}

// Also support module exports for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HOW_TO_VIDEOS,
    HOW_TO_VIDEOS_META
  };
}
`;

  await writeFile(OUTPUT_FILE, fileContent, 'utf-8');
  console.log(`[How-To Videos] Data file written to: ${OUTPUT_FILE}`);
  console.log(`[How-To Videos] Total records: ${videos.length} (${withYouTube} with a YouTube URL)`);
}

async function main() {
  console.log('[How-To Videos] Reading:', DB_PATH);

  let rows;
  try {
    rows = readRows(DB_PATH);
  } catch (error) {
    console.error('[How-To Videos] Database read failed:', error.message);
    console.error('[How-To Videos] Existing data left untouched. Pass the vanguard.db path as an argument or set VANGUARD_DB.');
    process.exit(1);
  }

  const videos = buildRecords(rows);
  const previous = await existingRecordCount();

  if (videos.length === 0) {
    console.error('[How-To Videos] Found zero "Nexus, " titles with a video URL. Existing data left untouched.');
    process.exit(1);
  }

  if (previous > 0 && videos.length < previous * SHRINK_TOLERANCE) {
    console.error(`[How-To Videos] Found ${videos.length} videos against ${previous} committed.`);
    console.error('[How-To Videos] That drop looks like the wrong database. Existing data left untouched.');
    console.error('[How-To Videos] Re-run, and if videos were genuinely removed, delete the data file first.');
    process.exit(1);
  }

  await generateDataFile(videos);
  console.log('[How-To Videos] Complete');
}

main();
