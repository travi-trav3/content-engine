/**
 * library.js
 *
 * The brand's photo library: photos/library.json in the workspace, one entry
 * per image, plus a usage log. Selection never returns a photo used in the
 * last `days` days (30 by default) or already taken by this batch, prefers
 * the least recently used, and only returns photos with enough resolution
 * for the layout that asked.
 *
 * Entry shape:
 *   {
 *     id, file, width, height, orientation,           written by ingest
 *     luminance, zones, fullBleedOk, bandOk,          written by ingest
 *     source: { photographer, url, license },         written by ingest
 *     tags: [...], subject, time, people,             written by review
 *     focus: { x, y },                                0..1, crop center
 *     reviewed: true|false,                           false until a person or agent has tagged it
 *     notes
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');

const DAY = 24 * 60 * 60 * 1000;

function libraryPath() {
  return path.join(workspace().dir, 'photos', 'library.json');
}

function load(file = libraryPath()) {
  if (!fs.existsSync(file)) return { photos: [], usage: [] };
  const lib = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { photos: lib.photos || [], usage: lib.usage || [] };
}

function save(lib, file = libraryPath()) {
  const sorted = { photos: [...lib.photos].sort((a, b) => a.id.localeCompare(b.id)), usage: lib.usage };
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

function lastUsed(lib, id) {
  const dates = lib.usage.filter((u) => u.photo === id).map((u) => Date.parse(u.date));
  return dates.length ? Math.max(...dates) : 0;
}

/**
 * Candidates for a slot, best first.
 *   need: 'fullBleed' | 'band' | 'any'
 *   tags: every tag must be present (subject, time and people count as tags)
 *   exclude: ids already taken in this batch
 */
function select(lib, { tags = [], need = 'any', orientation, days = 30, exclude = [], now = Date.now() } = {}) {
  const cutoff = now - days * DAY;
  return lib.photos
    .filter((p) => p.reviewed && !p.restricted)
    .filter((p) => need === 'any' || (need === 'fullBleed' ? p.fullBleedOk : p.bandOk))
    .filter((p) => !orientation || p.orientation === orientation)
    .filter((p) => {
      const all = new Set([...(p.tags || []), p.subject, p.time, p.people].filter(Boolean));
      return tags.every((t) => all.has(t));
    })
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => lastUsed(lib, p.id) < cutoff)
    .sort((a, b) => lastUsed(lib, a.id) - lastUsed(lib, b.id) || a.id.localeCompare(b.id));
}

/**
 * The library with every photo the batch ledgers used counted as a use on
 * the post's date. The ledgers are the record of use: a photo in a planned
 * or published post is used, whether or not anyone called recordUse. A
 * draft the reviewer deleted does not count.
 */
function withLedgerUsage(lib, ledgers) {
  const usage = [...lib.usage];
  for (const p of ledgers.flatMap((l) => (Array.isArray(l) ? l : l.posts || []))) {
    if (!p || (p.buffer && p.buffer.status === 'deleted')) continue;
    for (const photo of p.photos || []) usage.push({ photo, post: p.id, date: p.dueAt || p.date });
  }
  return { photos: lib.photos, usage };
}

function recordUse(lib, { photo, post, date }) {
  if (!lib.photos.some((p) => p.id === photo)) throw new Error(`Unknown photo "${photo}"`);
  lib.usage.push({ photo, post, date });
}

function get(lib, id) {
  const p = lib.photos.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown photo "${id}" (not in photos/library.json)`);
  return p;
}

module.exports = { load, save, select, recordUse, withLedgerUsage, get, lastUsed, libraryPath };
