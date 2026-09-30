/**
 * plan.js
 *
 * Step one of a batch: decide what each post says before anything is
 * written. The model fills every slot of the calendar with a pillar, a
 * territory, one plain-sentence message, a layout and the attestations the
 * gates need; the engine adds ids, dates and shells; then the plan gate,
 * the rotation rules and the engine's own consistency checks run, and any
 * failure goes back to the model, verbatim, for a full revision.
 *
 * The plan is the cheapest place to catch a bad batch: ten one-sentence
 * messages are faster to fix than ten finished posts.
 */

'use strict';

const planGate = require('../gates/plan-gate');
const rotationGate = require('../gates/rotation-gate');
const { PHOTO_VOCAB } = require('./catalog');
const { brandContext, historySummary, photoSummary, layoutMenu } = require('./context');

const CHECKLIST = ['interestingWithoutPurchase', 'peerToPeer', 'credibleScenario', 'oneThought',
  'captionAddsLayer', 'worksWithoutCta', 'buildsTrust', 'hasDistribution'];

const THREAD_INTERACTION = { 'message-thread': 'answer', 'photo-thread': 'answer', 'escalation-thread': 'escalation' };

const nullable = (schema) => ({ ...schema, type: [schema.type, 'null'], ...(schema.enum ? { enum: [...schema.enum, null] } : {}) });

function planSchema({ catalog, pillars, demoClubs, ctaTypes, slotCount }) {
  const layouts = catalog.filter((c) => c.eligible).map((c) => c.id);
  const entry = {
    slot: { type: 'integer', description: `The slot index this entry fills, 0 to ${slotCount - 1}.` },
    slug: { type: 'string', description: 'Two to four lowercase words joined by hyphens, naming the idea.' },
    pillar: { type: 'string', enum: pillars },
    territory: { type: 'string', enum: planGate.TERRITORIES },
    audience: { type: 'string', enum: planGate.AUDIENCES },
    feeling: { type: 'string', enum: planGate.FEELINGS },
    aversion: { type: 'string', enum: planGate.AVERSIONS },
    message: { type: 'string', description: 'One plain sentence: the single thing this post says. No metaphor.' },
    angle: { type: 'string', description: 'Two or three sentences for the writer: what the graphic shows and what the caption adds.' },
    layout: { type: 'string', enum: layouts },
    renderSurface: { type: 'string', enum: ['dark', 'light', 'photo'] },
    photoSubject: nullable({ type: 'string', enum: PHOTO_VOCAB.subjects }),
    photoBrief: nullable({ type: 'string', description: 'For a photo layout: what the photo must show, and why it fits the copy.' }),
    artDirectionMatch: nullable({ type: 'string', description: 'For a photo layout: one sentence confirming the shot depicts the scenario in the copy.' }),
    depictsAssistant: { type: 'boolean' },
    interactionType: nullable({ type: 'string', enum: ['answer', 'escalation'] }),
    sourceDocument: nullable({ type: 'string', description: 'For an answer: the club document class it comes from (e.g. "facility hours").' }),
    depictsScenario: { type: 'boolean' },
    operationalCheck: nullable({ type: 'string', description: 'For a scenario: the fact id from club-operations-facts.md, then the fact it relies on.' }),
    sender: nullable({ type: 'string', enum: demoClubs }),
    ctaType: { type: 'string', enum: ['none', ...ctaTypes] },
    ...Object.fromEntries(CHECKLIST.map((k) => [k, { type: 'boolean' }])),
    rationale: nullable({ type: 'string', description: 'Required when any checklist answer is false.' }),
  };
  return {
    type: 'object',
    properties: {
      posts: {
        type: 'array',
        items: { type: 'object', properties: entry, required: Object.keys(entry), additionalProperties: false },
      },
    },
    required: ['posts'],
    additionalProperties: false,
  };
}

/** Allowed post counts per territory band for a batch of n, as the plan gate computes them. */
function territoryRanges(n) {
  const band = (pct) => { const ideal = Math.round(pct * n); return `${Math.max(0, ideal - 1)}-${ideal + 1}`; };
  return `seeing ${band(0.5)}, thinking ${band(0.25)}, learning and building together ${band(0.15)}, promote ${band(0.1)}`;
}

const SYSTEM = (brandName) => `You plan social media batches for ${brandName}. You decide what each post says; a writer drafts the copy afterwards from your plan.

The brand files are the authority on positioning, voice, capability and proof. Follow them exactly. Where they mark something GATED, CONFIRM or GAP, do not use it. Never invent a statistic, a quote, a customer, a club name or a product capability.

Automated checks run on your plan. They enforce the rules listed in the request; a plan that fails them comes back to you with the failures quoted. Answer every checklist question honestly: a false answer with a rationale is better than a true answer that is not true.

Return only the JSON the schema asks for.`;

