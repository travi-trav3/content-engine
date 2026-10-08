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
// Booking words are allowed in calls to action (2026-09-30) and still fail
// any post that depicts the assistant: the court "booked from the car" is the
// Aug 6 overreach and must keep failing on its own words.
check('b2-08-tennis still fails for the assistant booking a court (capability.lexicon.blocked: booked)',
  b2cap.failures.some((f) => f.id === 'b2-08-tennis' && f.rule === 'capability.lexicon.blocked' && /booked/.test(f.detail)));
check('a call to action that books a demo no longer fails (b2-09-single-ask)',
  !b2cap.failures.some((f) => f.id === 'b2-09-single-ask'));

console.log('== carousels: every slide is checked ==');
const carousel = (slide2) => ({
  id: 'car', pillar: 'Industry pulse', format: 'carousel', depictsAssistant: false, clubMarks: [],
  headline: 'What is the most effective channel at your club?', caption: 'A question worth asking.',
  slides: [
    { index: 1, headline: 'What is the most effective channel at your club?' },
    { index: 2, headline: 'Email?', text: null, ...slide2 },
  ],
});
check('an em dash on an inner slide fails the brand gate',
  brand.checkBatch({ posts: [carousel({ text: 'Some members live in email — others never open it.' })] }).failures
    .some((f) => f.rule === 'brand.emDash' && /slide 2/.test(f.id)));
check('an out-of-scope claim on an inner slide fails the capability gate',
  capability.checkBatch({ posts: [carousel({ text: 'Members pay their dues by text.' })] }, WS.brandDir).failures
    .some((f) => f.rule === 'capability.lexicon.blocked'));
check('an unapproved number on an inner slide fails the stat gate',
  stat.checkBatch({ posts: [carousel({ headline: '43% of members open email.' })] }).failures
    .some((f) => f.rule === 'stat.unapprovedNumeral'));
const fourCarousels = { posts: ['a', 'b', 'c', 'd'].map((x, i) => ({ id: x, pillar: plan.PILLARS[i], format: 'carousel' })) };
const fourCards = { posts: ['a', 'b', 'c', 'd'].map((x, i) => ({ id: x, pillar: plan.PILLARS[i], format: 'type-card' })) };
check('four carousels in a batch pass: the brand sets their frequency (config carousel.every)',
  !rotation.checkBatch(fourCarousels).failures.some((f) => f.rule === 'rotation.formatDominates'));
check('four type cards in a batch still fail (rotation.formatDominates)',
  rotation.checkBatch(fourCards).failures.some((f) => f.rule === 'rotation.formatDominates'));

console.log('== humor: review-first, as a person or as a Buffer draft ==');
const joke = {
  id: 'joke', pillar: 'Humor', headline: 'Fog delay? Not for the seven o\'clock doubles.',
  earnsItsPlace: 'Recognition of the devoted regulars every operator knows, told by the brand that talks to members every day.',
  humorMechanism: 'Devotion taken slightly too far: the regulars play through fog nobody else would.', standsWithoutFooter: true,
};
const edRules = (post) => editorial.checkBatch({ posts: [post] }).failures.map((f) => f.rule);
check('a humor post nobody has approved still fails (editorial.humorNeedsApproval)', edRules(joke).includes('editorial.humorNeedsApproval'));
check('a humor post going to Buffer as a draft for review passes the approval rule',
  !edRules({ ...joke, review: 'buffer-drafts' }).includes('editorial.humorNeedsApproval'), edRules({ ...joke, review: 'buffer-drafts' }).join(', '));
check('a Buffer-draft humor post still needs its mechanism', edRules({ ...joke, review: 'buffer-drafts', humorMechanism: '' }).includes('editorial.humorMechanism'));
check('and still fails when the joke needs a footer', edRules({ ...joke, review: 'buffer-drafts', standsWithoutFooter: false }).includes('editorial.standsWithoutFooter'));

console.log('== capability: context decides (2026-09-30) ==');
// A word fails where it describes the product doing something, not where the
// industry story or a call to action uses it.
const capPost = (over) => ({
  id: 'ctx', depictsAssistant: false, clubMarks: [], headline: 'H', caption: '', ...over,
});
const capRules = (post) => capability.checkBatch({ posts: [post] }, WS.brandDir).failures.map((f) => f.rule);
const passes = (label, post) => { const r = capRules(post); check(`passes: ${label}`, r.length === 0, r.join(', ')); };
const fails = (label, post, rule) => { const r = capRules(post); check(`fails: ${label} (${rule})`, r.includes(rule), r.join(', ') || 'passed'); };
passes('the partnership story names the tee sheet', capPost({ headline: 'Rip out the tee sheet? No.' }));
passes('a channel members pay attention to', capPost({ caption: 'Text is a channel members pay attention to.' }));
passes('in order to', capPost({ caption: 'Clubs send fewer messages in order to be heard.' }));
passes('a call to action books a call with the team', capPost({ caption: 'Book a quick call with our team.' }));
fails('a thread in which the assistant mentions the tee sheet',
  capPost({ depictsAssistant: true, interactionType: 'answer', sourceDocument: 'hours', thread: [{ from: 'assistant', text: 'The tee sheet shows a gap at 9.' }] }),
  'capability.lexicon.blocked');
