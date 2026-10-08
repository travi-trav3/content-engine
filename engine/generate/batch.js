#!/usr/bin/env node
/**
 * batch.js
 *
 * Generates one batch, end to end, into content/batch-NN/:
 *
 *   1. plan      the model fills the calendar; plan gate, rotation rules and
 *                engine checks; revise until it passes (plan.json)
 *   2. write     each post's props, caption, first comment and alt text;
 *                photos picked from the library; props validated
 *   3. gates     every ledger gate; a post that fails is rewritten with the
 *                findings, then the gates run again
 *   4. render    each post at its channel's size; a render issue (overflow, a
 *                lone word) sends the post back for a rewrite
 *   5. record    ledger.json, a contact sheet, and report.md for the operator
 *
 * Renders go to .staging/batch-NN/ (not committed); publishing them to the
 * assets repository and drafting them in Buffer are separate steps.
 *
 *   node engine/generate/batch.js [--start YYYY-MM-DD] [--batch NN] [--resume]
 *                                 [--provider codex|agent|openai|mock] [--mock-dir DIR]
 *                                 [--plan-only] [--if-due DAYS]
 *
 * With the agent provider the run stops at the end of a stage whose model
 * calls have no answer yet (exit 3, the open requests listed); --resume picks
 * the unfinished batch up again with every earlier answer replayed.
 *
 * --if-due DAYS generates only when the last planned post is fewer than DAYS
 * days away, so a weekly schedule makes a batch every other week, a week
 * before it starts (GitHub Actions cron cannot say "every two weeks").
 *
 * Exit 0: every gate passed and every render is clean, or no batch was due.
 * Exit 1: the batch needs a person (see report.md). Exit 2: the run itself
 * failed. Exit 3: waiting for answers. Nothing is ever scheduled from here.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { workspace } = require('../lib/workspace');
const photoLib = require('../photos/library');
const { createRenderer } = require('../render/render');
const { contactSheet } = require('../render/contact-sheet');
const { checkAll, priorLedgers } = require('../gates/check-batch');
const { createProvider } = require('./providers');
const { loadCatalog, propsSummary } = require('./catalog');
const { brandContext } = require('./context');
const { slotsFor, nextMonday, addDays } = require('./slots');
const { makePlan } = require('./plan');
const { writePost, coverPhotoSpec } = require('./write');
const { assignVariants, assignEndCards, validateLibrary } = require('./cta');
const { ledgerEntry } = require('./ledger');
const feedbackLog = require('../feedback/log');
const briefMode = require('./brief');
const founder = require('./founder');
const { isPending } = require('./providers/agent');
const { loadSources } = require('./sources');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const today = (now) => new Date(now).toISOString().slice(0, 10);
const postsOf = (l) => (Array.isArray(l) ? l : l.posts || []);

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) throw new Error(`${file} not found`);
  return read(file);
}

function nextBatchNo(contentDir) {
  const nums = fs.existsSync(contentDir)
    ? fs.readdirSync(contentDir).map((d) => /^batch-(\d{2})$/.exec(d)).filter(Boolean).map((m) => Number(m[1]))
    : [];
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** The Monday after both today and the last scheduled post. */
function defaultStart(priors, now) {
  const last = priors.flatMap(postsOf).map((p) => String(p.dueAt || p.date || '').slice(0, 10)).filter(Boolean).sort().pop();
  const floor = [addDays(today(now), 1), last ? addDays(last, 1) : null].filter(Boolean).sort().pop();
  return nextMonday(floor);
}