function planRequest({ ctx, slots, rules, revision }) {
  const slotLines = slots.map((s) => `- slot ${s.slot}: ${s.date} (${s.dueAt}) ${s.channel}`).join('\n');
  const parts = [
    ctx.brand,
    '<history>', ctx.history, '</history>',
    '<photo_library>', ctx.photos, '</photo_library>',
    '<layouts>', ctx.layouts, '</layouts>',
    '<task>',
    `Plan one post for each of these ${slots.length} slots:`,
    slotLines,
    '',
    'Rules the checks enforce:',
    ...rules.map((r) => `- ${r}`),
    '</task>',
  ];
  if (revision) {
    parts.push('<revision>',
      'Your previous plan failed these checks. Return a complete corrected plan for every slot, changing what the failures require and keeping what passed.',
      'Failures:', revision.failures.map((f) => `- ${f}`).join('\n'),
      'Previous plan:', JSON.stringify(revision.previous, null, 1), '</revision>');
  }
  return parts.join('\n');
}

function batchRules({ slots, pillars, config, factIds, demoClubs }) {
  const n = slots.length;
  const ctaTypes = (config.cta && config.cta.types) || [];
  return [
    'One entry per slot, every slot filled once. The slot fixes the date and channel.',
    `Pillars allowed in this batch: ${pillars.join('; ')}.`,
    `Territory mix for ${n} posts: ${territoryRanges(n)}.`,
    `Each message is one plain sentence, distinct from every other message in the plan and from the history. The idea that answers already exist in documents the club wrote may carry at most one post.`,
    `At most one post has a CTA (${ctaTypes.join(' or ') || 'none configured'}), and it is the promote post. Every other ctaType is "none".`,
    `Shells (from the layout menu): no shell on more than ${Math.ceil(n / 3)} posts, and no two consecutive posts on the same channel share a shell.`,
    'Formats (from the layout menu): a pillar uses a format at most once in the batch; no format on more than 3 posts; at least one pillar + format pairing that is not in the history.',
    'The front desk leak runs on LinkedIn only.',
    'renderSurface must be one the chosen layout offers. Photo layouts use photo or the band surfaces as listed; vary dark and light across type layouts.',
    'Thread layouts (message-thread, photo-thread: interactionType "answer" with a sourceDocument; escalation-thread: interactionType "escalation") set depictsAssistant true. Every other layout sets depictsAssistant false and interactionType null.',
    `Thread layouts name a sender from the demo clubs (${demoClubs.join(', ')}), a different club for each thread in the batch. Other layouts set sender null.`,
    `A post that depicts a club scenario sets depictsScenario true and an operationalCheck that starts with one of these fact ids: ${factIds.join(', ')}. If no fact covers the scenario, choose another scenario.`,
    'Photo layouts set photoSubject to a subject the library has (see photo_library), a photoBrief and an artDirectionMatch. Other layouts set all three null.',
    'Every checklist answer is true, except worksWithoutCta may be false on the single promote post; any false needs a rationale.',
  ];
}

function slugify(s) {
  return String(s || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .split('-').slice(0, 4).join('-') || 'post';
}

/** Model output plus the engine's fields: ids, dates, shell, format, review mode. */
function toPlanEntries(response, { slots, catalog, batchNo, config, plannedOn }) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const nn = String(batchNo).padStart(2, '0');
  return [...(response.posts || [])].sort((a, b) => a.slot - b.slot).map((p) => {
    const slot = slots[p.slot] || {};
    const c = byId.get(p.layout) || {};
    const suffix = String(slot.channel || '').startsWith('linkedin') ? 'li' : 'ig';
    const entry = {
      id: `b${nn}-${String(p.slot + 1).padStart(2, '0')}-${slugify(p.slug)}-${suffix}`,
      date: slot.date,
      dueAt: slot.dueAt,
      channel: slot.channel,
      pillar: p.pillar,
      territory: p.territory,
      audience: p.audience,
      feeling: p.feeling,
      aversion: p.aversion,
      message: p.message,
      angle: p.angle,
      layout: p.layout,
      renderSurface: p.renderSurface,
      surface: c.shell,
      format: c.format,
      template: p.layout,
      depictsAssistant: p.depictsAssistant,
      depictsScenario: p.depictsScenario,
      ctaType: p.ctaType,
      founderVoice: false,
    };
    if (p.depictsAssistant) {
      entry.interactionType = p.interactionType;
      if (p.interactionType === 'answer') entry.sourceDocument = p.sourceDocument;
      if (p.interactionType === 'escalation') entry.endsAtHandoff = true;
    }
    if (p.depictsScenario) entry.operationalCheck = p.operationalCheck;
    if (p.sender) entry.sender = p.sender;
    if (p.photoSubject) {
      entry.photoSubject = p.photoSubject;
      entry.photoBrief = p.photoBrief;
    }
    if (p.artDirectionMatch) entry.artDirectionMatch = p.artDirectionMatch;
    for (const k of CHECKLIST) entry[k] = p[k];
    if (p.rationale) entry.rationale = p.rationale;
    if (config.review === 'plan-approval') entry.approvedBy = '';
    else entry.review = planGate.REVIEW_IN_BUFFER;
    entry.plannedBy = `engine, ${plannedOn}`;
    return entry;
  });
}

