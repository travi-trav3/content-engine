/**
 * mock.js
 *
 * An in-memory Drive with the client's methods, for tests and dry runs. It
 * also plays the reviewer: drop() puts a file in a folder, moveTo() drags a
 * file to another folder, trash() deletes one.
 */

'use strict';

const crypto = require('crypto');

function createMockDrive({ root = 'root' } = {}) {
  const files = new Map();
  const calls = [];
  let seq = 0;
  const nextId = () => `f${(seq += 1).toString().padStart(4, '0')}`;
  const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
  const view = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, description: f.description || '', md5Checksum: f.md5, modifiedTime: f.modifiedTime, size: String(f.data ? f.data.length : 0), parents: [f.parent] });
  files.set(root, { id: root, name: 'root', mimeType: 'application/vnd.google-apps.folder', parent: null });

  const api = {
    name: 'mock',
    calls,
    files,
    async listFolder(folderId, { foldersOnly = false } = {}) {
      calls.push({ op: 'listFolder', folderId });
      return [...files.values()].filter((f) => f.parent === folderId && !f.trashed
        && (!foldersOnly || f.mimeType === 'application/vnd.google-apps.folder')).map(view);
    },
    async download(id) {
      calls.push({ op: 'download', id });
      const f = files.get(id);
      if (!f || f.trashed) throw new Error(`Drive 404: ${id}`);
      return Buffer.from(f.data);
    },
    async move(id, { to, from }) {
      calls.push({ op: 'move', id, to, from });
      const f = files.get(id);
      if (f.parent !== from) throw new Error(`Drive 400: ${id} is not in ${from}`);
      f.parent = to;
      return view(f);
    },
    async describe(id, description) {
      calls.push({ op: 'describe', id });
      files.get(id).description = description;
      return view(files.get(id));
    },
    async upload(folderId, { name, mimeType, data, description }) {
      calls.push({ op: 'upload', folderId, name });
      const f = { id: nextId(), name, mimeType, data: Buffer.from(data), md5: md5(data), parent: folderId, description: description || '', modifiedTime: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString() };
      files.set(f.id, f);
      return view(f);
    },
    async ensureFolders(rootId, names) {
      const out = {};
      for (const [role, name] of Object.entries(names)) {
        let f = [...files.values()].find((x) => x.parent === rootId && x.name.toLowerCase() === name.toLowerCase() && x.mimeType === 'application/vnd.google-apps.folder');
        if (!f) {
          f = { id: nextId(), name, mimeType: 'application/vnd.google-apps.folder', parent: rootId };
          files.set(f.id, f);
          calls.push({ op: 'createFolder', name });
        }
        out[role] = f.id;
      }
      return out;
    },
  };

  /* -- the reviewer ---------------------------------------------------- */
  api.human = {
    drop(folderId, name, data, mimeType = 'image/jpeg') {
      const f = { id: nextId(), name, mimeType, data: Buffer.from(data), md5: md5(data), parent: folderId, description: '', modifiedTime: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString() };
      files.set(f.id, f);
      return f.id;
    },
    moveTo(id, folderId) { files.get(id).parent = folderId; },
    trash(id) { files.get(id).trashed = true; },
    replace(id, data) { const f = files.get(id); f.data = Buffer.from(data); f.md5 = md5(data); },
  };
  return api;
}

module.exports = { createMockDrive };
