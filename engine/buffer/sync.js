#!/usr/bin/env node
/**
 * sync.js
 *
 * Reads the engine's drafts back from Buffer and acts on what the reviewer
 * did, every 15 minutes in working hours (.github/workflows/sync.yml):
 *
 *   a new note        revise the post (engine/feedback/revise.js) and swap
 *                     the new images into the same draft, tagged Revised; or
 *                     tag it "Needs a look" and say why
 *   a caption edit    record it as feedback; if the new caption trips a gate,
 *                     tag it "Check caption" and say which rule (the
 *                     reviewer's words are never changed)
 *   scheduled         record the approval
 *   deleted           record the rejection
 *   sent / error      record it; report a publishing error
 *
 * Everything lands in the ledger (post.buffer) and in feedback/log.jsonl,
 * which the next batch reads. One Buffer request per run when nothing
 * changed (the posts query); none when no draft is open.
 *
 *   node engine/buffer/sync.js [--defer-renders] [--buffer mock] [--provider mock --mock-dir DIR] [--assets mock]
 *
 * --defer-renders: when a note needs a re-render and no Chromium is
 * installed, leave the note unread, finish everything else, and write
 * needs-render.txt; the workflow then installs Chromium and runs again. Most
 * runs find nothing to render and never pay for the install.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const photoLib = require('../photos/library');
const { createRenderer, chromiumPath } = require('../render/render');
const { priorLedgers } = require('../gates/check-batch');
const { createProvider } = require('../generate/providers');
const { loadCatalog } = require('../generate/catalog');
const { brandContext } = require('../generate/context');
const capability = require('../gates/capability-gate');
const brandGate = require('../gates/brand-gate');
const stat = require('../gates/stat-gate');
const feedbackLog = require('../feedback/log');
const { reviseFromNotes, captionBody } = require('../feedback/revise');
const { reviseFounder, founderConfig } = require('../generate/founder');
const { loadSources } = require('../generate/sources');
const { createBuffer, ensureTags } = require('./client');
const { createMockBuffer } = require('./mock');
const { createHost } = require('../publish/host');
const { createNotifier } = require('../notify');
const { bufferConfig, TAG_COLORS } = require('./push');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();
const OPEN = ['draft', 'needs_approval', 'scheduled', 'sending', 'error'];
const canRender = () => { try { chromiumPath(); return true; } catch { return false; } };
const channelName = (c) => (String(c).startsWith('linkedin') ? 'LinkedIn' : 'Instagram');
const stop = (t) => String(t || '').trim().replace(/[.\s]+$/, '');
const lower = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
/** How a person finds the post in Buffer: its headline, channel and time. */
const label = (post, tz) => {
  const h = String(post.headline || post.message || post.id).replace(/\s+/g, ' ').trim();
  return `"${h.length > 60 ? `${h.slice(0, 57).replace(/\s+\S*$/, '')}...` : h}" (${channelName(post.channel)}, ${when(post.dueAt, tz)})`;
};
const when = (iso, tz) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || 'UTC' });

/** Batches with at least one draft still open in Buffer. */
function openBatches(contentDir) {
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir).filter((d) => /^batch-\d{2}$/.test(d)).sort().map((d) => {
    const ledgerFile = path.join(contentDir, d, 'ledger.json');
    if (!fs.existsSync(ledgerFile)) return null;
    const ledger = read(ledgerFile);
    const open = [...ledger.posts, ...(ledger.founder || [])].filter((p) => p.buffer && p.buffer.id && OPEN.includes(p.buffer.status));
    return open.length ? { name: d, no: Number(d.slice(6)), dir: path.join(contentDir, d), ledgerFile, ledger, open } : null;
  }).filter(Boolean);
}

