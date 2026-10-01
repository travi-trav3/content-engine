/**
 * host.js
 *
 * Where rendered images live once Buffer needs them. Buffer takes an image
 * by URL, so every render is published before its draft is created.
 *
 *   github   commits the file to a public repository through the contents
 *            API and serves it from raw.githubusercontent.com. The repository
 *            holds images only (config.json assets.repo); the token is
 *            scoped to it (assets.tokenEnv, ASSETS_PUSH_TOKEN).
 *   mock     keeps files in memory and answers with https://assets.test/...
 *            URLs. Tests and dry runs.
 *
 * Names are content-hashed (b07-03-1a2b3c4d5e.png): a changed render gets a
 * new URL, so the CDN can never serve stale bytes under a reused name (the
 * Aug 2026 stale-image defect). After upload the URL is fetched and its
 * sha256 compared with the file before anyone hands it to Buffer.
 *
 *   const host = createHost(config)
 *   const { url, sha256 } = await host.publish('/abs/render.png', 'batch-07/b07-03.png')
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** batch-07/b07-03.png + bytes -> batch-07/b07-03-1a2b3c4d5e.png */
function hashedKey(key, digest) {
  const ext = path.extname(key);
  return `${key.slice(0, key.length - ext.length)}-${digest.slice(0, 10)}${ext}`;
}

function createGithubHost({ repo, branch = 'main', token, fetchImpl = fetch, verifyTries = 8, verifyDelayMs = 3000 }) {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`assets.repo must be "owner/name", got "${repo}"`);
  if (!token) throw new Error('No token for the assets repository (config.json assets.tokenEnv)');
  const api = `https://api.github.com/repos/${repo}/contents`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'content-engine',
  };
  const urlOf = (key) => `https://raw.githubusercontent.com/${repo}/${branch}/${key}`;
  const encodePath = (key) => key.split('/').map(encodeURIComponent).join('/');

  async function exists(key) {
    const res = await fetchImpl(`${api}/${encodePath(key)}?ref=${encodeURIComponent(branch)}`, { headers });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`assets: checking ${key} returned ${res.status}`);
    return true;
  }

  async function upload(key, buf) {
    const res = await fetchImpl(`${api}/${encodePath(key)}`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ message: `assets: ${key}`, content: buf.toString('base64'), branch }),
    });
    // 422: the path appeared since the check (same name means same bytes).
    if (res.status === 422 && await exists(key)) return;
    if (!res.ok) throw new Error(`assets: uploading ${key} returned ${res.status} ${await res.text()}`);
  }

  async function verify(url, digest) {
    let last = '';
    for (let i = 0; i < verifyTries; i += 1) {
      const res = await fetchImpl(url, { headers: { 'user-agent': 'content-engine' } });
      if (res.ok) {
        const got = sha256(Buffer.from(await res.arrayBuffer()));
        if (got === digest) return;
        last = `sha256 ${got.slice(0, 10)} instead of ${digest.slice(0, 10)}`;
      } else {
        last = `HTTP ${res.status}`;
      }
      if (i < verifyTries - 1) await sleep(verifyDelayMs);
    }
    throw new Error(`assets: ${url} did not serve the uploaded bytes (${last})`);
  }

  async function publish(file, key) {
    const buf = fs.readFileSync(file);
    const digest = sha256(buf);
    const name = hashedKey(key, digest);
    if (!await exists(name)) await upload(name, buf);
    const url = urlOf(name);
    await verify(url, digest);
    return { url, sha256: digest, key: name };
  }

  return { name: 'github', publish };
}

function createMockHost() {
  const files = new Map();
  async function publish(file, key) {
    const buf = fs.readFileSync(file);
    const digest = sha256(buf);
    const name = hashedKey(key, digest);
    files.set(name, buf);
    return { url: `https://assets.test/${name}`, sha256: digest, key: name };
  }
  return { name: 'mock', publish, files };
}

/** The host config.json names (assets.host), or the one given. */
function createHost(config = {}, overrides = {}) {
  const a = { ...(config.assets || {}), ...overrides };
  if (a.host === 'mock') return createMockHost();
  if (a.host === 'github') {
    return createGithubHost({ ...a, token: a.token || process.env[a.tokenEnv || 'ASSETS_PUSH_TOKEN'] });
  }
  throw new Error(`Unknown assets host "${a.host}" (have: github, mock)`);
}

module.exports = { createHost, createGithubHost, createMockHost, hashedKey, sha256 };
