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

const ROOT = __dirname;
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
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const priors = fs.readdirSync(CONTENT)
  .filter((d) => /^batch-\d{2}$/.test(d) && d !== `batch-${nn}`)
  .sort()
  .map((d) => path.join(CONTENT, d, 'ledger.json'))
  .filter((f) => fs.existsSync(f));

let failed = false;
function run(label, fn) {
  console.log(`\n===== ${label} =====`);
  try {
    const result = fn();
    console.log(result.reportText);
    if (!result.pass) failed = true;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    failed = true;
  }
}

/* -- plan ----------------------------------------------------------- */
if (!fs.existsSync(planPath)) {
  console.error(`${planPath} not found. No plan, no batch.`);
  process.exit(1);
}
const plan = require(path.join(ROOT, 'plan-gate.js'));
run('plan gate', () => {
  const r = plan.checkPlan(read(planPath), priors.map(read));
  return { pass: r.pass, reportText: plan.report(r) };
});

if (planOnly) {
  console.log(failed ? '\nPLAN FAILS. Fix it before generating.' : '\nPLAN PASSES. Generation may read it.');
  process.exit(failed ? 1 : 0);
}

/* -- ledger --------------------------------------------------------- */
if (!fs.existsSync(ledgerPath)) {
  console.error(`${ledgerPath} not found. Run with --plan before generation, or write the ledger first.`);
  process.exit(1);
}
const ledger = read(ledgerPath);

const capability = require(path.join(ROOT, 'capability-gate.js'));
run('capability gate', () => {
  const r = capability.checkBatch(ledger, workspace().brandDir);
  return { pass: r.pass, reportText: capability.report(r) };
});

const editorial = require(path.join(ROOT, 'editorial-gate.js'));
run('editorial gate', () => {
  const r = editorial.checkBatch(ledger);
  return { pass: r.pass, reportText: editorial.report(r) };
});

const rotation = require(path.join(ROOT, 'rotation-gate.js'));
run('rotation gate', () => {
  const r = rotation.checkBatch(ledger, priors.map(read));
  return { pass: r.pass, reportText: rotation.report(r) };
});

const diversity = require(path.join(ROOT, 'diversity-gate.js'));
run('diversity gate', () => {
  const r = diversity.checkBatch(ledger, priors.map(read));
  return { pass: r.pass, reportText: diversity.report(r) };
});

const brand = require(path.join(ROOT, 'brand-gate.js'));
run('brand gate', () => {
  const r = brand.checkBatch(ledger);
  return { pass: r.pass, reportText: brand.report(r) };
});

const stat = require(path.join(ROOT, 'stat-gate.js'));
run('stat gate', () => {
  const r = stat.checkBatch(ledger);
  return { pass: r.pass, reportText: stat.report(r) };
});

run('plan match', () => {
  const r = plan.checkLedgerAgainstPlan(ledger, read(planPath));
  return { pass: r.pass, reportText: plan.report(r, 'plan match') };
});

console.log(failed
  ? '\nBATCH DOES NOT SHIP: one or more gates failed.'
  : '\nALL GATES PASS. Not a verdict on quality; a person still reads the batch.');
process.exit(failed ? 1 : 0);
