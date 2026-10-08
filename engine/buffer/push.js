#!/usr/bin/env node
/**
 * push.js
 *
 * Puts a generated batch into Buffer as drafts: each clean post's renders
 * published to the assets host, then one draft per post at its planned time,
 * with its caption (the engine's CTA line included), first comment, alt
 * text and the engine's tag. Nothing is scheduled; Byron schedules a draft
 * to approve it.
 *
 * A post is drafted only when it rendered clean and fails no gate of its
 * own. Posts whose slot has passed, or whose channel has no Buffer channel
 * yet (config.json buffer.channels), are skipped and reported. The ledger
 * records each draft as it is made (post.buffer), so a run that stops part
 * way resumes where it left off and never drafts a post twice.
 *
 *   node engine/buffer/push.js --batch 07 [--buffer mock] [--assets mock] [--dry-run]
 *   node engine/buffer/push.js --latest      the newest batch that has a ledger
 *   node engine/buffer/push.js --open        every batch: draft what is ready, update drafts
 *                                            whose post changed in the repository
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const photoLib = require('../photos/library');
const { createRenderer } = require('../render/render');
const { checkAll, priorLedgers } = require('../gates/check-batch');
const { findingsByPost } = require('../generate/batch');
const { createBuffer, ensureTags } = require('./client');
const { createMockBuffer } = require('./mock');
const { createHost } = require('../publish/host');
const { createNotifier } = require('../notify');
const { ensureRenders, rendersCurrent, publishMedia, draftInput, channelMetadata, contentSignature } = require('./media');
const { loadSources } = require('../generate/sources');
const { founderConfig, askMessage } = require('../generate/founder');
const { checkFounderPosts, findingsOf } = require('../gates/source-gate');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

const TAG_COLORS = { engine: '#1F7A3E', revised: '#2563EB', needsLook: '#D97706', checkCaption: '#DC2626' };
const DEFAULT_TAGS = { engine: 'Content engine', revised: 'Revised', needsLook: 'Needs a look', checkCaption: 'Check caption' };

function bufferConfig(config) {
  const b = config.buffer || {};
  return { ...b, tags: { ...DEFAULT_TAGS, ...(b.tags || {}) }, channels: b.channels || {} };
}

/** Why a post may not be drafted, or null. A founder post is text only: written, not rendered. */
function skipReason(post, { gateFindings, channelId, now }) {
  if (post.buffer && post.buffer.id) return 'already drafted';
  if (post.layout === 'text') {
    if (post.status === 'needs-source') return 'waiting for the founder\'s own words on its topic';
    if (post.status !== 'written') return `not written (status ${post.status})`;
  } else if (post.status !== 'rendered') return `not rendered clean (status ${post.status})`;
  if (gateFindings && gateFindings.length) return `fails its gates: ${gateFindings.join('; ')}`;
  if (!channelId) return `no Buffer channel for ${post.channel} in config.json buffer.channels`;
  if (Date.parse(post.dueAt) <= now) return `its slot (${post.dueAt}) has passed`;
  return null;
}

