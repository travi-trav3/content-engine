#!/usr/bin/env node
/**
 * brief.js
 *
 * Brief mode: the reviewer's own plan for a month (or a list of standing
 * ideas) steering what the engine writes, without taking over how. A brief
 * is a file in the workspace's briefs/ folder, as the reviewer wrote it:
 * Word (.docx), Markdown or plain text.
 *
 *   read      the model turns the document into structured items once
 *             (month, the month's story, weekly themes, creative rules, one
 *             item per post idea with its hook, beats, reveal, body and
 *             sources). The result is saved beside the source as
 *             <name>.json with the source's sha256, so it is read again only
 *             when the document changes, and a person can correct it.
 *   offer     a batch is offered the items whose week has started by the end
 *             of its window and that no earlier post has used. The planner
 *             must take at least brief.minShare of its posts from them
 *             (each at most once) and keeps each week on its theme.
 *   guard     the brief supplies ideas and the story; the engine still owns
 *             the format mix, the gates and the cadence. A brief that asks
 *             for twelve flip carousels gets its twelve ideas, in the
 *             layouts the rotation allows.
 *   report    which items each batch used, what is still open, what waits
 *             for another mode (founder posts need source mode; blog posts
 *             are not social posts), and what in the brief trips a gate
 *             before anyone writes from it (an unapproved number, a
 *             channel-versus-channel comparison).
 *
 *   node engine/generate/brief.js            read new or changed briefs and print their checks
 *   node engine/generate/brief.js --notify   and send the reviewer a summary of each one just read
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { workspace } = require('../lib/workspace');

const SOURCE_EXT = ['.md', '.txt', '.docx'];
const CHANNELS = ['instagram', 'linkedin_company', 'any', 'founder', 'blog'];
// Items the company planner can use; the others wait for their own mode.
const PLANNABLE = ['instagram', 'linkedin_company', 'any'];
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const postsOf = (l) => (Array.isArray(l) ? l : l.posts || []);

/* ------------------------------------------------------------------ *
 * Reading the source
 * ------------------------------------------------------------------ */

