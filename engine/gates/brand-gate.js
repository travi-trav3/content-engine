/**
 * brand-gate.js
 *
 * Club Pilot brand rules as code, checked against ledger text AND template
 * markup. Four brand-rule defects shipped in every batch since July because
 * the QA pass checked the generic list (dimensions, fonts, collisions) and
 * never the locked brand rules. This gate reads what the viewer actually
 * sees: the ledger copy and the rendered template's own markup.
 *
 * Zero dependencies. Runs in the same pre-schedule block as the other gates,
 * or standalone:
 *
 *   node brand-gate.js content/batch-04/ledger.json
 *
 * Origin, one incident per rule family: the thread sender shipped as
 * "Club Concierge" with a CP monogram four times (D1); pillar and series
 * labels rendered as public eyebrows in every batch (D2); a benchmark card
 * shipped tagged @clubpilot and another sourced to "Club Pilot member data"
 * (D3); first-person Byron posts ran on the company page while his channel
 * sat locked (D4); Instagram captions carried bare URLs (D5); banned filler
 * and pillar vocabulary reached captions (D12). Byron's Aug 21 review added
 * the channel-versus-channel ban (D18), the command-opener ban (D19), the
 * three-second copy caps (D20) and the second-person accusation ban (D21).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FAIL = 'fail';
const WARN = 'warn';

const { workspace } = require('../lib/workspace');

const PILLARS = [
  'The front desk leak',
  'Member experience, elevated',
  'Intelligent communication',
  'Proof and results',
  'Operator POV, day in the life',
  'Humor',
  'Industry pulse',
];

// Planning vocabulary that never renders on creative: pillar names, audience
// labels, series names, and territory names (the second axis).
const TERRITORY_LABELS = [
  "What we're seeing",
  'Things worth thinking about',
  "What we're learning",
  "What we're building",
  'Start a conversation',
  'Occasional promotion',
];

const INTERNAL_LABELS = [
  ...PILLARS,
  ...TERRITORY_LABELS,
  'For membership directors',
  'For general managers',
  'For comms managers',
  "A comms manager's Monday",
  'The math nobody runs',
  'The proof',
  'Meanwhile, at the front desk',
  'The ask',
];

// Retired positioning (BRAND.md, Retired lines, 2026-08-26).
const RETIRED_LINES = ['smartest front desk', 'never had to hire'];

// Known abstractions (D22), from BRAND.md. This list catches repeats of
// shipped offenders and nothing more: novel abstraction passes every string
// check ever written. The real defense is the plan's plain-language message
// field, reviewed by a person before generation. Partial by design and the
// report says so.
const ABSTRACTION_PHRASES = [
  'is not a bigger gesture',
  'is the whole job',
  'the surface area',
  'the room relaxed',
  'that routing',
];

// Second-person accusation patterns (D21). Tuned so batch 3's "a channel is
// not a system" post fails: the reader finishes it thinking they have no
// system, even though using every channel beats using none.
const ACCUSATION_PATTERNS = [
  /your (staff|team) (is|are) (losing|wasting|drowning)/i,
  /your club is (behind|failing|losing)/i,
  /you('re| are) (losing|wasting|failing)/i,
  /nobody at your/i,
  /most clubs fail/i,
  /if your club still/i,
  /with no system/i,
  /channels? (and|with) no system/i,
  /another place for (staff|a member|members) to (check|miss)/i,
  /(that|which) get[s]? ignored/i,
];

// Channel lexicon for the channel-versus-channel ban (D18).
const CHANNEL_WORDS = '(text(s|ing)?|sms|e-?mails?|apps?|push(?: notifications?)?|web ?chat|phone(?: calls?)?)';
const CHANNEL_COMPARATORS = new RegExp(
  `\\b${CHANNEL_WORDS}\\b[^.!?\\n]{0,60}\\b(vs\\.?|versus|instead of|beats?|faster than|slower than|better than|worse than)\\b[^.!?\\n]{0,60}\\b${CHANNEL_WORDS}\\b`, 'i');

// Command-form openers on organic (D19): a first word that is an imperative
// verb in caps commands the reader. Organic invites, it does not instruct.
const COMMAND_OPENER = /^\s*(WATCH|SEE|CLICK|GET|TRY|BOOK|DOWNLOAD|BUY|SIGN|JOIN)\b/;

// Copy caps against the props, not the render (D20, three-second rule).
const CAP_HEADLINE = 90;
const CAP_SUBHEAD = 140;
const CAP_CARD_TOTAL = 240;

const BANNED_WORDS = ['genuinely', 'actually'];
const PROPER_WORDS = new Set([
  'club', 'pilot', 'golf', 'digest', 'byron', 'white', 'aimi', 'pga', 'cmaa',
  'ngf', 'usga', 'linkedin', 'instagram', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday', 'march', 'august', 'i',
]);

const FOUNDER_CHANNEL = 'linkedin_byron';

const idOf = (p) => p.id || p.slug || p.name || '(unidentified post)';

function postsOf(ledger) {
  return (Array.isArray(ledger) ? ledger : ledger.posts || []).filter(Boolean);
}

function threadTexts(p) {
  if (!Array.isArray(p.thread)) return [];
  return p.thread.map((m) => (typeof m === 'string' ? m : (m && m.text) || '')).filter(Boolean);
}

function cardText(p) {
  // What renders on the image: headline, subhead, on-card text, thread bubbles.
  return [p.headline, p.subhead, p.text, ...threadTexts(p)].filter(Boolean);
}

function allText(p) {
  return [...cardText(p), p.caption, p.firstComment].filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Roster loading
 * ------------------------------------------------------------------ */

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function loadDemoClubs(brandDir) {
  const raw = loadJson(path.join(brandDir, 'demo-clubs.json'), null);
  if (!raw || !Array.isArray(raw.clubs)) return { clubs: [], missing: true };
  return { clubs: raw.clubs, missing: false };
}

