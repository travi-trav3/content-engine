/**
 * photos.test.js
 *
 * The photo library's selection rules, ingest naming and review vocabulary,
 * plus a check that the Club Pilot library is consistent with its files.
 * No browser.
 *
 *   node test/photos.test.js
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const library = require('../engine/photos/library');
const { slugify, unsplashSource } = require('../engine/photos/ingest');
const review = require('../engine/photos/review');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

const photo = (id, extra = {}) => ({
  id, file: `${id}.jpg`, width: 2400, height: 1600, orientation: 'landscape',
  fullBleedOk: true, bandOk: true, reviewed: true, subject: 'course', time: 'day', people: 'none', tags: [], ...extra,
});
const NOW = Date.parse('2026-09-29T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

console.log('== selection ==');
const lib = {
  photos: [
    photo('a-course'),
    photo('b-marina', { subject: 'marina', tags: ['docks'] }),
    photo('c-unreviewed', { reviewed: false }),
    photo('d-restricted', { restricted: true }),
    photo('e-small', { fullBleedOk: false, bandOk: false }),
    photo('f-used-recently'),
    photo('g-used-long-ago'),
  ],
  usage: [
    { photo: 'f-used-recently', post: 'b05-p01', date: daysAgo(10) },
    { photo: 'g-used-long-ago', post: 'b01-p01', date: daysAgo(45) },
  ],
};
const ids = (list) => list.map((p) => p.id).join(',');
const all = library.select(lib, { now: NOW });
check('never offers an unreviewed photo', !all.some((p) => p.id === 'c-unreviewed'), ids(all));
check('never offers a restricted photo', !all.some((p) => p.id === 'd-restricted'), ids(all));
check('skips a photo used in the last 30 days', !all.some((p) => p.id === 'f-used-recently'), ids(all));
check('offers a photo last used 45 days ago, after unused ones', all[all.length - 1].id === 'g-used-long-ago', ids(all));
check('a full-bleed slot skips photos without the resolution',
  !library.select(lib, { need: 'fullBleed', now: NOW }).some((p) => p.id === 'e-small'));
check('tags narrow by subject and tag together', ids(library.select(lib, { tags: ['marina', 'docks'], now: NOW })) === 'b-marina');
check('photos taken earlier in the batch are excluded',
  !library.select(lib, { exclude: ['a-course'], now: NOW }).some((p) => p.id === 'a-course'));
library.recordUse(lib, { photo: 'a-course', post: 'b06-p01', date: new Date(NOW).toISOString() });
check('a recorded use takes the photo out of rotation', !library.select(lib, { now: NOW }).some((p) => p.id === 'a-course'));
const priorBatch = { posts: [
  { id: 'b05-02', dueAt: daysAgo(5), photos: ['b-marina'] },
  { id: 'b05-04', dueAt: daysAgo(3), photos: ['g-used-long-ago'], buffer: { status: 'deleted' } },
] };
const withPriors = library.withLedgerUsage(lib, [priorBatch]);
check('a photo an earlier batch used is out of rotation for 30 days', !library.select(withPriors, { now: NOW }).some((p) => p.id === 'b-marina'),
  ids(library.select(withPriors, { now: NOW })));
check('a draft the reviewer deleted does not count as a use', library.select(withPriors, { now: NOW }).some((p) => p.id === 'g-used-long-ago'));
check('the library itself is left as it was', lib.usage.length === 3);
let threw = null;
try { library.recordUse(lib, { photo: 'nope', post: 'x', date: 'y' }); } catch (e) { threw = e.message; }
check('recording a use of an unknown photo fails', /Unknown photo/.test(threw || ''), threw || 'accepted');

console.log('== ingest naming ==');
check('slugifies an Unsplash filename', slugify('Bryce Wendler-Ri5G7U0KwPM-unsplash (1).jpg') === 'bryce-wendler-ri5g7u0kwpm');
const credit = unsplashSource('bryce-wendler-ri5g7U0KWPM-unsplash.jpg');
check('credits the Unsplash photographer and photo', credit && credit.photographer === 'Bryce Wendler'
  && credit.url === 'https://unsplash.com/photos/ri5g7U0KWPM', JSON.stringify(credit));
check('leaves other filenames uncredited', unsplashSource('byron-white.jpg') === null);

console.log('== review ==');
const rlib = { photos: [photo('r1', { reviewed: false, subject: null, time: null, people: null })], usage: [] };
let res = review.apply(rlib, { r1: { subject: 'course', time: 'day' } }, 'test', '2026-09-29');
check('a photo is not reviewed until subject, time and people are all set', rlib.photos[0].reviewed === false);
res = review.apply(rlib, { r1: { people: 'none' } }, 'test', '2026-09-29');
check('and is reviewed once they are', rlib.photos[0].reviewed === true && res.errors.length === 0);
res = review.apply(rlib, { r1: { subject: 'sunset' } }, 'test', '2026-09-29');
check('rejects a subject outside the vocabulary', res.errors.some((e) => /invalid subject/.test(e)), res.errors.join('; '));
res = review.apply(rlib, { r1: { focus: { x: 1.4, y: 0.5 } } }, 'test', '2026-09-29');
check('rejects a focus point off the photo', res.errors.some((e) => /focus/.test(e)), res.errors.join('; '));

console.log('== the Club Pilot library matches its files ==');
const real = library.load();
const dir = path.dirname(library.libraryPath());
const files = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')));
const missing = real.photos.filter((p) => !files.has(p.file)).map((p) => p.id);
check('every entry has its file', missing.length === 0, missing.join(', '));
const orphans = [...files].filter((f) => !real.photos.some((p) => p.file === f));
check('every file has an entry', orphans.length === 0, orphans.join(', '));
const badVocab = real.photos.filter((p) => p.reviewed && (!review.SUBJECTS.includes(p.subject)
  || !review.TIMES.includes(p.time) || !review.PEOPLE.includes(p.people))).map((p) => p.id);
check('every reviewed entry uses the review vocabulary', badVocab.length === 0, badVocab.join(', '));
const founders = real.photos.filter((p) => (p.tags || []).includes('founder'));
check('the founder tag is on the founder headshot only', founders.map((p) => p.id).join(',') === 'byron-white-founder',
  founders.map((p) => p.id).join(','));

console.log(failures === 0 ? '\nphotos: ALL CHECKS PASS' : `\nphotos: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
