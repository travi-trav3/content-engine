#!/usr/bin/env node
/**
 * codex-auth.js
 *
 * The client's ChatGPT login for the Codex CLI, so scheduled runs write on
 * the client's subscription instead of an API key. OpenAI's guidance for
 * Codex in CI with a ChatGPT login: seed ~/.codex/auth.json from secure
 * storage, let Codex refresh it in place, and keep the refreshed copy for
 * the next run. Here the copy lives in the workspace as codex-auth.enc,
 * encrypted (AES-256-GCM) with a key that exists only as the repository
 * secret CODEX_AUTH_KEY; the workflows commit it back when Codex refreshed
 * it. The file is useless without the key; treat both as the client's
 * password. Never for a public repository.
 *
 *   node engine/codex-auth.js seed     after `codex login` on a computer the client trusts:
 *                                      encrypts ~/.codex/auth.json into the workspace and prints
 *                                      the key to add as CODEX_AUTH_KEY (once)
 *   node engine/codex-auth.js check    decrypts with CODEX_AUTH_KEY and says whether a login is there
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function keyBytes(key) {
  const k = Buffer.from(String(key || '').trim(), 'base64');
  if (k.length !== 32) throw new Error('CODEX_AUTH_KEY must be 32 random bytes, base64 (node engine/codex-auth.js seed makes one)');
  return k;
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBytes(key), iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return `${JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }, null, 2)}\n`;
}

function decrypt(blob, key) {
  const b = JSON.parse(blob);
  const d = crypto.createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(b.iv, 'base64'));
  d.setAuthTag(Buffer.from(b.tag, 'base64'));
  try {
    return Buffer.concat([d.update(Buffer.from(b.data, 'base64')), d.final()]);
  } catch {
    throw new Error('codex-auth.enc does not open with CODEX_AUTH_KEY (wrong key, or the file was changed)');
  }
}

/** Writes the login into home/auth.json. Returns its hash, to tell later whether Codex refreshed it. */
function restore({ blobFile, key, home }) {
  const plain = decrypt(fs.readFileSync(blobFile, 'utf8'), key);
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'auth.json'), plain, { mode: 0o600 });
  return sha(plain);
}

/** Saves home/auth.json back into the blob when Codex refreshed it. Returns the new hash, or null if unchanged. */
function save({ blobFile, key, home, previous }) {
  const file = path.join(home, 'auth.json');
  if (!fs.existsSync(file)) return null;
  const plain = fs.readFileSync(file);
  const h = sha(plain);
  if (h === previous) return null;
  fs.writeFileSync(blobFile, encrypt(plain, key));
  return h;
}

module.exports = { encrypt, decrypt, restore, save, keyBytes };

if (require.main === module) {
  const { workspace } = require('./lib/workspace');
  const ws = workspace();
  const blobFile = path.join(ws.dir, 'codex-auth.enc');
  const cmd = process.argv[2];
  try {
    if (cmd === 'seed') {
      const from = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'auth.json');
      if (!fs.existsSync(from)) throw new Error(`${from} not found. Run \`codex login\` first and sign in with the client's ChatGPT account.`);
      const fresh = !process.env.CODEX_AUTH_KEY;
      const key = process.env.CODEX_AUTH_KEY || crypto.randomBytes(32).toString('base64');
      fs.writeFileSync(blobFile, encrypt(fs.readFileSync(from), key));
      console.log(`Wrote ${path.relative(process.cwd(), blobFile)}. Commit it.`);
      if (fresh) console.log(`\nAdd this as the repository secret CODEX_AUTH_KEY (Settings, Secrets and variables, Actions). It is shown once:\n\n${key}\n`);
    } else if (cmd === 'check') {
      if (!process.env.CODEX_AUTH_KEY) throw new Error('CODEX_AUTH_KEY is not set');
      const auth = JSON.parse(decrypt(fs.readFileSync(blobFile, 'utf8'), process.env.CODEX_AUTH_KEY).toString('utf8'));
      const kind = auth.tokens ? 'a ChatGPT login' : auth.OPENAI_API_KEY ? 'an API key (this bills the API, not the subscription)' : 'no login';
      console.log(`codex-auth.enc opens and holds ${kind}${auth.last_refresh ? `, last refreshed ${auth.last_refresh}` : ''}.`);
    } else {
      console.log('usage: node engine/codex-auth.js seed|check');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
