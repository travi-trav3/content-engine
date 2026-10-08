#!/usr/bin/env node
/**
 * change.js
 *
 * A change the reviewer asks for in conversation with Codex ("make post 3
 * shorter", "use a course photo on the Tuesday post"), made the way a note
 * on a Buffer draft is: read, rewritten by the writer, run through every
 * gate, rendered (revise.js; founder posts through founder.js and the source
 * gate). Nothing here touches Buffer: the revised post is recorded in the
 * ledger, and push.js --open swaps it into the draft once the change is
 * pushed. The reviewer never edits a post's fields by hand, and neither does
 * Codex: what the gates would refuse does not reach the ledger.
 *
 *   node engine/feedback/change.js --post <id> --note "what to change" [--provider agent|codex]
 *
 * With the agent provider, Codex answers the requests it writes and runs the
 * same command again (exit 3 while waiting). Exit 0: changed. 1: not changed,
 * with the reason. 2: the run failed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const photoLib = require('../photos/library');
const { createRenderer } = require('../render/render');
const { priorLedgers } = require('../gates/check-batch');
const { loadCatalog } = require('../generate/catalog');
const { brandContext } = require('../generate/context');
const { createProvider, isPending } = require('../generate/providers');
const { loadSources } = require('../generate/sources');
const founder = require('../generate/founder');
const feedbackLog = require('./log');
const { reviseFromNotes } = require('./revise');

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

/** The batch and post an id names, across every batch. */
function findPost(contentDir, id) {
  for (const d of fs.readdirSync(contentDir).filter((x) => /^batch-\d{2}$/.test(x)).sort().reverse()) {
    const ledgerFile = path.join(contentDir, d, 'ledger.json');
    if (!fs.existsSync(ledgerFile)) continue;
    const ledger = read(ledgerFile);
    const post = (ledger.posts || []).find((p) => p.id === id) || (ledger.founder || []).find((p) => p.id === id);
    if (post) return { batch: d, dir: path.join(contentDir, d), ledgerFile, ledger, post };
  }
  return null;
}

async function makeChange({ config, provider, postId, note, contentDir, sourcesDir, feedbackFile, library = photoLib.load(), renderer, now = Date.now(), log = () => {} }) {
  const ws = workspace();
  const found = findPost(contentDir, postId);
  if (!found) return { applied: false, reason: `no post ${postId} in any batch` };
  const { batch, dir, ledgerFile, ledger, post } = found;
  const notes = [{ id: `change-${now}`, text: note, author: { name: (config.buffer && config.buffer.reviewerName) || 'the reviewer' } }];
  let r;
  if (post.layout === 'text') {
    const fc = founder.founderConfig(config);
    const { sources } = await loadSources({ dir: sourcesDir, provider, founderNames: fc.names, model: fc.transcribeModel });
    r = await founder.reviseFounder({ config, brandDir: ws.brandDir, brandText: brandContext(ws.brandDir), provider, buffer: null, tagIds: {}, log }, { post, ledger, notes, bufferPost: null, sources });
  } else {
    const priors = priorLedgers(contentDir, batch);
    const brand = read(path.join(ws.brandDir, 'render.json'));
    const plan = read(path.join(dir, 'plan.json'));
    const own = renderer || await createRenderer();
    try {
      r = await reviseFromNotes({
        config, brand, brandDir: ws.brandDir, brandText: brandContext(ws.brandDir), library: photoLib.withLedgerUsage(library, priors), lib: photoLib,
        catalog: loadCatalog({ brand, library, config }), provider, buffer: null, host: null, renderer: own, tagIds: {}, now, log,
        reviewerFeedback: feedbackLog.summary(feedbackLog.load(feedbackFile), { reviewer: (config.buffer && config.buffer.reviewerName) || 'The reviewer' }),
        plan, ledger, priors, batchNo: Number(batch.slice(6)), stagingDir: path.join(ws.root, '.staging', batch),
      }, { post, notes, bufferPost: null });
    } finally {
      if (!renderer) await own.close();
    }
    if (r.applied) write(path.join(dir, 'plan.json'), plan);
  }
  if (r.applied) write(ledgerFile, ledger);
  feedbackLog.append([{
    at: new Date(now).toISOString(), batch, post: post.id, channel: post.channel, layout: post.layout, pillar: post.pillar,
    kind: 'note', via: 'codex', note, understood: r.understood || '', applied: r.applied, changed: r.changed || [], reason: r.reason || null, lesson: r.lesson || null,
  }], feedbackFile);
  return { ...r, batch };
}

module.exports = { makeChange, findPost };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    if (!arg('post') || !arg('note')) throw new Error('usage: node engine/feedback/change.js --post <id> --note "what to change" [--provider agent|codex]');
    const config = read(path.join(ws.dir, 'config.json'));
    const provider = createProvider(config, arg('provider') ? { name: arg('provider') } : {});
    let r;
    try {
      r = await makeChange({ config, provider, postId: arg('post'), note: arg('note'), contentDir: ws.contentDir, sourcesDir: path.join(ws.dir, 'sources') });
    } catch (e) {
      if (!isPending(e)) throw e;
      console.log(`Waiting for ${provider.pending.length} answer(s). Write each answer where its request says, then run the same command again:`);
      for (const w of provider.pending) console.log(`  ${w.request}${w.reason ? `  (${w.reason})` : ''}`);
      process.exit(3);
    }
    if (r.applied) {
      console.log(`Changed ${arg('post')} (${r.batch}): ${r.understood}. What changed: ${(r.changed || []).join(', ') || 'nothing visible'}.`);
      console.log('Commit and push: the draft in Buffer updates from GitHub.');
      return;
    }
    console.log(`Not changed: ${r.reason}`);
    process.exit(1);
  })().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
}
