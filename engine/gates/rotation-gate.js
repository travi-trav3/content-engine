/**
 * rotation-gate.js
 *
 * Club Pilot format rotation as code.
 * Enforces brand/format-rotation.md against the batch ledger.
 *
 * Zero dependencies. Pure functions. Runs in the same pre-schedule block as
 * capability-gate.js and editorial-gate.js, or standalone:
 *
 *   node rotation-gate.js content/batch-03/ledger.json \
 *                         content/batch-01/ledger.json content/batch-02/ledger.json
 *
 * The first ledger is the batch being checked. Every ledger after it is prior
 * history, used for the "has this pairing ever run before" and "has this pillar
 * been stuck on one format" rules. With no history given, those two rules are
 * skipped and say so rather than passing silently.
 *
 * Origin: three batches in, Humor had always been a type card, Member
 * experience had always been a photograph, and Intelligent communication was a
 * phone thread four times out of six. Nobody chose that. Each batch copied the
 * previous batch's pairing, and the feed became predictable enough that a
 * reader could tell what a post said before reading it.
 */

'use strict';

const fs = require('fs');

const FAIL = 'fail';
const WARN = 'warn';
const INFO = 'info';

const MAX_PER_FORMAT = 3;
const STALE_AFTER = 3; // consecutive batches on one format before a pillar is flagged

const KNOWN_FORMATS = [
  'photo', 'thread', 'type-card', 'data', 'portrait',
  'list', 'compare', 'carousel', 'logo-wall',
];

const norm = (s) => String(s || '').trim().toLowerCase();
const pairKey = (p) => `${norm(p.pillar)} + ${norm(p.format)}`;

function postsOf(ledger) {
  return (Array.isArray(ledger) ? ledger : ledger.posts || []).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function checkBatch(ledger, priors = []) {
  const posts = postsOf(ledger);
  const findings = [];
  const add = (level, rule, detail, id = '(batch)') => findings.push({ id, level, rule, detail });

  /* -- Rule 0: the field has to exist -------------------------------- */
  for (const p of posts) {
    const id = p.id || p.slug || '(unidentified post)';
    if (!p.format || !norm(p.format)) {
      add(FAIL, 'rotation.formatMissing',
        'format is missing. Every post declares its shape so rotation can be reasoned about. See brand/format-rotation.md.', id);
    } else if (!KNOWN_FORMATS.includes(norm(p.format))) {
      add(WARN, 'rotation.formatUnknown',
        `"${p.format}" is not a documented format (${KNOWN_FORMATS.join(', ')}). New formats are welcome, add it to brand/format-rotation.md.`, id);
    }
  }

  /* -- Rule 1: a pillar may not repeat a format inside one batch ------ */
  const byPair = new Map();
  for (const p of posts) {
    if (!p.format || !p.pillar) continue;
    const k = pairKey(p);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(p.id || p.slug || '(unidentified)');
  }
  for (const [k, ids] of byPair) {
    if (ids.length > 1) {
      add(FAIL, 'rotation.pillarFormatRepeat',
        `"${k}" runs ${ids.length} times in this batch: ${ids.join(', ')}. A pillar gets one shot per format per batch. Re-cut one of them into a shape that pillar has not used.`);
    }
  }

  /* -- Rule 2: no format dominates the batch -------------------------- */
  const byFormat = new Map();
  for (const p of posts) {
    if (!p.format) continue;
    const f = norm(p.format);
    byFormat.set(f, (byFormat.get(f) || 0) + 1);
  }
  for (const [f, n] of byFormat) {
    if (n > MAX_PER_FORMAT) {
      add(FAIL, 'rotation.formatDominates',
        `${n} posts use "${f}", over the limit of ${MAX_PER_FORMAT}. The batch reads as one idea in one shape.`);
    }
  }

  /* -- History-dependent rules ---------------------------------------- */
  const priorBatches = priors.map(postsOf).filter((b) => b.length);
  const seenPairs = new Set();
  for (const b of priorBatches) for (const p of b) if (p.format && p.pillar) seenPairs.add(pairKey(p));

  if (!priorBatches.length) {
    add(INFO, 'rotation.noHistory',
      'No prior ledgers given, so the never-run-before and stuck-pillar rules were skipped. Pass prior batch ledgers as extra arguments to check them.');
  } else {
    /* -- Rule 3: at least one genuinely new pairing ------------------- */
    const fresh = [...byPair.keys()].filter((k) => !seenPairs.has(k));
    if (!fresh.length) {
      add(FAIL, 'rotation.noNewPairing',
        'Every pillar and format pairing in this batch has run before. At least one has to be new. When a pillar and a format have never met, that pairing is usually where the batch\'s best post is.');
    } else {
      add(INFO, 'rotation.newPairings', `New pairings this batch: ${fresh.join('; ')}`);
    }

    /* -- Rule 5: a pillar stuck on one format across batches ---------- */
    const timeline = [...priorBatches, posts];
    const pillars = new Set(timeline.flat().map((p) => norm(p.pillar)).filter(Boolean));
    for (const pillar of pillars) {
      let run = 0, runFormat = null;
      for (const batch of timeline) {
        const formats = new Set(batch.filter((p) => norm(p.pillar) === pillar && p.format).map((p) => norm(p.format)));
        if (formats.size === 1) {
          const only = [...formats][0];
          if (only === runFormat) { run += 1; } else { runFormat = only; run = 1; }
        } else { runFormat = null; run = 0; }
      }
      if (run >= STALE_AFTER) {
        add(WARN, 'rotation.pillarStuck',
          `"${pillar}" has run as "${runFormat}" and nothing else for ${run} consecutive batches. Break it.`);
      }
    }
  }

  /* -- Rule 4: back-to-back same format on a channel (warn) ----------- */
  const byChannel = new Map();
  for (const p of posts) {
    if (!p.channel || !p.dueAt) continue;
    if (!byChannel.has(p.channel)) byChannel.set(p.channel, []);
    byChannel.get(p.channel).push(p);
  }
  for (const [chan, list] of byChannel) {
    list.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].format && norm(list[i].format) === norm(list[i - 1].format)) {
        add(WARN, 'rotation.consecutiveFormat',
          `${chan}: "${list[i - 1].id}" and "${list[i].id}" run back to back, both "${list[i].format}".`);
      }
    }
  }

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    formats: Object.fromEntries(byFormat),
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

function report(result) {
  const lines = [];
  const mix = Object.entries(result.formats).map(([f, n]) => `${f} ${n}`).join(', ');
  lines.push(`rotation gate: ${result.checked} post(s) checked`);
  if (mix) lines.push(`  format mix: ${mix}`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass ? '  PASS: format rotation is healthy'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = { checkBatch, report, KNOWN_FORMATS, MAX_PER_FORMAT };

if (require.main === module) {
  const [current, ...priors] = process.argv.slice(2);
  if (!current) {
    console.error('usage: node rotation-gate.js <ledger.json> [<prior-ledger.json>...]');
    process.exit(2);
  }
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const result = checkBatch(read(current), priors.map(read));
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