/** No fictional club may resemble a real one: shared distinctive name token. */
function rosterResemblance(demoClubs, brandDir) {
  const approvedRaw = loadJson(path.join(brandDir, 'approved-clubs.json'), {});
  const approved = (approvedRaw.clubs || []).map((c) => String(c.name || c).toLowerCase());
  const generic = new Set(['country', 'club', 'golf', 'cc', 'the']);
  const clashes = [];
  for (const demo of demoClubs) {
    const demoTokens = String(demo.name || '').toLowerCase().split(/\s+/).filter((t) => !generic.has(t));
    for (const real of approved) {
      const realTokens = real.split(/\s+/).filter((t) => !generic.has(t));
      if (demoTokens.some((t) => realTokens.includes(t))) clashes.push(`${demo.name} vs ${real}`);
    }
  }
  return clashes;
}

/* ------------------------------------------------------------------ *
 * Template scanning
 * ------------------------------------------------------------------ */

function templateMarkup(templateName) {
  if (!templateName) return null;
  const dir = path.join(workspace().legacyTemplatesDir, templateName);
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.dc.html'));
  if (!file) return null;
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  // Visible text only: what a viewer reads, not comments or CSS.
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, ' ')
    .replace(/\s+/g, ' ');
  return { html, visible, file: path.join('legacy-templates', templateName, file) };
}

function looksLikeThreadTemplate(tpl) {
  return /align-self:\s*flex-(start|end)/i.test(tpl.html) && /border-radius:\s*24px/i.test(tpl.html);
}

const hasStatSignal = (s) => /\d+\s*%|\$\s?\d|\bbenchmark\b|\bNGF\b|\bopen rate\b|\b\d{2,}\b/i.test(s);

/* ------------------------------------------------------------------ *
 * Per-post rules
 * ------------------------------------------------------------------ */

