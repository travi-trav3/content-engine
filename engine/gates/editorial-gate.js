/**
 * editorial-gate.js
 *
 * Club Pilot editorial standard as code.
 * Enforces brand/editorial-standard.md and brand/humor-standard.md.
 *
 * Replaces humor-gate.js, which was too narrow a concern to own a file. The
 * rules here are about whether a post deserves to exist, which applies on
 * every pillar; humor is one section of that, not a separate axis.
 *
 * Zero dependencies. Pure functions. Runs in the same pre-schedule block as
 * capability-gate.js and rotation-gate.js, or standalone:
 *
 *   node editorial-gate.js content/batch-03/ledger.json
 *
 * Origin: two Humor posts published to the live Instagram account on Aug 15
 * and Aug 16 2026 and were deleted by the operator. Neither broke a rule.
 * Both passed every gate that existed. The second shipped after the first had
 * already been rejected, without a human reading the line.
 *
 * What this file cannot do: tell you a post is good. Every check below is
 * satisfiable by an author who is wrong. The Aug 16 post named a real humor
 * mechanism, honestly, and was not funny. Passing is the absence of known
 * defects, never a verdict on quality.
 */

'use strict';

const fs = require('fs');

/* ------------------------------------------------------------------ *
 * Lexicons
 * ------------------------------------------------------------------ */

// Blaming the member for not checking a channel argues the club's
// communication was fine and the member failed. That sells against a product
// whose whole position is that the information could not be reached.
const BLAMES_MEMBER = [
  'on the website the whole time', 'was on the website', 'it was on the website',
  'right there on the website', 'in the email', 'was in the email',
  'it was in the newsletter', 'in the newsletter', 'if they had checked',
  "if they'd checked", 'if they had read', "if they'd read", 'if they looked',
  'if they had looked', 'we already told them', 'we did tell them',
  'it is in the app', "it's in the app", 'we sent it twice', 'we posted it',
];

const MOCKS_MEMBER = [
  'idiot', 'moron', 'stupid', 'dumb', 'clueless', 'oblivious',
  'brain cell', 'bless their heart', 'read the room',
];

// Non-answers to "why could only we post this".
const EMPTY_JUSTIFICATIONS = [
  'on brand', 'on-brand', 'fits the pillar', 'fits our pillar', 'brand voice',
  'good content', 'engaging', 'relatable', 'it is funny', "it's funny",
  'members will like it', 'club audience', 'golf audience', 'n/a', 'none',
];

const KNOWN_MECHANISMS = [
  'observable contradiction', 'recognition', 'devotion', 'understatement',
  'scale', 'juxtaposition', 'deadpan', 'self-deprecation',
];

const FAIL = 'fail';
const WARN = 'warn';

