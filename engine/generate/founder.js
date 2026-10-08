#!/usr/bin/env node
/**
 * founder.js
 *
 * Source mode: posts for the founder's own LinkedIn, in the founder's first
 * person, written only from the founder's own words (engine/generate/
 * sources.js). Each batch gets founder slots (config.json founder.slots) on
 * the founder's channel, recorded in the ledger as ledger.founder, apart from
 * the company feed and its gates.
 *
 *   topic     a founder idea from the month's brief, in week order, or, with
 *             none, the strongest idea in the sources no earlier post used
 *   write     the model builds the post sentence by sentence, each sentence
 *             with the exact quotes it restates; the source gate and the
 *             caption gates (capability, brand, stat) check it; findings go
 *             back for a rewrite
 *   ask       when the sources do not hold enough of the founder's words on
 *             the topic, nothing is written: the founder gets three to five
 *             questions to answer out loud, and the slot waits. When new
 *             material arrives (a voice memo in the Drive folder Sources, a
 *             document in sources/), the waiting slots are tried again
 *   draft     a written post goes to Buffer as a text-only draft on the
 *             founder's channel; the founder schedules it to approve it
 *
 *   node engine/generate/founder.js --fill [--push] [--batch NN] [--force]
 *        [--provider mock --mock-dir DIR] [--buffer mock]
 *
 * --fill tries every founder slot still open (not written, not past, at least
 * founder.minLeadHours away) whose sources changed since its last try; --force
 * tries them even if nothing changed. --push drafts what is written.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const { slotsFor } = require('./slots');
const { weekOf } = require('./brief');
const { brandContext } = require('./context');
const src = require('./sources');
const { checkFounderPosts, findingsOf, assembleCaption, flatSentences } = require('../gates/source-gate');
const { isPending } = require('./providers/agent');
const { contentSignature } = require('../buffer/media');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const when = (iso, tz) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || 'UTC' });

const DEFAULTS = {
  enabled: false, channel: 'linkedin_byron', pillar: 'Founder', name: 'the founder', names: [], slots: [], signOff: null,
  minWords: 90, maxWords: 220, minOverlap: 0.6, minLeadHours: 12, maxSourceChars: 80000, transcribeModel: 'gpt-4o-transcribe', allowNames: [],
};

function founderConfig(config = {}) {
  return { ...DEFAULTS, ...(config.founder || {}) };
}

/* ------------------------------------------------------------------ *
 * The model's part
 * ------------------------------------------------------------------ */

const REF = {
  type: 'object', additionalProperties: false, required: ['source', 'quote'],
  properties: {
    source: { type: 'string', description: 'The source file name, exactly as given.' },
    quote: { type: 'string', description: 'Copied character for character from a turn the founder spoke, at least four words; "..." only to skip words inside one passage.' },
  },
};
const SENTENCE = {
  type: 'object', additionalProperties: false, required: ['text', 'refs'],
  properties: {
    text: { type: 'string', description: 'One sentence of the post.' },
    refs: { type: 'array', items: REF, description: 'The quotes this sentence restates. Empty only for a sentence that claims nothing, or a closing question to the reader that asserts nothing.' },
  },
};
const FOUNDER_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['supported', 'questions', 'understood', 'summary', 'paragraphs'],
  properties: {
    supported: { type: 'boolean', description: 'true when the sources hold enough of the founder\'s own words for this post.' },
    questions: { type: 'array', items: { type: 'string' }, description: 'When not supported: three to five questions the founder could answer out loud in a few minutes to give this post its material. Empty when supported.' },
    understood: { type: 'string', description: 'When a reviewer\'s note is given: what it asks, in one plain sentence. Otherwise empty.' },
    summary: { type: 'string', description: 'One line on what the post says, for the reviewer. Not published.' },
    paragraphs: {
      type: 'array', description: 'The post. Empty when not supported.',
      items: { type: 'object', additionalProperties: false, required: ['sentences'], properties: { sentences: { type: 'array', items: SENTENCE } } },
    },
  },
};

