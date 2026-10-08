/**
 * codex.js
 *
 * The model is Codex, on the client's ChatGPT subscription: each request in
 * the exchange (agent.js) is answered by one `codex exec` run, unattended, in
 * an empty directory with a read-only sandbox, held to the request's JSON
 * schema (--output-schema). This is how scheduled runs (GitHub Actions) and
 * any computer logged in to Codex write without an API key.
 *
 * Login: with CODEX_AUTH_KEY set and the workspace's codex-auth.enc present,
 * the client's ChatGPT login is restored into a private CODEX_HOME for the
 * run and saved back if Codex refreshed it (codex-auth.js); otherwise the
 * CLI uses whatever login the computer has. The CLI comes from npm on first
 * use (config.json provider.cli overrides, e.g. ["codex"] where it is
 * installed).
 *
 * Answers stay in the exchange, so a run that stops (a usage limit, a
 * timeout) picks up where it left off on the same computer.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createExchange } = require('./agent');
const codexAuth = require('../../codex-auth');

const DEFAULT_CLI = ['npx', '--yes', '@openai/codex@latest'];
// Flags this provider relies on; the preflight checks the CLI still has them.
const FLAGS = ['--sandbox', '--skip-git-repo-check', '--output-schema', '--output-last-message', '--model', '--image'];

function run(cmd, args, { cwd, env, input, timeoutMs, spawnImpl = spawn }) {
  return new Promise((resolve) => {
    const child = spawnImpl(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: `${stderr}\n${e.message}` }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: killed ? -2 : code, stdout, stderr: killed ? `${stderr}\ntimed out` : stderr }); });
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** The JSON in Codex's last message (a fenced block is unwrapped). */
function extractJson(text) {
  const t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('no JSON in the answer');
  const json = t.slice(start, end + 1);
  JSON.parse(json);
  return json;
}

function createCodex({ dir, model = null, cli, blobFile, keyEnv = 'CODEX_AUTH_KEY', env = process.env, timeoutMs = 10 * 60 * 1000, spawnImpl, log = () => {} } = {}) {
  const command = cli && cli.length ? cli : (env.CODEX_CLI ? [env.CODEX_CLI] : DEFAULT_CLI);
  let home = null;
  let hash = null;
  const key = env[keyEnv];
  const prepare = () => {
    if (home !== null) return;
    if (key && blobFile && fs.existsSync(blobFile)) {
      home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
      hash = codexAuth.restore({ blobFile, key, home });
    } else {
      home = '';
    }
  };
  const keep = () => {
    if (!home) return;
    const h = codexAuth.save({ blobFile, key, home, previous: hash });
    if (h) { hash = h; log({ step: 'codex-auth', refreshed: true }); }
  };

  async function answer({ id, requestFile, responseFile, schemaFile, images }) {
    prepare();
    const out = `${responseFile}.codex`;
    const args = [
      ...command.slice(1), 'exec',
      '--sandbox', 'read-only', '--skip-git-repo-check',
      '--output-schema', schemaFile, '--output-last-message', out,
      ...(model ? ['--model', model] : []),
      ...images.flatMap((f) => ['--image', f]),
      '-',
    ];
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-run-'));
    const r = await run(command[0], args, {
      cwd, env: home ? { ...env, CODEX_HOME: home } : env, input: fs.readFileSync(requestFile), timeoutMs, spawnImpl,
    });
    keep();
    fs.rmSync(cwd, { recursive: true, force: true });
    log({ step: 'codex', id, code: r.code });
    if (r.code !== 0 || !fs.existsSync(out)) {
      const tail = `${r.stderr}\n${r.stdout}`.trim().split('\n').slice(-8).join(' | ');
      const e = new Error(`Codex could not answer ${id} (exit ${r.code}): ${tail || 'no output'}`);
      e.limit = /usage limit|rate limit|quota|too many requests|try again (at|in)/i.test(tail);
      e.login = /not logged in|log ?in again|unauthori[sz]ed|\b401\b|refresh token/i.test(tail);
      throw e;
    }
    try {
      fs.writeFileSync(responseFile, `${extractJson(fs.readFileSync(out, 'utf8'))}\n`);
    } finally {
      fs.rmSync(out, { force: true });
    }
  }

  return createExchange({ dir, pointToBrand: false, delivery: 'reply', answer, name: 'codex', model: model || 'Codex default' });
}

module.exports = { createCodex, extractJson, run, DEFAULT_CLI, FLAGS };