/** One file out of a zip archive (a .docx is one), without dependencies. */
function unzipEntry(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (entry === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`unsupported zip compression ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return XML_ENTITIES[e] ?? m;
});

/** The paragraphs of a Word document as plain text, one per line. */
function docxText(buf) {
  const xml = unzipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('no word/document.xml in the .docx');
  const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  return xml.toString('utf8').split(/<\/w:p>/).map((para) => {
    let line = '';
    for (const m of para.matchAll(token)) line += m[1] !== undefined ? unxml(m[1]) : m[0] === '<w:tab/>' ? '\t' : '\n';
    return line.trim();
  }).filter(Boolean).join('\n');
}

function sourceText(file) {
  const buf = fs.readFileSync(file);
  return { text: path.extname(file).toLowerCase() === '.docx' ? docxText(buf) : buf.toString('utf8'), sha: sha256(buf) };
}

/* ------------------------------------------------------------------ *
 * The structured brief
 * ------------------------------------------------------------------ */

const str = (d) => ({ type: 'string', description: d });
const nstr = (d) => ({ type: ['string', 'null'], description: d });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const BRIEF_SCHEMA = obj({
  title: str('The brief\'s title as written.'),
  month: nstr('YYYY-MM when the brief plans a month; null for standing ideas with no dates.'),
  narrative: str('The story the brief tells across its posts, in one or two sentences of its own words.'),
  cadence: nstr('Any posting cadence or channel mix the brief states, verbatim. Null if none.'),
  weeks: {
    type: 'array',
    description: 'The weekly arc, if the brief has one. Empty otherwise.',
    items: obj({ week: { type: 'integer' }, theme: str('The week\'s theme, as titled.'), idea: str('What the week says, in the brief\'s words.') }),
  },
  rules: { type: 'array', items: { type: 'string' }, description: 'Creative rules the brief sets for every post (structure, tests, signature closes), each in its words.' },
  items: {
    type: 'array',
    description: 'Every post idea in the brief, in order, none merged or dropped.',
    items: obj({
      ref: str('The idea\'s own label in the brief ("01", "Week 2", "Blog 1"), or its position if it has none.'),
      channel: { type: 'string', enum: CHANNELS, description: 'instagram, linkedin_company (the company page), founder (the founder\'s personal profile, in the founder\'s own voice), blog, or any.' },
      week: { type: ['integer', 'null'], description: 'The week it belongs to, if the brief places it; else null.' },
      title: str('The idea\'s title as written.'),
      hook: nstr('The opening line or question, as written.'),
      beats: { type: 'array', items: { type: 'string' }, description: 'The reveal sequence, list items or steps, each as written.' },
      reveal: nstr('The payoff line, as written.'),
      body: nstr('The body or caption copy the brief gives, as written.'),
      visual: nstr('The image or graphic idea, as written.'),
      tryAtYourClub: nstr('A technique for clubs to use with their own members, if the brief gives one.'),
      anchor: nstr('The anchor idea or belief the item serves, if named.'),
      sources: { type: 'array', items: { type: 'string' }, description: 'Every source or citation the item gives, as written.' },
    }),
  },
  successSignal: nstr('What the brief says success looks like, if it says.'),
});

const READ_SYSTEM = `You turn a content brief, written by the founder or marketing lead, into structured data. Copy the brief's own words; do not improve, summarize away or add ideas. Every post idea becomes one item, in order. Numbers and sources are copied exactly as written. Return only the JSON the schema asks for.`;

const shortChannel = { instagram: 'ig', linkedin_company: 'li', any: 'post', founder: 'founder', blog: 'blog' };
const slug = (s) => String(s).toLowerCase().replace(/^week\s*/, 'w').replace(/^blog\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

/** Gives every item a stable id: <brief name>/<channel>-<its own label>. */
function withIds(name, brief) {
  const seen = new Set();
  return {
    ...brief,
    items: brief.items.map((it, i) => {
      let id = `${name}/${shortChannel[it.channel] || 'post'}-${slug(it.ref || String(i + 1))}`;
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);
      return { ...it, id };
    }),
  };
}

/**
 * Every brief in dir, read. A source whose saved reading matches its hash is
 * not sent to the model again. Without a provider, a new or changed source
 * is reported, not read.
 */
async function loadBriefs({ dir = path.join(workspace().dir, 'briefs'), provider, log = () => {} } = {}) {
  if (!fs.existsSync(dir)) return { briefs: [], unread: [] };
  const briefs = [];
  const unread = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (!SOURCE_EXT.includes(ext) || f.startsWith('.') || /^readme/i.test(f)) continue;
    const name = path.basename(f, path.extname(f));
    const file = path.join(dir, f);
    const cache = path.join(dir, `${name}.json`);
    const { text, sha } = sourceText(file);
    if (fs.existsSync(cache)) {
      const saved = JSON.parse(fs.readFileSync(cache, 'utf8'));
      if (saved.sourceSha256 === sha) { briefs.push(saved); continue; }
    }
    if (!provider) { unread.push(f); continue; }
    const { data, usage } = await provider.generate({ key: `brief-${name}`, system: READ_SYSTEM, user: `<brief file="${f}">\n${text}\n</brief>`, schema: BRIEF_SCHEMA, schemaName: 'brief' });
    log({ step: 'brief', name, usage });
    const brief = { name, source: f, sourceSha256: sha, readAt: new Date().toISOString(), ...withIds(name, data) };
    fs.writeFileSync(cache, `${JSON.stringify(brief, null, 2)}\n`);
    briefs.push(brief);
  }
  return { briefs, unread };
}

/* ------------------------------------------------------------------ *
 * What a batch is offered
 * ------------------------------------------------------------------ */

/** The week of the month a date falls in: days 1-7 are week 1, 22 on is week 4 and after. */
const weekOf = (date) => Math.min(5, Math.ceil(Number(String(date).slice(8, 10)) / 7));

/** Brief item ids used by earlier posts. */
function usedItems(priors) {
  return new Map(priors.flatMap(postsOf).filter((p) => p.briefItem).map((p) => [p.briefItem, p.id]));
}

/**
 * The briefs that apply to a batch window, the items it may use, and the
 * prompt text for the planner. slots: the batch calendar (dates).
 */
function activeBrief({ briefs, slots, priors, config = {} }) {
  const start = slots[0].date;
  const end = slots[slots.length - 1].date;
  const used = usedItems(priors);
  const months = new Set([start.slice(0, 7), end.slice(0, 7)]);
  const applies = briefs.filter((b) => !b.month || months.has(b.month));
  const available = [];
  const setAside = [];
  const sections = [];
  for (const b of applies) {
    // The last week the window reaches in this brief's month.
    const inMonth = slots.map((s) => s.date).filter((d) => !b.month || d.startsWith(b.month));
    const lastWeek = b.month && inMonth.length ? weekOf(inMonth[inMonth.length - 1]) : 99;
    const firstWeek = b.month && inMonth.length ? weekOf(inMonth[0]) : 1;
    const offered = [];
    for (const it of b.items) {
      if (used.has(it.id)) continue;
      if (!PLANNABLE.includes(it.channel)) { setAside.push({ ...it, brief: b.name }); continue; }
      if (b.month && it.week && it.week > lastWeek) continue;
      offered.push(it);
    }
    available.push(...offered.map((it) => ({ ...it, brief: b.name, month: b.month })));
    const weeks = (b.weeks || []).filter((w) => !b.month || (w.week >= firstWeek && w.week <= lastWeek));
    sections.push([
      `<brief name="${b.name}" title="${b.title}"${b.month ? ` month="${b.month}"` : ''}>`,
      `The story: ${b.narrative}`,
      ...(weeks.length ? ['This batch falls in:', ...weeks.map((w) => `- Week ${w.week} (${weekDates(b.month, w.week)}): ${w.theme}. ${w.idea}`)] : []),
      ...((b.rules || []).length ? ['Creative rules from the brief:', ...b.rules.map((r) => `- ${r}`)] : []),
      'Ideas not yet used (id, week: title / hook / reveal):',
      ...(offered.length ? offered.map((it) => `- ${it.id}${it.week ? `, week ${it.week}` : ''}: ${it.title}${it.hook ? ` / ${it.hook}` : ''}${it.reveal ? ` / ${it.reveal}` : ''}`) : ['- none']),
      '</brief>',
    ].join('\n'));
  }
  const share = (config.brief && config.brief.minShare) ?? 0.3;
  const min = Math.min(available.length, Math.floor(slots.length * share));
  return { briefs: applies, available, setAside, min, text: sections.join('\n\n'), used };
}

function weekDates(month, week) {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = (week - 1) * 7 + 1;
  const to = week >= 4 ? last : week * 7;
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${name} ${from} to ${to}`;
}

/** Planner rules for a batch with a brief. */
function briefRules(active) {
  if (!active || !active.available.length) return [];
  return [
    `Brief: at least ${active.min} posts take their idea from a brief item (briefItem set to its id), each item at most once; other posts set briefItem null. A brief item's idea, hook and reveal carry into the post; its format does not: run it in whatever layout the batch's rotation needs (a flip idea works as a carousel, a question card, a numbered list or a type card).`,
    'Where the brief gives weekly themes, a post in a week serves that week\'s theme, and no post runs an idea from a later week.',
  ];
}

/** Engine checks on a plan's brief items. */
function briefChecks(entries, active) {
  if (!active) return [];
  const failures = [];
  const ids = new Map(active.available.map((it) => [it.id, it]));
  const seen = new Map();
  for (const e of entries) {
    if (!e.briefItem) continue;
    if (active.used.has(e.briefItem)) failures.push(`${e.id}: brief item ${e.briefItem} was already used by ${active.used.get(e.briefItem)}`);
    else if (!ids.has(e.briefItem)) failures.push(`${e.id}: "${e.briefItem}" is not a brief item this batch can use`);
    if (seen.has(e.briefItem)) failures.push(`${e.id}: brief item ${e.briefItem} is already used by ${seen.get(e.briefItem)} in this plan`);
    seen.set(e.briefItem, e.id);
    const it = ids.get(e.briefItem);
    if (it && it.month && it.week && String(e.date).startsWith(it.month) && it.week > weekOf(e.date)) {
      failures.push(`${e.id}: ${e.briefItem} belongs to week ${it.week} of the brief and ${e.date} is in week ${weekOf(e.date)}; move it to a later slot or pick an idea from this week or earlier`);
    }
  }
  const count = entries.filter((e) => e.briefItem && ids.has(e.briefItem)).length;
  if (count < active.min) failures.push(`${count} posts take their idea from the brief; this batch needs at least ${active.min}`);
  return failures;
}

/* ------------------------------------------------------------------ *
 * What in the brief trips a gate
 * ------------------------------------------------------------------ */

// Content rules: what the brief's ideas say. Layout and copy-editing rules
// (dashes, casing, length) are the writer's job, not the brief's.
const CONTENT_RULES = /^(stat\.|capability\.(lexicon\.blocked|lexicon\.attributedAction|integrationClaim)|brand\.(channelVersus|accusation|pressClaim|retiredLine|knownAbstraction|memberData))/;

function itemText(it) {
  return [it.title, it.hook, ...(it.beats || []), it.reveal, it.body, it.visual, it.tryAtYourClub].filter(Boolean).join('\n');
}

/** Each brief item run through the content gates before anyone writes from it. */
function checkBrief(brief, brandDir = workspace().brandDir) {
  const capability = require('../gates/capability-gate');
  const brandGate = require('../gates/brand-gate');
  const stat = require('../gates/stat-gate');
  const out = [];
  for (const it of brief.items) {
    const post = { id: it.id, pillar: 'Industry pulse', headline: it.title, caption: itemText(it), depictsAssistant: false, clubMarks: [] };
    const findings = [
      ...stat.checkBatch({ posts: [post] }).failures,
      ...capability.checkBatch({ posts: [post] }, brandDir).failures,
      ...brandGate.checkBatch({ posts: [post] }).failures,
    ].filter((f) => CONTENT_RULES.test(f.rule));
    const seen = new Set();
    for (const f of findings) {
      const key = `${f.rule}|${f.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: it.id, ref: it.ref, title: it.title, rule: f.rule, detail: f.detail });
    }
  }
  return out;
}

