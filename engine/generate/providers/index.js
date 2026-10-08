/**
 * The provider named in config.json, or one given on the command line.
 * The engine only ever calls provider.generate({ key, system, user, schema,
 * schemaName, images }) and gets back { data, usage }, so adding a provider
 * is one file here and nothing else.
 *
 *   codex    Codex on the client's ChatGPT subscription, one `codex exec` per
 *            request (scheduled runs; no API key)
 *   agent    the agent running the command answers each request itself
 *            (Codex in the client's ChatGPT, working in the repository)
 *   openai   the OpenAI API with a key (billed per token)
 *   mock     recorded answers, for tests
 */

'use strict';

const path = require('path');
const { workspace } = require('../../lib/workspace');
const { createOpenAI } = require('./openai');
const { createMock } = require('./mock');
const { createAgent, isPending, Pending } = require('./agent');
const { createCodex } = require('./codex');

// The workspace's exchange/: answers (small) are kept by the workflows until a run
// finishes, so a run stopped by a usage limit resumes; requests are rebuilt each run.
const exchangeDir = () => path.join(workspace().dir, 'exchange');

function createProvider(config = {}, overrides = {}) {
  const p = { ...(config.provider || {}), ...overrides };
  if (p.name === 'mock') return createMock({ dir: p.dir });
  if (p.name === 'openai') return createOpenAI(p);
  if (p.name === 'agent') return createAgent({ dir: p.dir || exchangeDir(), brandDir: workspace().brandDir });
  if (p.name === 'codex') {
    return createCodex({
      dir: p.dir || exchangeDir(), model: p.model || null, cli: p.cli || null,
      blobFile: path.join(workspace().dir, 'codex-auth.enc'), log: p.log,
    });
  }
  throw new Error(`Unknown provider "${p.name}" (have: codex, agent, openai, mock)`);
}

module.exports = { createProvider, isPending, Pending, exchangeDir };