fails('members paying dues by text', capPost({ caption: 'Members can pay their dues by text.' }), 'capability.lexicon.blocked');
fails('ordering dinner by text', capPost({ caption: 'Members order dinner by text.' }), 'capability.lexicon.blocked');
fails('a dining reservation outside any thread', capPost({ caption: 'Move a dining reservation in seconds.' }), 'capability.lexicon.blocked');
fails('a claim that Club Pilot syncs with the tee sheet', capPost({ caption: 'Club Pilot syncs with your tee sheet.' }), 'capability.integrationClaim');
fails('a claim of a POS integration', capPost({ caption: 'Answers come straight from the POS integration.' }), 'capability.integrationClaim');
// Byron's October map, weeks 2 and 4: the partnership story is an ambition.
// The same words as a present fact are the claim, by a generic name.
fails('Club Pilot connects with the operational systems clubs rely on', capPost({ caption: 'Club Pilot connects with the operational systems clubs already rely on.' }), 'capability.integrationClaim');
fails('answers sync with the software a club already uses', capPost({ caption: 'Answers sync with the software your club already uses.' }), 'capability.integrationClaim');
fails('a named system gets no ambition exemption', capPost({ caption: 'Club Pilot wants to sync with your tee sheet.' }), 'capability.integrationClaim');
passes('the ambition, in the map\'s words', capPost({ caption: 'Club Pilot wants to connect with the operational technology ecosystem rather than replace it.' }));
passes('the ambition, about the systems clubs rely on', capPost({ caption: 'We want communication to connect with the systems clubs already rely on.' }));
passes('not ripping them out', capPost({ caption: 'Club Pilot\'s ambition is not to rip them out but to connect with them.' }));

console.log('== press: Golf Digest featured Club Pilot and judged nothing (BRAND.md section 8) ==');
const pressRules = (caption) => brand.checkBatch({ posts: [{ id: 'press', pillar: 'Proof', headline: 'Featured at the PGA Show.', caption, clubMarks: [] }] })
  .failures.map((f) => f.rule);
const pressFails = (label, caption) => check(`fails: ${label} (brand.pressClaim)`, pressRules(caption).includes('brand.pressClaim'), pressRules(caption).join(', ') || 'passed');
const pressPasses = (label, caption) => check(`passes: ${label}`, !pressRules(caption).includes('brand.pressClaim'));
pressFails('the Sep 30 home page draft line', 'Most clubs start with text, thanks to Golf Digest naming us a leader in the SMS space.');
pressFails('a remembered superlative', 'One of the coolest new products at the PGA Show, per Golf Digest.');
pressFails('Golf Digest called it the best', 'Golf Digest called Club Pilot one of the best new tools for clubs.');
pressPasses('featured in Golf Digest', 'As featured in Golf Digest, 2026.');
pressPasses('the locked quote, verbatim, with its attribution',
  `"${brand.PRESS_QUOTE}" Golf Digest, 2026`);

console.log('== stats: a figure approved for one subject only (sentence scope) ==');
const statRules = (caption) => stat.checkBatch({ posts: [{ id: 'st', caption }] }).failures.map((f) => f.rule);
check('passes: Byron\'s WriterAccess figure, in the map\'s own sentence', statRules('WriterAccess connected businesses, writers, and 40+ integrations rather than trying to replace the ecosystem.').length === 0);
check('fails: the same figure as a Club Pilot number (stat.unapprovedNumeral)', statRules('Club Pilot has 40+ integrations.').includes('stat.unapprovedNumeral'));
check('fails: WriterAccess in the sentence before does not approve it (stat.unapprovedNumeral)', statRules('I learned a lot at WriterAccess. Club Pilot now has 40+ integrations.').includes('stat.unapprovedNumeral'));

console.log('== source: founder voice restates a recorded source (Aug 24, Byron Aug 21) ==');
// Byron's own written words of Aug 21, about the invented Aug 24 post. As a
// source they are his; a post that turns them into his biography is the
// incident again.
const sourceGate = require(path.join(GATES, 'source-gate.js'));
const srcLib = require(path.join(ROOT, 'engine', 'generate', 'sources'));
const aug21Text = 'just plain confusing like me being an operator, inventor, sitting in a room.';
const aug21 = { name: 'byron-2026-08-21.md', kind: 'document', sha256: null, text: aug21Text,
  turns: [{ speaker: null, founder: true, text: aug21Text, tokens: srcLib.tokens(aug21Text) }], founderWords: srcLib.tokens(aug21Text).length };
const srcRules = (p) => sourceGate.checkPost(p, [aug21], { allowNames: ['Club Pilot'] }).map((f) => f.rule);
const b308 = ledgers.b3.posts.find((p) => p.id === 'b3-08-founder-li');
check('fails: the Aug 24 post itself, no sentence sourced (source.noSentences)', srcRules(b308).includes('source.noSentences'), srcRules(b308).join(', '));
const biography = { id: 'bio', paragraphs: [{ sentences: [{ text: 'I spent years as an operator before I built Club Pilot.', refs: [{ source: aug21.name, quote: 'me being an operator, inventor, sitting in a room' }] }] }] };
check('fails: his complaint turned into his biography (source.overlap)', srcRules(biography).includes('source.overlap'), srcRules(biography).join(', ') || 'passed');
const restated = { id: 'ok', paragraphs: [{ sentences: [{ text: 'A post that made me an operator and an inventor sitting in a room was just plain confusing.', refs: [{ source: aug21.name, quote: 'just plain confusing like me being an operator, inventor, sitting in a room.' }] }] }] };
check('passes: what he said, restated', srcRules(restated).length === 0, srcRules(restated).join(', '));

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
  // Club Pilot asks on one post in four (config.json cta.every, 2026-09-30):
  // three of these twelve may carry a CTA, four may not.
  ['more CTA posts than one in four', (p) => { [0, 3, 6].forEach((i) => { p.posts[i].ctaType = 'demo'; }); }, 'plan.ctaCount'],
  ['two CTA posts back to back on one channel', (p) => { p.posts[9].ctaType = 'demo'; }, 'plan.ctaAdjacent'],
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