function founderSystem(cfg) {
  const who = cfg.name;
  return `You write LinkedIn posts for ${who}'s own profile, in ${who}'s first person, from ${who}'s own words.

Rules that are checked, sentence by sentence:
1. Every sentence restates something ${who} said in the sources and lists the exact quotes it restates, copied character for character from a turn ${who} spoke, at least four words each, long enough to carry the sentence's meaning. Use "..." inside a quote only to skip words within one passage.
2. You may shorten, tighten, reorder and join what ${who} said, and smooth the grammar of speech. You may not add an experience, feeling, event, opinion, number, name, comparison or conclusion ${who} did not express. A sentence that needs words ${who} never used is invented; cut it.
3. In a transcript, what other people said is context, never ${who}'s words. Never put it in ${who}'s mouth.
4. A sentence that claims nothing (a short transition such as "Here's the thing.") may have no quote. So may a closing question to the reader that asserts nothing.
5. If the sources do not hold enough of ${who}'s own words on the topic for a post of at least ${cfg.minWords} words, set supported to false, leave paragraphs empty, and write three to five questions ${who} could answer out loud in a few minutes that would give this post its material: ask for what happened, who was there, what changed, what ${who} learned. Plain words, one thing per question.
6. Follow the brand files on words, punctuation and claims. Write no sign-off: the engine adds one only if the brand sets it. No hashtags, no links, no emoji.

Shape: a first line that makes a club leader stop, short paragraphs of one to three sentences, ${cfg.minWords} to ${cfg.maxWords} words. Return only the JSON the schema asks for.`;
}

function topicText(post) {
  if (!post.topic) return 'No topic is set. Write about the strongest idea in the sources that the earlier posts below did not use.';
  const t = post.topic;
  return [`Title: ${t.title}`, t.body ? `What the brief asks for: ${t.body}` : null, t.anchor ? `The line it builds to: ${t.anchor}` : null,
    'The brief sets the topic. It is not a source: nothing in it is the founder\'s words unless the sources say it too.'].filter(Boolean).join('\n');
}

function founderRequest({ brandText, post, sourcesText, omitted = [], earlierQuotes = [], previous, findings = [], note, cfg }) {
  // The brand files lead, unchanged, so the provider can cache them.
  const parts = [
    brandText,
    `<sources founder="${cfg.name}">\n${sourcesText || '(none yet)'}\n</sources>`,
    ...(omitted.length ? [`Sources left out for length: ${omitted.join(', ')}.`] : []),
    `<topic>\n${topicText(post)}\n</topic>`,
    `<post when="${post.date}" channel="${post.channel}"/>`,
  ];
  if (earlierQuotes.length) parts.push(`<earlier_posts_used>\nEarlier founder posts were built on these quotes. Do not build this post on the same ones:\n${earlierQuotes.slice(-40).map((q) => `- "${q}"`).join('\n')}\n</earlier_posts_used>`);
  if (previous) parts.push(`<previous_version>\n${JSON.stringify({ paragraphs: previous.paragraphs }, null, 1)}\n</previous_version>`);
  if (note) parts.push(`<reviewer_note>\n${note}\n</reviewer_note>\nRevise the previous version as the note asks, under the same rules. If the sources do not hold what the note asks for, set supported to false and ask for it.`);
  if (findings.length) parts.push(`<checks_failed>\nThe previous version failed these checks. Fix every one; if a sentence cannot be sourced, cut it.\n${findings.map((f) => `- ${f}`).join('\n')}\n</checks_failed>`);
  return parts.join('\n\n');
}

/** The ledger fields a written post carries. */
function assemble(data, sources, cfg) {
  const byName = new Map(sources.map((s) => [s.name, s]));
  const paragraphs = (data.paragraphs || [])
    .map((p) => ({ sentences: (p.sentences || []).map((s) => ({ text: String(s.text).trim(), refs: s.refs || [] })).filter((s) => s.text) }))
    .filter((p) => p.sentences.length);
  const caption = assembleCaption(paragraphs, cfg.signOff);
  const used = [...new Set(paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.refs.map((r) => r.source))))];
  const first = paragraphs.length ? paragraphs[0].sentences[0].text : '';
  return {
    paragraphs,
    caption,
    postText: caption,
    headline: first,
    summary: data.summary || '',
    firstComment: null,
    sourceNote: `Restates the founder's own words in ${used.join(', ') || 'no source'}; each sentence carries its quotes.`,
    sources: used.map((n) => ({ name: n, sha256: (byName.get(n) || {}).sha256 || null })),
    depictsAssistant: false,
    interactionType: null,
    questions: [],
  };
}

