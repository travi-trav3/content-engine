/**
 * stat-gate.js
 *
 * Club Pilot approved-stat allowlist as code.
 * Enforces brand/approved-stats.json against ledger copy.
 *
 * Zero dependencies. Runs in the same pre-schedule block as the other gates,
 * or standalone:
 *
 *   node stat-gate.js content/batch-04/ledger.json
 *
 * Origin: the Aug 19 LinkedIn post stated "Most clubs land north of four
 * hundred a week in season" as fact. The number exists in no source; it was
 * spelled out in words, so nothing digit-shaped could have caught it; and
 * Byron's Aug 21 feedback named the class: "Pulling generic stats and
 * applying them to clubs is not a good idea." Separately, the 90-seconds
 * versus 90-minutes contrast pair was retired as channel-versus-channel
 * framing, and Trinity's own "98% open rates in three minutes or less" is
 * the exact stat fusion the locked state bans.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FAIL = 'fail';
const WARN = 'warn';

const { workspace } = require('../lib/workspace');

const defaultStatsFile = () => path.join(workspace().brandDir, 'approved-stats.json');

const ESTIMATE_LABELS = /(roughly|about|around|approximately|estimated|typical(?:ly)?|close to|nearly|~)\s*$/i;

// Numbers a copy line may carry without an allowlist entry:
// clock times, years, ordinal dates, and small enumeration counts.
// "north of" is deliberately NOT an estimate label: "north of four hundred"
// presents an invented floor as fact, which is the Aug 19 defect.
const TIME_RE = /^(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm))$/i;
const YEAR_RE = /^(19|20)\d{2}$/;
const SMALL_COUNT_MAX = 20;

const WORD_VALUES = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1000000,
};

const idOf = (p) => p.id || p.slug || p.name || '(unidentified post)';

function postsOf(ledger) {
  return (Array.isArray(ledger) ? ledger : ledger.posts || []).filter(Boolean);
}

function copyFields(post) {
  const out = [];
  const push = (v) => { if (typeof v === 'string' && v.trim()) out.push(v); };
  push(post.headline); push(post.subhead); push(post.text);
  push(post.caption); push(post.firstComment);
  if (Array.isArray(post.thread)) {
    post.thread.forEach((m) => push(typeof m === 'string' ? m : m && m.text));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Numeral extraction, digits and words both. "Four hundred a week" is a
 * number even though nothing digit-shaped appears.
 * ------------------------------------------------------------------ */

function extractNumerals(text) {
  const found = [];

  // Digit forms, with a little left context for the estimate-label check.
  const digitRe = /\$?\d[\d,.:]*\s*(%|percent|am|pm)?/gi;
  let m;
  while ((m = digitRe.exec(text)) !== null) {
    found.push({ token: m[0].trim(), index: m.index });
  }

  // Word forms: maximal runs of number words ("four hundred", "ninety").
  const wordRe = /\b((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b[\s-]*)+)/gi;
  while ((m = wordRe.exec(text)) !== null) {
    const words = m[1].trim().toLowerCase().split(/[\s-]+/).filter(Boolean);
    let value = 0; let current = 0;
    for (const w of words) {
      const v = WORD_VALUES[w];
      if (v === undefined) continue;
      if (v === 100 || v === 1000 || v === 1000000) {
        current = (current || 1) * v;
      } else {
        current += v;
      }
    }
    value += current;
    found.push({ token: m[1].trim(), index: m.index, value });
  }
  return found;
}

function numeralValue(n) {
  if (n.value !== undefined) return n.value;
  const digits = n.token.replace(/[^0-9.]/g, '');
  return digits ? parseFloat(digits) : NaN;
}

function isExempt(n, text) {
  const tok = n.token.replace(/[.,:]+$/, '');
  if (TIME_RE.test(tok.replace(/\s+/g, ''))) return true;
  const before = text.slice(Math.max(0, n.index - 12), n.index);
  // "a hundred small moments" is an idiom, not a figure.
  if (/^hundred$/i.test(tok) && /\ba\s*$/i.test(before)) return true;
  // "members over 60" is an age qualifier (part of the 67% opt-in claim).
  if (/\bover\s*$/i.test(before) && numeralValue(n) <= 99 && !/[%$]/.test(tok)) return true;
  if (YEAR_RE.test(tok.replace(/[^0-9]/g, '')) && !/[%$]/.test(tok)) return true;
  // Ordinal dates and holes: "the 4th", "the 18th hole".
  const after = text.slice(n.index + tok.length, n.index + tok.length + 4);
  if (/^(st|nd|rd|th)\b/i.test(after)) return true;
  // Clock shorthand: "6am", "9:58pm" already caught by TIME_RE via token.
  const val = numeralValue(n);
  if (!/[%$]/.test(tok) && !Number.isNaN(val) && val <= SMALL_COUNT_MAX) return true;
  return false;
}