/** Gate findings a caption edit adds, against the engine's own caption. */
function captionFindings(post, newCaption, brandDir) {
  const run = (caption) => {
    const p = { ...post, caption };
    return [
      ...capability.checkBatch({ posts: [p] }, brandDir).failures,
      ...brandGate.checkBatch({ posts: [p] }).failures,
      ...stat.checkBatch({ posts: [p] }).failures,
    ].map((f) => `${f.rule}: ${f.detail}`);
  };
  const before = new Set(run(post.caption));
  return run(newCaption).filter((f) => !before.has(f));
}

async function syncOnce({ config, buffer, host, provider, notifier, contentDir, stagingDir, sourcesDir, renderer, library, lib = photoLib, feedbackFile, deferRenders = false, canRenderNow = canRender, now = Date.now(), log = () => {} }) {
  const ws = workspace();
  const content = contentDir || ws.contentDir;
  const bc = bufferConfig(config);
  const batches = openBatches(content);
  const result = { checked: 0, revised: [], notApplied: [], captionEdits: [], approved: [], deleted: [], sent: [], errors: [], deferred: [] };
  if (!batches.length) return result;

  // Tag ids recorded at push time save a request on every run.
  const cached = batches[0].open[0].buffer.tagIds;
  const tagIds = cached && Object.keys(bc.tags).every((r) => cached[r]) ? cached : await ensureTags(buffer, bc.organizationId, bc.tags, TAG_COLORS);
  const since = batches.flatMap((b) => b.open.map((p) => p.buffer.pushedAt)).sort()[0];
  const live = new Map((await buffer.listPosts({
    organizationId: bc.organizationId, tagIds: [tagIds.engine], createdAfter: new Date(Date.parse(since) - 86400000).toISOString(),
  })).map((p) => [p.id, p]));
  const reviewers = (bc.reviewers || []).map((e) => e.toLowerCase());
  const events = [];
  const at = new Date(now).toISOString();
  const brand = read(path.join(ws.brandDir, 'render.json'));
  const tz = config.timezone;
  let ctx = null;
  let ownRenderer = null;
  let founderSources = null;
  const reviewCtx = async (b) => {
    if (!ctx) {
      if (!renderer && !ownRenderer) ownRenderer = await createRenderer();
      ctx = {
        config, brand, brandDir: ws.brandDir, brandText: brandContext(ws.brandDir), library, lib,
        catalog: loadCatalog({ brand, library, config }), provider, buffer, host, renderer: renderer || ownRenderer, tagIds, now, log,
        reviewerFeedback: feedbackLog.summary(feedbackLog.load(feedbackFile), { reviewer: bc.reviewerName || 'The reviewer' }),
      };
    }
    const priors = b.priors || (b.priors = priorLedgers(content, b.name));
    return {
      ...ctx,
      // A new photo for a revision respects the reuse window across batches.
      library: lib.withLedgerUsage(library, priors),
      plan: b.plan || (b.plan = read(path.join(b.dir, 'plan.json'))),
      ledger: b.ledger,
      priors,
      batchNo: b.no,
      stagingDir: path.join(stagingDir || path.join(ws.root, '.staging'), b.name),
    };
  };
  const tags = (roles) => roles.map((r) => tagIds[r]).filter(Boolean);
  const meta = (b, post) => ({ at, batch: b.name, post: post.id, channel: post.channel, layout: post.layout, pillar: post.pillar });

  try {
    for (const b of batches) {
      let dirty = false;
      for (const post of b.open) {
        result.checked += 1;
        let bp = live.get(post.buffer.id);
        if (!bp) bp = await buffer.getPost(post.buffer.id);
        if (!bp) {
          post.buffer.status = 'deleted';
          post.buffer.deletedSeenAt = at;
          events.push({ ...meta(b, post), kind: 'deleted', headline: post.headline });
          result.deleted.push(post.id);
          dirty = true;
          continue;
        }

        /* -- status ---------------------------------------------------- */
        if (bp.status !== post.buffer.status) {
          const was = post.buffer.status;
          post.buffer.status = bp.status;
          dirty = true;
          if (['scheduled', 'needs_approval'].includes(bp.status) && was === 'draft') {
            post.buffer.scheduledSeenAt = at;
            events.push({ ...meta(b, post), kind: 'approved', edited: norm(bp.text) !== norm(post.postText), revisions: (post.buffer.revisions || []).length });
            result.approved.push(post.id);
          } else if (bp.status === 'sent') {
            post.buffer.sentAt = bp.sentAt;
            post.buffer.externalLink = bp.externalLink || null;
            events.push({ ...meta(b, post), kind: 'published', link: bp.externalLink || null });
            result.sent.push(post.id);
          } else if (bp.status === 'error') {
            const msg = (bp.error && bp.error.message) || 'no message';
            result.errors.push(post.id);
            await notifier.send(`Buffer could not publish ${label(post, tz)}: ${stop(msg)}.`);
          }
        }

        /* -- caption edits --------------------------------------------- */
        if (norm(bp.text) !== norm(post.buffer.text)) {
          events.push({ ...meta(b, post), kind: 'caption-edit', before: post.buffer.text, after: bp.text });
          post.buffer.text = norm(bp.text);
          post.buffer.captionEdited = true;
          dirty = true;
          result.captionEdits.push(post.id);
          const found = captionFindings(post, captionBody(bp.text, post), ws.brandDir);
          if (found.length && bp.status !== 'sent') {
            const roles = [...new Set([...(post.buffer.tagRoles || ['engine']), 'checkCaption'])];
            await buffer.editPost({ id: bp.id, tagIds: tags(roles) });
            post.buffer.tagRoles = roles;
            await notifier.send([`The edited caption on ${label(post, tz)} trips a check. It is tagged Check caption; the words are yours to change or keep.`,
              ...found.map((f) => { const i = f.indexOf(': '); return `- ${f.slice(i + 2)} (${f.slice(0, i)})`; })].join('\n'));
          }
        }

        /* -- notes ----------------------------------------------------- */
        const seen = new Set(post.buffer.notesSeen || []);
        const fresh = (bp.notes || []).filter((n) => n.type === 'userGenerated' && !seen.has(n.id)
          && (!reviewers.length || reviewers.includes(String((n.author && n.author.email) || '').toLowerCase())));
        if (!fresh.length) continue;
        dirty = true;
        const noteText = fresh.map((n) => n.text).join(' / ');
        const markSeen = (p) => { p.buffer.notesSeen = [...seen, ...fresh.map((n) => n.id)]; p.buffer.noteFailures = 0; };
        if (bp.status === 'sent') {
          markSeen(post);
          events.push({ ...meta(b, post), kind: 'note', note: noteText, applied: false, reason: 'the post had already been published', understood: '' });
          continue;
        }
        const isFounder = post.layout === 'text';
        if (!isFounder && deferRenders && !renderer && !canRenderNow()) {
          result.deferred.push(post.id);
          continue;
        }
        let c = null;
        let r;
        try {
          if (isFounder) {
            // Text only: no renderer, and the founder's own words as sources.
            if (!founderSources) {
              const fc = founderConfig(config);
              founderSources = (await loadSources({ dir: sourcesDir || path.join(ws.dir, 'sources'), provider, founderNames: fc.names, model: fc.transcribeModel })).sources;
            }
            r = await reviseFounder({
              config, brandDir: ws.brandDir, brandText: brandContext(ws.brandDir), provider, buffer, tagIds, log,
            }, { post, ledger: b.ledger, notes: fresh, bufferPost: bp, sources: founderSources });
          } else {
            c = await reviewCtx(b);
            r = await reviseFromNotes(c, { post, notes: fresh, bufferPost: bp });
          }
        } catch (e) {
          // An outage (the model, Buffer, the assets host) is retried on the
          // next run; the notes stay unread. After three tries a person takes it.
          post.buffer.noteFailures = (post.buffer.noteFailures || 0) + 1;
          log({ step: 'sync', id: post.id, error: e.message, attempt: post.buffer.noteFailures });
          if (post.buffer.noteFailures < 3) continue;
          r = { applied: false, understood: '', changed: [], warnings: [], lesson: null, reason: `processing the note failed three times (${e.message})` };
        }
        const current = r.applied ? r.post : post;
        markSeen(current);
        events.push({ ...meta(b, current), kind: 'note', note: noteText, understood: r.understood, applied: r.applied, changed: r.changed, reason: r.reason || null, lesson: r.lesson });
        const where = label(post, tz);
        if (r.applied) {
          current.buffer.revisions = [...(post.buffer.revisions || []), { at, notes: fresh.map((n) => n.id), understood: r.understood, changed: r.changed }];
          if (c) write(path.join(b.dir, 'plan.json'), c.plan);
          result.revised.push(post.id);
          if (config.notify && config.notify.onRevised) {
            await notifier.send([`Revised ${where} as asked: ${lower(stop(r.understood))}. Changed: ${r.changed.join(', ') || 'nothing visible'}.`,
              ...(r.warnings.length ? ['Worth knowing, the change affects the batch:', ...r.warnings.map((w) => `- ${w}`)] : [])].join('\n'));
          }
        } else if (r.noChange) {
          result.notApplied.push({ id: post.id, reason: r.reason });
          await notifier.send(`A note on ${where} asks for no change, so the draft is as it was. The note: "${noteText}"`);
        } else {
          const roles = [...new Set([...(post.buffer.tagRoles || ['engine']), 'needsLook'])];
          await buffer.editPost({ id: bp.id, tagIds: tags(roles) });
          post.buffer.tagRoles = roles;
          result.notApplied.push({ id: post.id, reason: r.reason });
          await notifier.send(`Could not apply the note on ${where}: ${lower(stop(r.reason))}. The draft is unchanged and tagged Needs a look. The note: "${noteText}"`);
        }
      }
      if (dirty) write(b.ledgerFile, b.ledger);
    }
  } finally {
    if (ownRenderer) await ownRenderer.close();
  }
  feedbackLog.append(events, feedbackFile);
  return result;
}