const isHumor = (post) => String(post.pillar || '').trim().toLowerCase() === 'humor';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function readableText(post) {
  const out = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) out.push(v); };
  push(post.headline); push(post.subhead); push(post.caption);
  push(post.text); push(post.firstComment); push(post.altText); push(post.footer);
  if (Array.isArray(post.thread)) {
    post.thread.forEach((m) => push(typeof m === 'string' ? m : m && m.text));
  }
  // A carousel's slides are copy too: every one is checked.
  for (const sl of post.slides || []) {
    push(sl.headline); push(sl.subhead); push(sl.text);
    if (Array.isArray(sl.thread)) sl.thread.forEach((m) => push(typeof m === 'string' ? m : m && m.text));
  }
  if (Array.isArray(post.assets)) post.assets.forEach((a) => push(a && a.altText));
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hits(haystack, terms) {
  const found = new Set();
  for (const term of terms) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`, 'i');
    for (const s of haystack) { if (re.test(s)) { found.add(term); break; } }
  }
  return [...found];
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function checkPost(post) {
  const id = post.id || post.slug || post.name || '(unidentified post)';
  const findings = [];
  const add = (level, rule, detail) => findings.push({ id, level, rule, detail });
  const text = readableText(post);

  /* -- Rule 1: the post has to deserve to exist ---------------------- */
  const earns = post.earnsItsPlace;
  if (!earns || !String(earns).trim()) {
    add(FAIL, 'editorial.earnsItsPlace',
      'Name in one sentence what makes this a post only Club Pilot could publish. If a rival platform, a course, or a golf apparel brand could post it verbatim, it does not go out. An empty slot costs nothing; filler teaches the audience the feed is skippable.');
  } else {
    const e = norm(earns);
    if (e.length < 25) {
      add(FAIL, 'editorial.earnsItsPlace.tooThin',
        `earnsItsPlace is too short to be a reason: ${JSON.stringify(earns)}. Name the product truth, the operator problem, or the position it carries.`);
    } else if (EMPTY_JUSTIFICATIONS.some((k) => e.includes(k))) {
      add(FAIL, 'editorial.earnsItsPlace.notAReason',
        `earnsItsPlace restates that the post is on brand rather than saying what is ours about it: ${JSON.stringify(earns)}. "On brand" and "fits the pillar" are not answers.`);
    }
  }

  /* -- Rule 2: never blame or mock the member ------------------------ */
  const blame = hits(text, BLAMES_MEMBER);
  if (blame.length) {
    add(FAIL, 'editorial.blamesMember',
      `Blames the member for not checking a channel: ${blame.join(', ')}. Our position is that the information existed and could not be reached.`);
  }
  const mocks = hits(text, MOCKS_MEMBER);
  if (mocks.length) {
    add(FAIL, 'editorial.mocksMember',
      `Makes the member the butt: ${mocks.join(', ')}. The reader is an operator who likes their members.`);
  }

  if (!isHumor(post)) return findings;

  /* -- Rule 3: humor is review-first until it is calibrated ---------- */
  // Review-first holds either way: a person approved the line (approvedBy),
  // or the post goes to Buffer only as a draft that Byron reads and schedules
  // himself (review: "buffer-drafts", 2026-09-30). Humor is now a regular
  // part of the plan because it performs best; nothing publishes unread.
  const approved = post.approvedBy && String(post.approvedBy).trim();
  if (!approved && post.review !== 'buffer-drafts') {
    add(FAIL, 'editorial.humorNeedsApproval',
      'Humor is review-first. Two Humor posts published and were deleted on Aug 15 and Aug 16 2026, the second after the first had already been rejected. No Humor post publishes until a person has read the line and said yes: set approvedBy to their name, or send it to Buffer as a draft the operator reviews and schedules (review: "buffer-drafts").');
  }

  /* -- Rule 4: the joke needs a stated reason ------------------------ */
  const mech = post.humorMechanism;
  if (!mech || !String(mech).trim()) {
    add(FAIL, 'editorial.humorMechanism',
      'Say in one sentence why it is funny. Any mechanism and any format are allowed, but a joke whose reason cannot be stated has no joke in it.');
  } else {
    const m = norm(mech);
    const head = norm(post.headline);
    if (head && m && (m.includes(head) || head.includes(m)) && head.length > 12) {
      add(FAIL, 'editorial.humorMechanism.restatesJoke',
        'humorMechanism restates the joke instead of explaining why it lands.');
    } else if (!KNOWN_MECHANISMS.some((k) => m.includes(k))) {
      add(WARN, 'editorial.humorMechanism.unrecognized',
        `Mechanism is not one of the documented ones: ${JSON.stringify(mech)}. Allowed, but confirm it is a real reason.`);
    }
    if (m.includes('observable contradiction')) {
      const obs = post.observableAnswer;
      if (!obs || !String(obs).trim()) {
        add(FAIL, 'editorial.observableAnswer',
          'Observable contradiction requires naming the thing the asker can see that settles the question.');
      } else if (/^(asked|said|sent|texted|called|from the|at the|in the)\b/i.test(String(obs).trim())) {
        add(FAIL, 'editorial.observableAnswer.notEvidence',
          `observableAnswer is a location or an action, not evidence: ${JSON.stringify(obs)}.`);
      }
    }
  }

  /* -- Rule 5: no footnote carrying the joke ------------------------- */
  if (post.standsWithoutFooter !== true) {
    add(FAIL, 'editorial.standsWithoutFooter',
      'Cover any explanatory line and read the card again. If the joke stops working, the footer was carrying it.');
  }

  return findings;
}

/* ------------------------------------------------------------------ *
 * Batch entry point
 * ------------------------------------------------------------------ */

function checkBatch(ledger) {
  const posts = Array.isArray(ledger) ? ledger : ledger.posts || [];
  let findings = [];
  for (const post of posts) findings = findings.concat(checkPost(post));
  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    humorPosts: posts.filter(isHumor).length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

function report(result) {
  const lines = [];
  lines.push(`editorial gate: ${result.checked} post(s) checked, ${result.humorPosts} on the Humor pillar`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: nothing known-broken. This is not a verdict on quality.'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = { checkPost, checkBatch, report, isHumor, BLAMES_MEMBER, MOCKS_MEMBER, KNOWN_MECHANISMS };

if (require.main === module) {
  const ledgerPath = process.argv[2];
  if (!ledgerPath) { console.error('usage: node editorial-gate.js <ledger.json>'); process.exit(2); }
  const result = checkBatch(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')));
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
