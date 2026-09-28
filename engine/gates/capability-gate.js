/**
 * capability-gate.js
 *
 * Club Pilot capability + asset provenance rules as code.
 * Enforces brands/club-pilot/capability-boundary.md against the batch ledger.
 *
 * Zero dependencies. Pure functions. Import from diversity-gate.js and run
 * alongside the existing structural checks, or run standalone:
 *
 *   node capability-gate.js content/batch-03/ledger.json
 *
 * Origin: three posts flagged by Byron on Aug 6 2026 depicted the assistant
 * booking a court, locating a guest, and rendering unapproved club logos.
 * None of those were copy failures. They were unenforced rules.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');

/* ------------------------------------------------------------------ *
 * Lexicons
 * ------------------------------------------------------------------ */

// Hard fail anywhere in the post. These describe an action or a live-state
// lookup the product cannot perform.
const BLOCKED = [
  'book', 'booked', 'booking', 'books',
  'reserve', 'reserved', 'reserves', 'reservation',
  'tee time', 'tee times', 'tee sheet', 'court time', 'table for',
  'pay', 'paid', 'payment', 'charge to', 'bill to', 'order',
  'has arrived', 'have they arrived', 'arrived yet', 'arrive yet',
  'did my guest', 'is my guest', 'on the tee', 'where is my', 'where is the',
  'how many slots', 'slots are available', 'free right now',
  'still available', 'any openings', 'is there space',
];

// Hard fail whenever the assistant is depicted. These attribute an action or
// a completed outcome to the assistant.
const BLOCKED_WHEN_ASSISTANT = [
  'tell the', 'let them know', 'leave a note', 'hold my',
  "i'll take care of", 'i will take care of', 'done for you',
  'all set', "you're booked", 'you are booked',
  'handled', 'taken care of', 'on your behalf',
];

// Permitted only inside interactionType === 'escalation'. Their presence is
// what makes a blocked term survivable, with a named human clearing it.
const ESCALATION_PHRASES = [
  'send your question to a staff member',
  'sending your question',
  'send it to the team',
  'someone will get back to you',
  "i don't have that",
  'i do not have that',
  "i don't have the exact",
  'escalate to a human',
  'the team will follow up',
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const FAIL = 'fail';
const WARN = 'warn';

/** Every string on a post that a reader could see. */
function readableText(post) {
  const out = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) out.push(v); };

  push(post.headline);
  push(post.subhead);
  push(post.caption);
  push(post.text);
  push(post.firstComment);
  push(post.altText);

  // Rendered message-thread copy is the highest-risk surface. It is where all
  // three Aug 6 defects lived.
  if (Array.isArray(post.thread)) {
    post.thread.forEach((m) => push(typeof m === 'string' ? m : m && m.text));
  }
  if (Array.isArray(post.assets)) {
    post.assets.forEach((a) => {
      push(a && a.altText);
      push(a && a.image && a.image.altText);
    });
  }
  return out;
}

