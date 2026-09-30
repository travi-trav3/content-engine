/**
 * plan-gate.js
 *
 * Club Pilot batch plan validation as code.
 * Enforces content/PLAN-TEMPLATE.md against content/batch-NN/plan.json.
 *
 * Zero dependencies beyond diversity-gate.js. Pure functions. Runs BEFORE
 * generation, unlike every other gate, which runs before scheduling:
 *
 *   node plan-gate.js content/batch-04/plan.json \
 *                     content/batch-01/ledger.json content/batch-02/ledger.json ...
 *
 *   node plan-gate.js --match content/batch-04/plan.json content/batch-04/ledger.json
 *
 * The first form validates a plan against these rules and the prior ledgers
 * (for the 30-day message dedupe). The second form checks a finished ledger
 * against its plan: a ledger entry whose fields do not match its plan entry
 * fails.
 *
 * Origin: the engine had a fence (the capability boundary) and rotation rules,
 * and no positive brief. Asked to fill a batch, it generated the safest thing
 * that passed both, fifteen times. On Aug 6 2026 that was the vivid
 * transaction; in batch 3 it was the newest constraint restated seven times.
 * The plan is where a person approves what each post will say, once per batch,
 * before anything is written. No plan, no batch.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const diversity = require('./diversity-gate');
const { workspace } = require('../lib/workspace');

const FAIL = 'fail';
const WARN = 'warn';
const INFO = 'info';

const PILLARS = [
  'The front desk leak',
  'Member experience, elevated',
  'Intelligent communication',
  'Proof and results',
  'Operator POV, day in the life',
  'Humor',
  'Industry pulse',
];

// The second axis (Byron's editorial territories, adopted 2026-08-26).
// A pillar answers what the post is about; a territory answers what posture
// it takes. A post is one pillar and one territory.
const TERRITORIES = ['seeing', 'thinking', 'learning', 'building', 'promote'];

const AUDIENCES = ['champion', 'buyer'];
const FEELINGS = ['seen', 'safe', 'relieved', 'capable', 'hopeful'];
const AVERSIONS = ['more systems', 'more work', 'more risk'];
const SURFACES = ['dark-type', 'photo-full-bleed', 'thread'];
const CTA_TYPES = ['none', 'demo', 'app', 'follow', 'website'];

const FOUNDER_CHANNEL = 'linkedin_byron';
const REVIEW_IN_BUFFER = 'buffer-drafts';

/** One CTA per this many posts, from the brand's config.json (cta.every), or null. */
function ctaEvery() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(workspace().dir, 'config.json'), 'utf8'));
    const n = cfg.cta && Number(cfg.cta.every);
    return n > 0 ? n : null;
  } catch { return null; }
}

