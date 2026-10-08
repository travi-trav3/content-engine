#!/usr/bin/env node
/**
 * scout.js
 *
 * The weekly photo scout: a handful of new candidate photos, chosen where
 * the library is thinnest, waiting in the reviewer's Drive for a yes or a
 * no. Nothing reaches a post without the reviewer moving it to Active.
 *
 *   1. gaps     count the photos in rotation for each subject in
 *               config.json scout.subjects; the thinnest subjects go first
 *   2. search   Unsplash, with that subject's queries (free photos only,
 *               at least scout.minWidth pixels wide, never one already in
 *               the library, suggested before, or rejected)
 *   3. screen   the vision reading (vision.js): a candidate with any concern
 *               or a different subject is dropped
 *   4. suggest  up to scout.perWeek photos go to the Drive "Suggested"
 *               folder, named so the photographer is credited, with a
 *               description saying why it was picked
 *
 * The reviewer moves a suggestion to Active (drive-sync.js adds it to the
 * library) or to Rejected (never suggested again). State is kept in
 * photos/scout.json.
 *
 * What the scout cannot fix: the subjects stock photography does badly
 * (the club's own staff, members, dining room, events). Those need the
 * club's own photos.
 *
 *   node engine/photos/scout.js [--drive mock] [--unsplash mock]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const photoLib = require('./library');
const { proposeTags } = require('./vision');
const { isPending } = require('../generate/providers/agent');
const { slugify } = require('./ingest');
const { driveConfig } = require('./drive-sync');

const stateFile = () => path.join(workspace().dir, 'photos', 'scout.json');

function loadState(file = stateFile()) {
  if (!fs.existsSync(file)) return { suggested: {}, rejected: [], screenedOut: [] };
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { suggested: s.suggested || {}, rejected: s.rejected || [], screenedOut: s.screenedOut || [] };
}

function saveState(state, file = stateFile()) {
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

/** Unsplash ids already in the library (its sources credit them). */
function libraryUnsplashIds(lib) {
  return new Set(lib.photos.map((p) => (/unsplash\.com\/photos\/([A-Za-z0-9_-]{11})/.exec((p.source && p.source.url) || '') || [])[1]).filter(Boolean));
}

/** Subjects by how many photos are in rotation, thinnest first. */
function gaps(lib, subjects, now) {
  const inRotation = photoLib.select(lib, { days: 0, now });
  return subjects.map((s) => ({ subject: s, have: inRotation.filter((p) => p.subject === s).length }))
    .sort((a, b) => a.have - b.have || subjects.indexOf(a.subject) - subjects.indexOf(b.subject));
}

/** A file name ingest.js credits: <photographer>-<id>-unsplash.jpg */
const creditName = (photo) => `${slugify((photo.user && photo.user.name) || 'unsplash') || 'unsplash'}-${photo.id}-unsplash.jpg`;

