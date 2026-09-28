/**
 * workspace.js
 *
 * Where a brand's material lives. A client instance keeps `brand/` and
 * `content/` at the repository root, which is the default. The core repo
 * keeps each fixture brand under `brands/<name>/` and points CE_WORKSPACE at
 * it (tests do this).
 *
 *   CE_WORKSPACE=brands/clubpilot node engine/gates/check-batch.js 05
 *
 * Resolved at call time, not require time, so a caller can set the
 * environment after loading a gate.
 */

'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function workspace() {
  const dir = process.env.CE_WORKSPACE ? path.resolve(ROOT, process.env.CE_WORKSPACE) : ROOT;
  return {
    root: ROOT,
    dir,
    brandDir: path.join(dir, 'brand'),
    contentDir: path.join(dir, 'content'),
    // Per-post templates from the session-era engine. Absent in new
    // workspaces; the brand gate skips its markup checks when missing.
    legacyTemplatesDir: path.join(dir, 'legacy-templates'),
  };
}

module.exports = { ROOT, workspace };