/**
 * Writes one founder post: the model, the gates, and rewrites with the
 * findings. Returns { status: written | needs-source | failed, fields, data }.
 */
async function writeFounderPost({ provider, post, sources, config, brandDir, brandText, earlierQuotes = [], note, previous: start, log = () => {} }) {
  const cfg = founderConfig(config);
  const { text: sourcesText, omitted } = src.sourcesPrompt(sources, { maxChars: cfg.maxSourceChars, founderName: cfg.name });
  const rounds = 1 + ((config.maxRevisions && config.maxRevisions.post) ?? 2);
  let previous = start || null;
  let findings = [];
  let last = null;
  for (let round = 1; round <= rounds; round += 1) {
    const { data, usage } = await provider.generate({
      key: `founder-${post.id}`,
      system: founderSystem(cfg),
      user: founderRequest({ brandText, post, sourcesText, omitted, earlierQuotes, previous, findings, note, cfg }),
      schema: FOUNDER_SCHEMA,
      schemaName: 'founder_post',
    });
    if (!data.supported) {
      log({ step: 'founder', id: post.id, round, usage, supported: false });
      return { status: 'needs-source', data, fields: { status: 'needs-source', questions: (data.questions || []).slice(0, 5), understood: data.understood || '' } };
    }
    const fields = assemble(data, sources, cfg);
    const results = checkFounderPosts({ posts: [{ ...post, ...fields }], sources, config, brandDir });
    findings = findingsOf(results).get(post.id) || [];
    log({ step: 'founder', id: post.id, round, usage, failures: findings });
    last = { data, fields };
    if (!findings.length) return { status: 'written', data, fields: { ...fields, status: 'written', understood: data.understood || '' } };
    previous = data;
  }
  return { status: 'failed', data: last.data, fields: { ...last.fields, status: 'failed', findings } };
}

/* ------------------------------------------------------------------ *
 * Slots, topics, filling
 * ------------------------------------------------------------------ */

/** The founder slots of a batch that starts on `start`, each with its brief topic if one is due. */
function planFounder({ config, start, batchNo, briefs = [], priors = [] }) {
  const cfg = founderConfig(config);
  if (!cfg.enabled || !cfg.slots.length) return [];
  const nn = String(batchNo).padStart(2, '0');
  const slots = slotsFor({ cadence: { batchDays: (config.cadence && config.cadence.batchDays) || 14, slots: cfg.slots.map((s) => ({ ...s, channel: cfg.channel })) }, start, timeZone: config.timezone });
  const used = new Set(priors.flatMap((l) => l.founder || []).map((p) => p.briefItem).filter(Boolean));
  const items = briefs.flatMap((b) => (b.items || []).filter((it) => it.channel === 'founder').map((it) => ({ ...it, month: b.month })));
  return slots.map((s, i) => {
    const due = items
      .filter((it) => !used.has(it.id) && (!it.month || s.date.startsWith(it.month)) && (!it.week || !it.month || it.week <= weekOf(s.date)))
      .sort((a, b) => (a.week || 0) - (b.week || 0))[0];
    if (due) used.add(due.id);
    return {
      id: `b${nn}-f${i + 1}`,
      channel: cfg.channel,
      founderVoice: true,
      pillar: cfg.pillar,
      layout: 'text',
      date: s.date,
      dueAt: s.dueAt,
      briefItem: due ? due.id : null,
      topic: due ? { title: due.title, body: due.body || null, anchor: due.anchor || null } : null,
      status: 'planned',
    };
  });
}