const firstSentence = (t) => (String(t).match(/^[^.]*\./) || [String(t)])[0];

/** Report lines: what the batch used, what is open, what waits, what trips a gate. */
function coverageReport({ active, entries, checks }) {
  if (!active || !active.briefs.length) return [];
  const lines = [];
  for (const b of active.briefs) {
    lines.push(`### ${b.title} (${b.source})`, '');
    if (b.cadence) lines.push(`The brief's cadence: ${b.cadence}. The engine posts on config.json's cadence; change it there if the brief's should win.`, '');
    const byId = new Map(b.items.map((it) => [it.id, it]));
    const label = (it) => `${it.ref}${it.week ? ` (week ${it.week})` : ''}`;
    const usedHere = entries.filter((e) => e.briefItem && byId.has(e.briefItem));
    const usedBefore = [...active.used].filter(([id]) => byId.has(id));
    const usedIds = new Set([...usedHere.map((e) => e.briefItem), ...usedBefore.map(([id]) => id)]);
    lines.push(usedHere.length ? 'Used in this batch:' : 'Used in this batch: none.');
    for (const e of usedHere) lines.push(`- ${e.id} (${e.layout}) <- ${byId.get(e.briefItem).ref} "${byId.get(e.briefItem).title}"`);
    if (usedBefore.length) lines.push(`Used before: ${usedBefore.map(([id, post]) => `${byId.get(id).ref} (${post})`).join(', ')}.`);
    const open = b.items.filter((it) => PLANNABLE.includes(it.channel) && !usedIds.has(it.id));
    lines.push(`Still open: ${open.length ? open.map(label).join(', ') : 'none'}.`);
    for (const ch of ['founder', 'blog']) {
      const list = b.items.filter((it) => it.channel === ch);
      if (!list.length) continue;
      lines.push(ch === 'founder'
        ? `For the founder's own LinkedIn (written from the founder's own material, in source mode): ${list.map((it) => `"${it.title}"`).join(', ')}.`
        : `Blog posts (not social posts; outside the engine): ${list.map((it) => `"${it.title}"`).join(', ')}.`);
    }
    const found = (checks || []).filter((c) => byId.has(c.id));
    if (found.length) {
      lines.push('', 'In the brief itself, before anyone writes from it. The engine writes these ideas without the part that trips the check, unless the brand files change:');
      for (const id of [...new Set(found.map((c) => c.id))]) {
        const it = byId.get(id);
        const mine = found.filter((c) => c.id === id);
        const numbers = mine.filter((c) => c.rule === 'stat.unapprovedNumeral').map((c) => (/^"([^"]+)"/.exec(c.detail) || [])[1]).filter(Boolean);
        if (numbers.length) lines.push(`- ${it.ref} "${it.title}": numbers not in approved-stats.json: ${numbers.join(', ')}. Add them with their sources, or the posts leave them out (stat.unapprovedNumeral).`);
        for (const c of mine.filter((x) => x.rule !== 'stat.unapprovedNumeral')) lines.push(`- ${it.ref} "${it.title}": ${firstSentence(c.detail)} (${c.rule})`);
      }
    }
    lines.push('');
  }
  return lines;
}