async function pushBatch({ batchNo, config, buffer, host, notifier, contentDir, stagingDir, sourcesDir, renderer, library, now = Date.now(), dryRun = false, founderOnly = false, update = false, quiet = false, log = () => {} }) {
  const ws = workspace();
  const nn = String(batchNo).padStart(2, '0');
  const batchDir = path.join(contentDir || ws.contentDir, `batch-${nn}`);
  const ledgerFile = path.join(batchDir, 'ledger.json');
  const ledger = read(ledgerFile);
  const plan = founderOnly ? null : read(path.join(batchDir, 'plan.json'));
  const stage = stagingDir || path.join(ws.root, '.staging', `batch-${nn}`);
  const bc = bufferConfig(config);
  if (!dryRun && !bc.organizationId) throw new Error('config.json buffer.organizationId is not set');

  const priors = founderOnly ? [] : priorLedgers(contentDir || ws.contentDir, `batch-${nn}`);
  const gates = founderOnly ? [] : checkAll({ plan, ledger, priors, brandDir: ws.brandDir });
  const byPost = findingsByPost(gates, ledger.posts.map((p) => p.id));
  const batchLevel = gates.flatMap((g) => g.failures.filter((f) => !ledger.posts.some((p) => String(f.id).startsWith(p.id))).map((f) => `${f.rule}: ${f.detail}`));

  const tagIds = dryRun ? { engine: 'dry-run' } : await ensureTags(buffer, bc.organizationId, bc.tags, TAG_COLORS);
  const result = { batch: `batch-${nn}`, drafted: [], updated: [], skipped: [], warnings: [], batchLevel };
  const founder = ledger.founder || [];
  let founderFindings = new Map();
  if (founder.length) {
    const fc = founderConfig(config);
    const { sources } = await loadSources({ dir: sourcesDir || path.join(ws.dir, 'sources'), founderNames: fc.names });
    founderFindings = findingsOf(checkFounderPosts({ posts: founder.filter((p) => p.status === 'written'), sources, config, brandDir: ws.brandDir }));
  }
  let ownRenderer = null;
  const rendererFor = async (post) => {
    if (!rendersCurrent(post, stage) && !renderer && !ownRenderer) ownRenderer = await createRenderer();
    return renderer || ownRenderer;
  };
  try {
    for (const post of founderOnly ? [] : ledger.posts) {
      const channelId = bc.channels[post.channel];
      const reason = skipReason(post, { gateFindings: byPost.get(post.id), channelId, now });
      if (reason) {
        if (reason !== 'already drafted') result.skipped.push({ id: post.id, reason });
        continue;
      }
      const size = (config.channels[post.channel] || {}).size || 'ig';
      const { files, warnings } = await ensureRenders({ post, dir: stage, renderer: await rendererFor(post), library, size });
      result.warnings.push(...warnings.map((w) => `${post.id}: ${w}`));
      if (dryRun) {
        result.drafted.push({ id: post.id, dryRun: true, files: files.map((f) => path.basename(f)) });
        continue;
      }
      const { media, published } = await publishMedia({ post, files, host, folder: `batch-${nn}`, config, workDir: stage });
      const input = draftInput(post, { channelId, media, tagIds: [tagIds.engine] });
      const created = await buffer.createPost(input);
      post.buffer = {
        id: created.id,
        channelId,
        status: created.status,
        pushedAt: new Date(now).toISOString(),
        // As Buffer stored it, so a later comparison sees the reviewer's
        // edits and not Buffer's own normalization.
        text: String(created.text || input.text).replace(/\r\n/g, '\n').trim(),
        tagIds,
        tagRoles: ['engine'],
        firstComment: post.firstComment || null,
        media: published,
        notesSeen: [],
        revisions: [],
        // What the engine sent, to tell a later change in the repository from an edit in Buffer.
        sentText: input.text,
        signature: contentSignature(post),
        renders: renderShas(post),
      };
      write(ledgerFile, ledger);
      result.drafted.push({ id: post.id, bufferId: created.id });
      log({ step: 'push', id: post.id, bufferId: created.id });
    }

    /* -- founder posts: text only, checked again against the sources ---- */
    if (founder.length) {
      for (const post of founder) {
        const channelId = bc.channels[post.channel];
        const reason = skipReason(post, { gateFindings: founderFindings.get(post.id), channelId, now });
        if (reason) {
          if (reason !== 'already drafted') result.skipped.push({ id: post.id, reason, waiting: post.status === 'needs-source' });
          continue;
        }
        if (dryRun) {
          result.drafted.push({ id: post.id, dryRun: true, files: [] });
          continue;
        }
        const input = draftInput(post, { channelId, media: [], tagIds: [tagIds.engine] });
        const created = await buffer.createPost(input);
        post.buffer = {
          id: created.id,
          channelId,
          status: created.status,
          pushedAt: new Date(now).toISOString(),
          text: String(created.text || input.text).replace(/\r\n/g, '\n').trim(),
          tagIds,
          tagRoles: ['engine'],
          firstComment: null,
          media: [],
          notesSeen: [],
          revisions: [],
          sentText: input.text,
          signature: contentSignature(post),
          renders: [],
        };
        write(ledgerFile, ledger);
        result.drafted.push({ id: post.id, bufferId: created.id });
        log({ step: 'push', id: post.id, bufferId: created.id });
      }
    }

    /* -- drafts whose post changed in the repository (a change made with Codex) -- */
    if (update && !dryRun) {
      for (const post of [...(founderOnly ? [] : ledger.posts), ...founder]) {
        const b = post.buffer;
        if (!b || !b.id || !OPEN.includes(b.status)) continue;
        const sig = contentSignature(post);
        if (!b.signature) {
          // Drafted before signatures were kept: this is the baseline, not a change.
          Object.assign(b, { signature: sig, sentText: b.sentText || post.postText, renders: renderShas(post) });
          write(ledgerFile, ledger);
          continue;
        }
        if (b.signature === sig) continue;
        const findings = post.layout === 'text' ? founderFindings.get(post.id) : byPost.get(post.id);
        if (findings && findings.length) {
          result.skipped.push({ id: post.id, reason: `changed in the repository, but fails its gates: ${findings.join('; ')}` });
          continue;
        }
        const input = { id: b.id, tagIds: [tagIds.engine, tagIds.revised].filter(Boolean) };
        const changed = [];
        if (post.layout !== 'text' && JSON.stringify(renderShas(post)) !== JSON.stringify(b.renders || [])) {
          const size = (config.channels[post.channel] || {}).size || 'ig';
          const { files, warnings } = await ensureRenders({ post, dir: stage, renderer: await rendererFor(post), library, size });
          result.warnings.push(...warnings.map((w) => `${post.id}: ${w}`));
          const { media, published } = await publishMedia({ post, files, host, folder: `batch-${nn}`, config, workDir: stage });
          input.assets = media;
          b.media = published;
          changed.push('image');
        }
        if (norm(post.postText) !== norm(b.sentText || b.text) || norm(post.firstComment) !== norm(b.firstComment)) {
          if (b.captionEdited) {
            result.warnings.push(`${post.id}: the caption changed in the repository, but it was edited in Buffer; the words in Buffer stay`);
          } else {
            input.text = post.postText;
            input.metadata = channelMetadata(post);
            changed.push('caption');
          }
        }
        if (changed.length) {
          const edited = await buffer.editPost(input);
          if (input.text) Object.assign(b, { text: norm(edited.text || input.text), sentText: post.postText, firstComment: post.firstComment || null });
          b.tagRoles = [...new Set([...(b.tagRoles || ['engine']), 'revised'])];
          b.revisions = [...(b.revisions || []), { at: new Date(now).toISOString(), by: 'repository', changed }];
          result.updated.push({ id: post.id, changed, label: post.headline || post.id });
          log({ step: 'update', id: post.id, changed });
        }
        Object.assign(b, { signature: sig, renders: renderShas(post) });
        write(ledgerFile, ledger);
      }
    }
  } finally {
    if (ownRenderer) await ownRenderer.close();
  }

  // Founder slots waiting on the founder's words get their questions once;
  // a re-push that only finds them still waiting says nothing.
  const asking = dryRun ? [] : (ledger.founder || []).filter((p) => p.status === 'needs-source' && !p.askedAt);
  const loud = result.drafted.length || result.updated.length || asking.length || (!quiet && result.skipped.some((s) => !s.waiting));
  if (!dryRun && notifier && loud) {
    let sheet = null;
    const sheetFile = path.join(batchDir, 'contact-sheet.jpg');
    const lines = [];
    if (result.drafted.length) {
      if (host && fs.existsSync(sheetFile)) sheet = (await host.publish(sheetFile, `batch-${nn}/contact-sheet.jpg`)).url;
      lines.push(`${ledger.batch} (${ledger.window}) is in Buffer: ${result.drafted.length} draft${result.drafted.length === 1 ? '' : 's'} to review.`,
        'Edit a caption right in Buffer. To change anything else, ask Codex in ChatGPT (or leave a note on the draft); the new version replaces the draft, tagged Revised. Schedule a draft to approve it.');
      if (sheet) lines.push(`All posts at a glance: ${sheet}`);
    }
    if (result.updated.length) {
      lines.push(...(lines.length ? [''] : []), `Updated in Buffer from your changes: ${result.updated.map((u) => `"${u.label}" (${u.changed.join(', ')})`).join('; ')}.`);
    }
    if (result.skipped.length) lines.push('', 'Not drafted:', ...result.skipped.map((s) => `- ${s.id}: ${s.reason}`));
    if (batchLevel.length) lines.push('', 'Batch checks that failed (the drafts are there; worth a look):', ...batchLevel.map((b) => `- ${b}`));
    const ask = askMessage(asking, config);
    if (ask) {
      lines.push('', ask);
      for (const p of asking) p.askedAt = new Date(now).toISOString();
      write(ledgerFile, ledger);
    }
    await notifier.send(lines.join('\n'));
  }
  return result;
}