/** Quotes earlier founder posts were built on. */
function earlierQuotesOf(ledgers) {
  return ledgers.flatMap((l) => l.founder || []).filter((p) => p.status === 'written')
    .flatMap((p) => flatSentences(p).flatMap((s) => (s.refs || []).map((r) => r.quote)));
}

/**
 * Writes the open founder slots of one ledger (changed in place). A slot is
 * tried when it is planned, or its sources changed since its last try (or
 * force), and it is at least minLeadHours away. Returns what happened.
 */
async function fillFounder({ ledger, config, brandDir, brandText = brandContext(brandDir), sources, provider, priors = [], now = Date.now(), force = false, log = () => {} }) {
  const cfg = founderConfig(config);
  const key = src.sourcesKey(sources);
  const result = { written: [], needsSource: [], failed: [], waiting: [], late: [], pending: [] };
  const earlier = earlierQuotesOf([...priors, ledger]);
  for (const post of ledger.founder || []) {
    if (post.status === 'written' || (post.buffer && post.buffer.id)) continue;
    if (Date.parse(post.dueAt) - now < cfg.minLeadHours * 3600000) { result.late.push(post.id); continue; }
    if (!force && post.status !== 'planned' && post.sourcesKey === key) { result.waiting.push(post.id); continue; }
    let r;
    try {
      r = await writeFounderPost({ provider, post, sources, config, brandDir, brandText, earlierQuotes: earlier, log });
    } catch (e) {
      // The agent provider: this slot waits for its answer, unchanged.
      if (!isPending(e)) throw e;
      result.pending.push(post.id);
      continue;
    }
    for (const k of ['paragraphs', 'caption', 'postText', 'headline', 'summary', 'sourceNote', 'sources', 'findings', 'questions']) delete post[k];
    Object.assign(post, r.fields, { sourcesKey: key, triedAt: new Date(now).toISOString(), draft: r.data });
    if (r.status === 'written') { result.written.push(post.id); earlier.push(...flatSentences(post).flatMap((s) => s.refs.map((x) => x.quote))); }
    else if (r.status === 'needs-source') result.needsSource.push(post.id);
    else result.failed.push(post.id);
  }
  return result;
}

/** What to ask the founder for, one message for every slot waiting on material. */
function askMessage(posts, config) {
  const cfg = founderConfig(config);
  const waiting = posts.filter((p) => p.status === 'needs-source' && p.questions && p.questions.length);
  if (!waiting.length) return null;
  const lines = [];
  for (const p of waiting) {
    lines.push(`${cfg.name}'s LinkedIn post for ${when(p.dueAt, config.timezone)}${p.topic ? ` ("${p.topic.title}")` : ''} needs ${cfg.name}'s own words first. Answer these out loud in a few minutes, on a phone, and drop the recording in the Drive folder Sources (or add it to sources/ in GitHub):`);
    p.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  }
  lines.push('The post is written only from what the recording says. Nothing is added; anything that cannot be sourced is cut.');
  return lines.join('\n');
}

/** What the failed slots need from a person. */
function failedMessage(posts, config) {
  const failed = posts.filter((p) => p.status === 'failed');
  if (!failed.length) return null;
  return [`${failed.length === 1 ? 'A founder post' : `${failed.length} founder posts`} could not be written within the source checks:`,
    ...failed.map((p) => `- ${when(p.dueAt, config.timezone)}${p.topic ? ` ("${p.topic.title}")` : ''}: ${(p.findings || [])[0] || 'see the ledger'}`),
    'More material on the topic usually fixes it.'].join('\n');
}

/* ------------------------------------------------------------------ *
 * A note on a founder draft (engine/buffer/sync.js)
 * ------------------------------------------------------------------ */

/**
 * Revises a founder draft from the reviewer's note: same writer, same gates,
 * the caption swapped in the same draft. A caption the founder edited in
 * Buffer is the founder's own words, so it joins the sources. Returns the
 * shape reviseFromNotes returns.
 */
