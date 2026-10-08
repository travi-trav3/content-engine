#!/usr/bin/env node
/**
 * routine.js
 *
 * The biweekly routine, one command: everything that needs the model, on the
 * client's ChatGPT subscription. Run on a schedule (GitHub Actions, with the
 * codex provider) or by Codex in the client's ChatGPT (the agent provider),
 * it does what is due and stops:
 *
 *   1. briefs    reads any new or changed brief in briefs/
 *   2. batch     writes the next batch when one is due (the last planned post
 *                is under a week away), or finishes one that stopped part way
 *   3. founder   writes the founder posts still open, from sources/
 *
 * It never touches Buffer: drafting and updating drafts is push.js
 * (`--open`), which the workflows run after the routine, and on every push
 * of a change.
 *
 * With the agent provider a step whose model calls have no answer yet stops
 * the routine (exit 3) with the open requests listed. The agent answers them
 * and runs the routine again; earlier answers replay. When everything is
 * answered and written, the exchange is cleared.
 *
 *   node engine/routine.js [--provider codex|agent|mock] [--mock-dir DIR] [--batch-now] [--fresh]
 *   node engine/routine.js --due      prints yes when a batch is due or unfinished
 *
 * Exit 0: done (or nothing due). 1: something needs a person (report.md).
 * 2: the run failed. 3: waiting for answers. 4: the ChatGPT usage limit was
 * reached (the next scheduled run picks it up).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('./lib/workspace');
const { priorLedgers } = require('./gates/check-batch');
const { createProvider } = require('./generate/providers');
const { runBatch, batchDue, unfinishedBatch } = require('./generate/batch');
const briefMode = require('./generate/brief');
const founder = require('./generate/founder');

const DUE_DAYS = 7;

async function routine({ config, provider, contentDir, briefsDir, sourcesDir, brandDir, batchNow = false, now = Date.now(), notifier = null, log = () => {}, batchOptions = {} }) {
  const out = { steps: [], waiting: [], needsPerson: [], batch: null };
  const stop = () => provider.pending && provider.pending.length;
  const waitingResult = (step) => {
    out.steps.push(`${step}: waiting for ${provider.pending.length} answer(s)`);
    out.waiting = provider.pending.slice();
    return out;
  };

  /* -- 1. briefs ------------------------------------------------------- */
  const { briefs } = await briefMode.loadBriefs({ dir: briefsDir, provider, log });
  if (stop()) return waitingResult('briefs');
  out.steps.push(`briefs: ${briefs.length} read`);

  /* -- 2. the batch ---------------------------------------------------- */
  const unfinished = unfinishedBatch(contentDir);
  const { due, last } = batchDue(priorLedgers(contentDir), now, DUE_DAYS);
  if (unfinished || due || batchNow) {
    const r = await runBatch({ config, provider, contentDir, now, resume: true, briefsDir, sourcesDir, log, ...batchOptions });
    out.batch = r.batch;
    if (r.stage === 'waiting') return waitingResult(`batch ${r.batch} (${r.waitingAt})`);
    // Its founder slots asked already in this run; the next run finishes them.
    if (stop()) return waitingResult(`batch ${r.batch} (founder posts)`);
    out.steps.push(`batch ${r.batch} (${r.window}): ${r.ok ? 'written, every gate passed' : 'written; some posts need a person (see its report.md)'}`);
    if (!r.ok) out.needsPerson.push(`${r.batch}: see ${path.relative(process.cwd(), path.join(r.dir, 'report.md'))}`);
  } else {
    out.steps.push(`batch: none due (the last planned post is ${last ? last.slice(0, 10) : 'none'})`);
  }

  /* -- 3. founder posts ---------------------------------------------- */
  if (founder.founderConfig(config).enabled) {
    const f = await founder.fillAll({ contentDir, brandDir, sourcesDir, config, provider, notifier, now, log });
    if (stop()) return waitingResult('founder posts');
    const sum = (k) => f.batches.reduce((n, b) => n + b[k].length, 0);
    out.steps.push(`founder posts: ${sum('written')} written, ${sum('needsSource')} waiting for the founder's words, ${sum('failed')} failed the source checks`);
    if (sum('failed')) out.needsPerson.push('founder posts that failed the source checks: see the batch report and ledger.founder');
    for (const p of f.problems) out.needsPerson.push(p);
  }
  return out;
}

module.exports = { routine, DUE_DAYS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = JSON.parse(fs.readFileSync(path.join(ws.dir, 'config.json'), 'utf8'));
    if (argv.includes('--due')) {
      // For the workflow: is there a batch to write (so Chromium is worth installing)?
      const { due } = batchDue(priorLedgers(ws.contentDir), Date.now(), DUE_DAYS);
      console.log(due || unfinishedBatch(ws.contentDir) || argv.includes('--batch-now') ? 'yes' : 'no');
      return;
    }
    const overrides = {};
    if (arg('provider')) overrides.name = arg('provider');
    if (arg('mock-dir')) overrides.dir = arg('mock-dir');
    const provider = createProvider(config, overrides);
    if (argv.includes('--fresh') && provider.reset) provider.reset();
    const notifier = provider.name === 'agent' ? null : require('./notify').createNotifier(config);
    let r;
    try {
      r = await routine({
      config, provider, notifier, batchNow: argv.includes('--batch-now'),
      contentDir: ws.contentDir, briefsDir: path.join(ws.dir, 'briefs'), sourcesDir: path.join(ws.dir, 'sources'), brandDir: ws.brandDir,
      log: (e) => {
        if (e.step === 'codex' && e.code !== 0) console.log(`codex ${e.id}: exit ${e.code}`);
        else if (e.failures && e.failures.length) console.log(`${e.step}${e.id ? ` ${e.id}` : ''} round ${e.round}: ${e.failures.length} finding(s), rewriting`);
      },
      });
    } catch (e) {
      // The two ways a subscription run stops that a person should hear about.
      if (notifier && e.limit) await notifier.send('The content routine reached the ChatGPT usage limit part way. Nothing is lost: what was written is kept, and tomorrow morning\'s run picks it up. (Heavy ChatGPT or Codex use the same day draws on the same allowance.)');
      if (notifier && e.login) await notifier.send('The content routine could not sign in to ChatGPT: the saved login has expired. On a computer signed in to ChatGPT, run `codex login`, then `node engine/codex-auth.js seed` in the repository and commit codex-auth.enc (docs/INSTANCE.md, "The ChatGPT login").');
      throw e;
    }
    for (const s of r.steps) console.log(s);
    if (r.waiting.length) {
      console.log(`\nWaiting for ${r.waiting.length} answer(s). Write each answer where its request says, then run the routine again:`);
      for (const w of r.waiting) console.log(`  ${w.request}${w.reason ? `  (${w.reason})` : ''}`);
      process.exit(3);
    }
    // Finished: the answers have served their purpose.
    if (provider.reset) provider.reset();
    if (r.needsPerson.length) {
      console.log('\nNeeds a person:');
      for (const n of r.needsPerson) console.log(`  ${n}`);
      process.exit(1);
    }
    console.log('\nDone. Commit and push: drafts reach Buffer from GitHub.');
  })().catch((e) => {
    console.error(e.message);
    process.exit(e.limit ? 4 : 2);
  });
}
