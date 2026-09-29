#!/usr/bin/env node
/**
 * review.js
 *
 * Applies a review file to the photo library: tags, subject, time of day,
 * people, crop focus, restrictions and notes. A reviewed photo becomes
 * selectable; a restricted one never is, until someone lifts the restriction.
 *
 *   node engine/photos/review.js review.json [--by "Name"]
 *
 * review.json: { "<photo id>": { subject, time, people, tags, focus, restricted, notes }, ... }
 *
 * Vocabulary, so selection can rely on it:
 *   subject  course | aerial-course | golfer | golfers | golf-detail | range | carts |
 *            clubhouse | grounds | marina | aerial-marina | yacht | tennis | pickleball |
 *            phone | landscape | portrait
 *   time     dawn | day | golden | dusk | night
 *   people   none | distant | present
 */

'use strict';

const fs = require('fs');
const library = require('./library');

const SUBJECTS = ['course', 'aerial-course', 'golfer', 'golfers', 'golf-detail', 'range', 'carts', 'clubhouse',
  'grounds', 'marina', 'aerial-marina', 'yacht', 'tennis', 'pickleball', 'phone', 'landscape', 'portrait'];
const TIMES = ['dawn', 'day', 'golden', 'dusk', 'night'];
const PEOPLE = ['none', 'distant', 'present'];

function validate(id, r) {
  const errors = [];
  if (r.subject !== undefined && !SUBJECTS.includes(r.subject)) errors.push(`subject "${r.subject}"`);
  if (r.time !== undefined && !TIMES.includes(r.time)) errors.push(`time "${r.time}"`);
  if (r.people !== undefined && !PEOPLE.includes(r.people)) errors.push(`people "${r.people}"`);
  if (r.focus && !(r.focus.x >= 0 && r.focus.x <= 1 && r.focus.y >= 0 && r.focus.y <= 1)) errors.push('focus out of 0..1');
  return errors.map((e) => `${id}: invalid ${e}`);
}

function apply(lib, review, by, date) {
  const errors = [];
  let applied = 0;
  for (const [id, r] of Object.entries(review)) {
    const photo = lib.photos.find((p) => p.id === id);
    if (!photo) { errors.push(`${id}: not in the library`); continue; }
    const bad = validate(id, r);
    if (bad.length) { errors.push(...bad); continue; }
    for (const key of ['subject', 'time', 'people', 'tags', 'focus', 'restricted', 'notes']) {
      if (r[key] !== undefined) photo[key] = r[key];
    }
    photo.reviewed = Boolean(photo.subject && photo.time && photo.people);
    photo.reviewedBy = by;
    photo.reviewedOn = date;
    applied += 1;
  }
  return { applied, errors };
}

module.exports = { apply, SUBJECTS, TIMES, PEOPLE };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--'));
  const byIdx = argv.indexOf('--by');
  if (!file) {
    console.error('usage: node engine/photos/review.js review.json [--by "Name"]');
    process.exit(2);
  }
  const lib = library.load();
  const { applied, errors } = apply(lib, JSON.parse(fs.readFileSync(file, 'utf8')),
    byIdx > -1 ? argv[byIdx + 1] : 'unknown', new Date().toISOString().slice(0, 10));
  library.save(lib);
  for (const e of errors) console.error(`  ${e}`);
  const unreviewed = lib.photos.filter((p) => !p.reviewed).map((p) => p.id);
  console.log(`${applied} applied, ${errors.length} error(s); ${lib.photos.length - unreviewed.length} of ${lib.photos.length} photos reviewed`);
  if (unreviewed.length) console.log(`  not yet reviewed: ${unreviewed.join(', ')}`);
  process.exit(errors.length ? 1 : 0);
}
