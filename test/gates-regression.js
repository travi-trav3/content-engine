/**
 * gates-regression.js
 *
 * Regression and generation verification for the Aug 26 2026 correction,
 * run against the Club Pilot fixture in brands/clubpilot. Run from anywhere:
 *
 *   node test/gates-regression.js
 *
 * Exits 0 only when every expectation holds. Two suites:
 *
 * 1. Regression: the gates against the three shipped batches. Batch 3 must
 *    hard-fail on D6, D8, D11, D1, D2, D5, D12, D18, D20 and D21; batch 2's
 *    Aug 6 three must still fail the capability gate. If batch 3 passes,
 *    the fix is not done.
 * 2. Generation: the batch-4 fixture plan must pass plan-gate, and eight
 *    mutations of it must each be rejected for the right reason.
 */

'use strict';

const fs = require('fs');
const path = require('path');

process.env.CE_WORKSPACE = 'brands/clubpilot';

const { ROOT, workspace } = require('../engine/lib/workspace');
const GATES = path.join(ROOT, 'engine', 'gates');
const WS = workspace();
const read = (f) => JSON.parse(fs.readFileSync(path.resolve(WS.dir, f), 'utf8'));

const capability = require(path.join(GATES, 'capability-gate.js'));
const editorial = require(path.join(GATES, 'editorial-gate.js'));
const rotation = require(path.join(GATES, 'rotation-gate.js'));
const diversity = require(path.join(GATES, 'diversity-gate.js'));
const brand = require(path.join(GATES, 'brand-gate.js'));
const stat = require(path.join(GATES, 'stat-gate.js'));
const plan = require(path.join(GATES, 'plan-gate.js'));

const ledgers = {
  b1: read('content/batch-01/ledger.json'),
  b2: read('content/batch-02/ledger.json'),
  b3: read('content/batch-03/ledger.json'),
};

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};
const hasRule = (result, rule, id) =>
  result.failures.some((f) => f.rule === rule && (!id || f.id === id));

/* ------------------------------------------------------------------ *
 * Suite 1: regression over the shipped batches
 * ------------------------------------------------------------------ */

console.log('== regression: batch 3 must hard-fail on the briefed defects ==');

const b3brand = brand.checkBatch(ledgers.b3);
const b3stat = stat.checkBatch(ledgers.b3);
const b3div = diversity.checkBatch(ledgers.b3, [ledgers.b1, ledgers.b2]);

check('D6  invented stat fails (stat.unapprovedNumeral on b3-05)',
  hasRule(b3stat, 'stat.unapprovedNumeral', 'b3-05-math-li'));
check('D18 contrast pair fails (stat.bannedComparison on b3-09)',
  hasRule(b3stat, 'stat.bannedComparison', 'b3-09-stat-ig'));
check('D8  one-idea batch fails (dedupe.themeRepeat)',
  hasRule(b3div, 'dedupe.themeRepeat'));
check('D11 Aug 30 ask repeats Aug 18 ask (dedupe.sharedPhrasing on b3-12)',
  hasRule(b3div, 'dedupe.sharedPhrasing', 'b3-12-ask-ig'));
check('D1  thread sender fails (brand.threadSender.missing on b3-01)',
  hasRule(b3brand, 'brand.threadSender.missing', 'b3-01-escalation-li'));
check('D2  internal label fails (brand.internalLabel on b3-05 subhead)',
  hasRule(b3brand, 'brand.internalLabel', 'b3-05-math-li'));
check('D5  IG caption URL fails (brand.igCaptionUrl on b3-12)',
  hasRule(b3brand, 'brand.igCaptionUrl', 'b3-12-ask-ig'));
check('D12 banned word fails (brand.bannedWord on b3-12)',
  hasRule(b3brand, 'brand.bannedWord', 'b3-12-ask-ig'));