/** A short message about a brief just read: what the engine will use and what trips a check. */
function briefSummary(b, checks) {
  const count = (ch) => b.items.filter((it) => it.channel === ch).length;
  const engine = b.items.filter((it) => PLANNABLE.includes(it.channel)).length;
  const lines = [`Read "${b.title}" (${b.source})${b.month ? ` for ${b.month}` : ''}: ${engine} ideas for the engine${count('founder') ? `, ${count('founder')} for the founder's own LinkedIn (source mode)` : ''}${count('blog') ? `, ${count('blog')} blog posts (outside the engine)` : ''}.`];
  if (b.weeks && b.weeks.length) lines.push(`Weekly themes: ${b.weeks.map((w) => `${w.week} ${w.theme}`).join('; ')}.`);
  if (b.cadence) lines.push(`Its cadence (${b.cadence}) is not the engine's; the engine keeps config.json's.`);
  if (checks.length) {
    lines.push('Before anyone writes from it:');
    for (const id of [...new Set(checks.map((c) => c.id))]) {
      const mine = checks.filter((c) => c.id === id);
      const numbers = mine.filter((c) => c.rule === 'stat.unapprovedNumeral').map((c) => (/^"([^"]+)"/.exec(c.detail) || [])[1]).filter(Boolean);
      const other = mine.filter((c) => c.rule !== 'stat.unapprovedNumeral').map((c) => firstSentence(c.detail));
      lines.push(`- ${mine[0].ref} "${mine[0].title}": ${[numbers.length ? `numbers without an approved source (${numbers.join(', ')})` : '', ...other].filter(Boolean).join('; ')}`);
    }
    lines.push('The posts keep these ideas and leave out what trips the check, unless the brand files change.');
  } else {
    lines.push('Nothing in it trips a check.');
  }
  return lines.join('\n');
}

module.exports = {
  loadBriefs, activeBrief, briefRules, briefChecks, checkBrief, coverageReport, briefSummary, usedItems,
  docxText, unzipEntry, sourceText, withIds, weekOf, weekDates, BRIEF_SCHEMA, PLANNABLE,
};

if (require.main === module) {
  (async () => {
    const ws = workspace();
    const config = JSON.parse(fs.readFileSync(path.join(ws.dir, 'config.json'), 'utf8'));
    const { createProvider } = require('./providers');
    const argv = process.argv.slice(2);
    const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
    const overrides = {};
    if (arg('provider')) overrides.name = arg('provider');
    if (arg('mock-dir')) overrides.dir = arg('mock-dir');
    // Created on first use: a brief already read needs no key.
    let provider = null;
    const lazy = { generate: (req) => (provider || (provider = createProvider(config, overrides))).generate(req) };
    const fresh = [];
    const { briefs, unread } = await loadBriefs({ provider: lazy, log: (e) => fresh.push(e.name) });
    const notifier = argv.includes('--notify') ? require('../notify').createNotifier(config) : null;
    for (const b of briefs) {
      const text = briefSummary(b, checkBrief(b, ws.brandDir));
      console.log(`${text}\n`);
      if (notifier && fresh.includes(b.name)) await notifier.send(text);
    }
    for (const f of unread) console.log(`${f}: not read (no provider)`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