module.exports = { syncOnce, openBatches, captionFindings };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = read(path.join(ws.dir, 'config.json'));
    const bc = bufferConfig(config);
    if (arg('buffer') !== 'mock' && !bc.organizationId) throw new Error('config.json buffer.organizationId is not set');
    const providerOverrides = {};
    if (arg('provider')) providerOverrides.name = arg('provider');
    if (arg('mock-dir')) providerOverrides.dir = arg('mock-dir');
    const r = await syncOnce({
      config,
      buffer: arg('buffer') === 'mock' ? createMockBuffer({ channels: bc.channels }) : createBuffer({ apiKeyEnv: bc.apiKeyEnv }),
      host: createHost(config, arg('assets') ? { host: arg('assets') } : {}),
      provider: createProvider(config, providerOverrides),
      notifier: createNotifier(config),
      library: photoLib.load(),
      deferRenders: argv.includes('--defer-renders'),
      log: (e) => { if (e.error) console.log(`${e.id}: ${e.error} (attempt ${e.attempt})`); },
    });
    const marker = path.join(ws.root, 'needs-render.txt');
    if (r.deferred.length) fs.writeFileSync(marker, `${r.deferred.join('\n')}\n`);
    else fs.rmSync(marker, { force: true });
    console.log(`checked ${r.checked}; revised ${r.revised.length}; not applied ${r.notApplied.length}; caption edits ${r.captionEdits.length}; approved ${r.approved.length}; deleted ${r.deleted.length}; sent ${r.sent.length}; errors ${r.errors.length}${r.deferred.length ? `; ${r.deferred.length} note(s) wait for Chromium` : ''}`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
