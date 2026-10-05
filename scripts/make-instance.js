#!/usr/bin/env node
/**
 * make-instance.js
 *
 * Builds a client's repository from the core: the engine, the layouts, the
 * tests and CI, the client's brand workspace, and the instance workflows
 * (batch, brief, photos, scout, sync) set to that workspace. What never
 * ships: internal/ (Applied Intelligence's plans and contracts), other
 * clients' brands, this script, and anything generated.
 *
 *   node scripts/make-instance.js --brand clubpilot --out ../clubpilot-content
 *   node scripts/make-instance.js --brand clubpilot --out ../clubpilot-content --update
 *
 * The client's copy keeps the core's layout (brands/<brand>/ is the
 * workspace, CE_WORKSPACE in every workflow), so the tests, fixtures and
 * later core updates work in it unchanged. --update replaces only what the
 * core owns (engine, layouts, tests, CI, workflows, package files, AGENTS.md)
 * and never touches the client's workspace: its brand files, photos,
 * briefs, batches and feedback are theirs.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Owned by the core: replaced on --update.
const CORE = ['engine', 'layouts', 'test', 'package.json', 'package-lock.json', '.gitignore', 'CLAUDE.md'];
const SKIP = new Set(['node_modules', 'output', '.staging', 'needs-render.txt']);

function copyTree(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      if (SKIP.has(name)) continue;
      copyTree(path.join(from, name), path.join(to, name));
    }
  } else {
    fs.copyFileSync(from, to);
  }
}

// Core AGENTS.md text between these markers is about the core itself (internal/, this script).
const coreOnly = (text) => text.replace(/\n*<!-- core-only -->[\s\S]*?<!-- \/core-only -->/g, '');

function instanceAgents(brand, ws, core) {
  return `# ${brand.title} content engine

This repository is ${brand.title}'s licensed copy of Applied Intelligence's content engine. Everything
that belongs to ${brand.title} lives in \`${ws}/\`: brand files, photos, briefs, every batch, and the
feedback log. Every workflow sets \`CE_WORKSPACE=${ws}\`; export it when you run anything locally.

## What the reviewer asks for, and where it goes

| Ask | Where |
|---|---|
| New photos | The Drive folder's Inbox (\`photos.yml\` adds them). Locally: \`npm run photos:ingest\` then \`npm run photos:review\`. |
| "Never say X" / "always say Y" | \`${ws}/brand/BRAND.md\` (Live rule overrides, with the date). If a word must never ship, also a gate rule with a regression case (rule 1 below). |
| A month's plan, or ideas | A brief in the Drive folder's Briefs, or \`${ws}/briefs/\` (\`brief.yml\` reads it). |
| A different cadence or channel mix | \`${ws}/config.json\` \`cadence\`; then \`npm run doctor\`. |
| Different calls to action | \`${ws}/config.json\` \`cta.variants\` and \`cta.endCards\`. |
| A change to one draft | A note on the draft in Buffer (\`sync.yml\` revises it). |
| A batch now | Run the \`batch\` workflow with "force". |

## Never

- Commit a key, token or service-account file. Secrets live in the repository's Actions secrets only.
- Edit \`engine/\`, \`layouts/\` or \`test/\` to make a post pass. Those come from Applied Intelligence and
  are replaced on update; a change there needs \`npm test\` to pass and should be sent back upstream.
- Schedule or publish from code. Drafts only; the reviewer schedules.

\`npm run doctor\` says whether everything a live run needs is in place. This file is regenerated when
the engine is updated; notes for this repository go in \`${ws}/NOTES.md\`, which updates never touch.

---

${coreOnly(core).replace(/^# Working in content-engine\n/, '# Working in the engine\n')}`;
}

function instanceReadme(brand, ws) {
  return `# ${brand.title} content engine

Plans, writes and renders ${brand.title}'s social posts every two weeks and puts them in Buffer as
drafts for review. Nothing posts until a person schedules it.

- **Review:** edit captions in Buffer; leave a note on a draft to change its image; schedule to approve.
- **Steer:** drop a monthly content map in the Drive folder's Briefs.
- **Photos:** drop them in the Drive folder's Inbox; move them between Active, Parked and Retired.

Setup and the workflows: \`docs/INSTANCE.md\`. Rules for people and coding agents: \`AGENTS.md\`.
${brand.title}'s material is in \`${ws}/\`.
`;
}

function makeInstance({ brand: brandName, out, update = false, title }) {
  if (!brandName) throw new Error('--brand is required');
  if (!out) throw new Error('--out is required');
  const ws = `brands/${brandName}`;
  const src = path.join(ROOT, ws);
  if (!fs.existsSync(path.join(src, 'config.json'))) throw new Error(`${ws}/config.json not found`);
  const config = JSON.parse(fs.readFileSync(path.join(src, 'config.json'), 'utf8'));
  const brand = { title: title || config.brand || brandName };
  if (!update && fs.existsSync(out) && fs.readdirSync(out).filter((f) => f !== '.git').length) {
    throw new Error(`${out} is not empty; use --update to refresh an existing instance`);
  }
  if (update && !fs.existsSync(path.join(out, ws))) throw new Error(`${out} has no ${ws}; it is not an instance of this brand`);
  fs.mkdirSync(out, { recursive: true });

  for (const item of CORE) {
    const target = path.join(out, item);
    fs.rmSync(target, { recursive: true, force: true });
    copyTree(path.join(ROOT, item), target);
  }
  // The packager's own test needs the packager, which does not ship.
  fs.rmSync(path.join(out, 'test', 'instance.test.js'), { force: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
  delete pkg.scripts['test:instance'];
  pkg.scripts.test = pkg.scripts.test.split(' && ').filter((s) => !s.includes('instance.test.js')).join(' && ');
  fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  // CI, and the instance workflows set to this workspace.
  const wf = path.join(out, '.github', 'workflows');
  fs.mkdirSync(wf, { recursive: true });
  fs.copyFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), path.join(wf, 'ci.yml'));
  const workflows = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'instance', '.github', 'workflows'))) {
    const text = fs.readFileSync(path.join(ROOT, 'instance', '.github', 'workflows', f), 'utf8').split('__WS__').join(ws);
    fs.writeFileSync(path.join(wf, f), text);
    workflows.push(f);
  }
  fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'instance', 'README.md'), path.join(out, 'docs', 'INSTANCE.md'));
  fs.writeFileSync(path.join(out, 'AGENTS.md'), instanceAgents(brand, ws, fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')));
  if (!update || !fs.existsSync(path.join(out, 'README.md'))) fs.writeFileSync(path.join(out, 'README.md'), instanceReadme(brand, ws));

  // The client's workspace: copied once, never overwritten.
  const wsOut = path.join(out, ws);
  if (!update) copyTree(src, wsOut);
  return { out, ws, workflows, updated: update };
}

module.exports = { makeInstance, CORE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  try {
    const r = makeInstance({ brand: arg('brand'), out: arg('out') && path.resolve(arg('out')), update: argv.includes('--update'), title: arg('title') });
    console.log(`${r.updated ? 'Updated' : 'Created'} ${r.out}: core, CI, workflows (${r.workflows.join(', ')}), workspace ${r.ws}.`);
    if (!r.updated) {
      console.log('Next: git init, push to the client\'s private repository, add the Actions secrets (docs/INSTANCE.md), fill in config.json, then npm ci && npm run doctor.');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