// Operational fact ids from brand/club-operations-facts.md ("### <id>" headers).
function loadFactIds() {
  try {
    const md = fs.readFileSync(path.join(workspace().brandDir, 'club-operations-facts.md'), 'utf8');
    return [...md.matchAll(/^### +([a-z0-9-]+)/gm)].map((m) => m[1]);
  } catch { return []; }
}

// Retired 2026-08-26: the structure is the reader-blaming, channel-losing
// treatment. See BRAND.md changelog. Any reference fails.
const RETIRED_TEMPLATES = /old[-_ ]?way.{0,8}intelligent[-_ ]?way|intelligent[-_ ]?way.{0,8}old[-_ ]?way/i;

const isLinkedIn = (ch) => String(ch || '').toLowerCase().startsWith('linkedin');
const idOf = (p) => p.id || p.slug || '(unidentified post)';

function postsOf(doc) {
  return (Array.isArray(doc) ? doc : doc.posts || []).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Per-post schema
 * ------------------------------------------------------------------ */

function checkPost(post) {
  const id = idOf(post);
  const findings = [];
  const add = (level, rule, detail) => findings.push({ id, level, rule, detail });
  const req = (field, ok, detail) => { if (!ok) add(FAIL, `plan.${field}`, detail); };

  req('date', /^\d{4}-\d{2}-\d{2}$/.test(String(post.date || '')),
    `date must be YYYY-MM-DD. Got: ${JSON.stringify(post.date)}`);
  req('channel', typeof post.channel === 'string' && post.channel.trim(),
    'channel is required (instagram, linkedin_page, linkedin_byron).');
  req('pillar', PILLARS.includes(post.pillar),
    `pillar must be one of the seven, exact string: ${PILLARS.join(' | ')}. Got: ${JSON.stringify(post.pillar)}`);
  req('territory', TERRITORIES.includes(post.territory),
    `territory must be one of: ${TERRITORIES.join(', ')}. Got: ${JSON.stringify(post.territory)}`);
  req('audience', AUDIENCES.includes(post.audience),
    `audience must be "champion" or "buyer", never "clubs". Got: ${JSON.stringify(post.audience)}`);
  req('feeling', FEELINGS.includes(post.feeling),
    `feeling is one word from: ${FEELINGS.join(', ')}. Got: ${JSON.stringify(post.feeling)}`);
  req('aversion', AVERSIONS.includes(post.aversion),
    `aversion must be one of: ${AVERSIONS.join(', ')}. Got: ${JSON.stringify(post.aversion)}`);
  req('surface', SURFACES.includes(post.surface),
    `surface must be one of: ${SURFACES.join(', ')}. Got: ${JSON.stringify(post.surface)}`);

  /* -- message: the single thing this post says, stated plainly ------ */
  const msg = String(post.message || '').trim();
  if (!msg) {
    add(FAIL, 'plan.message',
      'message is required: one sentence, the single thing this post says, stated plainly, with no metaphor and no abstraction. If the message cannot be stated in plain language it is not a message, it is a phrase.');
  } else {
    const sentences = msg.split(/[.?!]/).filter((s) => s.trim()).length;
    if (sentences > 1) {
      add(FAIL, 'plan.message.oneSentence',
        `message must be one sentence (found ${sentences}). One post carries one thought. ${JSON.stringify(msg)}`);
    }
    if (msg.length > 200) {
      add(FAIL, 'plan.message.tooLong',
        `message is ${msg.length} characters. A thought that needs more than 200 characters to state is not one thought.`);
    }
  }

  /* -- capability attestations, mirrored from the capability gate ---- */
  if (typeof post.depictsAssistant !== 'boolean') {
    add(FAIL, 'plan.depictsAssistant',
      'depictsAssistant is required on every plan entry (boolean).');
  } else if (post.depictsAssistant === true) {
    if (!['answer', 'escalation'].includes(post.interactionType)) {
      add(FAIL, 'plan.interactionType',
        `interactionType must be "answer" or "escalation" when depictsAssistant is true. Got: ${JSON.stringify(post.interactionType)}`);
    } else if (post.interactionType === 'answer' && !(post.sourceDocument && String(post.sourceDocument).trim())) {
      add(FAIL, 'plan.sourceDocument',
        'An answer must name the club document class it comes from, at plan time, before a word is written.');
    } else if (post.interactionType === 'escalation' && post.endsAtHandoff !== true) {
      add(FAIL, 'plan.endsAtHandoff',
        'An escalation must declare endsAtHandoff: true at plan time.');
    }
  }

  /* -- operational credibility (D16): scenario posts name their fact - */
  if (typeof post.depictsScenario !== 'boolean') {
    add(FAIL, 'plan.depictsScenario',
      'depictsScenario is required (boolean): does this post depict a club scenario? Club professionals spot a false one instantly.');
  } else if (post.depictsScenario === true) {
    const check = String(post.operationalCheck || '').trim();
    if (!check) {
      add(FAIL, 'plan.operationalCheck',
        'A post depicting a club scenario must carry operationalCheck: the operational fact the scenario relies on, plus its source. Cart path only is decided the day of play; a round ends on the 18th hole. See brand/club-operations-facts.md.');
    } else {
      const factIds = loadFactIds();
      if (factIds.length && !factIds.some((fid) => check.includes(fid))) {
        add(FAIL, 'plan.operationalCheck.noFactRef',
          `operationalCheck must reference an entry id from brand/club-operations-facts.md (${factIds.join(', ')}). If no entry covers this scenario, add one, with its source, before planning the post. Got: ${JSON.stringify(check)}`);
      }
    }
  }

  /* -- art direction must match the scenario (D17) ------------------- */
  if (post.surface === 'photo-full-bleed'
    && !(post.artDirectionMatch && String(post.artDirectionMatch).trim())) {
    add(FAIL, 'plan.artDirectionMatch',
      'A photo post must carry artDirectionMatch: one sentence confirming the described shot depicts the scenario in the copy. The aeration post shipped over a smooth putting surface.');
  }

  /* -- CTA type ------------------------------------------------------ */
  const cta = post.ctaType === undefined ? 'none' : post.ctaType;
  if (!CTA_TYPES.includes(cta)) {
    add(FAIL, 'plan.ctaType',
      `ctaType must be one of: ${CTA_TYPES.join(', ')} (default none). Got: ${JSON.stringify(post.ctaType)}`);
  }

  /* -- channel weighting rules per slot ------------------------------ */
  if (post.founderVoice === true && post.channel !== FOUNDER_CHANNEL) {
    add(FAIL, 'plan.founderChannel',
      `Founder voice runs on the founder's channel (${FOUNDER_CHANNEL}), never the company page. Got channel: ${JSON.stringify(post.channel)}. If the founder channel is locked, the slot waits; it does not move.`);
  }
  if (post.pillar === 'The front desk leak' && !isLinkedIn(post.channel)) {
    add(FAIL, 'plan.frontDeskChannel',
      'Front desk leak slots run on LinkedIn, the demand channel where the buyer decides.');
  }

  /* -- retired template (BRAND.md changelog 4.4) --------------------- */
  const templateish = [post.template, post.format, post.structure].filter(Boolean).join(' ');
  if (RETIRED_TEMPLATES.test(templateish)) {
    add(FAIL, 'plan.retiredTemplate',
      `"${templateish}" references the retired old-way-vs-intelligent-way structure. Its whole shape is the reader-blaming, channel-losing treatment retired on 2026-08-26. Reframing it is a new brief, not a plan entry.`);
  }

  /* -- Byron's approval test, plus distribution (C4) ------------------ */
  // Seven checks from the Aug 26 feedback doc, one added: a post can pass
  // all seven and reach forty people.
  const CHECKLIST = [
    ['interestingWithoutPurchase', 'Would a smart club GM find this interesting even if they never buy Club Pilot?'],
    ['peerToPeer', 'Does it sound like one industry professional talking to another?'],
    ['credibleScenario', 'Is the scenario credible and respectful of how clubs operate?'],
    ['oneThought', 'Does the graphic communicate one thought in about three seconds?'],
    ['captionAddsLayer', 'Does the caption add insight rather than repeat the graphic?'],
    ['worksWithoutCta', 'Can the post work without a CTA?'],
    ['buildsTrust', 'Does the post build trust, curiosity or conversation?'],
    ['hasDistribution', 'Does this post have a path to an audience?'],
  ];
  for (const [field, question] of CHECKLIST) {
    const v = post[field];
    if (typeof v !== 'boolean') {
      add(FAIL, `plan.checklist.${field}`,
        `Approval checklist field missing: ${field} ("${question}"). Answer it honestly as a boolean.`);
    } else if (v === false) {
      const isPromoteCtaException = field === 'worksWithoutCta'
        && post.territory === 'promote' && post.ctaType && post.ctaType !== 'none';
      if (!isPromoteCtaException) {
        add(FAIL, `plan.checklist.${field}`,
          `Checklist answer is false: ${field} ("${question}"). A false here means the concept fails; only worksWithoutCta may be false, on the single promote post.`);
      }
      if (!(post.rationale && String(post.rationale).trim())) {
        add(FAIL, 'plan.checklist.rationale',
          `${field} is false with no rationale. Every false carries one.`);
      }
    }
  }

  /* -- approval: where a person is in the loop ----------------------- */
  // Either a person approved the plan before generation (approvedBy: name
  // and date), or the plan says honestly that nobody has yet and a person
  // reviews every post as a Buffer draft that nothing schedules for them
  // (review: "buffer-drafts", the operating model since the Sep 2026
  // handoff). What never passes is neither, or an approval nobody gave.
  const approved = post.approvedBy && String(post.approvedBy).trim();
  if (!approved && post.review !== REVIEW_IN_BUFFER) {
    add(FAIL, 'plan.approvedBy',
      `approvedBy is empty and review is not "${REVIEW_IN_BUFFER}". Either a person approves the plan before generation (name and date), or every post goes to Buffer as a draft that a person reviews and schedules. Got review: ${JSON.stringify(post.review)}.`);
  }

  return findings;
}

/* ------------------------------------------------------------------ *
 * Batch rules
 * ------------------------------------------------------------------ */

function checkPlan(plan, priors = []) {
  const posts = postsOf(plan);
  let findings = [];
  const add = (level, rule, detail, id = '(batch)') => findings.push({ id, level, rule, detail });

  if (!posts.length) {
    add(FAIL, 'plan.empty', 'The plan has no posts. No plan, no batch.');
  }

  for (const post of posts) findings = findings.concat(checkPost(post));

  /* -- LinkedIn carries at least half the slots (D15) ---------------- */
  const li = posts.filter((p) => isLinkedIn(p.channel)).length;
  if (posts.length && li < posts.length / 2) {
    add(FAIL, 'plan.linkedinWeight',
      `LinkedIn has ${li} of ${posts.length} slots. LinkedIn is the demand channel where the buyer decides and carries at least half of any batch. Batch 3 shipped 5 LinkedIn against 10 Instagram.`);
  }

  /* -- CTA frequency and spacing ------------------------------------- */
  // The brand's config sets how often a post may ask (cta.every: one post in
  // N). Without it, the original rule holds: at most one CTA per batch (4.5,
  // the 10% promote band). Club Pilot moved to one in four on 2026-09-30,
  // with soft, rotating "meet the team" asks.
  const ctas = posts.filter((p) => p.ctaType && p.ctaType !== 'none');
  const every = ctaEvery();
  const ctaMax = every ? Math.ceil(posts.length / every) : 1;
  if (ctas.length > ctaMax) {
    add(FAIL, 'plan.ctaCount',
      every
        ? `${ctas.length} posts carry a CTA (${ctas.map(idOf).join(', ')}). The brand asks on at most one post in ${every}: ${ctaMax} of ${posts.length} here. The rest build trust.`
        : `${ctas.length} posts carry a CTA (${ctas.map(idOf).join(', ')}). At most one post per batch promotes; the other ${posts.length - 1} build trust.`);
  }
  // Two asks in a row on one channel read as a sales push.
  const ctaByChannel = new Map();
  for (const p of [...posts].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    if (!ctaByChannel.has(p.channel)) ctaByChannel.set(p.channel, []);
    ctaByChannel.get(p.channel).push(p);
  }
  for (const [chan, list] of ctaByChannel) {
    for (let i = 1; i < list.length; i += 1) {
      const a = list[i - 1];
      const b = list[i];
      if (a.ctaType && a.ctaType !== 'none' && b.ctaType && b.ctaType !== 'none') {
        add(FAIL, 'plan.ctaAdjacent',
          `${chan}: "${idOf(a)}" and "${idOf(b)}" both carry a CTA, back to back. Space the asks out so the feed never reads as a sales push.`);
      }
    }
  }

  /* -- surface mix: none above a third, none adjacent per channel ---- */
  const bySurface = new Map();
  for (const p of posts) {
    if (!p.surface) continue;
    bySurface.set(p.surface, (bySurface.get(p.surface) || 0) + 1);
  }
  // Ceiling, not floor: a strict n/3 cap makes any batch size not divisible
  // by three infeasible with only three surfaces.
  const surfaceCap = Math.ceil(posts.length / 3);
  for (const [s, n] of bySurface) {
    if (n > surfaceCap) {
      add(FAIL, 'plan.surfaceDominates',
        `${n} of ${posts.length} posts use the "${s}" surface, above the one-third cap of ${surfaceCap}. Batch 3 put eleven of fifteen renders on one shell.`);
    }
  }
  const byChannel = new Map();
  for (const p of posts) {
    if (!p.channel || !p.date) continue;
    if (!byChannel.has(p.channel)) byChannel.set(p.channel, []);
    byChannel.get(p.channel).push(p);
  }
  for (const [chan, list] of byChannel) {
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].surface && list[i].surface === list[i - 1].surface) {
        add(FAIL, 'plan.surfaceAdjacent',
          `${chan}: "${idOf(list[i - 1])}" and "${idOf(list[i])}" run back to back, both "${list[i].surface}".`);
      }
    }
  }

  /* -- territory mix: 50 / 25 / 15 / 10, plus or minus one per band -- */
  // Bands map Byron's editorial mix onto the five territories: seeing 50,
  // thinking 25, learning + building together 15, promote 10.
  if (posts.length) {
    const bands = [
      { name: 'seeing (teach/observe)', pct: 0.50, count: (p) => p.territory === 'seeing' },
      { name: 'thinking (conversations)', pct: 0.25, count: (p) => p.territory === 'thinking' },
      { name: 'learning+building', pct: 0.15, count: (p) => p.territory === 'learning' || p.territory === 'building' },
      { name: 'promote', pct: 0.10, count: (p) => p.territory === 'promote' },
    ];
    const distribution = [];
    let mixOk = true;
    for (const band of bands) {
      const actual = posts.filter(band.count).length;
      const ideal = Math.round(band.pct * posts.length);
      const lo = Math.max(0, ideal - 1);
      const hi = ideal + 1;
      distribution.push(`${band.name}: ${actual} (target ${ideal}, allowed ${lo}-${hi})`);
      if (actual < lo || actual > hi) mixOk = false;
    }
    // Reported whether it passes or fails, so drift is visible before it
    // becomes a pattern.
    add(INFO, 'plan.territoryDistribution', distribution.join('; '));
    if (!mixOk) {
      add(FAIL, 'plan.territoryMix',
        `Territory mix is off the 50/25/15/10 editorial mix (tolerance one post per band). ${distribution.join('; ')}`);
    }
  }

  /* -- message dedupe + theme cap, via the diversity gate ------------ */
  const dedupe = diversity.checkBatch(plan, priors);
  findings = findings.concat(dedupe.findings.filter((f) => f.level !== WARN || priors.length === 0));

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: posts.length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

/* ------------------------------------------------------------------ *
 * Ledger-vs-plan match: generation writes copy against the plan, and a
 * ledger entry whose fields do not match its plan entry fails.
 * ------------------------------------------------------------------ */

function checkLedgerAgainstPlan(ledger, plan) {
  const planPosts = postsOf(plan);
  const findings = [];
  const add = (level, rule, detail, id) => findings.push({ id, level, rule, detail });

  const planById = new Map(planPosts.map((p) => [idOf(p), p]));
  for (const post of postsOf(ledger)) {
    const id = idOf(post);
    const entry = planById.get(id)
      || planPosts.find((p) => p.date === String(post.dueAt || '').slice(0, 10) && p.channel === post.channel);
    if (!entry) {
      add(FAIL, 'match.noPlanEntry',
        'No plan entry for this post. Generation reads the plan; a post that was never planned was never approved. No plan, no batch.', id);
      continue;
    }
    const compare = (field, ledgerVal, planVal) => {
      if (planVal !== undefined && ledgerVal !== undefined && ledgerVal !== planVal) {
        add(FAIL, `match.${field}`,
          `Ledger says ${JSON.stringify(ledgerVal)}, plan says ${JSON.stringify(planVal)}. The plan is what was approved; the ledger drifted.`, id);
      }
    };
    compare('pillar', post.pillar, entry.pillar);
    compare('channel', post.channel, entry.channel);
    compare('territory', post.territory, entry.territory);
    compare('depictsAssistant', post.depictsAssistant, entry.depictsAssistant);
    compare('date', String(post.dueAt || '').slice(0, 10), entry.date);

    // Copy-to-message coherence (D22 defense 3 of 3): a headline sharing
    // fewer than two content words with its plan message usually means the
    // copy drifted into a phrase. Flag for human review, never block; this
    // check cannot tell drift from a good re-cut, and pretending otherwise
    // would build false confidence.
    const headline = post.headline || '';
    if (headline && entry.message) {
      const shared = [...diversity.contentWords(headline)]
        .filter((w) => diversity.contentWords(entry.message).has(w));
      if (shared.length < 2) {
        add(WARN, 'match.messageCoherence',
          `Headline ${JSON.stringify(headline)} shares ${shared.length} content word(s) with the plan message ${JSON.stringify(entry.message)}. High divergence usually means the copy drifted into a phrase. Read it aloud: can you state what it means in plain words? Human review, not a block.`, id);
      }
    }
  }

  const failures = findings.filter((f) => f.level === FAIL);
  return {
    pass: failures.length === 0,
    checked: postsOf(ledger).length,
    failures,
    warnings: findings.filter((f) => f.level === WARN),
    findings,
  };
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

function report(result, label = 'plan gate') {
  const lines = [];
  lines.push(`${label}: ${result.checked} post(s) checked`);
  for (const f of result.findings) {
    lines.push(`  [${f.level.toUpperCase()}] ${f.id} :: ${f.rule}`);
    lines.push(`         ${f.detail}`);
  }
  lines.push(result.pass
    ? '  PASS: the plan holds together. Generation may read it.'
    : `  FAIL: ${result.failures.length} violation(s). No batch until the plan passes.`);
  return lines.join('\n');
}

module.exports = {
  checkPost, checkPlan, checkLedgerAgainstPlan, report,
  PILLARS, TERRITORIES, AUDIENCES, FEELINGS, AVERSIONS, SURFACES, CTA_TYPES, REVIEW_IN_BUFFER,
};

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const args = process.argv.slice(2);
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  if (args[0] === '--match') {
    const [, planPath, ledgerPath] = args;
    if (!planPath || !ledgerPath) {
      console.error('usage: node plan-gate.js --match <plan.json> <ledger.json>');
      process.exit(2);
    }
    const result = checkLedgerAgainstPlan(read(ledgerPath), read(planPath));
    console.log(report(result, 'plan match'));
    process.exit(result.pass ? 0 : 1);
  }
  const [planPath, ...priors] = args;
  if (!planPath) {
    console.error('usage: node plan-gate.js <plan.json> [<prior-ledger.json>...]');
    console.error('       node plan-gate.js --match <plan.json> <ledger.json>');
    process.exit(2);
  }
  if (!fs.existsSync(planPath)) {
    console.error(`plan not found: ${planPath}. No plan, no batch.`);
    process.exit(1);
  }
  const result = checkPlan(read(planPath), priors.map(read));
  console.log(report(result));
  process.exit(result.pass ? 0 : 1);
}