async function scout({ config, drive, unsplash, provider, lib, state, now = Date.now(), log = () => {} }) {
  const sc = config.scout || {};
  const perWeek = sc.perWeek || 8;
  const minWidth = sc.minWidth || 2400;
  const subjectQueries = sc.subjects || {};
  const dc = driveConfig(config);
  if (!dc.rootFolderId) throw new Error('config.json drive.rootFolderId is not set');
  const folders = await drive.ensureFolders(dc.rootFolderId, { suggested: 'Suggested', rejected: 'Rejected', ...dc.folders });
  const at = new Date(now).toISOString();
  const result = { suggested: [], rejectedSeen: [], screenedOut: [], waiting: [] };

  // The reviewer's no's, remembered.
  for (const f of await drive.listFolder(folders.rejected)) {
    const id = (/-([A-Za-z0-9_-]{11})-unsplash\.[a-z]+$/i.exec(f.name) || [])[1];
    if (id && !state.rejected.includes(id)) { state.rejected.push(id); result.rejectedSeen.push(id); }
  }

  const known = new Set([...libraryUnsplashIds(lib), ...Object.keys(state.suggested), ...state.rejected, ...state.screenedOut]);
  const order = gaps(lib, Object.keys(subjectQueries), now);
  const per = Math.max(1, Math.ceil(perWeek / Math.max(1, Math.min(order.length, 4))));
  // Each screening is a vision call: at most three per suggestion wanted.
  const maxScreens = sc.maxScreens || perWeek * 3;
  let screens = 0;
  for (const { subject, have } of order) {
    if (result.suggested.length >= perWeek) break;
    let taken = 0;
    for (const query of subjectQueries[subject] || []) {
      if (taken >= per || result.suggested.length >= perWeek) break;
      for (const photo of await unsplash.search(query)) {
        if (taken >= per || result.suggested.length >= perWeek) break;
        if (known.has(photo.id) || photo.width < minWidth) continue;
        if (screens >= maxScreens) break;
        screens += 1;
        known.add(photo.id);
        const data = await unsplash.download(photo, { width: minWidth });
        const name = creditName(photo);
        let reading;
        try {
          reading = await proposeTags({ provider, buffer: data, id: slugify(name), lib, brandName: config.brand || 'the brand' });
        } catch (e) {
          if (!isPending(e)) throw e;
          known.delete(photo.id); // not screened: offered again next week
          result.waiting.push(photo.id);
          continue;
        }
        if (reading.concerns.length || reading.subject !== subject) {
          state.screenedOut.push(photo.id);
          result.screenedOut.push({ id: photo.id, why: reading.concerns.length ? reading.concerns.join('; ') : `reads as ${reading.subject}, not ${subject}` });
          continue;
        }
        const credit = `Photo by ${(photo.user && photo.user.name) || 'unknown'} on Unsplash (${(photo.links && photo.links.html) || `https://unsplash.com/photos/${photo.id}`}), Unsplash License.`;
        const f = await drive.upload(folders.suggested, {
          name,
          mimeType: 'image/jpeg',
          data,
          description: `Suggested for "${subject}": the library has ${have} in rotation. ${reading.description} ${credit} Move it to Active to use it, or to Rejected and it will not be suggested again.`,
        });
        state.suggested[photo.id] = { at, subject, query, fileId: f.id, name };
        result.suggested.push({ id: photo.id, subject, name });
        taken += 1;
        log({ step: 'scout', id: photo.id, subject });
      }
    }
  }
  return result;
}

function scoutMessage(r) {
  if (!r.suggested.length) return null;
  const by = new Map();
  for (const s of r.suggested) by.set(s.subject, (by.get(s.subject) || 0) + 1);
  return `${r.suggested.length} new photo${r.suggested.length === 1 ? ' is' : 's are'} in the Drive folder Suggested (${[...by].map(([s, n]) => `${n} ${s}`).join(', ')}). Move the ones you like to Active and the rest to Rejected.`;
}

module.exports = { scout, scoutMessage, gaps, loadState, saveState, creditName, libraryUnsplashIds };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : undefined; };
  (async () => {
    const ws = workspace();
    const config = JSON.parse(fs.readFileSync(path.join(ws.dir, 'config.json'), 'utf8'));
    const dc = driveConfig(config);
    const drive = arg('drive') === 'mock' ? require('../drive/mock').createMockDrive({ root: dc.rootFolderId || 'root' })
      : require('../drive/client').createDrive({ credentialsEnv: dc.credentialsEnv });
    const unsplash = arg('unsplash') === 'mock' ? require('./unsplash').createMockUnsplash()
      : require('./unsplash').createUnsplash({ accessKeyEnv: (config.scout && config.scout.accessKeyEnv) || 'UNSPLASH_ACCESS_KEY' });
    const provider = require('../generate/providers').createProvider(config);
    const state = loadState();
    const r = await scout({ config, drive, unsplash, provider, lib: photoLib.load(), state });
    saveState(state);
    const msg = scoutMessage(r);
    if (msg) await require('../notify').createNotifier(config).send(msg);
    console.log(`suggested ${r.suggested.length}; screened out ${r.screenedOut.length}; newly rejected ${r.rejectedSeen.length}`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
