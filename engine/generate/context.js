/**
 * context.js
 *
 * Everything the model reads before it plans or writes, assembled the same
 * way on every call so the long, unchanging part (the brand files) leads
 * every prompt and the provider can cache it.
 *
 * Brand files are reference material written by people: the model follows
 * them, and the gates check that it did. Nothing in here is a secret; the
 * whole context is what a new copywriter would be handed on day one.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { propsSummary } = require('./catalog');

// Read in this order. Humor has its own standard and is review-first, so it
// is not generated automatically and its standard is not sent.
const BRAND_FILES = [
  'BRAND.md',
  'capability-boundary.md',
  'editorial-standard.md',
  'club-operations-facts.md',
  'format-rotation.md',
  'voice-reference-posts.md',
  'approved-stats.json',
  'demo-clubs.json',
  'approved-clubs.json',
];

function brandContext(brandDir) {
  const parts = [];
  for (const f of BRAND_FILES) {
    const file = path.join(brandDir, f);
    if (!fs.existsSync(file)) continue;
    parts.push(`<brand_file name="${f}">\n${fs.readFileSync(file, 'utf8').trim()}\n</brand_file>`);
  }
  return parts.join('\n\n');
}

const postsOf = (ledger) => (Array.isArray(ledger) ? ledger : ledger.posts || []).filter(Boolean);
const dateOf = (p) => String(p.dueAt || p.date || '').slice(0, 10);

/** Recent posts, newest last, so the planner does not repeat a message or a pairing. */
function historySummary(priors, beforeDate, days = 60) {
  const cutoff = new Date(Date.parse(`${beforeDate}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const rows = priors.flatMap(postsOf)
    .filter((p) => dateOf(p) && dateOf(p) >= cutoff && dateOf(p) < beforeDate)
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
    .map((p) => `- ${dateOf(p)} ${p.channel} | ${p.pillar} | ${p.format || '?'} | ${p.message || p.headline || ''}`);
  const pairs = [...new Set(priors.flatMap(postsOf).filter((p) => p.pillar && p.format)
    .map((p) => `${p.pillar} + ${p.format}`))].sort();
  return [
    `Posts in the ${days} days before this batch:`,
    rows.length ? rows.join('\n') : '- none',
    '',
    'Pillar + format pairings that have already run (at least one pairing this batch must be new):',
    pairs.length ? pairs.map((p) => `- ${p}`).join('\n') : '- none',
  ].join('\n');
}

/** What the photo library can supply, by subject and time of day. */
function photoSummary(library, lib = require('../photos/library'), now = Date.now()) {
  const available = lib.select(library, { now });
  const count = (key) => {
    const m = new Map();
    for (const p of available) m.set(p[key], (m.get(p[key]) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  };
  const tags = new Map();
  for (const p of available) for (const t of p.tags || []) tags.set(t, (tags.get(t) || 0) + 1);
  const topTags = [...tags].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
  return [
    `${available.length} photos are available (reviewed, unrestricted, not used in the last 30 days).`,
    `By subject: ${count('subject')}.`,
    `By time of day: ${count('time')}.`,
    `By people: ${count('people')}.`,
    `Common tags: ${topTags || 'none'}.`,
    'Plan photo posts only around subjects the library has. There are no photos of staff, dining, events or',
    'clubhouse interiors; a post about those runs as a type card, list or thread, not a photo.',
  ].join('\n');
}

function layoutMenu(catalog, brand) {
  return catalog.filter((c) => c.eligible).map((c) => [
    `### ${c.id} (format: ${c.format}; shell: ${c.shell}; surfaces: ${c.surfaces.join(', ')})`,
    c.description,
    ...propsSummary(c.layout, brand).map((l) => `- ${l}`),
  ].join('\n')).join('\n\n');
}

module.exports = { brandContext, historySummary, photoSummary, layoutMenu, BRAND_FILES };
