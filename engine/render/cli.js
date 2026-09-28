#!/usr/bin/env node
/**
 * Render one layout from a props file.
 *
 *   node engine/render/cli.js --layout type-card --props props.json --out renders/
 *       [--surface dark|light] [--size ig|li|all]
 *
 * With --size all (the default) it writes <out>/<layout>-<surface>-<size>.png
 * for every platform size. Exits 1 if any render reports an issue, so a
 * broken render never reaches the assets repo.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createRenderer, SIZES } = require('./render');

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

(async () => {
  const a = args(process.argv.slice(2));
  if (!a.layout || !a.props || !a.out) {
    console.error('usage: node engine/render/cli.js --layout <id> --props <file.json> --out <dir> [--surface <s>] [--size ig|li|all]');
    process.exit(2);
  }
  const props = JSON.parse(fs.readFileSync(a.props, 'utf8'));
  const sizes = !a.size || a.size === 'all' ? Object.keys(SIZES) : [a.size];
  const renderer = await createRenderer();
  let failed = false;
  try {
    for (const size of sizes) {
      const r = await renderer.render({ layout: a.layout, surface: a.surface, size, props });
      const file = path.join(a.out, `${a.layout}-${r.surface}-${size}.png`);
      fs.mkdirSync(a.out, { recursive: true });
      fs.writeFileSync(file, r.png);
      console.log(`${file}  ${r.width}x${r.height}  fit step ${r.fitStep}  ${r.sha256.slice(0, 12)}`);
      for (const issue of r.issues) console.log(`  ISSUE ${issue.rule}: ${issue.detail}`);
      if (r.issues.length) failed = true;
    }
  } finally {
    await renderer.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
