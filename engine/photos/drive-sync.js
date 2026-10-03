#!/usr/bin/env node
/**
 * drive-sync.js
 *
 * The photo library as the reviewer sees it: a Google Drive folder with
 * one subfolder per state. Moving a file between folders is how a person
 * manages the library; this sync makes photos/library.json follow.
 *
 *   Inbox         drop new photos here. Each is resized and measured
 *                 (ingest.js), read by a vision model (vision.js), and moved
 *                 to Active, or to Needs a look when the reading has a
 *                 concern. Uploading is the reviewer's approval of the photo;
 *                 the reading supplies the tags.
 *   Active        in rotation.
 *   Parked        out of rotation until moved back to Active.
 *   Retired       out for good. A photo used drive.retireAfterUses times is
 *                 moved here by the sync; so is a duplicate upload.
 *   Needs a look  restricted until a person moves it to Active (an
 *                 override, recorded) or to Retired.
 *   Briefs        the reviewer's briefs (Word, Google Docs, Markdown, text),
 *                 copied into briefs/ when new or changed.
 *   Suggested     the weekly scout's candidates (scout.js). One the reviewer
 *                 moves to Active is added to the library; a photo dropped
 *                 straight into Active is too. Either way the move is the
 *                 approval, and any concern in the reading goes in its notes.
 *   Rejected      suggestions the reviewer turned down (never suggested again).
 *
 * Each photo's Drive description says what the library holds about it and
 * how often it has been used. A file deleted from Drive is retired. Photos
 * already in the library are uploaded once with --seed.
 *
 *   node engine/photos/drive-sync.js [--seed] [--drive mock] [--provider mock --mock-dir DIR]
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { workspace } = require('../lib/workspace');
const photoLib = require('./library');
const { ingestOne, slugify, unsplashSource } = require('./ingest');
const { proposeTags } = require('./vision');
const { GOOGLE_DOC } = require('../drive/client');

const DEFAULT_FOLDERS = {
  inbox: 'Inbox', active: 'Active', parked: 'Parked', retired: 'Retired', needsLook: 'Needs a look', briefs: 'Briefs',
  suggested: 'Suggested', rejected: 'Rejected',
};
const STATE_FOLDERS = ['active', 'parked', 'retired', 'needsLook'];
const IMAGE = /\.(jpe?g|png|webp|heic|tiff?)$/i;
const BRIEF = /\.(docx|md|txt)$/i;
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function driveConfig(config) {
  const d = config.drive || {};
  return { ...d, folders: { ...DEFAULT_FOLDERS, ...(d.folders || {}) } };
}

/** Use counts and the last use, per photo, from the ledgers. */
function usageOf(lib, ledgers) {
  const out = new Map();
  for (const u of photoLib.withLedgerUsage(lib, ledgers).usage) {
    const cur = out.get(u.photo) || { count: 0, last: null, post: null };
    cur.count += 1;
    if (!cur.last || String(u.date) > String(cur.last)) { cur.last = u.date; cur.post = u.post; }
    out.set(u.photo, cur);
  }
  return out;
}

/** What Drive shows under the file's details. */
function describePhoto(p, use, retireAfter) {
  const state = p.retired ? 'Retired.' : p.parked ? 'Parked: out of rotation until moved back to Active.'
    : p.restricted ? `Needs a look: ${p.restrictedReason || p.notes || 'restricted'}. Move it to Active to use it anyway, or to Retired to drop it.`
      : 'In rotation.';
  const what = [p.subject, p.time, p.people === 'none' ? 'no people' : p.people === 'distant' ? 'people at a distance' : p.people === 'present' ? 'people' : null].filter(Boolean).join(', ');
  const used = use && use.count ? `Used ${use.count} time${use.count === 1 ? '' : 's'}, last ${day(use.last)} (${use.post}).` : 'Not used yet.';
  return [
    state,
    what ? `${what}.` : null,
    p.tags && p.tags.length ? `Tags: ${p.tags.join(', ')}.` : null,
    used,
    retireAfter && !p.retired ? `Retires after ${retireAfter} uses.` : null,
    `Library id: ${p.id}.`,
  ].filter(Boolean).join(' ');
}

function uniqueId(lib, base) {
  let id = base || 'photo';
  let n = 2;
  while (lib.photos.some((p) => p.id === id)) { id = `${base}-${n}`; n += 1; }
  return id;
}