/** The engine's own consistency rules, which no gate covers because only generated plans name layouts. */
function engineChecks(entries, { slots, catalog, pillars, library, lib }) {
  const failures = [];
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const seenSlots = entries.map((e) => e.date + e.channel);
  if (entries.length !== slots.length) failures.push(`plan has ${entries.length} entries for ${slots.length} slots`);
  slots.forEach((s) => { if (!seenSlots.includes(s.date + s.channel)) failures.push(`slot ${s.slot} (${s.date} ${s.channel}) has no entry`); });
  const senders = new Map();
  const subjectDemand = new Map();
  for (const e of entries) {
    const c = byId.get(e.layout);
    const at = `${e.id}:`;
    if (!c || !c.eligible) { failures.push(`${at} layout "${e.layout}" is not available`); continue; }
    if (!pillars.includes(e.pillar)) failures.push(`${at} pillar "${e.pillar}" is not allowed in this batch`);
    if (!c.surfaces.includes(e.renderSurface)) {
      failures.push(`${at} ${e.layout} offers surfaces ${c.surfaces.join(', ')}, not "${e.renderSurface}"`);
    }
    const expected = THREAD_INTERACTION[e.layout];
    if (expected) {
      if (!e.depictsAssistant || e.interactionType !== expected) {
        failures.push(`${at} ${e.layout} depicts the assistant with interactionType "${expected}"`);
      }
      if (!e.sender) failures.push(`${at} ${e.layout} needs a sender from the demo clubs`);
      else if (senders.has(e.sender)) failures.push(`${at} sender "${e.sender}" is already used by ${senders.get(e.sender)}`);
      else senders.set(e.sender, e.id);
    } else {
      if (e.depictsAssistant) failures.push(`${at} only thread layouts depict the assistant; set depictsAssistant false or use a thread layout`);
      if (e.sender) failures.push(`${at} sender is only for thread layouts`);
    }
    if (c.photoProps.length) {
      if (!e.photoSubject) failures.push(`${at} ${e.layout} needs a photoSubject`);
      else subjectDemand.set(e.photoSubject, (subjectDemand.get(e.photoSubject) || 0) + 1);
    }
  }
  for (const [subject, n] of subjectDemand) {
    const have = lib.select(library, { tags: [subject] }).length;
    if (have < n) failures.push(`${n} posts want a "${subject}" photo and the library has ${have} available`);
  }
  return failures;
}

// In plan-approval mode the plan waits for a person's name; that is not
// something the model can or should fix.
function gateFailures(entries, priors, { awaitingApproval = false } = {}) {
  const doc = { posts: entries };
  const plan = planGate.checkPlan(doc, priors);
  const rotation = rotationGate.checkBatch(doc, priors);
  return [...plan.failures, ...rotation.failures]
    .filter((f) => !(awaitingApproval && f.rule === 'plan.approvedBy'))
    .map((f) => `${f.id} ${f.rule}: ${f.detail}`);
}

/**
 * Plans a batch, revising until the plan passes or the revision budget runs
 * out. Returns { entries, failures, rounds }; failures is empty on success.
 */
async function makePlan({ provider, brandDir, brand, config, catalog, library, lib, slots, priors, batchNo, plannedOn, demoClubs, factIds, log = () => {} }) {
  const pillars = planGate.PILLARS.filter((p) => !(config.excludePillars || []).includes(p));
  const ctaTypes = (config.cta && config.cta.types) || [];
  const schema = planSchema({ catalog, pillars, demoClubs, ctaTypes, slotCount: slots.length });
  const ctx = {
    brand: brandContext(brandDir),
    history: historySummary(priors, slots[0].date),
    photos: photoSummary(library, lib, Date.parse(`${slots[0].date}T12:00:00Z`)),
    layouts: layoutMenu(catalog, brand),
  };
  const rules = batchRules({ slots, pillars, config, factIds, demoClubs });
  const maxRounds = 1 + ((config.maxRevisions && config.maxRevisions.plan) ?? 3);
  let revision = null;
  let entries = [];
  let failures = [];
  let round = 0;
  while (round < maxRounds) {
    round += 1;
    const { data, usage } = await provider.generate({
      key: 'plan',
      system: SYSTEM(config.brand || brand.name),
      user: planRequest({ ctx, slots, rules, revision }),
      schema,
      schemaName: 'batch_plan',
    });
    log({ step: 'plan', round, usage });
    entries = toPlanEntries(data, { slots, catalog, batchNo, config, plannedOn });
    failures = [...engineChecks(entries, { slots, catalog, pillars, library, lib }),
      ...gateFailures(entries, priors, { awaitingApproval: config.review === 'plan-approval' })];
    log({ step: 'plan', round, failures });
    if (!failures.length) break;
    revision = { failures, previous: data };
  }
  return { entries, failures, rounds: round };
}

module.exports = { makePlan, planSchema, toPlanEntries, engineChecks, gateFailures, territoryRanges, CHECKLIST };