function hits(haystack, terms) {
  const found = new Set();
  for (const term of terms) {
    // Word-boundary match so "facebook" does not trip "book".
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`, 'i');
    for (const s of haystack) {
      if (re.test(s)) { found.add(term); break; }
    }
  }
  return [...found];
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assetPaths(post) {
  if (!Array.isArray(post.assets)) return [];
  return post.assets
    .map((a) => (a && (a.source || a.path || a.file)) || '')
    .filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function checkPost(post, approved) {
  const id = post.id || post.slug || post.name || '(unidentified post)';
  const findings = [];
  const add = (level, rule, detail) => findings.push({ id, level, rule, detail });

  const text = readableText(post);
  const depicts = post.depictsAssistant;
  const type = post.interactionType;

  /* -- Rule 1: attestation must exist ------------------------------- */
  if (typeof depicts !== 'boolean') {
    add(FAIL, 'attestation.depictsAssistant',
      'depictsAssistant is missing. Every post must declare whether it renders an assistant message or product UI.');
  }

  /* -- Rule 2: assistant posts must declare an interaction type ------ */
  if (depicts === true && !['answer', 'escalation'].includes(type)) {
    add(FAIL, 'attestation.interactionType',
      `interactionType must be "answer" or "escalation" when depictsAssistant is true. Got: ${JSON.stringify(type)}`);
  }

  /* -- Rule 3: answers must name a source document ------------------- */
  if (depicts === true && type === 'answer') {
    if (!post.sourceDocument || !String(post.sourceDocument).trim()) {
      add(FAIL, 'capability.sourceDocument',
        'An answer must name the club document class it comes from. If you cannot name one, the concept fails and no rewrite fixes it.');
    }
  }

  /* -- Rule 4: escalations must stop at the handoff ------------------ */
  if (depicts === true && type === 'escalation') {
    if (post.endsAtHandoff !== true) {
      add(FAIL, 'capability.endsAtHandoff',
        'An escalation must end at "someone will get back to you shortly". No outcome, no confirmation, no completed task.');
    }
    const escalationSignal = hits(text, ESCALATION_PHRASES);
    if (escalationSignal.length === 0) {
      add(WARN, 'capability.escalationLanguage',
        'Declared as an escalation but no escalation language found. Confirm the thread actually shows the handoff rather than implying it.');
    }
  }

  /* -- Rule 5: blocked lexicon --------------------------------------- */
  const blocked = hits(text, BLOCKED);
  if (blocked.length) {
    const inEscalation = depicts === true && type === 'escalation';
    if (inEscalation && hits(text, ESCALATION_PHRASES).length > 0) {
      // The product itself says "I don't have the exact number of available
      // tee time slots right now." Blocked terms can legitimately appear in
      // the member's question or the assistant's refusal. A named human
      // clears it; the gate does not clear it silently.
      if (!post.capabilityClearedBy) {
        add(FAIL, 'capability.lexicon.needsClearance',
          `Blocked terms inside an escalation post: ${blocked.join(', ')}. Permitted only when the term sits in the question or the refusal, never in an outcome. Set capabilityClearedBy to the reviewer's name to clear.`);
      } else {
        add(WARN, 'capability.lexicon.cleared',
          `Blocked terms present but cleared by ${post.capabilityClearedBy}: ${blocked.join(', ')}`);
      }
    } else {
      add(FAIL, 'capability.lexicon.blocked',
        `Out-of-scope language: ${blocked.join(', ')}. The product answers from uploaded documents and hands off what it cannot answer. It does not act.`);
    }
  }

  /* -- Rule 6: actions attributed to the assistant -------------------- */
  if (depicts === true) {
    const attributed = hits(text, BLOCKED_WHEN_ASSISTANT);
    if (attributed.length) {
      add(FAIL, 'capability.lexicon.attributedAction',
        `Assistant depicted performing or completing an action: ${attributed.join(', ')}. It forwards a question and flags a thread. It does not dispatch, assign, task, or resolve.`);
    }
  }

  /* -- Rule 7: club mark provenance ----------------------------------- */
  const hasAssets = Array.isArray(post.assets) && post.assets.length > 0;
  if (hasAssets && !Array.isArray(post.clubMarks)) {
    add(FAIL, 'provenance.unattested',
      'clubMarks is missing. Declare every real club name, logo, monogram, crest, or wordmark rendered, or an empty array if none.');
  }
  if (Array.isArray(post.clubMarks)) {
    for (const mark of post.clubMarks) {
      if (!approved.has(String(mark).toLowerCase())) {
        add(FAIL, 'provenance.unapprovedMark',
          `"${mark}" is not on the written approved list. Verbal approval and prior appearance in a document do not count and do not carry over.`);
      }
    }
    if (post.clubMarks.length > 0 && post.boosted === true) {
      add(FAIL, 'provenance.paidPlacement',
        'Approved club marks are organic placements only. Never paid or boosted.');
    }
  }

  /* -- Rule 8: crossed asset rosters ----------------------------------- */
  for (const p of assetPaths(post)) {
    if (/golf[-_ ]?pilot/i.test(p)) {
      add(FAIL, 'provenance.crossedRoster',
        `Asset path references Golf Pilot in a Club Pilot batch: ${p}. Club Pilot and Golf Pilot logo files are separate rosters. Halt rather than guess.`);
    }
  }

  return findings;
}

/* ------------------------------------------------------------------ *
 * Batch entry point
 * ------------------------------------------------------------------ */

function loadApprovedClubs(brandDir) {
  const file = path.join(brandDir, 'approved-clubs.json');
  if (!fs.existsSync(file)) {
    // No list means no mark is approved. Fail closed, not open.
    return { set: new Set(), missing: true };
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.clubs || [];
  return {
    set: new Set(list.map((c) => String(c.name || c).toLowerCase())),
    missing: false,
  };
}

function checkBatch(ledger, brandDir = workspace().brandDir) {
  const { set: approved, missing } = loadApprovedClubs(brandDir);
  const posts = Array.isArray(ledger) ? ledger : ledger.posts || [];
  let findings = [];

  if (missing) {
    findings.push({
      id: '(batch)', level: WARN, rule: 'provenance.noApprovedList',
      detail: 'approved-clubs.json not found. Every real club mark will hard-fail until it exists.',
    });
  }

  for (const post of posts) findings = findings.concat(checkPost(post, approved));

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

function report(result) {
  const lines = [];
  lines.push(`capability gate: ${result.checked} post(s) checked`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: no capability or provenance violations'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = {
  checkPost, checkBatch, report, loadApprovedClubs,
  BLOCKED, BLOCKED_WHEN_ASSISTANT, ESCALATION_PHRASES,
};

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const ledgerPath = process.argv[2];
  const brandDir = process.argv[3] || workspace().brandDir;
  if (!ledgerPath) {
    console.error('usage: node capability-gate.js <ledger.json> [brandDir]');
    process.exit(2);
  }
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const result = checkBatch(ledger, brandDir);
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