function checkPost(post, ctx) {
  const id = idOf(post);
  const findings = [];
  const add = (level, rule, detail) => findings.push({ id, level, rule, detail });
  const card = cardText(post);
  const all = allText(post);
  const joinedAll = all.join('\n');

  /* -- D1: thread sender is a demo club, with the microline ---------- */
  const isThread = Array.isArray(post.thread) && post.thread.length > 0;
  if (isThread) {
    const sender = String(post.sender || '').trim();
    const demoNames = ctx.demoClubs.map((c) => [c.name, c.short]).flat().filter(Boolean);
    if (!sender) {
      add(FAIL, 'brand.threadSender.missing',
        'Thread post declares no sender. The sender is a rotating fictional demo club from brand/demo-clubs.json, never ClubPilot, never a character avatar. Members knowingly texting a software company is the experience the product exists to prevent.');
    } else if (/club concierge|clubpilot|club pilot|aimi/i.test(sender)) {
      add(FAIL, 'brand.threadSender.identity',
        `Thread sender is "${sender}". The sender is never the product or a character; it is a fictional demo club with a "powered by Club Pilot" microline.`);
    } else if (!demoNames.some((n) => n.toLowerCase() === sender.toLowerCase())) {
      add(FAIL, 'brand.threadSender.notInRoster',
        `Thread sender "${sender}" is not in brand/demo-clubs.json. Add it there (checked against the approved-clubs list) or use one from the roster.`);
    }
  }

  /* -- Template markup checks (D1, D2, D3) --------------------------- */
  const tpl = templateMarkup(post.template);
  if (post.template && !tpl) {
    add(WARN, 'brand.templateMissing',
      `Template "${post.template}" not found under legacy-templates/; markup checks skipped.`);
  }
  if (tpl) {
    if (/club concierge/i.test(tpl.visible)) {
      add(FAIL, 'brand.template.senderConcierge',
        `${tpl.file} renders "Club Concierge" as the thread sender.`);
    }
    if (/(^|[^a-z])aimi([^a-z]|$)/i.test(tpl.visible)) {
      add(FAIL, 'brand.template.senderAimi', `${tpl.file} renders "Aimi". Aimi is peripheral and never the sender.`);
    }
    if (/border-radius:999px[^>]*>\s*(CP|CLUBPILOT)\s*</i.test(tpl.html.replace(/\n/g, ' '))) {
      add(FAIL, 'brand.template.monogramAvatar',
        `${tpl.file} renders a product-monogram avatar on the thread. The avatar is the demo club's initials.`);
    }
    if (looksLikeThreadTemplate(tpl) && !/powered by club pilot/i.test(tpl.visible)) {
      add(FAIL, 'brand.template.microlineMissing',
        `${tpl.file} is a thread template with no "powered by Club Pilot" microline. The microline is where the brand lives on a thread.`);
    }
    for (const label of ctx.internalLabels) {
      const re = new RegExp(`(^|[^a-z])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      if (re.test(tpl.visible)) {
        add(FAIL, 'brand.template.internalLabel',
          `${tpl.file} renders "${label}" as visible text. Pillar, audience, series and territory names are planning vocabulary and never render on creative.`);
      }
    }
    if (/@clubpilot/i.test(tpl.visible)) {
      if (hasStatSignal(tpl.visible) || card.some(hasStatSignal)) {
        add(FAIL, 'brand.template.statTag',
          `${tpl.file} tags @clubpilot on a card carrying a stat. Never attach @clubpilot to a benchmark.`);
      } else {
        add(WARN, 'brand.template.handle', `${tpl.file} renders an @clubpilot handle; confirm the card carries no stat.`);
      }
    }
    if (/member data/i.test(tpl.visible)) {
      add(FAIL, 'brand.template.memberData',
        `${tpl.file} attributes a figure to "Club Pilot member data". Benchmarks are industry-attributed, never presented as our data.`);
    }
    // Capability lexicon over template sample copy, warn-level: the ledger
    // copy is where capability-gate hard-fails, but stale sample copy in a
    // template is how the Aug 6 overreach gets rendered by accident. Warn so
    // a session re-deriving copy from the sample sees the trap.
    try {
      const cap = require('./capability-gate');
      const capHits = cap.BLOCKED.filter((term) => {
        const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
        return re.test(tpl.visible);
      });
      if (capHits.length) {
        add(WARN, 'brand.template.capabilityLexicon',
          `${tpl.file} sample copy contains capability-blocked terms: ${capHits.join(', ')}. Template sample copy is a starting point, never ground truth; re-derive the thread from the plan before rendering.`);
      }
    } catch { /* capability-gate optional here */ }
  }

  /* -- D2: internal labels in ledger copy ---------------------------- */
  for (const field of ['eyebrow', 'subhead', 'tag', 'label']) {
    const v = String(post[field] || '').trim().toLowerCase();
    if (v && ctx.internalLabels.some((l) => l.toLowerCase() === v)) {
      add(FAIL, 'brand.internalLabel',
        `${field} is "${post[field]}", a planning label. Pillar, audience, series and territory names never render on creative.`);
    }
  }

  /* -- D3: stat attribution in ledger copy ---------------------------- */
  if (/member data/i.test(joinedAll)) {
    add(FAIL, 'brand.memberData', '"member data" attribution in copy. Benchmarks are industry-attributed.');
  }
  if (/@clubpilot/i.test(card.join('\n')) && card.some(hasStatSignal)) {
    add(FAIL, 'brand.statTag', '@clubpilot on a card carrying a stat. Never attach the handle to a benchmark.');
  }

  /* -- D4: founder voice runs on the founder's channel ---------------- */
  const signedAsByron = /cheers,?\s+byron\s+white/i.test(joinedAll);
  if (signedAsByron && post.channel !== FOUNDER_CHANNEL) {
    add(FAIL, 'brand.founderChannel',
      `First-person Byron copy on channel "${post.channel}". Founder voice runs on the founder's channel (${FOUNDER_CHANNEL}). If that channel is locked, the post waits; it does not move to the company page.`);
  }

  /* -- D7: founder anecdotes carry their source ------------------------ */
  if (signedAsByron || post.founderVoice === true) {
    if (!(post.sourceNote && String(post.sourceNote).trim())) {
      add(FAIL, 'brand.founderSourceNote',
        'Founder post carries no sourceNote naming the call transcript, voice file, or Byron quote the anecdote comes from. A founder post never invents Byron\'s internal experience; it restates something he said, with the source recorded. Byron confirmed this in writing on Aug 21: the invented Aug 24 post read "just plain confusing like me being an operator, inventor, sitting in a room."');
    }
  }

  /* -- D5: Instagram captions do not carry links ----------------------- */
  if (String(post.channel || '').toLowerCase() === 'instagram') {
    const cap = String(post.caption || '');
    if (/https?:\/\/|(^|[\s(])[a-z0-9-]+\.(com|io|co|app|org|net)(\/|\b)/i.test(cap)) {
      add(FAIL, 'brand.igCaptionUrl',
        'Instagram caption contains a URL. Instagram captions do not hyperlink; the link lives in bio or firstComment.');
    }
  }

  /* -- D12: banned words, em dashes, Title Case, pillar vocabulary ----- */
  for (const w of ctx.bannedWords) {
    const re = new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i');
    if (re.test(joinedAll)) {
      add(FAIL, 'brand.bannedWord', `Banned filler "${w}" in copy.`);
    }
  }
  if (/—/.test(joinedAll)) {
    add(FAIL, 'brand.emDash', 'Em dash in copy. Use periods, commas, or short sentences.');
  }
  const head = String(post.headline || '').trim();
  if (head) {
    const words = head.replace(/["“”.,:;!?]/g, '').split(/\s+/).filter((w) => w.length > 2);
    const capitalized = words.slice(1).filter((w) => /^[A-Z]/.test(w) && !PROPER_WORDS.has(w.toLowerCase()));
    if (words.length >= 4 && capitalized.length / Math.max(1, words.length - 1) > 0.6) {
      add(FAIL, 'brand.titleCase', `Headline reads as Title Case: ${JSON.stringify(head)}. Sentence case, always.`);
    }
  }
  const caption = String(post.caption || '');
  if (/(^|[^a-z])elevated?([^a-z]|$)/i.test(caption)) {
    add(FAIL, 'brand.pillarVocab', '"Elevated" in caption copy. Pillar vocabulary is planning language, not copy.');
  }
  if (/intelligent communication/i.test(caption)) {
    add(FAIL, 'brand.pillarVocab', '"Intelligent communication" in caption copy. Pillar vocabulary is planning language, not copy.');
  }

  /* -- Retired positioning lines (4.1) --------------------------------- */
  for (const line of RETIRED_LINES) {
    if (joinedAll.toLowerCase().includes(line)) {
      add(FAIL, 'brand.retiredLine',
        `Retired positioning ("${line}") in copy. It implies staff replacement and criticizes the club's current front desk. See BRAND.md, Retired lines.`);
    }
  }

  /* -- D22: known abstractions (partial defense, see the list) ---------- */
  for (const phrase of ABSTRACTION_PHRASES) {
    if (joinedAll.toLowerCase().includes(phrase)) {
      add(FAIL, 'brand.knownAbstraction',
        `Known abstraction in copy: "${phrase}". It sounds composed and communicates nothing (BRAND.md, known abstractions). This list only catches repeat offenders; novel abstraction is caught at plan time by the plain-language message rule, or by nobody.`);
    }
  }

  /* -- D21: second-person accusations ---------------------------------- */
  for (const re of ACCUSATION_PATTERNS) {
    const m = joinedAll.match(re);
    if (m) {
      add(FAIL, 'brand.accusation',
        `Copy assigns the problem to the reader: "${m[0]}". The subject is a solvable industry pattern, never this reader's failure. A GM using every channel is doing better than one using none.`);
    }
  }

  /* -- D18: channel versus channel -------------------------------------- */
  const compMatch = joinedAll.match(CHANNEL_COMPARATORS);
  if (compMatch) {
    add(FAIL, 'brand.channelVersus',
      `Channel-versus-channel framing: "${compMatch[0]}". The platform carries text, email, app and AI Assist together; no channel wins and no channel fails.`);
  }
  // Numeric comparison across two channels: each channel word near a figure.
  const channelNearNumber = (text) => {
    const re = new RegExp(`(\\d[\\d,.]*|ninety|sixty|thirty)[^.!?\\n]{0,40}\\b${CHANNEL_WORDS}\\b|\\b${CHANNEL_WORDS}\\b[^.!?\\n]{0,40}(\\d[\\d,.]*|ninety|sixty|thirty)`, 'gi');
    const hits = new Set();
    let m;
    while ((m = re.exec(text)) !== null) {
      const chan = (m[0].match(new RegExp(CHANNEL_WORDS, 'i')) || [''])[0].toLowerCase();
      hits.add(chan.startsWith('text') || chan.startsWith('sms') ? 'text' : chan.replace(/s$/, ''));
    }
    return hits;
  };
  const numericChans = channelNearNumber(joinedAll);
  if (numericChans.size >= 2) {
    add(FAIL, 'brand.channelVersus.numeric',
      `Numeric comparison across channels (${[...numericChans].join(' vs ')}). Retired treatment: never set one product channel against another with figures.`);
  }

  /* -- D19: command-form openers on image copy --------------------------- */
  for (const field of ['headline', 'subhead', 'text']) {
    const v = String(post[field] || '');
    if (COMMAND_OPENER.test(v)) {
      add(FAIL, 'brand.commandOpener',
        `${field} opens with a command: ${JSON.stringify(v.slice(0, 40))}. Organic invites, it does not instruct.`);
    }
  }

  /* -- D20: copy caps against the props ----------------------------------- */
  if (head.length > CAP_HEADLINE) {
    add(FAIL, 'brand.copyCap.headline', `Headline is ${head.length} characters (cap ${CAP_HEADLINE}).`);
  }
  const sub = String(post.subhead || '');
  if (sub.length > CAP_SUBHEAD) {
    add(FAIL, 'brand.copyCap.subhead', `Subhead is ${sub.length} characters (cap ${CAP_SUBHEAD}).`);
  }
  const cardTotal = card.join(' ').length;
  if (cardTotal > CAP_CARD_TOTAL) {
    add(FAIL, 'brand.copyCap.card',
      `Rendered card copy totals ${cardTotal} characters (cap ${CAP_CARD_TOTAL}). One thought in three seconds; the argument belongs in the caption, the insight in the first comment.`);
  }

  /* -- Pillar tag allowlist ------------------------------------------------ */
  if (post.pillar !== undefined && post.pillar !== null && !PILLARS.includes(post.pillar)) {
    add(FAIL, 'brand.pillarTag',
      `Pillar tag "${post.pillar}" is not one of the seven. Invented tags are violations; an ask is a ctaType, not a pillar.`);
  }

  return findings;
}

/* ------------------------------------------------------------------ *
 * Batch entry point
 * ------------------------------------------------------------------ */

function checkBatch(ledger, brandDir = workspace().brandDir) {
  const { clubs: demoClubs, missing } = loadDemoClubs(brandDir);
  const ctx = {
    demoClubs,
    internalLabels: INTERNAL_LABELS,
    bannedWords: BANNED_WORDS,
  };
  let findings = [];

  if (missing) {
    findings.push({
      id: '(batch)', level: WARN, rule: 'brand.noDemoClubs',
      detail: 'demo-clubs.json not found; every thread sender will fail until it exists.',
    });
  }
  const clashes = rosterResemblance(demoClubs, brandDir);
  for (const clash of clashes) {
    findings.push({
      id: '(batch)', level: FAIL, rule: 'brand.demoResemblesReal',
      detail: `Fictional demo club resembles a real club: ${clash}. Rename the fictional one.`,
    });
  }

  const posts = postsOf(ledger);
  for (const post of posts) findings = findings.concat(checkPost(post, ctx));

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
  lines.push(`brand gate: ${result.checked} post(s) checked`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: no brand-rule violations found'
    : `  FAIL: ${result.failures.length} violation(s). Batch does not ship.`);
  return lines.join('\n');
}

module.exports = {
  checkPost, checkBatch, report,
  PILLARS, INTERNAL_LABELS, ACCUSATION_PATTERNS, RETIRED_LINES,
  CAP_HEADLINE, CAP_SUBHEAD, CAP_CARD_TOTAL,
};

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const ledgerPath = process.argv[2];
  const brandDir = process.argv[3] || workspace().brandDir;
  if (!ledgerPath) {
    console.error('usage: node brand-gate.js <ledger.json> [brandDir]');
    process.exit(2);
  }
  const result = checkBatch(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')), brandDir);
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