const OPEN = ['draft', 'needs_approval', 'scheduled'];
const norm = (t) => String(t || '').replace(/\r\n/g, '\n').trim();
const renderShas = (post) => (post.layout === 'text' ? [] : post.slides ? post.slides.map((s) => (s.render && s.render.sha256) || null) : [(post.render && post.render.sha256) || null]);
const readyToDraft = (p) => (p.layout === 'text' ? p.status === 'written' : p.status === 'rendered');

/**
 * Every batch with something to do in Buffer: posts ready and not drafted
 * whose slot is ahead, drafts whose post changed in the repository, founder
 * slots whose questions were not sent. What runs after the routine and on
 * every push of a change.
 */
async function pushOpen({ contentDir, now = Date.now(), ...rest }) {
  const dir = contentDir || workspace().contentDir;
  const out = [];
  const batches = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => /^batch-\d{2}$/.test(d) && fs.existsSync(path.join(dir, d, 'ledger.json'))).sort() : [];
  for (const d of batches) {
    const ledger = read(path.join(dir, d, 'ledger.json'));
    const posts = [...(ledger.posts || []), ...(ledger.founder || [])];
    const work = posts.some((p) => (p.buffer && p.buffer.id
      ? OPEN.includes(p.buffer.status) && p.buffer.signature !== contentSignature(p)
      : readyToDraft(p) && Date.parse(p.dueAt) > now))
      // Questions for the founder count only when there is someone to send them to.
      || (Boolean(rest.notifier) && (ledger.founder || []).some((p) => p.status === 'needs-source' && !p.askedAt));
    if (!work) continue;
    out.push(await pushBatch({ ...rest, contentDir: dir, now, batchNo: Number(d.slice(6)), update: true, quiet: true }));
  }
  return out;
}

