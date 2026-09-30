/**
 * openai.js
 *
 * The OpenAI provider: one call to the Responses API per step, with the
 * output held to a strict JSON schema (structured outputs), so the engine
 * receives data it can validate rather than prose it has to parse.
 *
 * Uses fetch (Node 20+) and no SDK. The key comes from the environment
 * variable named in config.json (OPENAI_API_KEY by default), which in
 * GitHub Actions is a repository secret. It is never written to disk,
 * logged, or passed to anything but this request.
 *
 * Retries 429 and 5xx responses with backoff; anything else fails the step
 * with the API's own error message.
 */

'use strict';

const API = 'https://api.openai.com/v1/responses';
const RETRIES = 3;
const TIMEOUT_MS = 240000;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** The request body, separate so tests can check its shape without a network call. */
function requestBody({ model, system, user, schema, schemaName, reasoningEffort }) {
  const body = {
    model,
    instructions: system,
    input: [{ role: 'user', content: user }],
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
    store: false,
  };
  if (reasoningEffort) body.reasoning = { effort: reasoningEffort };
  return body;
}

/** The JSON text of a Responses API result, or a clear error. */
function outputText(json) {
  if (json.status && json.status !== 'completed') {
    const why = json.incomplete_details && json.incomplete_details.reason;
    throw new Error(`OpenAI response ${json.status}${why ? ` (${why})` : ''}`);
  }
  for (const item of json.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type === 'refusal') throw new Error(`OpenAI refused: ${c.refusal}`);
      if (c.type === 'output_text') return c.text;
    }
  }
  throw new Error('OpenAI response had no output text');
}

function createOpenAI({ model, apiKeyEnv = 'OPENAI_API_KEY', reasoningEffort, fetchImpl = globalThis.fetch } = {}) {
  if (!model) throw new Error('config.json provider.model is required for the OpenAI provider');
  const key = process.env[apiKeyEnv];
  if (!key) throw new Error(`${apiKeyEnv} is not set. Add it as a repository secret (Actions) or export it locally.`);

  async function generate({ system, user, schema, schemaName }) {
    const body = JSON.stringify(requestBody({ model, system, user, schema, schemaName, reasoningEffort }));
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (attempt) await sleep(2000 * 2 ** (attempt - 1));
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res;
      try {
        res = await fetchImpl(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body,
          signal: ctrl.signal,
        });
      } catch (e) {
        lastError = new Error(`OpenAI request failed: ${e.name === 'AbortError' ? 'timed out' : e.message}`);
        continue;
      } finally {
        clearTimeout(timer);
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenAI ${res.status}: ${(json.error && json.error.message) || 'retryable error'}`);
        continue;
      }
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(json.error && json.error.message) || 'request rejected'}`);
      const usage = json.usage || {};
      return {
        data: JSON.parse(outputText(json)),
        usage: {
          input: usage.input_tokens || 0,
          cachedInput: (usage.input_tokens_details && usage.input_tokens_details.cached_tokens) || 0,
          output: usage.output_tokens || 0,
        },
      };
    }
    throw lastError;
  }

  return { name: 'openai', model, generate };
}

module.exports = { createOpenAI, requestBody, outputText };