function hasEstimateLabel(n, text) {
  return ESTIMATE_LABELS.test(text.slice(Math.max(0, n.index - 20), n.index));
}

/* ------------------------------------------------------------------ *
 * Allowlist loading and validation
 * ------------------------------------------------------------------ */

function loadStats(file = defaultStatsFile()) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stats = (raw.stats || []).map((s) => ({ ...s, re: new RegExp(s.pattern, 'i') }));
  const invalid = stats.filter((s) => !s.source || !String(s.source).trim());
  return { stats, invalid };
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function checkPost(post, stats) {
  const id = idOf(post);
  const findings = [];
  const add = (level, rule, detail) => findings.push({ id, level, rule, detail });
  const fields = copyFields(post);
  const joined = fields.join('\n');

  /* -- Which approved stats does this post reference? ----------------- */
  const referenced = stats.filter((s) => s.re.test(joined));

  /* -- Rule 1: every numeral is approved or labeled an estimate -------- */
  for (const text of fields) {
    for (const n of extractNumerals(text)) {
      if (isExempt(n, text)) continue;
      const window = text.slice(Math.max(0, n.index - 30), n.index + n.token.length + 30);
      const matchesApproved = referenced.some((s) => s.re.test(window));
      if (matchesApproved) continue;
      if (hasEstimateLabel(n, text)) continue;
      add(FAIL, 'stat.unapprovedNumeral',
        `"${n.token}" (in: "${window.trim()}") matches no approved stat and carries no estimate label. A number presented as fact needs a source; if it is an estimate, say roughly, about, estimated, or typical. Invented specificity reads as data and costs credibility when a GM checks it.`);
    }
  }

  /* -- Rule 2: no two comparison-banned stats in one post -------------- */
  const nonComparable = referenced.filter((s) => s.comparisonAllowed === false);
  if (nonComparable.length >= 2) {
    add(FAIL, 'stat.bannedComparison',
      `Post carries ${nonComparable.map((s) => s.id).join(' + ')}. No two stats may share a post when either carries comparisonAllowed: false. This is the rule that retires the 90-seconds-versus-90-minutes contrast pair.`);
  }

  /* -- Rule 3: fuse-with-speed ------------------------------------------ */
  const sentences = joined.split(/[.!?\n]/);
  for (const s of sentences) {
    if (/98\s?(%|percent)?/.test(s) && /minutes?/i.test(s) && /open|read|deliver/i.test(s)) {
      add(FAIL, 'stat.fusedOpenRateSpeed',
        `Open-rate figure fused with a time window: "${s.trim()}". "98% opened within 3 minutes" exists in no source. The two stats stay separate, always.`);
    }
  }

  /* -- Rule 4: email-failure implication -------------------------------- */
  if (/email (is |are )?(dead|failing|fails|broken|useless|worthless)/i.test(joined)) {
    add(FAIL, 'stat.emailFailure',
      'Copy implies email fails. Club event emails open at 50 to 70%, and email is part of the platform.');
  }

  return findings;
}

function checkBatch(ledger, statsFile = defaultStatsFile()) {
  const { stats, invalid } = loadStats(statsFile);
  let findings = [];
  for (const s of invalid) {
    findings.push({
      id: '(allowlist)', level: FAIL, rule: 'stat.noSource',
      detail: `Approved stat "${s.id}" has no source. A stat with no source is not usable, even if it is true. Fix approved-stats.json.`,
    });
  }
  const posts = postsOf(ledger);
  for (const post of posts) findings = findings.concat(checkPost(post, stats));

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    statsLoaded: stats.length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

function report(result) {
  const lines = [];
  lines.push(`stat gate: ${result.checked} post(s) checked against ${result.statsLoaded} approved stat(s)`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: every number is approved, labeled an estimate, or exempt'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = { checkPost, checkBatch, report, extractNumerals, loadStats };

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const ledgerPath = process.argv[2];
  if (!ledgerPath) {
    console.error('usage: node stat-gate.js <ledger.json> [approved-stats.json]');
    process.exit(2);
  }
  const result = checkBatch(
    JSON.parse(fs.readFileSync(ledgerPath, 'utf8')),
    process.argv[3] || defaultStatsFile(),
  );
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
