/**
 * diversity-gate.js
 *
 * Club Pilot message dedupe as code.
 * Enforces the near-duplicate-messages rule that existed only as prose in the
 * social-content-pipeline skill until 2026-08-26 and was never compiled.
 *
 * Zero dependencies. Pure functions. Runs in the same pre-schedule block as
 * capability-gate.js, editorial-gate.js and rotation-gate.js, or standalone:
 *
 *   node diversity-gate.js content/batch-04/ledger.json \
 *                          content/batch-01/ledger.json content/batch-02/ledger.json ...
 *
 * The first file is the batch being checked (a ledger or a plan). Every file
 * after it is history; prior posts within HISTORY_DAYS of the batch count.
 *
 * Origin: batch 3 carried one idea ("the answer was already written down")
 * across seven of eleven posts, and its Aug 30 ask repeated the Aug 18 ask
 * nearly verbatim, subhead included. The rotation gate passed the batch as
 * "healthy" because posts had been relabeled and re-templated to satisfy it,
 * message unchanged. This gate reads the words a viewer sees, so relabeling
 * the pillar or swapping the template does not clear it.
 */

'use strict';

const fs = require('fs');

const FAIL = 'fail';
const WARN = 'warn';

const JACCARD_THRESHOLD = 0.5; // near-duplicate message/headline
const PHRASE_WORDS = 5;        // shared verbatim run this long fails
const HISTORY_DAYS = 30;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'to', 'of', 'in', 'on', 'at',
  'for', 'from', 'by', 'with', 'without', 'about', 'as', 'into', 'over',
  'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'not', 'no', 'nor', 'that', 'this', 'these', 'those',
  'there', 'here', 'then', 'than', 'when', 'what', 'which', 'who', 'whom',
  'how', 'why', 'where', 'your', 'you', 'yours', 'their', 'they', 'them',
  'his', 'her', 'she', 'he', 'we', 'our', 'ours', 'us', 'i', 'my', 'me',
  'one', 'ones', 'get', 'gets', 'got', 'has', 'have', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'just', 'also', 'too', 'very',
  'if', 'up', 'out', 'all', 'any', 'each', 'every', 'more', 'most', 'some',
]);

// Required treatments repeat by design and are exempt from the shared-phrase
// check. Only mandated boilerplate belongs here, never a headline idea.
const BOILERPLATE = [
  'cheers byron white founder club pilot', // the sign-off batches 1 to 3 carried; posts carry none since 2026-10-08
  'powered by club pilot',                 // required thread microline
];

// One idea per batch, hard-capped. Seeded with the batch-3 monoculture; add a
// theme here when a new one starts repeating, with the cap it should carry.
const THEMES = [
  {
    id: 'documents-already-written',
    cap: 1,
    pattern: /already (written|wrote|posted|published|answered|sent)|written down|answer (is|was|s) written|written (weeks|months|long) before|answered? from (club )?documents|answers? (already|out of) exist/i,
    note: 'The "answer was already written down" idea. The mechanism belongs in the source and not the output; batch 3 put it in the output seven times.',
  },
];

/* ------------------------------------------------------------------ *
 * Text utilities (shared with plan-gate.js)
 * ------------------------------------------------------------------ */

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentWords(s) {
  return new Set(normalize(s).split(' ').filter((w) => w && !STOPWORDS.has(w)));
}

function jaccard(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const w of aSet) if (bSet.has(w)) inter += 1;
  return inter / (aSet.size + bSet.size - inter);
}

/** Verbatim word runs of PHRASE_WORDS+ appearing in both texts, keeping only
 *  runs that carry at least two content words so "and it is on the" cannot trip it. */
function sharedPhrases(aText, bText) {
  const aWords = normalize(aText).split(' ').filter(Boolean);
  const bJoined = ' ' + normalize(bText) + ' ';
  const found = [];
  for (let i = 0; i + PHRASE_WORDS <= aWords.length; i += 1) {
    // Longest match starting at i, so sub-runs of one long repeat report once.
    let len = 0;
    while (i + PHRASE_WORDS + len <= aWords.length
      && bJoined.includes(' ' + aWords.slice(i, i + PHRASE_WORDS + len).join(' ') + ' ')) {
      len += 1;
    }
    if (len > 0) {
      const phrase = aWords.slice(i, i + PHRASE_WORDS + len - 1).join(' ');
      const isBoilerplate = BOILERPLATE.some((b) => b.includes(phrase) || phrase.includes(b));
      if (!isBoilerplate
        && phrase.split(' ').filter((w) => !STOPWORDS.has(w)).length >= 2) {
        found.push(phrase);
        i += PHRASE_WORDS + len - 2; // skip past this run
      }
    }
  }
  return [...new Set(found)];
}