check('D12 pillar vocabulary fails (brand.pillarVocab on b3-07)',
  hasRule(b3brand, 'brand.pillarVocab', 'b3-07-tomorrow-thread-ig'));
check('D20 copy cap fails (brand.copyCap.card on b3-08, the AI-handoff card)',
  hasRule(b3brand, 'brand.copyCap.card', 'b3-08-founder-li'));
check('D21 reader accusation fails (brand.accusation on b3-11)',
  hasRule(b3brand, 'brand.accusation', 'b3-11-compare-li'));
check('D4/D7 founder off-channel and unsourced fail (b3-08)',
  hasRule(b3brand, 'brand.founderChannel', 'b3-08-founder-li')
  && hasRule(b3brand, 'brand.founderSourceNote', 'b3-08-founder-li'));
check('D22 known abstraction fails (brand.knownAbstraction on b3-07)',
  hasRule(b3brand, 'brand.knownAbstraction', 'b3-07-tomorrow-thread-ig'));

// D20 numbers, reported rather than tuned to force: the cart-path card
// (b3-07) totals under the 240 cap and is caught by other checks instead.
const b307 = ledgers.b3.posts.find((p) => p.id === 'b3-07-tomorrow-thread-ig');
const b307total = [b307.headline, b307.subhead, b307.text,
  ...(b307.thread || []).map((m) => m.text)].filter(Boolean).join(' ').length;
console.log(`  note  D20 numbers: b3-07 card copy totals ${b307total} chars (cap 240), so the cart-path card passes the caps and fails on D12/D22/D16-class checks instead; b3-08 totals over cap. Reported per the amendment rather than silently lowering the cap.`);

console.log('== regression: batch 2, the Aug 6 three still fail capability ==');
const b2cap = capability.checkBatch(ledgers.b2, WS.brandDir);
for (const id of ['b2-01-triad-carousel', 'b2-02-thread-li', 'b2-06-humor']) {
  check(`capability still fails ${id}`, b2cap.failures.some((f) => f.id === id));
}

console.log('== regression: overall gate verdicts ==');
check('batch 3 fails the combined gates',
  !(b3brand.pass && b3stat.pass && b3div.pass));
check('batch 1 passes stat gate (no false positives on legacy numbers)',
  stat.checkBatch(ledgers.b1).pass);

console.log('== generated posts: visible-text checks run on what the render drew ==');
// A generated post has no legacy template file. Its render's text gets the
// checks a template's markup got, so a layout cannot draw what a template
// was forbidden to show.
const generated = (over) => ({
  id: 'gen-01', channel: 'linkedin_page', pillar: 'Member experience, elevated', format: 'thread',
  template: 'message-thread', layout: 'message-thread', sender: 'Fairhaven Country Club',
  headline: 'One less call to the front desk.', caption: 'A routine question, answered from the club hours.',
  thread: [{ from: 'member', text: 'What time does the range close tonight?' },
    { from: 'assistant', text: 'The range closes at 8pm tonight, per the facility hours.' }],
  depictsAssistant: true, interactionType: 'answer', sourceDocument: 'facility hours', clubMarks: [],
  renderedText: 'clubpilot One less call to the front desk. FC Fairhaven Country Club Texting · powered by Club Pilot What time does the range close tonight? The range closes at 8pm tonight, per the facility hours.',
  ...over,
});
const genClean = brand.checkBatch({ posts: [generated({})] });
check('a clean generated thread passes the brand gate with no template warning',
  genClean.pass && !hasRule({ failures: genClean.warnings }, 'brand.templateMissing'),
  [...genClean.failures, ...genClean.warnings].map((f) => f.rule).join(', '));
const genNoMicro = brand.checkBatch({ posts: [generated({ renderedText: 'clubpilot One less call to the front desk. FC Fairhaven Country Club What time does the range close tonight?' })] });
check('a generated thread drawn without the powered-by line fails (brand.template.microlineMissing)',
  hasRule(genNoMicro, 'brand.template.microlineMissing'));