function factIdsOf(brandDir) {
  const file = path.join(brandDir, 'club-operations-facts.md');
  if (!fs.existsSync(file)) return [];
  return [...fs.readFileSync(file, 'utf8').matchAll(/^### +([a-z0-9-]+)/gm)].map((m) => m[1]);
}

/** Render findings, phrased as instructions the writer can act on. */
function renderFeedback(issues) {
  const hint = {
    'render.overflow': 'The copy does not fit even at the smallest type size. Shorten the text in that element.',
    'render.singleWordLine': 'A line holds a single word. Reword so every line carries at least two words.',
    'render.offCanvas': 'Text runs off the canvas. Shorten it.',
    'render.photoTooSmall': 'The photo is too small for this layout. Ask for a different photo.',
  };
  return issues.map((i) => `${i.rule}: ${i.detail} ${hint[i.rule] || ''}`.trim());
}

/** A plan entry plus what the writer needs: the loaded layout, photo props, fixed props, menu text. */
function workEntry(e, i, byLayout, brand) {
  if (e.layout === 'carousel') {
    return {
      ...e,
      slotIndex: i,
      layoutModule: null,
      photoProps: e.renderSurface === 'photo' ? [coverPhotoSpec()] : [],
      fixed: [],
      layoutInfo: `carousel (${e.carouselKind}, about ${e.slideCount} slides): cover, inner slides, ${e.carouselKind === 'reveal-flip' ? 'the reveal, ' : ''}and the close. Limits are in the schema descriptions.`,
    };
  }
  const c = byLayout.get(e.layout);
  return {
    ...e,
    slotIndex: i,
    layoutModule: c.layout,
    photoProps: c.photoProps,
    fixed: 'sender' in c.layout.props && e.sender ? ['sender'] : [],
    layoutInfo: [`${c.id}: ${c.description}`, ...propsSummary(c.layout, brand).map((l) => `- ${l}`)].join('\n'),
  };
}

/**
 * Gate failures grouped by post. A carousel slide's finding names the slide
 * ("<id> (slide 6)"); it goes back to its post, with the slide named, so
 * the writer can fix it. Batch-level findings are left out.
 */
function findingsByPost(gates, ids) {
  const out = new Map();
  for (const g of gates) {
    for (const f of g.failures) {
      const slide = /^(.*) \(slide (\d+)\)$/.exec(String(f.id));
      const id = slide ? slide[1] : f.id;
      if (!ids.includes(id)) continue;
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(`${slide ? `slide ${slide[2]}: ` : ''}${f.rule}: ${f.detail}`);
    }
  }
  return out;
}

/** The latest batch with no ledger yet: a run that stopped part way. */
function unfinishedBatch(contentDir) {
  if (!fs.existsSync(contentDir)) return null;
  const nums = fs.readdirSync(contentDir).map((d) => /^batch-(\d{2})$/.exec(d)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  const last = nums.pop();
  if (!last) return null;
  return fs.existsSync(path.join(contentDir, `batch-${String(last).padStart(2, '0')}`, 'ledger.json')) ? null : last;
}

const waitingOn = (provider) => Boolean(provider && provider.pending && provider.pending.length);

/** The run stops: answers are missing. report.md says which, and how to go on. */
function waiting(result, provider, stage, batchDir) {
  Object.assign(result, { stage: 'waiting', waitingAt: stage, ok: false, waiting: provider.pending.slice() });
  const lines = [`# ${result.batch}: waiting for answers`, '', `Window: ${result.window}. Stopped at: ${stage}.`, '',
    `${result.waiting.length} request${result.waiting.length === 1 ? '' : 's'} need an answer. Write each one's answer where its file says, then run the same command again; answered requests replay and the run continues.`, '',
    ...result.waiting.map((w) => `- ${w.request}${w.reason ? ` (${w.reason})` : ''}`), ''];
  fs.writeFileSync(path.join(batchDir, 'report.md'), `${lines.join('\n')}`);
  return result;
}

async function runBatch(opts = {}) {
  const now = opts.now || Date.now();
  const ws = workspace();
  const config = opts.config || loadConfig(ws.dir);
  const contentDir = opts.contentDir || ws.contentDir;
  const stagingRoot = opts.stagingDir || path.join(ws.root, '.staging');
  const brandDir = ws.brandDir;
  const brand = read(path.join(brandDir, 'render.json'));
  const ownLibrary = opts.library || photoLib.load();
  const provider = opts.provider || createProvider(config);
  const log = opts.log || (() => {});
  const events = [];
  const note = (e) => { events.push(e); log(e); };

  const libraryErrors = validateLibrary(config);
  if (libraryErrors.length) throw new Error(`config.json cta library: ${libraryErrors.join('; ')}`);
  // A run that stopped to wait for answers (the agent provider) is picked up
  // where it left off: same batch, same window, earlier answers replayed.
  const batchNo = opts.batchNo || (opts.resume && unfinishedBatch(contentDir)) || nextBatchNo(contentDir);
  const nn = String(batchNo).padStart(2, '0');
  const priors = priorLedgers(contentDir, `batch-${nn}`);
  // Photos the earlier batches used count against the 30-day reuse window.
  const library = photoLib.withLedgerUsage(ownLibrary, priors);
  const start = opts.start || defaultStart(priors, now);
  const slots = slotsFor({ cadence: config.cadence, start, timeZone: config.timezone });
  const catalog = loadCatalog({ brand, library, config });
  const byLayout = new Map(catalog.map((c) => [c.id, c]));
  const demoClubs = read(path.join(brandDir, 'demo-clubs.json')).clubs.map((c) => c.name);
  // How the reviewer received recent drafts (feedback/log.jsonl, written by sync).
  const reviewerFeedback = opts.reviewerFeedback ?? feedbackLog.summary(feedbackLog.load(opts.feedbackFile),
    { reviewer: (config.buffer && config.buffer.reviewerName) || 'The reviewer' });
  const batchDir = path.join(contentDir, `batch-${nn}`);
  const stagingDir = path.join(stagingRoot, `batch-${nn}`);
  fs.mkdirSync(batchDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  const window = `${slots[0].date} to ${slots[slots.length - 1].date}`;
  const result = { batch: `batch-${nn}`, window, dir: batchDir, stage: 'plan', ok: false };

  /* -- the brief: the reviewer's own plan for the month, if any ------- */
  const briefsDir = opts.briefsDir || path.join(ws.dir, 'briefs');
  const { briefs, unread } = await briefMode.loadBriefs({ dir: briefsDir, provider, log: note });
  if (waitingOn(provider)) return waiting(result, provider, 'brief', batchDir);
  const brief = briefs.length ? briefMode.activeBrief({ briefs, slots, priors, config }) : null;
  const briefFindings = brief ? brief.briefs.flatMap((b) => briefMode.checkBrief(b, brandDir)) : [];
  result.brief = { unread, active: brief ? brief.briefs.map((b) => b.name) : [] };

  /* -- 1. plan ------------------------------------------------------- */
  let plan;
  try {
    plan = await makePlan({
      provider, brandDir, brand, config, catalog, library, lib: photoLib, slots, priors, batchNo,
      plannedOn: today(now), demoClubs, factIds: factIdsOf(brandDir), reviewerFeedback, brief, log: note,
    });
  } catch (e) {
    if (!isPending(e)) throw e;
    return waiting(result, provider, 'plan', batchDir);
  }
  if (!plan.failures.length) {
    assignVariants(plan.entries, priors, config);
    assignEndCards(plan.entries, priors, config);
  }
  const planDoc = {
    batch: `${config.brand || brand.name} batch ${nn}`,
    window,
    review: config.review || 'buffer-drafts',
    plannedBy: `engine (${provider.name}${provider.model ? ` ${provider.model}` : ''}), ${today(now)}`,
    posts: plan.entries,
  };
  fs.writeFileSync(path.join(batchDir, 'plan.json'), `${JSON.stringify(planDoc, null, 2)}\n`);
  const briefReport = briefMode.coverageReport({ active: brief, entries: plan.entries, checks: briefFindings });
  if (plan.failures.length) {
    result.failures = plan.failures;
    writeReport({ result, planDoc, ledger: null, gates: null, events, batchDir, briefReport });
    return result;
  }
  if (opts.planOnly || config.review === 'plan-approval') {
    result.stage = config.review === 'plan-approval' ? 'awaiting-plan-approval' : 'planned';
    result.ok = true;
    writeReport({ result, planDoc, ledger: null, gates: null, events, batchDir, briefReport });
    return result;
  }

  /* -- 2. write ------------------------------------------------------ */
  result.stage = 'write';
  const brandText = brandContext(brandDir);
  const briefItems = new Map((brief ? brief.available : []).map((it) => [it.id, it]));
  const work = plan.entries.map((e, i) => {
    const w = workEntry(e, i, byLayout, brand);
    const item = e.briefItem && briefItems.get(e.briefItem);
    if (item) w.briefDetail = { item, rules: (brief.briefs.find((b) => b.name === item.brief) || {}).rules || [] };
    return w;
  });
  const written = new Map();
  const usedBy = new Map();
  const usedPhotos = (exceptId) => [...usedBy].filter(([id]) => id !== exceptId).flatMap(([, ps]) => ps);
  const write = async (w, feedback) => {
    const prev = written.get(w.id);
    const r = await writePost({
      provider, entry: w, brand, brandDir, config, lib: photoLib, library, brandText, reviewerFeedback,
      usedPhotos: usedPhotos(w.id), feedback, previous: prev && prev.raw, log: note,
    });
    written.set(w.id, r);
    usedBy.set(w.id, r.post.photos);
    return r;
  };
  for (const w of work) {
    try {
      await write(w);
    } catch (e) {
      // Every post's request is written before the run stops, so the agent answers them together.
      if (!isPending(e)) throw e;
    }
  }
  if (waitingOn(provider)) return waiting(result, provider, 'write', batchDir);

  /* -- 3 + 4. gates and renders, rewriting what fails ---------------- */
  const renders = new Map();
  const assemble = () => work.map((w, i) => ledgerEntry({
    index: i, entry: w, layout: w.layoutModule, post: written.get(w.id).post,
    render: renders.get(w.id), size: (config.channels[w.channel] || {}).size || 'ig', batchNo,
    draft: written.get(w.id).raw,
  }));
  const renderer = await createRenderer();
  let gates = null;
  try {
    const rounds = 1 + ((config.maxRevisions && config.maxRevisions.post) ?? 2);
    for (let round = 1; round <= rounds; round += 1) {
      result.stage = 'gates';
      const failing = new Map();
      for (const w of work) {
        const wr = written.get(w.id);
        if (wr.failures.length) failing.set(w.id, [...wr.failures]);
      }
      gates = checkAll({ plan: planDoc, ledger: { posts: assemble() }, priors, brandDir });
      for (const [id, found] of findingsByPost(gates, work.map((w) => w.id))) {
        if (!failing.has(id)) failing.set(id, []);
        failing.get(id).push(...found);
      }
      result.stage = 'render';
      for (const w of work) {
        if (failing.has(w.id) || renders.has(w.id)) continue;
        const wr = written.get(w.id);
        const size = (config.channels[w.channel] || {}).size || 'ig';
        if (wr.post.slides) {
          const results = [];
          const issues = [];
          for (const sl of wr.post.slides) {
            const r = await renderer.render({
              layout: sl.layout, surface: sl.surface, size, props: sl.props, slide: sl.slide, library,
              out: path.join(stagingDir, `${w.id}-${String(sl.slide.index).padStart(2, '0')}.png`),
            });
            results.push(r);
            for (const i of r.issues) issues.push({ ...i, detail: `slide ${sl.slide.index} (${sl.layout}): ${i.detail}` });
          }
          note({ step: 'render', id: w.id, issues: issues.map((i) => i.rule) });
          if (issues.length) failing.set(w.id, renderFeedback(issues));
          else renders.set(w.id, results);
          continue;
        }
        const r = await renderer.render({
          layout: w.layout, surface: w.renderSurface, size, props: wr.post.props, library,
          out: path.join(stagingDir, `${w.id}.png`),
        });
        note({ step: 'render', id: w.id, issues: r.issues.map((i) => i.rule) });
        if (r.issues.length) failing.set(w.id, renderFeedback(r.issues));
        else renders.set(w.id, r);
      }
      if (!failing.size) break;
      if (round === rounds) {
        result.unresolved = Object.fromEntries(failing);
        break;
      }
      for (const [id, feedback] of failing) {
        const w = work.find((x) => x.id === id);
        if (!w) continue;
        renders.delete(id);
        try {
          await write(w, feedback);
        } catch (e) {
          if (!isPending(e)) throw e;
        }
      }
      if (waitingOn(provider)) break;
    }
  } finally {
    await renderer.close();
  }
  if (waitingOn(provider)) return waiting(result, provider, 'rewrite', batchDir);

  /* -- 5. record ----------------------------------------------------- */
  const ledger = {
    batch: planDoc.batch,
    window,
    plan: `content/batch-${nn}/plan.json`,
    review: planDoc.review,
    generatedBy: planDoc.plannedBy,
    posts: assemble(),
  };
  gates = checkAll({ plan: planDoc, ledger, priors, brandDir });
  fs.writeFileSync(path.join(batchDir, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);

  /* -- 6. founder posts, from the founder's own words ----------------- */
  const fc = founder.founderConfig(config);
  if (fc.enabled) {
    result.stage = 'founder';
    ledger.founder = founder.planFounder({ config, start, batchNo, briefs, priors });
    const loaded = await loadSources({ dir: opts.sourcesDir || path.join(ws.dir, 'sources'), provider, founderNames: fc.names, model: fc.transcribeModel, log: note });
    const fr = await founder.fillFounder({ ledger, config, brandDir, brandText, sources: loaded.sources, provider, priors, now, log: note });
    result.founder = { ...fr, problems: loaded.problems, untranscribed: loaded.untranscribed };
    fs.writeFileSync(path.join(batchDir, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
    // Founder slots waiting on answers stay planned; the routine's founder step finishes them.
    if (waitingOn(provider)) result.waiting = provider.pending.slice();
  }
  const files = work.filter((w) => renders.has(w.id)).flatMap((w) => {
    const post = written.get(w.id).post;
    return post.slides
      ? post.slides.map((sl) => path.join(stagingDir, `${w.id}-${String(sl.slide.index).padStart(2, '0')}.png`))
      : [path.join(stagingDir, `${w.id}.png`)];
  });
  if (files.length) {
    const sheetPng = path.join(stagingDir, 'contact-sheet.png');
    await contactSheet(files, { out: sheetPng, columns: 5, tileWidth: 360 });
    await sharp(sheetPng).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(batchDir, 'contact-sheet.jpg'));
  }
  result.stage = 'done';
  result.ok = gates.every((g) => g.pass) && ledger.posts.every((p) => p.status === 'rendered');
  result.renders = files;
  writeReport({ result, planDoc, ledger, gates, events, batchDir, briefReport });
  return result;
}

function writeReport({ result, planDoc, ledger, gates, events, batchDir, briefReport = [] }) {
  const lines = [`# ${planDoc.batch}`, '', `Window: ${planDoc.window}. Review: ${planDoc.review}. ${planDoc.plannedBy}.`, ''];
  const verdict = {
    plan: 'The plan did not pass its checks after every revision. Nothing was written.',
    planned: 'Plan written; posts not generated (--plan-only).',
    'awaiting-plan-approval': 'Plan written. It waits for a person to set approvedBy on each entry before posts are generated.',
    done: result.ok ? 'Every gate passed and every render is clean. The drafts are ready for review.' : 'Some posts need a person. See below.',
  }[result.stage] || `Stopped at ${result.stage}.`;
  lines.push(`**${verdict}**`, '');
  if (result.failures && result.failures.length) {
    lines.push('## Plan failures', '', ...result.failures.map((f) => `- ${f}`), '');
  }
  const posts = ledger ? ledger.posts : planDoc.posts;
  lines.push('## Posts', '', '| # | Date | Channel | Pillar | Layout | Headline | Photo | Ask | Status |', '|---|---|---|---|---|---|---|---|---|');
  posts.forEach((p, i) => {
    const photo = p.photoMatch ? `${p.photoMatch.id}${p.photoMatch.dropped.length ? ` (dropped ${p.photoMatch.dropped.join(', ')})` : ''}` : '';
    const head = (p.headline || p.message || '').replace(/\|/g, '/');
    const shape = p.layout === 'carousel' ? `carousel, ${p.carouselKind}, ${p.slides ? p.slides.length : p.slideCount} slides` : p.layout;
    lines.push(`| ${i + 1} | ${String(p.dueAt || p.date).slice(0, 16).replace('T', ' ')} | ${p.channel} | ${p.pillar} | ${shape} (${p.renderSurface}) | ${head} | ${photo} | ${p.ctaVariant || (p.endCard ? `end card: ${p.endCard}` : '')} | ${p.status || 'planned'} |`);
  });
  lines.push('');
  if (briefReport.length || (result.brief && result.brief.unread && result.brief.unread.length)) {
    lines.push('## Brief', '');
    if (result.brief && result.brief.unread && result.brief.unread.length) lines.push(`Not read (no provider): ${result.brief.unread.join(', ')}`, '');
    lines.push(...briefReport);
  }
  if (ledger && ledger.founder && ledger.founder.length) {
    lines.push('## Founder posts', '', 'Written only from the founder\'s own words in sources/; each sentence carries its quotes in ledger.json.', '',
      '| # | Date | Topic | Status | First line, or what is needed |', '|---|---|---|---|---|');
    for (const p of ledger.founder) {
      const what = p.status === 'written' ? p.headline
        : p.status === 'needs-source' ? `Needs the founder's words: ${(p.questions || []).join(' / ') || 'no material yet'}`
          : p.status === 'failed' ? `Failed the source checks: ${(p.findings || [])[0] || ''}` : 'not tried (too close to its time)';
      lines.push(`| ${p.id} | ${String(p.dueAt).slice(0, 16).replace('T', ' ')} | ${p.topic ? p.topic.title : 'from the sources'} | ${p.status} | ${String(what).replace(/\|/g, '/')} |`);
    }
    const f = result.founder || {};
    if ((f.problems || []).length || (f.untranscribed || []).length) {
      lines.push('', ...(f.problems || []).map((x) => `- ${x}`), ...(f.untranscribed || []).map((x) => `- ${x} is not transcribed yet (no provider).`));
    }
    lines.push('');
  }
  if (result.unresolved) {
    lines.push('## Needs a person', '', 'These posts still failed after every rewrite. Fix the copy in ledger.json and re-run, or drop the post.', '');
    for (const [id, f] of Object.entries(result.unresolved)) lines.push(`- **${id}**`, ...f.map((x) => `  - ${x}`));
    lines.push('');
  }
  if (gates) {
    lines.push('## Gates', '');
    for (const g of gates) lines.push(`- ${g.pass ? 'pass' : '**FAIL**'} ${g.label}${g.warnings.length ? ` (${g.warnings.length} warning${g.warnings.length > 1 ? 's' : ''})` : ''}`);
    const warnings = gates.flatMap((g) => g.warnings.map((w) => `${w.id} ${w.rule}: ${w.detail}`));
    if (warnings.length) lines.push('', '### Warnings for the reviewer', '', ...warnings.map((w) => `- ${w}`));
    lines.push('');
  }
  const usage = events.filter((e) => e.usage).reduce((a, e) => ({
    calls: a.calls + 1, input: a.input + e.usage.input, cached: a.cached + e.usage.cachedInput, output: a.output + e.usage.output,
  }), { calls: 0, input: 0, cached: 0, output: 0 });
  const rewrites = events.filter((e) => e.step === 'write' && e.round > 1).length
    + Math.max(0, events.filter((e) => e.step === 'write').length - posts.length);
  lines.push('## Run', '', `${usage.calls} model calls; ${usage.input} input tokens (${usage.cached} cached), ${usage.output} output tokens. Plan rounds: ${events.filter((e) => e.step === 'plan' && e.usage).length}. Post rewrites: ${Math.max(0, rewrites)}.`, '');
  fs.writeFileSync(path.join(batchDir, 'report.md'), `${lines.join('\n')}\n`);
}

/** Whether a new batch is due: the last planned post is fewer than `days` days from now. */
function batchDue(priors, now, days) {
  const last = priors.flatMap(postsOf).map((p) => Date.parse(p.dueAt || `${p.date}T12:00:00Z`)).filter(Number.isFinite).sort((a, b) => a - b).pop();
  return { due: !last || last - now < days * 86400000, last: last ? new Date(last).toISOString() : null };
}

module.exports = { runBatch, defaultStart, nextBatchNo, unfinishedBatch, renderFeedback, workEntry, findingsByPost, batchDue };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  const overrides = {};
  if (arg('provider')) overrides.name = arg('provider');
  if (arg('mock-dir')) overrides.dir = arg('mock-dir');
  (async () => {
    const config = loadConfig(workspace().dir);
    if (arg('if-due')) {
      const { due, last } = batchDue(priorLedgers(workspace().contentDir), Date.now(), Number(arg('if-due')));
      if (!due) {
        console.log(`No batch due: the last planned post is ${last}, more than ${arg('if-due')} days out.`);
        process.exit(0);
      }
    }
    const r = await runBatch({
      config,
      provider: Object.keys(overrides).length ? createProvider(config, overrides) : undefined,
      start: arg('start'),
      batchNo: arg('batch') ? Number(arg('batch')) : undefined,
      planOnly: argv.includes('--plan-only'),
      resume: argv.includes('--resume'),
      log: (e) => {
        if (e.failures && e.failures.length) console.log(`${e.step}${e.id ? ` ${e.id}` : ''} round ${e.round}: ${e.failures.length} failure(s)`);
        else if (e.step === 'render') console.log(`render ${e.id}: ${e.issues.length ? e.issues.join(', ') : 'clean'}`);
      },
    });
    if (r.waiting && r.waiting.length) {
      console.log(`\n${r.batch} (${r.window}): waiting for ${r.waiting.length} answer(s):`);
      for (const w of r.waiting) console.log(`  ${w.request}${w.reason ? `  (${w.reason})` : ''}`);
      console.log('Answer them, then run the same command again.');
      process.exit(3);
    }
    console.log(`\n${r.batch} (${r.window}): ${r.stage}, ${r.ok ? 'ready for review' : 'needs a person'}. See ${path.relative(process.cwd(), path.join(r.dir, 'report.md'))}`);
    process.exit(r.ok ? 0 : 1);
  })().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
}
