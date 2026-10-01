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
const { ensureRenders, publishMedia, draftInput } = require('./media');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

const TAG_COLORS = { engine: '#1F7A3E', revised: '#2563EB', needsLook: '#D97706', checkCaption: '#DC2626' };
const DEFAULT_TAGS = { engine: 'Content engine', revised: 'Revised', needsLook: 'Needs a look', checkCaption: 'Check caption' };

function bufferConfig(config) {
  const b = config.buffer || {};
  return { ...b, tags: { ...DEFAULT_TAGS, ...(b.tags || {}) }, channels: b.channels || {} };
}

/** Why a post may not be drafted, or null. */
function skipReason(post, { gateFindings, channelId, now }) {
  if (post.buffer && post.buffer.id) return 'already drafted';
  if (post.status !== 'rendered') return `not rendered clean (status ${post.status})`;
  if (gateFindings && gateFindings.length) return `fails its gates: ${gateFindings.join('; ')}`;
  if (!channelId) return `no Buffer channel for ${post.channel} in config.json buffer.channels`;
  if (Date.parse(post.dueAt) <= now) return `its slot (${post.dueAt}) has passed`;
  return null;
}

async function pushBatch({ batchNo, config, buffer, host, notifier, contentDir, stagingDir, renderer, library, now = Date.now(), dryRun = false, log = () => {} }) {
  const ws = workspace();
  const nn = String(batchNo).padStart(2, '0');
  const batchDir = path.join(contentDir || ws.contentDir, `batch-${nn}`);
  const ledgerFile = path.join(batchDir, 'ledger.json');
  const ledger = read(ledgerFile);
  const plan = read(path.join(batchDir, 'plan.json'));
  const stage = stagingDir || path.join(ws.root, '.staging', `batch-${nn}`);
  const bc = bufferConfig(config);
  if (!dryRun && !bc.organizationId) throw new Error('config.json buffer.organizationId is not set');

  const priors = priorLedgers(contentDir || ws.contentDir, `batch-${nn}`);
  const gates = checkAll({ plan, ledger, priors, brandDir: ws.brandDir });
  const byPost = findingsByPost(gates, ledger.posts.map((p) => p.id));
  const batchLevel = gates.flatMap((g) => g.failures.filter((f) => !ledger.posts.some((p) => String(f.id).startsWith(p.id))).map((f) => `${f.rule}: ${f.detail}`));

  const tagIds = dryRun ? { engine: 'dry-run' } : await ensureTags(buffer, bc.organizationId, bc.tags, TAG_COLORS);
  const result = { batch: `batch-${nn}`, drafted: [], skipped: [], warnings: [], batchLevel };
  let ownRenderer = null;
  try {
    for (const post of ledger.posts) {
      const channelId = bc.channels[post.channel];
      const reason = skipReason(post, { gateFindings: byPost.get(post.id), channelId, now });
      if (reason) {
        if (reason !== 'already drafted') result.skipped.push({ id: post.id, reason });
        continue;
      }
      const size = (config.channels[post.channel] || {}).size || 'ig';
      const needRenderer = !(post.slides ? post.slides.every((sl) => fs.existsSync(path.join(stage, `${post.id}-${String(sl.index).padStart(2, '0')}.png`))) : fs.existsSync(path.join(stage, `${post.id}.png`)));
      if (needRenderer && !renderer && !ownRenderer) ownRenderer = await createRenderer();
      const { files, warnings } = await ensureRenders({ post, dir: stage, renderer: renderer || ownRenderer, library, size });
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
      };
      write(ledgerFile, ledger);
      result.drafted.push({ id: post.id, bufferId: created.id });
      log({ step: 'push', id: post.id, bufferId: created.id });
    }
  } finally {
    if (ownRenderer) await ownRenderer.close();
  }

  if (!dryRun && notifier && (result.drafted.length || result.skipped.length)) {
    let sheet = null;
    const sheetFile = path.join(batchDir, 'contact-sheet.jpg');
    if (host && fs.existsSync(sheetFile)) sheet = (await host.publish(sheetFile, `batch-${nn}/contact-sheet.jpg`)).url;
    const lines = [`${ledger.batch} (${ledger.window}) is in Buffer: ${result.drafted.length} draft${result.drafted.length === 1 ? '' : 's'} to review.`,
      'Edit a caption right in Buffer. To change an image, leave a note on the draft saying what to change; a new version replaces it, tagged Revised. Schedule a draft to approve it.'];
    if (sheet) lines.push(`All posts at a glance: ${sheet}`);
    if (result.skipped.length) lines.push('', 'Not drafted:', ...result.skipped.map((s) => `- ${s.id}: ${s.reason}`));
    if (batchLevel.length) lines.push('', 'Batch checks that failed (the drafts are there; worth a look):', ...batchLevel.map((b) => `- ${b}`));
    await notifier.send(lines.join('\n'));
  }
  return result;
}

module.exports = { pushBatch, bufferConfig, skipReason, DEFAULT_TAGS, TAG_COLORS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = read(path.join(ws.dir, 'config.json'));
    const batchNo = Number(arg('batch'));
    if (!batchNo) throw new Error('--batch NN is required');
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
