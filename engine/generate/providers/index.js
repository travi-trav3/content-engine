/**
 * The provider named in config.json, or one given on the command line.
 * The engine only ever calls provider.generate({ key, system, user, schema,
 * schemaName }) and gets back { data, usage }, so adding a provider is one
 * file here and nothing else.
 */

'use strict';

const { createOpenAI } = require('./openai');
const { createMock } = require('./mock');

function createProvider(config = {}, overrides = {}) {
  const p = { ...(config.provider || {}), ...overrides };
  if (p.name === 'mock') return createMock({ dir: p.dir });
  if (p.name === 'openai') return createOpenAI(p);
  throw new Error(`Unknown provider "${p.name}" (have: openai, mock)`);
}

module.exports = { createProvider };
