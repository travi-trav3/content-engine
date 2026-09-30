/**
 * check-batch.js
 *
 * One command that runs every gate for a batch, in order, and fails if any
 * fails. Six separate gate commands is how a gate gets skipped; this is the
 * only entry point a session needs to remember.
 *
 *   node engine/gates/check-batch.js 04            # gate content/batch-04 (plan + ledger)
 *   node engine/gates/check-batch.js 04 --plan     # plan only (before generation)
 *
 * content/ resolves through engine/lib/workspace.js: the repository root in a
 * client instance, or CE_WORKSPACE (e.g. brands/clubpilot) in the core repo.
 *
 * Prior batch ledgers are discovered automatically and passed as history to
 * the rotation and diversity gates. Exit 0 means everything passed; any
 * other exit means the batch does not ship. Passing is not a verdict on
 * quality: every gate catches specific, previously observed failures, and
 * each is satisfiable by an author who is wrong.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { workspace } = require('../lib/workspace');

const GATES = __dirname;
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/**
 * Every gate for one batch, as data: [{ label, pass, failures, warnings,
 * reportText }]. The plan gate always runs; the ledger gates run when a
 * ledger is given. The batch runner (engine/generate/batch.js) calls this
 * directly; the command below prints it.
 */
function checkAll({ plan, ledger, priors = [], brandDir = workspace().brandDir }) {
  const results = [];
  const run = (label, fn, reportFn) => {
    try {
      const r = fn();
      results.push({ label, pass: r.pass, failures: r.failures || [], warnings: r.warnings || [], reportText: reportFn(r) });
    } catch (e) {
      results.push({ label, pass: false, failures: [{ id: '(batch)', rule: 'gate.error', detail: e.message }], warnings: [], reportText: `  ERROR: ${e.message}` });
    }
  };
  const planGate = require(path.join(GATES, 'plan-gate.js'));
  run('plan gate', () => planGate.checkPlan(plan, priors), (r) => planGate.report(r));
  if (!ledger) return results;

  const capability = require(path.join(GATES, 'capability-gate.js'));
  run('capability gate', () => capability.checkBatch(ledger, brandDir), (r) => capability.report(r));
  const editorial = require(path.join(GATES, 'editorial-gate.js'));
  run('editorial gate', () => editorial.checkBatch(ledger), (r) => editorial.report(r));
  const rotation = require(path.join(GATES, 'rotation-gate.js'));
  run('rotation gate', () => rotation.checkBatch(ledger, priors), (r) => rotation.report(r));
  const diversity = require(path.join(GATES, 'diversity-gate.js'));
  run('diversity gate', () => diversity.checkBatch(ledger, priors), (r) => diversity.report(r));
  const brand = require(path.join(GATES, 'brand-gate.js'));
  run('brand gate', () => brand.checkBatch(ledger), (r) => brand.report(r));
  const stat = require(path.join(GATES, 'stat-gate.js'));
  run('stat gate', () => stat.checkBatch(ledger), (r) => stat.report(r));
  run('plan match', () => planGate.checkLedgerAgainstPlan(ledger, plan), (r) => planGate.report(r, 'plan match'));
  return results;
}

/** Prior batch ledgers in a content directory, oldest first, excluding one batch. */
function priorLedgers(contentDir, exceptBatch) {
  return fs.readdirSync(contentDir)
    .filter((d) => /^batch-\d{2}$/.test(d) && d !== exceptBatch)
    .sort()
    .map((d) => path.join(contentDir, d, 'ledger.json'))
    .filter((f) => fs.existsSync(f))
    .map(read);
}

module.exports = { checkAll, priorLedgers };

if (require.main === module) {
  const CONTENT = workspace().contentDir;
  const nn = (process.argv[2] || '').replace(/^batch-/, '');
  const planOnly = process.argv.includes('--plan');
  if (!/^\d{2}$/.test(nn)) {
    console.error('usage: node engine/gates/check-batch.js <NN> [--plan]');
    process.exit(2);
  }
  const batchDir = path.join(CONTENT, `batch-${nn}`);
  const planPath = path.join(batchDir, 'plan.json');
  const ledgerPath = path.join(batchDir, 'ledger.json');
  if (!fs.existsSync(planPath)) {
    console.error(`${planPath} not found. No plan, no batch.`);
    process.exit(1);
  }
  if (!planOnly && !fs.existsSync(ledgerPath)) {
    console.error(`${ledgerPath} not found. Run with --plan before generation, or write the ledger first.`);
    process.exit(1);
  }
  const results = checkAll({
    plan: read(planPath),
    ledger: planOnly ? null : read(ledgerPath),
    priors: priorLedgers(CONTENT, `batch-${nn}`),
  });
  for (const r of results) console.log(`\n===== ${r.label} =====\n${r.reportText}`);
  const failed = results.some((r) => !r.pass);
  if (planOnly) {
    console.log(failed ? '\nPLAN FAILS. Fix it before generating.' : '\nPLAN PASSES. Generation may read it.');
  } else {
    console.log(failed
      ? '\nBATCH DOES NOT SHIP: one or more gates failed.'
      : '\nALL GATES PASS. Not a verdict on quality; a person still reads the batch.');
  }
  process.exit(failed ? 1 : 0);
}