const genLabel = brand.checkBatch({ posts: [generated({ renderedText: 'clubpilot INTELLIGENT COMMUNICATION One less call. powered by Club Pilot' })] });
check('a planning label drawn on a generated post fails (brand.template.internalLabel)',
  hasRule(genLabel, 'brand.template.internalLabel'));

/* ------------------------------------------------------------------ *
 * Suite 2: generation tests on the fixture plan
 * ------------------------------------------------------------------ */

console.log('== generation: fixture plan and its mutations ==');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'plan-batch-04-fixture.json'), 'utf8'));
const priors = [ledgers.b1, ledgers.b2, ledgers.b3];
const clone = () => JSON.parse(JSON.stringify(fixture));

const valid = plan.checkPlan(fixture, priors);
check('valid 12-post plan is accepted', valid.pass,
  valid.failures.map((f) => `${f.id}:${f.rule}`).join(', '));

const mutations = [
  ['duplicate message', (p) => { p.posts[2].message = p.posts[0].message; }, 'dedupe.nearDuplicateMessage'],
  ['two documents-idea posts', (p) => {
    p.posts[0].message = 'The answer was already written down in the guest policy.';
    p.posts[4].message = 'Most answers already exist in documents the club published.';
  }, 'dedupe.themeRepeat'],
  ['LinkedIn below half', (p) => { p.posts[0].channel = 'instagram'; p.posts[2].channel = 'instagram'; }, 'plan.linkedinWeight'],
  ['empty approvedBy', (p) => { p.posts[5].approvedBy = ''; }, 'plan.approvedBy'],
  ['territory mix off tolerance', (p) => { p.posts.forEach((x) => { x.territory = 'seeing'; }); }, 'plan.territoryMix'],
  ['two CTA posts', (p) => { p.posts[0].ctaType = 'website'; }, 'plan.ctaCount'],
  ['scenario post missing operationalCheck', (p) => { delete p.posts[1].operationalCheck; }, 'plan.operationalCheck'],
  // Also proves brand/club-operations-facts.md resolved: the gate skips this
  // check silently when the facts file cannot be found.
  ['operationalCheck citing no known fact', (p) => {
    p.posts.find((x) => x.depictsScenario === true).operationalCheck = 'Checked with a club manager.';
  }, 'plan.operationalCheck.noFactRef'],
  ['retired template 9 reference', (p) => { p.posts[0].template = 'old-way-vs-intelligent-way'; }, 'plan.retiredTemplate'],
  ['an unknown review mode in place of approval', (p) => {
    p.posts[5].approvedBy = '';
    p.posts[5].review = 'auto';
  }, 'plan.approvedBy'],
];

// Buffer review is the operating model after handoff: an unapproved plan
// whose posts all go to Buffer as drafts for a person to review passes the
// approval rule, and says so instead of carrying an approval nobody gave.
const bufferReview = clone();
bufferReview.posts.forEach((x) => { delete x.approvedBy; x.review = plan.REVIEW_IN_BUFFER; });
const br = plan.checkPlan(bufferReview, priors);
check('a plan reviewed as Buffer drafts is accepted without approvedBy', br.pass,
  br.failures.map((f) => `${f.id}:${f.rule}`).join(', '));

for (const [label, mutate, expectedRule] of mutations) {
  const mutated = clone();
  mutate(mutated);
  const result = plan.checkPlan(mutated, priors);
  check(`rejects ${label} (${expectedRule})`, !result.pass && hasRule(result, expectedRule),
    result.pass ? 'plan passed' : `rules: ${[...new Set(result.failures.map((f) => f.rule))].join(', ')}`);
}

/* ------------------------------------------------------------------ */

console.log(failures === 0
  ? '\nverification: ALL EXPECTATIONS HOLD'
  : `\nverification: ${failures} EXPECTATION(S) VIOLATED`);
process.exit(failures === 0 ? 0 : 1);