module.exports = { pushBatch, pushOpen, bufferConfig, skipReason, DEFAULT_TAGS, TAG_COLORS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = read(path.join(ws.dir, 'config.json'));
    if (argv.includes('--open')) {
      const bc0 = bufferConfig(config);
      const results = await pushOpen({
        config, buffer: arg('buffer') === 'mock' ? createMockBuffer({ channels: bc0.channels }) : createBuffer({ apiKeyEnv: bc0.apiKeyEnv }),
        host: createHost(config, arg('assets') ? { host: arg('assets') } : {}), notifier: createNotifier(config), library: photoLib.load(),
        log: (e) => console.log(e.step === 'update' ? `updated ${e.id}: ${e.changed.join(', ')}` : `drafted ${e.id} -> ${e.bufferId}`),
      });
      for (const r of results) console.log(`${r.batch}: ${r.drafted.length} drafted, ${r.updated.length} updated, ${r.skipped.length} skipped${r.warnings.length ? `; ${r.warnings.join('; ')}` : ''}`);
      if (!results.length) console.log('Nothing to draft or update.');
      return;
    }
    let batchNo = Number(arg('batch'));
    if (argv.includes('--latest')) {
      const nums = fs.readdirSync(ws.contentDir).map((d) => /^batch-(\d{2})$/.exec(d)).filter(Boolean)
        .filter((m) => fs.existsSync(path.join(ws.contentDir, m[0], 'ledger.json'))).map((m) => Number(m[1]));
      batchNo = nums.length ? Math.max(...nums) : 0;
    }
    if (!batchNo) throw new Error('--batch NN or --latest is required');
    const dryRun = argv.includes('--dry-run');
    const bc = bufferConfig(config);
    const buffer = dryRun ? null : arg('buffer') === 'mock' ? createMockBuffer({ channels: bc.channels }) : createBuffer({ apiKeyEnv: bc.apiKeyEnv });
    const host = dryRun ? null : createHost(config, arg('assets') ? { host: arg('assets') } : {});
    const r = await pushBatch({
      batchNo, config, buffer, host, dryRun,
      notifier: createNotifier(config),
      library: photoLib.load(),
      log: (e) => console.log(`drafted ${e.id} -> ${e.bufferId}`),
    });
    for (const d of r.drafted.filter((x) => x.dryRun)) console.log(`would draft ${d.id}: ${d.files.join(', ')}`);
    for (const s of r.skipped) console.log(`skipped ${s.id}: ${s.reason}`);
    for (const w of r.warnings) console.log(`warning: ${w}`);
    console.log(`${r.batch}: ${r.drafted.length} ${dryRun ? 'ready to draft' : 'drafted'}, ${r.skipped.length} skipped.`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
