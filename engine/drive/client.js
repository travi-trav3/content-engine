/**
 * client.js
 *
 * Google Drive, for the folders the reviewer works in: the photo library
 * (Inbox, Active, Parked, Retired, Needs a look) and Briefs. Drive API v3
 * over fetch, no SDK. Authenticates as a Google Cloud service account
 * whose key JSON is in the environment variable config.json names
 * (drive.credentialsEnv, GOOGLE_SERVICE_ACCOUNT_JSON); the reviewer shares
 * the root folder with the service account's email as an editor. The
 * account sees nothing else.
 *
 *   const drive = createDrive({ credentials })
 *   await drive.listFolder(id)          files in a folder (not trashed)
 *   await drive.download(id)            a file's bytes (Google Docs exported as .docx)
 *   await drive.move(id, { to, from })  a file into another folder
 *   await drive.describe(id, text)      set a file's description (what Drive shows under Details)
 *   await drive.upload(folderId, { name, mimeType, data, description })
 *   await drive.ensureFolders(rootId, ['Inbox', ...])  ids by name, creating what is missing
 */

'use strict';

const crypto = require('crypto');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER = 'application/vnd.google-apps.folder';
const GOOGLE_DOC = 'application/vnd.google-apps.document';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FIELDS = 'id,name,mimeType,description,md5Checksum,modifiedTime,size,parents';
// Shared drives and My Drive alike.
const ALL = 'supportsAllDrives=true';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A signed JWT assertion for the service account (RFC 7523). */
function assertion(credentials, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: credentials.client_email, scope: SCOPE, aud: TOKEN, iat, exp: iat + 3600 }));
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(credentials.private_key);
  return `${header}.${claims}.${b64url(signature)}`;
}

function createDrive({ credentials, credentialsEnv = 'GOOGLE_SERVICE_ACCOUNT_JSON', fetchImpl = fetch, retries = 3 } = {}) {
  const creds = credentials || (process.env[credentialsEnv] ? JSON.parse(process.env[credentialsEnv]) : null);
  if (!creds || !creds.client_email || !creds.private_key) throw new Error(`No Google service account key: set ${credentialsEnv} to the key JSON`);
  let token = null;
  let expires = 0;

  async function accessToken() {
    if (token && Date.now() < expires - 60000) return token;
    const res = await fetchImpl(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion(creds)}`,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new Error(`Google token request failed (${res.status}): ${json.error_description || json.error || 'no token'}`);
    token = json.access_token;
    expires = Date.now() + (json.expires_in || 3600) * 1000;
    return token;
  }

  async function call(url, init = {}, as = 'json') {
    let last;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt) await sleep(1000 * 2 ** attempt);
      const res = await fetchImpl(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${await accessToken()}` } });
      if (res.status === 429 || res.status >= 500) { last = new Error(`Drive ${res.status}`); continue; }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Drive ${res.status}: ${body.slice(0, 300)}`);
      }
      if (as === 'buffer') return Buffer.from(await res.arrayBuffer());
      return res.json();
    }
    throw last;
  }

  async function listFolder(folderId, { foldersOnly = false } = {}) {
    const q = `'${folderId}' in parents and trashed=false${foldersOnly ? ` and mimeType='${FOLDER}'` : ''}`;
    const out = [];
    let pageToken = '';
    do {
      const url = `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}&pageSize=1000&includeItemsFromAllDrives=true&${ALL}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const json = await call(url);
      out.push(...(json.files || []));
      pageToken = json.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async function download(id, mimeType) {
    if (mimeType === GOOGLE_DOC) return call(`${API}/files/${id}/export?mimeType=${encodeURIComponent(DOCX)}`, {}, 'buffer');
    return call(`${API}/files/${id}?alt=media&${ALL}`, {}, 'buffer');
  }

  async function move(id, { to, from }) {
    return call(`${API}/files/${id}?addParents=${to}&removeParents=${from}&fields=${FIELDS}&${ALL}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
    });
  }

  async function describe(id, description) {
    return call(`${API}/files/${id}?fields=${FIELDS}&${ALL}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description }),
    });
  }

  async function upload(folderId, { name, mimeType, data, description }) {
    const boundary = `ce-${crypto.randomBytes(8).toString('hex')}`;
    const meta = JSON.stringify({ name, parents: [folderId], ...(description ? { description } : {}) });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    return call(`${UPLOAD}?uploadType=multipart&fields=${FIELDS}&${ALL}`, {
      method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body,
    });
  }

  async function createFolder(parentId, name) {
    return call(`${API}/files?fields=${FIELDS}&${ALL}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
    });
  }

  async function ensureFolders(rootId, names) {
    const have = new Map((await listFolder(rootId, { foldersOnly: true })).map((f) => [f.name.toLowerCase(), f.id]));
    const out = {};
    for (const [role, name] of Object.entries(names)) {
      out[role] = have.get(name.toLowerCase()) || (await createFolder(rootId, name)).id;
    }
    return out;
  }

  return { name: 'drive', listFolder, download, move, describe, upload, ensureFolders };
}

module.exports = { createDrive, assertion, FOLDER, GOOGLE_DOC, DOCX };