/* ------------------------------------------------------------------ *
 * Post accessors — plans carry `message` + `date`, ledgers carry
 * `headline` + `dueAt`. Both are supported.
 * ------------------------------------------------------------------ */

const idOf = (p) => p.id || p.slug || p.name || '(unidentified post)';
const dateOf = (p) => String(p.dueAt || p.date || (p.slot && p.slot.date) || '');

/** The one thing the post says: plan message, plus headline and subhead. */
function messageText(p) {
  return [p.message, p.headline, p.subhead].filter(Boolean).join(' ');
}

/** Everything a reader sees, for the shared-phrase check. */
function fullText(p) {
  const parts = [p.message, p.headline, p.subhead, p.text, p.caption];
  if (Array.isArray(p.thread)) {
    p.thread.forEach((m) => parts.push(typeof m === 'string' ? m : m && m.text));
  }
  return parts.filter(Boolean).join(' ');
}

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

  /* -- Which prior posts are in the 30-day window ------------------- */
  const batchDates = posts.map(dateOf).filter(Boolean).sort();
  const earliest = batchDates[0] ? new Date(batchDates[0]) : null;
  const cutoff = earliest ? new Date(earliest.getTime() - HISTORY_DAYS * 24 * 3600 * 1000) : null;
  const history = [];
  for (const prior of priors) {
    for (const p of postsOf(prior)) {
      const d = dateOf(p);
      if (!cutoff || !d || new Date(d) >= cutoff) history.push(p);
    }
  }
  if (!priors.length) {
    add(WARN, 'dedupe.noHistory',
      `No prior ledgers given, so the last-${HISTORY_DAYS}-days repeat check was skipped. Pass prior batch ledgers as extra arguments.`);
  }

  /* -- Rule 1: near-duplicate message/headline (Jaccard) ------------- */
  const pairsSeen = new Set();
  const compareMessages = (a, b, where) => {
    const key = [idOf(a), idOf(b)].sort().join('|');
    if (pairsSeen.has(key)) return;
    const sim = jaccard(contentWords(messageText(a)), contentWords(messageText(b)));
    if (sim >= JACCARD_THRESHOLD) {
      pairsSeen.add(key);
      add(FAIL, 'dedupe.nearDuplicateMessage',
        `"${idOf(a)}" and "${idOf(b)}" (${where}) say the same thing (token overlap ${sim.toFixed(2)}, threshold ${JACCARD_THRESHOLD}). One message is one post. Relabeling the pillar or swapping the template does not clear this.`,
        idOf(a));
    }
  };

  /* -- Rule 2: shared verbatim phrasing ------------------------------ */
  const comparePhrasing = (a, b, where) => {
    const phrases = sharedPhrases(fullText(a), fullText(b));
    if (phrases.length) {
      add(FAIL, 'dedupe.sharedPhrasing',
        `"${idOf(a)}" and "${idOf(b)}" (${where}) share verbatim copy: ${phrases.map((p) => `"${p}"`).join('; ')}. A repeated run of ${PHRASE_WORDS}+ words is a reworded repeat, not a new post.`,
        idOf(a));
    }
  };

  for (let i = 0; i < posts.length; i += 1) {
    for (let j = i + 1; j < posts.length; j += 1) {
      compareMessages(posts[i], posts[j], 'same batch');
      comparePhrasing(posts[i], posts[j], 'same batch');
    }
    for (const h of history) {
      compareMessages(posts[i], h, `vs ${idOf(h)} in the last ${HISTORY_DAYS} days`);
      comparePhrasing(posts[i], h, `vs ${idOf(h)} in the last ${HISTORY_DAYS} days`);
    }
  }

  /* -- Rule 3: one idea per batch, per theme ------------------------- */
  for (const theme of THEMES) {
    const hits = posts.filter((p) => theme.pattern.test(fullText(p))).map(idOf);
    if (hits.length > theme.cap) {
      add(FAIL, 'dedupe.themeRepeat',
        `${hits.length} posts carry the "${theme.id}" idea (cap ${theme.cap}): ${hits.join(', ')}. ${theme.note}`);
    }
  }

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    historyChecked: history.length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

function report(result) {
  const lines = [];
  lines.push(`diversity gate: ${result.checked} post(s) checked against ${result.historyChecked} prior post(s)`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: no repeated messages or phrasing found'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = {
  checkBatch, report, normalize, contentWords, jaccard, sharedPhrases,
  messageText, fullText, JACCARD_THRESHOLD, HISTORY_DAYS, THEMES, STOPWORDS,
};

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const [current, ...priors] = process.argv.slice(2);
  if (!current) {
    console.error('usage: node diversity-gate.js <ledger-or-plan.json> [<prior-ledger.json>...]');
    process.exit(2);
  }
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const result = checkBatch(read(current), priors.map(read));
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
