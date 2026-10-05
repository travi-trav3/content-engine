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
const TRANSCRIBE_API = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_TRANSCRIBE = 'gpt-4o-transcribe';
const RETRIES = 3;
const TIMEOUT_MS = 240000;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * The request body, separate so tests can check its shape without a network
 * call. images: data URLs (or https URLs) sent with the text, for the steps
 * that look at a photo.
 */
function requestBody({ model, system, user, schema, schemaName, reasoningEffort, images = [] }) {
  const content = images.length
    ? [{ type: 'input_text', text: user }, ...images.map((url) => ({ type: 'input_image', image_url: url }))]
    : user;
  const body = {
    model,
    instructions: system,
    input: [{ role: 'user', content }],
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

  async function generate({ system, user, schema, schemaName, images }) {
    const body = JSON.stringify(requestBody({ model, system, user, schema, schemaName, reasoningEffort, images }));
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

  /**
   * A recording's words, for source mode (the founder's voice memos). Sent as
   * the file itself; nothing but the transcript comes back or is kept.
   */
  async function transcribe({ buffer, filename, model: transcribeModel = DEFAULT_TRANSCRIBE }) {
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (attempt) await sleep(2000 * 2 ** (attempt - 1));
      const form = new FormData();
      form.append('file', new Blob([buffer]), filename);
      form.append('model', transcribeModel);
      form.append('response_format', 'json');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res;
      try {
        res = await fetchImpl(TRANSCRIBE_API, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal });
      } catch (e) {
        lastError = new Error(`OpenAI transcription failed: ${e.name === 'AbortError' ? 'timed out' : e.message}`);
        continue;
      } finally {
        clearTimeout(timer);
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenAI ${res.status}: ${(json.error && json.error.message) || 'retryable error'}`);
        continue;
      }
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(json.error && json.error.message) || 'transcription rejected'}`);
      if (typeof json.text !== 'string') throw new Error('OpenAI transcription returned no text');
      return { text: json.text, model: transcribeModel };
    }
    throw lastError;
  }

  return { name: 'openai', model, generate, transcribe };
}

module.exports = { createOpenAI, requestBody, outputText };
