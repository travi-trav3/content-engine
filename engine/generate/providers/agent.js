/**
 * agent.js
 *
 * The model is an agent: Codex in the client's ChatGPT account, on the
 * subscription, with no API key anywhere. The engine keeps every step it
 * owns (planning rules, gates, rewrites, renders); only the model's turn
 * changes hands.
 *
 * Each model call is an exchange in a directory (the workspace's exchange/):
 *
 *   requests/<id>.md          what the step asks: its instructions, its input,
 *                             any images (saved beside it), and the JSON schema
 *                             the answer must fit
 *   requests/<id>.schema.json the schema alone
 *   responses/<id>.json       the answer, written by the agent
 *   responses/<id>.req        the hash of the request it answers
 *
 * A call whose answer is there gets it, checked against the schema. A call
 * whose answer is missing, unreadable or off-schema throws Pending; the
 * command stops at the end of its stage and lists every open request. The
 * agent answers them and runs the command again: answered calls replay, so
 * the run continues where it stopped, and the gates and rewrites run on the
 * agent's answers exactly as on an API's. A request whose text changed since
 * it was answered (new gate findings, a changed brand file) is a new request:
 * the old answer is set aside as <id>.json.stale.
 *
 * Ids are the step's key (plan, post-3, founder-b07-f1, brief-<name>, ...),
 * with --2, --3 for a step's later calls in one run (a rewrite).
 *
 * The brand files lead most requests (about 100 KB). An agent working in the
 * repository reads them once, so its requests point at them by path instead
 * of repeating them; the Codex CLI provider (codex.js) answers from the
 * request alone and gets them in full.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { conforms } = require('../schema');

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

class Pending extends Error {
  constructor(id, request, reason = null) {
    super(`waiting for the answer to ${id}${reason ? `: ${reason}` : ''}`);
    this.pending = true;
    this.id = id;
    this.request = request;
    this.reason = reason;
  }
}
const isPending = (e) => Boolean(e && e.pending);

const safe = (key) => String(key).replace(/[^A-Za-z0-9._-]+/g, '_');

/** Brand files in a request become pointers to the files in the repository. */
function pointToBrandFiles(text, brandDir) {
  return String(text).replace(/<brand_file name="([^"]+)">[\s\S]*?<\/brand_file>/g,
    (m, name) => `<brand_file name="${name}" path="${path.relative(process.cwd(), path.join(brandDir, name)) || name}"/>`);
}

function requestText({ id, system, user, schema, schemaName, images, delivery, answerFile }) {
  const how = delivery === 'file'
    ? `Write the answer as JSON, and nothing else, to:\n\n    ${answerFile}\n\nThe engine checks it against the schema at the end, then runs its gates and rewrites on it as on any model's answer. Brand files given by path are in the repository; read each once per session.`
    : 'Reply with the JSON answer only, fitting the schema at the end.';
  return [
    `# Request ${id} (${schemaName || 'answer'})`,
    '',
    how,
    '',
    '## Instructions',
    '',
    String(system || '').trim(),
    '',
    '## Input',
    '',
    String(user || '').trim(),
    ...(images.length ? ['', '## Images', '', ...images.map((f) => `- ${f}`)] : []),
    '',
    '## Answer schema',
    '',
    '```json',
    JSON.stringify(schema, null, 2),
    '```',
    '',
  ].join('\n');
}

function saveImage(dir, id, i, url) {
  const m = /^data:image\/(\w+);base64,(.*)$/s.exec(String(url));
  if (!m) return String(url);
  const file = path.join(dir, `${id}-image-${i + 1}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
  fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
  return file;
}

/**
 * The exchange. answer: an optional async ({ id, requestFile, responseFile,
 * schemaFile, images }) that tries to produce the answer itself (the Codex
 * CLI provider); without it, the agent running the command answers.
 */
function createExchange({ dir, brandDir, pointToBrand = true, delivery = 'file', answer = null, name = 'agent', model = null }) {
  const requests = path.join(dir, 'requests');
  const responses = path.join(dir, 'responses');
  const seen = new Map();
  const pending = [];
  const calls = [];

  async function generate({ key, system, user, schema, schemaName, images = [] }) {
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    const id = n === 1 ? safe(key) : `${safe(key)}--${n}`;
    fs.mkdirSync(requests, { recursive: true });
    fs.mkdirSync(responses, { recursive: true });
    const requestFile = path.join(requests, `${id}.md`);
    const schemaFile = path.join(requests, `${id}.schema.json`);
    const responseFile = path.join(responses, `${id}.json`);
    const imageFiles = images.map((url, i) => saveImage(requests, id, i, url));
    const body = requestText({
      id, system, user: pointToBrand && brandDir ? pointToBrandFiles(user, brandDir) : user, schema, schemaName, images: imageFiles, delivery,
      answerFile: path.relative(process.cwd(), responseFile),
    });
    // Each answer keeps the hash of the request it answers (responses/<id>.req),
    // so answers alone can be kept between runs (a scheduled run that stopped
    // at a usage limit) and a changed request still gets a fresh answer.
    const hashFile = path.join(responses, `${id}.req`);
    const current = sha(body);
    const before = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim()
      : fs.existsSync(requestFile) ? sha(fs.readFileSync(requestFile, 'utf8')) : null;
    if (before !== null && before !== current && fs.existsSync(responseFile)) fs.renameSync(responseFile, `${responseFile}.stale`);
    if (before !== current || !fs.existsSync(requestFile)) {
      fs.writeFileSync(requestFile, body);
      fs.writeFileSync(schemaFile, `${JSON.stringify(schema, null, 2)}\n`);
      fs.writeFileSync(hashFile, `${current}\n`);
    }
    calls.push({ key, id, schemaName });
    if (!fs.existsSync(responseFile) && answer) await answer({ id, requestFile, responseFile, schemaFile, images: imageFiles.filter((f) => fs.existsSync(f)) });
    const wait = (reason) => {
      pending.push({ id, request: path.relative(process.cwd(), requestFile), reason });
      return new Pending(id, requestFile, reason);
    };
    if (!fs.existsSync(responseFile)) throw wait(null);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
    } catch (e) {
      throw wait(`the answer is not valid JSON (${e.message})`);
    }
    const errors = conforms(schema, data);
    if (errors.length) throw wait(`the answer does not fit the schema: ${errors.slice(0, 6).join('; ')}`);
    return { data, usage: { input: 0, cachedInput: 0, output: 0 } };
  }

  /** Clears the exchange (after a finished run, or to start over). */
  function reset() {
    fs.rmSync(dir, { recursive: true, force: true });
    pending.length = 0;
    seen.clear();
  }

  return { name, model, generate, pending, calls, dir, reset };
}

function createAgent({ dir, brandDir } = {}) {
  return createExchange({ dir, brandDir, pointToBrand: true, delivery: 'file', name: 'agent', model: 'the agent running the engine' });
}

module.exports = { createAgent, createExchange, Pending, isPending, requestText, pointToBrandFiles };