async function reviseFounder(ctx, { post, ledger, notes, bufferPost, sources }) {
  const { config, brandDir, brandText, provider } = ctx;
  const cfg = founderConfig(config);
  const all = [...sources];
  if (post.buffer && post.buffer.captionEdited && (bufferPost || post.buffer.text)) {
    let edited = String((bufferPost ? bufferPost.text : post.buffer.text) || '').trim();
    if (cfg.signOff && edited.endsWith(cfg.signOff)) edited = edited.slice(0, -cfg.signOff.length).trim();
    const doc = { name: 'buffer-edit.md', kind: 'document', sha256: null, text: edited, turns: [{ speaker: null, founder: true, text: edited, tokens: src.tokens(edited) }] };
    doc.founderWords = doc.turns[0].tokens.length;
    all.push(doc);
  }
  const note = notes.map((n) => n.text).join('\n');
  const base = { understood: '', changed: [], warnings: [], lesson: null };
  const r = await writeFounderPost({ provider, post, sources: all, config, brandDir, brandText, note, previous: { paragraphs: post.paragraphs || [] }, log: ctx.log });
  base.understood = (r.data && r.data.understood) || '';
  if (r.status === 'needs-source') {
    return { ...base, applied: false, reason: `${cfg.name}'s recorded words do not cover what the note asks for. Record it and drop it in Sources, or edit the caption in Buffer${r.fields.questions.length ? ` (for example: ${r.fields.questions[0]})` : ''}` };
  }
  if (r.status === 'failed') return { ...base, applied: false, reason: `the rewrite kept failing the source checks: ${(r.fields.findings || []).slice(0, 2).join('; ')}` };
  const revised = { ...post, ...r.fields };
  const i = ledger.founder.indexOf(post);
  // Without Buffer (a change made by Codex in the repository), push.js --open swaps it in after the push.
  if (!ctx.buffer || !post.buffer || !post.buffer.id) {
    if (i >= 0) ledger.founder[i] = revised;
    return { ...base, applied: true, changed: ['caption'], post: revised };
  }
  const tagIds = [ctx.tagIds.engine, ctx.tagIds.revised].filter(Boolean);
  const edited = await ctx.buffer.editPost({ id: post.buffer.id, text: revised.postText, tagIds });
  revised.buffer = {
    ...post.buffer, text: String((edited && edited.text) || revised.postText).replace(/\r\n/g, '\n').trim(), sentText: revised.postText,
    tagRoles: ['engine', 'revised'], captionEdited: false, signature: contentSignature(revised),
  };
  if (i >= 0) ledger.founder[i] = revised;
  return { ...base, applied: true, changed: ['caption'], post: revised };
}

/**
 * Fills the open founder slots of every batch (or one) from the current
 * sources, tells the founder what is still needed, and drafts what was
 * written when push is set and the founder's channel is in Buffer. This is
 * what runs when new material lands (founder.yml, photos.yml).
 */
