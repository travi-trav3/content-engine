/**
 * mock.js
 *
 * A stand-in provider that answers from recorded responses, for tests and
 * for dry runs before an API key exists. Each call names a key (the plan,
 * or one post by its slot); the response is read from <dir>/<key>.json.
 * A file holding an array answers successive calls with successive
 * entries, so a test can script a first answer that fails the gates and a
 * revision that passes.
 *
 * Every call is recorded (key, system, user, schema name), so a test can
 * check what the engine asked, for example that gate failures were fed
 * back into a revision.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function createMock({ dir }) {
  if (!dir) throw new Error('The mock provider needs a directory of recorded responses');
  const calls = [];
  const served = new Map();

  async function generate({ key, system, user, schemaName, images }) {
    calls.push({ key, system, user, schemaName, images: images || [] });
    const file = path.join(dir, `${key}.json`);
    if (!fs.existsSync(file)) throw new Error(`mock: no recorded response for "${key}" (${file})`);
    const recorded = JSON.parse(fs.readFileSync(file, 'utf8'));
    let data = recorded;
    if (Array.isArray(recorded)) {
      const i = served.get(key) || 0;
      data = recorded[Math.min(i, recorded.length - 1)];
      served.set(key, i + 1);
    }
    return { data: JSON.parse(JSON.stringify(data)), usage: { input: 0, cachedInput: 0, output: 0 } };
  }

  return { name: 'mock', model: 'recorded', generate, calls };
}

module.exports = { createMock };
