/**
 * drive.test.js
 *
 * The Drive photo library, without a Google account:
 *
 *   - the Drive client against a stubbed fetch: the service-account JWT
 *     (verified with the public key), paging, downloads and Google Docs
 *     export, multipart uploads, moves, and a retried 429
 *   - the sync against an in-memory Drive and recorded vision readings: a
 *     seed of the existing library, new photos dropped in Inbox (one clean,
 *     one with a recognizable face, one duplicate), the reviewer's moves
 *     (an override to Active, a park, a delete), retirement after N uses,
 *     descriptions with usage, and briefs copied from the Briefs folder
 *
 *   node test/drive.test.js
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { workspace } = require('../engine/lib/workspace');
const { createDrive, assertion, GOOGLE_DOC } = require('../engine/drive/client');
const { createMockDrive } = require('../engine/drive/mock');
const { syncDrive, seedDrive, summaryMessage, describePhoto } = require('../engine/photos/drive-sync');
const { createMock } = require('../engine/generate/providers/mock');
const { scout, scoutMessage, loadState } = require('../engine/photos/scout');
const { createMockUnsplash, createUnsplash } = require('../engine/photos/unsplash');
const photoLib = require('../engine/photos/library');

const WS = workspace();
const OUT = path.join(__dirname, 'output', 'drive');
const FIXTURES = path.join(__dirname, 'fixtures', 'drive');
const PHOTOS = path.join(WS.dir, 'photos');
const NOW = Date.parse('2026-10-03T12:00:00Z');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const r = handler(url, init, calls.length);
    const status = r.status || 200;
    const bytes = r.bytes || Buffer.from(JSON.stringify(r.json || {}));
    return { status, ok: status < 300, json: async () => JSON.parse(bytes.toString()), text: async () => bytes.toString(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  /* ------------------------------------------------------------------ */
  console.log('== the Drive client ==');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { client_email: 'engine@club-pilot.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  {
    const jwt = assertion(credentials, NOW);
    const [h, c, sig] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    const verified = crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'));
    check('the service-account assertion is signed with the key and scoped to Drive', verified
      && claims.iss === credentials.client_email && /auth\/drive$/.test(claims.scope) && claims.exp - claims.iat === 3600);

    let page = 0;
    let throttled = false;
    const f = stubFetch((url, init) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) return { json: { access_token: 'tok', expires_in: 3600 } };
      if (/\/files\/d1\/export/.test(url)) return { bytes: Buffer.from('docx bytes') };
      if (/\/files\/p1\?alt=media/.test(url)) return { bytes: Buffer.from('photo bytes') };
      if (/upload\/drive\/v3\/files/.test(url)) return { json: { id: 'new1', name: 'x.jpg' } };
      if (init.method === 'PATCH') return { json: { id: 'p1' } };
      if (/\/files\?q=/.test(url)) {
        if (!throttled) { throttled = true; return { status: 429, json: {} }; }
        page += 1;
        return page === 1 ? { json: { files: [{ id: 'a' }], nextPageToken: 'n2' } } : { json: { files: [{ id: 'b' }] } };
      }
      return { status: 404, json: {} };
    });
    const drive = createDrive({ credentials, fetchImpl: f, retries: 2 });
    const listed = await drive.listFolder('folder1');
    check('a folder is listed across pages, after a retried 429', listed.map((x) => x.id).join() === 'a,b');
    check('the token is fetched once and sent as a Bearer header', f.calls.filter((c) => /oauth2/.test(c.url)).length === 1
      && f.calls.filter((c) => /googleapis\.com\/drive/.test(c.url)).every((c) => c.init.headers.authorization === 'Bearer tok'));
    check('the list asks only for what is in the folder and not trashed', decodeURIComponent(f.calls[1].url).includes("'folder1' in parents and trashed=false"));
    check('a file downloads as bytes', (await drive.download('p1')).toString() === 'photo bytes');
    check('a Google Doc is exported as Word', (await drive.download('d1', GOOGLE_DOC)).toString() === 'docx bytes'
      && f.calls.some((c) => /export\?mimeType=application%2Fvnd\.openxmlformats/.test(c.url)));
    await drive.move('p1', { to: 'B', from: 'A' });
    check('a move adds the new folder and removes the old', f.calls.some((c) => /addParents=B&removeParents=A/.test(c.url) && c.init.method === 'PATCH'));
    await drive.upload('F', { name: 'x.jpg', mimeType: 'image/jpeg', data: Buffer.from('JPEGDATA'), description: 'hello' });
    const up = f.calls.find((c) => /uploadType=multipart/.test(c.url));
    const body = up.init.body.toString();
    check('an upload is one multipart request with the metadata and the bytes', /"parents":\["F"\]/.test(body) && /"description":"hello"/.test(body) && body.includes('JPEGDATA'));
    let noKey = null;
    try { createDrive({ credentialsEnv: 'CE_TEST_NO_SUCH_GOOGLE_KEY' }); } catch (e) { noKey = e; }
    check('no key, no client', noKey && /CE_TEST_NO_SUCH_GOOGLE_KEY/.test(noKey.message));
  }

  /* ------------------------------------------------------------------ */
  console.log('== seeding the library into Drive ==');
  fs.rmSync(OUT, { recursive: true, force: true });
  const photosDir = path.join(OUT, 'photos');
  const briefsDir = path.join(OUT, 'briefs');
  const sourcesDir = path.join(OUT, 'sources');
  fs.mkdirSync(photosDir, { recursive: true });
  const real = photoLib.load();
  const keep = ['50m-above-gf5xptsylnu', 'alexander-lli9yoy5cm8', 'cardmapr-nl-au-tyt7e0lw'];
  const lib = { photos: JSON.parse(JSON.stringify(real.photos.filter((p) => keep.includes(p.id)))), usage: [] };
  for (const p of lib.photos) fs.copyFileSync(path.join(PHOTOS, p.file), path.join(photosDir, p.file));
  const config = {
    brand: 'Club Pilot',
    buffer: { reviewerName: 'Byron' },
    drive: { rootFolderId: 'root', retireAfterUses: 5 },
  };
  const drive = createMockDrive({ root: 'root' });
  const seeded = await seedDrive({ config, drive, lib, photosDir });
  const folderId = (name) => [...drive.files.values()].find((f) => f.name === name && f.parent === 'root').id;
  const inFolder = (name) => [...drive.files.values()].filter((f) => f.parent === folderId(name) && !f.trashed);
  check('the library is seeded once, each photo in the folder for its state', seeded.uploaded === 3
    && inFolder('Active').length === 2 && inFolder('Needs a look').map((f) => f.name).join() === 'cardmapr-nl-au-tyt7e0lw.jpg');
  check('the folders exist: Inbox, Active, Parked, Retired, Needs a look, Briefs, Sources',
    ['Inbox', 'Active', 'Parked', 'Retired', 'Needs a look', 'Briefs', 'Sources'].every((n) => { try { return Boolean(folderId(n)); } catch { return false; } }));
  check('every Drive file says what the library holds', inFolder('Active').every((f) => /In rotation\./.test(f.description) && /Library id:/.test(f.description)));
  check('seeding again uploads nothing', (await seedDrive({ config, drive, lib, photosDir })).uploaded === 0);

  /* ------------------------------------------------------------------ */
  console.log('== a sync: new photos, the reviewer\'s moves, usage ==');
  const inbox = folderId('Inbox');
  drive.human.drop(inbox, 'Dawn Fairway.jpg', fs.readFileSync(path.join(PHOTOS, 'adrian-hernandez-omtcilnwcgs.jpg')));
  drive.human.drop(inbox, 'Member at the net.jpg', fs.readFileSync(path.join(PHOTOS, 'allan-nygren-xvkquntohi.jpg')));
  drive.human.drop(inbox, 'copy of aerial.jpg', fs.readFileSync(path.join(photosDir, '50m-above-gf5xptsylnu.jpg')));
  drive.human.drop(folderId('Briefs'), 'November map.docx', fs.readFileSync(path.join(WS.dir, 'briefs', '2026-10-october-content-map.docx')), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  drive.human.drop(folderId('Briefs'), 'Ideas for December', Buffer.from('PK fake doc'), GOOGLE_DOC);
  drive.human.drop(folderId('Briefs'), 'logo.png', Buffer.from('not a brief'), 'image/png');
  drive.human.drop(folderId('Sources'), 'New Recording 12.m4a', Buffer.from('a voice memo'), 'audio/x-m4a');
  drive.human.drop(folderId('Sources'), 'Answers for October', Buffer.from('PK fake doc'), GOOGLE_DOC);
  drive.human.drop(folderId('Sources'), 'headshot.jpg', Buffer.from('not words'), 'image/jpeg');
  const usedFive = { posts: [1, 2, 3, 4, 5].map((n) => ({ id: `b05-0${n}`, dueAt: `2026-09-0${n}T09:00:00-07:00`, photos: ['alexander-lli9yoy5cm8'] })) };
  const provider = createMock({ dir: FIXTURES });
  const r1 = await syncDrive({ config, drive, provider, lib, photosDir, briefsDir, sourcesDir, ledgers: [usedFive], now: NOW });
  const photo = (id) => lib.photos.find((p) => p.id === id);
  const dawn = photo('dawn-fairway');
  check('a clean photo from Inbox is ingested, read and put in rotation', dawn && dawn.reviewed && !dawn.restricted && dawn.subject === 'course'
    && dawn.time === 'dawn' && fs.existsSync(path.join(photosDir, 'dawn-fairway.jpg')) && inFolder('Active').some((f) => f.name === 'Dawn Fairway.jpg'),
  JSON.stringify(dawn && { reviewed: dawn.reviewed, subject: dawn.subject }));
  check('its tags are cleaned: lowercased, hyphenated, no subject repeat, never "founder"', dawn && dawn.tags.join() === 'fairway,mist,sky-space-top', dawn && dawn.tags.join());
  check('it records who approved it and how', dawn && dawn.reviewedBy === 'vision reading; uploaded by Byron');
  check('the model saw the photo itself', provider.calls.find((c) => c.key === 'vision-dawn-fairway').images[0].startsWith('data:image/jpeg;base64,'));
  const member = photo('member-at-the-net');
  check('a photo with a recognizable face goes to Needs a look, restricted, with the reason', member && member.restricted
    && member.restrictedReason === 'recognizable face' && inFolder('Needs a look').some((f) => f.name === 'Member at the net.jpg'));
  check('a duplicate upload is caught before anyone reads it, and retired', r1.duplicates.length === 1 && r1.duplicates[0].of === '50m-above-gf5xptsylnu'
    && !provider.calls.some((c) => /aerial/.test(c.key)) && inFolder('Retired').some((f) => f.name === 'copy of aerial.jpg' && /already in the library/.test(f.description)));
  check('a photo used five times retires itself', r1.autoRetired.some((a) => a.id === 'alexander-lli9yoy5cm8' && a.uses === 5)
    && photo('alexander-lli9yoy5cm8').retired && inFolder('Retired').some((f) => f.name === 'alexander-lli9yoy5cm8.jpg'));
  check('and its description says how often and when it was used',
    /Used 5 times, last Sep 5, 2026 \(b05-05\)/.test(inFolder('Retired').find((f) => f.name === 'alexander-lli9yoy5cm8.jpg').description));
  check('briefs in the Briefs folder are copied, a Google Doc as Word, other files ignored',
    fs.existsSync(path.join(briefsDir, 'november-map.docx')) && fs.existsSync(path.join(briefsDir, 'ideas-for-december.docx')) && !fs.existsSync(path.join(briefsDir, 'logo.png')));
  check('the founder\'s memos and documents in Sources are copied for source mode; a photo there is not',
    r1.sources.sort().join() === 'answers-for-october.docx,new-recording-12.m4a' && fs.existsSync(path.join(sourcesDir, 'new-recording-12.m4a'))
    && !fs.existsSync(path.join(sourcesDir, 'headshot.jpg')), r1.sources.join());
  const msg = summaryMessage(r1);
  check('the reviewer is told what came in and what needs a look', /1 new photo is in rotation: Dawn Fairway\.jpg \(course\)/.test(msg)
    && /Member at the net\.jpg is in Needs a look: recognizable face/.test(msg) && /already in the library/.test(msg), msg);

  // The reviewer decides: uses the flagged photo anyway, parks one, deletes one.
  drive.human.moveTo(member.drive.fileId, folderId('Active'));
  drive.human.moveTo(photo('50m-above-gf5xptsylnu').drive.fileId, folderId('Parked'));
  drive.human.trash(dawn.drive.fileId);
  const calls = provider.calls.length;
  const downloads = drive.calls.filter((c) => c.op === 'download').length;
  const r2 = await syncDrive({ config, drive, provider, lib, photosDir, briefsDir, ledgers: [usedFive], now: NOW + 3600000 });
  check('moving a flagged photo to Active is an override, recorded on the photo', r2.overrides.includes('member-at-the-net') && !member.restricted
    && /Flagged "recognizable face"; moved to Active by Byron/.test(member.notes));
  check('a parked photo is out of rotation', photo('50m-above-gf5xptsylnu').parked
    && !photoLib.select(lib, { now: NOW }).some((p) => p.id === '50m-above-gf5xptsylnu'));
  check('a photo deleted in Drive is retired', r2.retiredMissing.includes('dawn-fairway') && dawn.retired);
  check('a second sync reads no photo twice and copies no unchanged brief', provider.calls.length === calls
    && drive.calls.filter((c) => c.op === 'download').length === downloads, `${drive.calls.filter((c) => c.op === 'download').length - downloads} downloads`);
  check('descriptions are rewritten only when they change', r2.described > 0 && (await syncDrive({ config, drive, provider, lib, photosDir, briefsDir, ledgers: [usedFive], now: NOW + 7200000 })).described === 0);
  const briefFile = [...drive.files.values()].find((f) => f.name === 'November map.docx');
  drive.human.replace(briefFile.id, Buffer.concat([fs.readFileSync(path.join(WS.dir, 'briefs', '2026-10-october-content-map.docx')), Buffer.from(' ')]));
  const r4 = await syncDrive({ config, drive, provider, lib, photosDir, briefsDir, ledgers: [usedFive], now: NOW + 9000000 });
  check('a changed brief is copied again, under the same name', r4.briefs.join() === 'november-map.docx');
  check('a parked photo says so in Drive', /^Parked:/.test(inFolder('Parked')[0].description));
  check('a flagged photo\'s description tells the reviewer what to do', /Needs a look: x\. Move it to Active/.test(describePhoto({ id: 'p', restricted: true, restrictedReason: 'x', tags: [] }, null, 5)));

  /* ------------------------------------------------------------------ */
  console.log('== the weekly scout: candidates where the library is thinnest ==');
  {
    const f = stubFetch((url) => {
      if (/search\/photos/.test(url)) return { json: { results: [{ id: 'FREEPHOTO01', urls: { raw: 'https://images.unsplash.com/a?ixid=1' } }, { id: 'PLUSPHOTO01', premium: true, urls: { raw: 'https://plus.unsplash.com/b' } }] } };
      if (/images\.unsplash\.com\/a/.test(url)) return { bytes: Buffer.from('jpeg') };
      if (/download_location/.test(url)) return { json: { url: 'x' } };
      return { status: 404, json: {} };
    });
    const u = createUnsplash({ accessKey: 'k', fetchImpl: f });
    const found = await u.search('pickleball');
    check('Unsplash search sends the Client-ID key, asks for portrait and safe content, and drops Unsplash+ photos',
      found.map((x) => x.id).join() === 'FREEPHOTO01' && f.calls[0].init.headers.authorization === 'Client-ID k'
      && /orientation=portrait/.test(f.calls[0].url) && /content_filter=high/.test(f.calls[0].url));
    await u.download({ id: 'FREEPHOTO01', urls: { raw: 'https://images.unsplash.com/a?ixid=1' }, links: { download_location: 'https://api.unsplash.com/photos/FREEPHOTO01/download_location' } });
    check('a download is fetched at library size and reported to Unsplash', /w=2400&fit=max&q=85&fm=jpg/.test(f.calls[1].url) && /download_location/.test(f.calls[2].url));
  }
  const img = (file) => fs.readFileSync(path.join(PHOTOS, file));
  const cand = (id, user, width = 4000, extra = {}) => ({ id, width, height: 5000, user: { name: user }, urls: { raw: `https://images.unsplash.com/${id}` }, links: { html: `https://unsplash.com/photos/${id}` }, ...extra });
  const unsplash = createMockUnsplash({
    results: {
      'pickleball court club': [
        cand('PREMIUM0001', 'Pro Shooter', 5000, { premium: true }),
        cand('Lli9yOy5cm8', 'Alexander'),
        cand('SMALLPHOTO1', 'Tiny Cam', 1200),
        cand('PKLBALL0002', 'Jane Doe'),
        cand('PKLBALL0001', 'Jane Doe'),
      ],
      'golf course morning': [cand('COURSE00001', 'Sam Lee'), cand('COURSE00002', 'Sam Lee')],
    },
    images: {
      PKLBALL0001: img('amauri-cruz-filho-kbnv9wpcs5k.jpg'), PKLBALL0002: img('aleksandr-galichkin-auae3-x-ldu.jpg'),
      COURSE00001: img('adrian-hernandez-wifghghg1ny.jpg'), COURSE00002: img('will-porada-uy5zequoscs.jpg'),
    },
  });
  const scoutConfig = { ...config, scout: { perWeek: 2, minWidth: 2400, subjects: { pickleball: ['pickleball court club'], course: ['golf course morning'] } } };
  const state = loadState(path.join(OUT, 'no-such-scout.json'));
  const sr = await scout({ config: scoutConfig, drive, unsplash, provider, lib, state, now: NOW });
  const suggested = inFolder('Suggested');
  check('two candidates go to Suggested, one per thin subject', sr.suggested.map((x) => `${x.subject}:${x.id}`).join() === 'pickleball:PKLBALL0001,course:COURSE00002',
    JSON.stringify(sr.suggested));
  check('named so the photographer is credited, with why it was picked and how to answer',
    suggested.some((x) => x.name === 'jane-doe-PKLBALL0001-unsplash.jpg' && /Suggested for "pickleball": the library has 0 in rotation/.test(x.description)
      && /Photo by Jane Doe on Unsplash/.test(x.description) && /Move it to Active to use it, or to Rejected/.test(x.description)));
  const downloaded = unsplash.calls.filter((c) => c.op === 'download').map((c) => c.id);
  check('never downloads an Unsplash+ photo, one too small, or one already in the library',
    !downloaded.includes('PREMIUM0001') && !downloaded.includes('SMALLPHOTO1') && !downloaded.includes('Lli9yOy5cm8'), downloaded.join());
  check('a candidate the reading puts in another subject, or flags, is dropped and remembered',
    sr.screenedOut.map((x) => x.id).join() === 'PKLBALL0002,COURSE00001' && /reads as tennis/.test(sr.screenedOut[0].why)
      && /third-party logo/.test(sr.screenedOut[1].why) && state.screenedOut.length === 2);
  check('the reviewer is told what is waiting', /2 new photos are in the Drive folder Suggested \(1 pickleball, 1 course\)/.test(scoutMessage(sr)), scoutMessage(sr));

  // Byron says yes to one and no to the other.
  drive.human.moveTo(suggested.find((x) => /PKLBALL0001/.test(x.name)).id, folderId('Active'));
  drive.human.moveTo(suggested.find((x) => /COURSE00002/.test(x.name)).id, folderId('Rejected'));
  const r5 = await syncDrive({ config: scoutConfig, drive, provider, lib, photosDir, briefsDir, ledgers: [usedFive], now: NOW + 86400000 });
  const pick = photo('jane-doe-pklball0001');
  check('a suggestion moved to Active joins the library, credited, approved by the move',
    r5.added.some((a) => a.adopted && a.id === 'jane-doe-pklball0001') && pick && pick.reviewed && !pick.restricted && pick.subject === 'pickleball'
      && pick.source.photographer === 'Jane Doe' && /PKLBALL0001/.test(pick.source.url) && pick.reviewedBy === 'vision reading; moved to Active by Byron',
    JSON.stringify(pick && { reviewedBy: pick.reviewedBy, source: pick.source }));
  check('and is in rotation', photoLib.select(lib, { now: NOW }).some((p) => p.id === 'jane-doe-pklball0001'));
  const sr2 = await scout({ config: scoutConfig, drive, unsplash, provider, lib, state, now: NOW + 7 * 86400000 });
  check('the rejection is remembered and nothing seen before is suggested again', sr2.rejectedSeen.join() === 'COURSE00002'
    && state.rejected.includes('COURSE00002') && sr2.suggested.length === 0, JSON.stringify(sr2));

  console.log(failures ? `\ndrive: ${failures} CHECK(S) FAILED` : '\ndrive: ALL CHECKS PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