async function fillAll({ contentDir, brandDir, sourcesDir, config, provider, notifier, buffer, batch, force = false, push = false, now = Date.now(), log = () => {} }) {
  const cfg = founderConfig(config);
  const loaded = await src.loadSources({ dir: sourcesDir, provider, founderNames: cfg.names, model: cfg.transcribeModel, log });
  const out = { batches: [], problems: loaded.problems, untranscribed: loaded.untranscribed, drafted: [], notDrafted: null };
  const all = fs.existsSync(contentDir) ? fs.readdirSync(contentDir).filter((d) => /^batch-\d{2}$/.test(d)).sort() : [];
  const chosen = batch ? [`batch-${String(batch).padStart(2, '0')}`] : all;
  const brandText = brandContext(brandDir);
  const asks = [];
  const failed = [];
  const touched = [];
  for (const name of chosen) {
    const file = path.join(contentDir, name, 'ledger.json');
    if (!fs.existsSync(file)) continue;
    const ledger = read(file);
    if (!(ledger.founder || []).length) continue;
    const priors = all.filter((b) => b < name).map((b) => path.join(contentDir, b, 'ledger.json')).filter((f) => fs.existsSync(f)).map(read);
    const r = await fillFounder({ ledger, config, brandDir, brandText, sources: loaded.sources, provider, priors, now, force, log });
    const asking = ledger.founder.filter((p) => r.needsSource.includes(p.id));
    // Asked now if there is someone to tell; otherwise the push message asks.
    if (notifier) for (const p of asking) p.askedAt = new Date(now).toISOString();
    write(file, ledger);
    out.batches.push({ batch: name, ...r });
    asks.push(...asking);
    failed.push(...ledger.founder.filter((p) => r.failed.includes(p.id)));
    if (r.written.length) touched.push(Number(name.slice(6)));
  }
  // Codex cannot listen to audio: a voice memo needs its transcript as text.
  const recordings = loaded.untranscribed.map((f) => `${f} is a recording. Add its transcript as text to Sources (iPhone Voice Memos shows one under each recording; copy it into a note or a .txt file).`);
  out.problems = [...loaded.problems, ...recordings];
  const problems = out.problems.length ? `Material that could not be used:\n${out.problems.map((p) => `- ${p}`).join('\n')}` : null;
  for (const msg of [askMessage(asks, config), failedMessage(failed, config), problems]) if (msg && notifier) await notifier.send(msg);
  if (push && touched.length) {
    const { pushBatch, bufferConfig } = require('../buffer/push');
    const bc = bufferConfig(config);
    if (!bc.organizationId || !bc.channels[cfg.channel]) {
      out.notDrafted = `no Buffer ${bc.organizationId ? `channel for ${cfg.channel}` : 'organization'} in config.json`;
      return out;
    }
    for (const n of touched) {
      const r = await pushBatch({ batchNo: n, config, buffer, host: null, notifier, contentDir, sourcesDir, founderOnly: true, now });
      out.drafted.push(...r.drafted);
    }
  }
  return out;
}

module.exports = {
  founderConfig, planFounder, fillFounder, fillAll, writeFounderPost, reviseFounder, askMessage, failedMessage,
  founderRequest, founderSystem, assemble, earlierQuotesOf, FOUNDER_SCHEMA,
};

/* ------------------------------------------------------------------ *
 * Command line
 * ------------------------------------------------------------------ */

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = read(path.join(ws.dir, 'config.json'));
    if (!founderConfig(config).enabled) { console.log('Founder posts are off (config.json founder.enabled).'); return; }
    const overrides = {};
    if (arg('provider')) overrides.name = arg('provider');
    if (arg('mock-dir')) overrides.dir = arg('mock-dir');
    // Created on first use: a run with nothing to transcribe or write needs no key.
    let real = null;
    const get = () => real || (real = require('./providers').createProvider(config, overrides));
    const provider = { generate: (r) => get().generate(r), transcribe: (r) => get().transcribe(r) };
    const bc = require('../buffer/push').bufferConfig(config);
    const push = argv.includes('--push');
    const buffer = !push ? null : arg('buffer') === 'mock' ? require('../buffer/mock').createMockBuffer({ channels: bc.channels }) : require('../buffer/client').createBuffer({ apiKeyEnv: bc.apiKeyEnv });
    const r = await fillAll({
      contentDir: ws.contentDir, brandDir: ws.brandDir, sourcesDir: path.join(ws.dir, 'sources'), config, provider, buffer, push,
      notifier: require('../notify').createNotifier(config), batch: arg('batch'), force: argv.includes('--force'),
      log: (e) => {
        if (e.step === 'transcribe') console.log(`transcribed ${e.name}`);
        else if (e.step === 'founder') console.log(`${e.id} round ${e.round}: ${e.supported === false ? 'needs material' : e.failures.length ? `${e.failures.length} finding(s)` : 'passes'}`);
      },
    });
    for (const p of r.problems) console.log(`source problem: ${p}`);
    for (const b of r.batches) console.log(`${b.batch}: written ${b.written.length}, waiting for material ${b.needsSource.length + b.waiting.length}, failed ${b.failed.length}, too late ${b.late.length}`);
    if (push) console.log(r.notDrafted ? `Not drafted: ${r.notDrafted}.` : `${r.drafted.length} founder draft(s) in Buffer.`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