/**
 * One sync. lib is the loaded library (changed in place; the caller saves
 * it). ledgers: every batch ledger, for usage. Returns what happened.
 */
async function syncDrive({ config, drive, provider, lib, photosDir, briefsDir, ledgers = [], now = Date.now(), log = () => {} }) {
  const dc = driveConfig(config);
  if (!dc.rootFolderId) throw new Error('config.json drive.rootFolderId is not set');
  const reviewer = (config.buffer && config.buffer.reviewerName) || 'the reviewer';
  const folders = await drive.ensureFolders(dc.rootFolderId, dc.folders);
  const at = new Date(now).toISOString();
  const result = { added: [], needsLook: [], moved: [], overrides: [], retiredMissing: [], autoRetired: [], duplicates: [], described: 0, briefs: [] };
  const byFile = new Map(lib.photos.filter((p) => p.drive && p.drive.fileId).map((p) => [p.drive.fileId, p]));
  const byMd5 = new Map(lib.photos.filter((p) => p.drive && p.drive.md5).map((p) => [p.drive.md5, p]));
  const seen = new Set();

  /* -- adding a photo the reviewer put in Drive ---------------------- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-drive-'));
  // Ingests and reads a Drive file; returns the library entry and the reading.
  const addPhoto = async (f, data, sum, approvedBy) => {
    const id = uniqueId(lib, slugify(f.name));
    const local = path.join(tmp, `${id}${path.extname(f.name).toLowerCase() || '.jpg'}`);
    fs.writeFileSync(local, data);
    const credit = unsplashSource(f.name);
    await ingestOne(local, { license: credit ? null : `Supplied by ${reviewer} through the Drive photo library` }, lib, photosDir);
    const p = lib.photos.find((x) => x.id === id);
    if (credit) p.source = credit;
    const reading = await proposeTags({ provider, buffer: data, id, lib, brandName: config.brand || 'the brand' });
    Object.assign(p, {
      subject: reading.subject, time: reading.time, people: reading.people, tags: reading.tags, focus: reading.focus,
      description: reading.description,
      reviewed: true,
      reviewedBy: `vision reading; ${approvedBy}`,
      reviewedOn: at.slice(0, 10),
      drive: { fileId: f.id, md5: sum, name: f.name },
    });
    byFile.set(f.id, p);
    byMd5.set(sum, p);
    seen.add(f.id);
    log({ step: 'photo', id, concerns: reading.concerns });
    return { p, reading };
  };
  const duplicateOf = async (f, from) => {
    const data = await drive.download(f.id);
    const sum = f.md5Checksum || md5(data);
    const dupe = byMd5.get(sum);
    if (!dupe) return { data, sum };
    await drive.move(f.id, { to: folders.retired, from });
    await drive.describe(f.id, `Retired: the same photo is already in the library as ${dupe.id}.`);
    result.duplicates.push({ name: f.name, of: dupe.id });
    seen.add(f.id);
    return null;
  };

  try {
    /* -- Inbox: new photos --------------------------------------------- */
    const inbox = (await drive.listFolder(folders.inbox)).filter((f) => IMAGE.test(f.name) || /^image\//.test(f.mimeType || ''));
    for (const f of inbox) {
      const fresh = await duplicateOf(f, folders.inbox);
      if (!fresh) continue;
      const { p, reading } = await addPhoto(f, fresh.data, fresh.sum, `uploaded by ${reviewer}`);
      if (reading.concerns.length) {
        p.restricted = true;
        p.restrictedReason = reading.concerns.join('; ');
        p.drive.folder = 'needsLook';
        await drive.move(f.id, { to: folders.needsLook, from: folders.inbox });
        result.needsLook.push({ id: p.id, name: f.name, concerns: reading.concerns });
      } else {
        p.drive.folder = 'active';
        await drive.move(f.id, { to: folders.active, from: folders.inbox });
        result.added.push({ id: p.id, name: f.name, subject: p.subject });
      }
    }

    /* -- state folders: the reviewer's moves --------------------------- */
    for (const role of STATE_FOLDERS) {
      for (const f of await drive.listFolder(folders[role])) {
        seen.add(f.id);
        const p = byFile.get(f.id);
        if (!p) {
          // A suggestion moved to Active, or a photo dropped straight in: the move is the approval.
          if (role !== 'active' || !(IMAGE.test(f.name) || /^image\//.test(f.mimeType || ''))) continue;
          const fresh = await duplicateOf(f, folders.active);
          if (!fresh) continue;
          const added = await addPhoto(f, fresh.data, fresh.sum, `moved to Active by ${reviewer}`);
          added.p.drive.folder = 'active';
          if (added.reading.concerns.length) {
            added.p.notes = `${added.p.notes ? `${added.p.notes} ` : ''}The reading noted: ${added.reading.concerns.join('; ')}; in rotation because ${reviewer} put it in Active.`.trim();
          }
          result.added.push({ id: added.p.id, name: f.name, subject: added.p.subject, concerns: added.reading.concerns, adopted: true });
          continue;
        }
        const was = p.drive.folder;
        if (was === role) continue;
        p.drive.folder = role;
        p.parked = role === 'parked';
        p.retired = role === 'retired';
        if (role === 'active' && p.restricted) {
          // Moving a flagged photo to Active is a person's decision to use it.
          p.restricted = false;
          p.notes = `${p.notes ? `${p.notes} ` : ''}${p.restrictedReason ? `Flagged "${p.restrictedReason}"; ` : ''}moved to Active by ${reviewer} on ${at.slice(0, 10)}.`.trim();
          p.restrictedReason = null;
          result.overrides.push(p.id);
        }
        if (role === 'needsLook' && !p.restricted) {
          p.restricted = true;
          p.restrictedReason = p.restrictedReason || `moved to Needs a look by ${reviewer}`;
        }
        result.moved.push({ id: p.id, from: was, to: role });
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  /* -- deleted in Drive ------------------------------------------------ */
  for (const p of lib.photos) {
    if (p.drive && p.drive.fileId && !seen.has(p.drive.fileId) && !p.retired) {
      p.retired = true;
      p.drive.folder = 'deleted';
      result.retiredMissing.push(p.id);
    }
  }

  /* -- usage: descriptions and auto-retirement ------------------------- */
  const use = usageOf(lib, ledgers);
  const limit = dc.retireAfterUses || null;
  const current = new Map();
  for (const role of STATE_FOLDERS) for (const f of await drive.listFolder(folders[role])) current.set(f.id, f);
  for (const p of lib.photos) {
    if (!p.drive || !p.drive.fileId || !current.has(p.drive.fileId)) continue;
    const u = use.get(p.id);
    if (limit && !p.retired && !p.parked && u && u.count >= limit) {
      await drive.move(p.drive.fileId, { to: folders.retired, from: folders[p.drive.folder] });
      p.retired = true;
      p.drive.folder = 'retired';
      result.autoRetired.push({ id: p.id, uses: u.count });
    }
    const text = describePhoto(p, u, limit);
    if ((current.get(p.drive.fileId).description || '') !== text) {
      await drive.describe(p.drive.fileId, text);
      result.described += 1;
    }
  }

  /* -- Briefs ---------------------------------------------------------- */
  if (briefsDir && folders.briefs) {
    const stateFile = path.join(briefsDir, '.drive.json');
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
    for (const f of await drive.listFolder(folders.briefs)) {
      const isDoc = f.mimeType === GOOGLE_DOC;
      if (!isDoc && !BRIEF.test(f.name)) continue;
      const version = f.md5Checksum || f.modifiedTime;
      if (state[f.id] && state[f.id].version === version) continue;
      const name = (state[f.id] && state[f.id].file) || `${slugify(f.name)}${isDoc ? '.docx' : path.extname(f.name).toLowerCase()}`;
      fs.mkdirSync(briefsDir, { recursive: true });
      fs.writeFileSync(path.join(briefsDir, name), await drive.download(f.id, f.mimeType));
      state[f.id] = { file: name, version, name: f.name };
      result.briefs.push(name);
    }
    if (result.briefs.length) fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  }
  return result;
}

/** Uploads library photos that are not in Drive yet, into the folder for their state. */
async function seedDrive({ config, drive, lib, photosDir, log = () => {} }) {
  const dc = driveConfig(config);
  const folders = await drive.ensureFolders(dc.rootFolderId, dc.folders);
  let n = 0;
  for (const p of lib.photos) {
    if (p.drive && p.drive.fileId) continue;
    const role = p.retired ? 'retired' : p.parked ? 'parked' : (p.restricted || !p.reviewed) ? 'needsLook' : 'active';
    const data = fs.readFileSync(path.join(photosDir, p.file));
    const f = await drive.upload(folders[role], { name: p.file, mimeType: 'image/jpeg', data, description: describePhoto(p, null, dc.retireAfterUses) });
    p.drive = { fileId: f.id, md5: f.md5Checksum || md5(data), name: p.file, folder: role };
    if (role === 'needsLook' && !p.restrictedReason) p.restrictedReason = p.reviewed ? (p.notes || 'restricted') : 'not reviewed yet';
    n += 1;
    log({ step: 'seed', id: p.id, folder: role });
  }
  return { uploaded: n };
}

/** A message for the reviewer about what the sync did, or null. */
function summaryMessage(r) {
  const lines = [];
  if (r.added.length) lines.push(`${r.added.length} new photo${r.added.length === 1 ? ' is' : 's are'} in rotation: ${r.added.map((a) => `${a.name} (${a.subject}${a.concerns && a.concerns.length ? `; the reading noted ${a.concerns.join(', ')}` : ''})`).join(', ')}.`);
  for (const n of r.needsLook) lines.push(`${n.name} is in Needs a look: ${n.concerns.join('; ')}. Move it to Active to use it anyway, or to Retired.`);
  for (const d of r.duplicates) lines.push(`${d.name} is already in the library (${d.of}); the copy is in Retired.`);
  for (const a of r.autoRetired) lines.push(`${a.id} was used ${a.uses} times and is now in Retired.`);
  if (r.briefs.length) lines.push(`New or changed brief${r.briefs.length === 1 ? '' : 's'} from Drive: ${r.briefs.join(', ')}.`);
  return lines.length ? lines.join('\n') : null;
}

module.exports = { syncDrive, seedDrive, describePhoto, usageOf, summaryMessage, driveConfig, DEFAULT_FOLDERS };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = JSON.parse(fs.readFileSync(path.join(ws.dir, 'config.json'), 'utf8'));
    // --drive mock is a dry run: an in-memory Drive, and nothing written.
    const dry = arg('drive') === 'mock';
    if (dry) config.drive = { ...(config.drive || {}), rootFolderId: (config.drive && config.drive.rootFolderId) || 'root' };
    const dc = driveConfig(config);
    const drive = dry ? require('../drive/mock').createMockDrive({ root: dc.rootFolderId })
      : require('../drive/client').createDrive({ credentialsEnv: dc.credentialsEnv });
    const lib = photoLib.load();
    const photosDir = path.join(ws.dir, 'photos');
    if (argv.includes('--seed')) {
      const r = await seedDrive({ config, drive, lib, photosDir, log: (e) => console.log(`seeded ${e.id} -> ${e.folder}`) });
      if (!dry) photoLib.save(lib);
      console.log(`${r.uploaded} photo(s) ${dry ? 'would be' : ''} uploaded to Drive.`.replace('  ', ' '));
      return;
    }
    const overrides = {};
    if (arg('provider')) overrides.name = arg('provider');
    if (arg('mock-dir')) overrides.dir = arg('mock-dir');
    let provider = null;
    const lazy = { generate: (req) => (provider || (provider = require('../generate/providers').createProvider(config, overrides))).generate(req) };
    const { priorLedgers } = require('../gates/check-batch');
    const r = await syncDrive({
      config, drive, provider: lazy, lib, photosDir: dry ? fs.mkdtempSync(path.join(os.tmpdir(), 'ce-dry-')) : photosDir,
      briefsDir: dry ? null : path.join(ws.dir, 'briefs'),
      ledgers: fs.existsSync(ws.contentDir) ? priorLedgers(ws.contentDir) : [],
    });
    if (!dry) photoLib.save(lib);
    const msg = summaryMessage(r);
    if (msg) await require('../notify').createNotifier(config).send(msg);
    console.log(`added ${r.added.length}; needs a look ${r.needsLook.length}; moved ${r.moved.length}; overrides ${r.overrides.length}; retired (deleted in Drive) ${r.retiredMissing.length}; retired (uses) ${r.autoRetired.length}; duplicates ${r.duplicates.length}; descriptions ${r.described}; briefs ${r.briefs.length}`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
