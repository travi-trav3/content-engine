#!/usr/bin/env node
/**
 * ingest.js
 *
 * Adds images to the brand's photo library.
 *
 *   node engine/photos/ingest.js <folder-or-files...> [--source-url-base URL] [--license TEXT]
 *
 * For each image: applies EXIF rotation, resizes so the long edge is at most
 * 2400px (never upscales), strips metadata, writes photos/<id>.jpg, and adds
 * or refreshes its entry in photos/library.json with what can be measured:
 * size, orientation, mean luminance, which zones are calm enough to carry
 * text, and whether the resolution holds up full bleed or as a band. Tags
 * are left for review (reviewed: false), and a photo is not selectable until
 * someone has tagged it.
 *
 * Unsplash filenames (<first>-<last>-<photoId>-unsplash.jpg) are credited
 * automatically. Anything else needs its source filled in during review.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { workspace } = require('../lib/workspace');
const library = require('./library');

const LONG_EDGE = 2400;
const QUALITY = 82;
const SMALL_SOURCE = 1200;
const SMALL_QUALITY = 94;
// A full-bleed LinkedIn post is 1200 x 1500; the 4:5 crop must hold that many real pixels.
const FULL_BLEED_MIN_WIDTH = 1200;
// A photo band spans the canvas width at up to ~60% of its height.
const BAND_MIN_WIDTH = 1200;

function slugify(name) {
  return name.toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/-unsplash$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function unsplashSource(fileName) {
  const base = fileName.replace(/\s*\(\d+\)(?=\.[a-z]+$)/i, '');
  const m = /^(.+)-([A-Za-z0-9_-]{11})-unsplash\.[a-z]+$/i.exec(base);
  if (!m) return null;
  const photographer = m[1].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return { photographer, url: `https://unsplash.com/photos/${m[2]}`, license: 'Unsplash License' };
}

/** Luminance mean and busyness (stdev) for a 3 x 3 grid of zones. */
async function measure(buffer) {
  const W = 90;
  const H = 90;
  const { data } = await sharp(buffer).greyscale().resize(W, H, { fit: 'fill' }).raw()
    .toBuffer({ resolveWithObject: true });
  const names = [['top-left', 'top', 'top-right'], ['left', 'center', 'right'], ['bottom-left', 'bottom', 'bottom-right']];
  const zones = {};
  let total = 0;
  for (let zy = 0; zy < 3; zy += 1) {
    for (let zx = 0; zx < 3; zx += 1) {
      const values = [];
      for (let y = zy * 30; y < zy * 30 + 30; y += 1) {
        for (let x = zx * 30; x < zx * 30 + 30; x += 1) values.push(data[y * W + x]);
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      total += mean;
      zones[names[zy][zx]] = { luminance: Math.round(mean), busyness: Math.round(sd) };
    }
  }
  // Calm enough for overlaid text: low detail. Dark or light decides the ink.
  const calm = Object.entries(zones).filter(([, z]) => z.busyness <= 28).map(([name]) => name);
  return { luminance: Math.round(total / 9), zones, calmZones: calm };
}

async function ingestOne(file, opts, lib, photosDir) {
  const name = path.basename(file);
  const id = slugify(name);
  const input = fs.readFileSync(file);
  const img = sharp(input).rotate();
  const meta = await img.metadata();
  const srcW = meta.autoOrient ? meta.autoOrient.width : meta.width;
  const srcH = meta.autoOrient ? meta.autoOrient.height : meta.height;
  // A small source is already compressed; re-encoding it at the library
  // quality visibly degrades it, so it keeps more of what it has.
  const quality = Math.max(srcW, srcH) < SMALL_SOURCE ? SMALL_QUALITY : QUALITY;
  const out = await img
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(photosDir, `${id}.jpg`), out.data);

  const { width, height } = out.info;
  const crop45Width = Math.min(width, height * 0.8);
  const m = await measure(out.data);
  const existing = lib.photos.find((p) => p.id === id);
  const measured = {
    id,
    file: `${id}.jpg`,
    width,
    height,
    sourceWidth: srcW,
    sourceHeight: srcH,
    orientation: width > height * 1.05 ? 'landscape' : height > width * 1.05 ? 'portrait' : 'square',
    luminance: m.luminance,
    tone: m.luminance < 85 ? 'dark' : m.luminance > 170 ? 'light' : 'mid',
    zones: m.zones,
    calmZones: m.calmZones,
    fullBleedOk: crop45Width >= FULL_BLEED_MIN_WIDTH,
    bandOk: width >= BAND_MIN_WIDTH,
  };
  const source = unsplashSource(name) || (opts.license ? { license: opts.license } : null);
  if (existing) {
    Object.assign(existing, measured);
    if (!existing.source && source) existing.source = source;
  } else {
    lib.photos.push({
      ...measured,
      source,
      tags: [],
      subject: null,
      time: null,
      people: null,
      focus: { x: 0.5, y: 0.5 },
      reviewed: false,
      notes: '',
    });
  }
  return { id, width, height, bytes: out.data.length, fullBleedOk: measured.fullBleedOk };
}

async function main(argv) {
  const opts = {};
  const inputs = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--license') opts.license = argv[++i];
    else inputs.push(argv[i]);
  }
  if (!inputs.length) {
    console.error('usage: node engine/photos/ingest.js <folder-or-files...> [--license TEXT]');
    process.exit(2);
  }
  const files = inputs.flatMap((p) => (fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f)).map((f) => path.join(p, f))
    : [p]));
  const photosDir = path.join(workspace().dir, 'photos');
  fs.mkdirSync(photosDir, { recursive: true });
  const lib = library.load();
  for (const f of files.sort()) {
    try {
      const r = await ingestOne(f, opts, lib, photosDir);
      console.log(`${r.id}  ${r.width}x${r.height}  ${Math.round(r.bytes / 1024)}KB${r.fullBleedOk ? '' : '  (not full-bleed)'}`);
    } catch (e) {
      console.error(`SKIP ${f}: ${e.message}`);
    }
  }
  library.save(lib);
  console.log(`${lib.photos.length} photo(s) in ${path.relative(process.cwd(), library.libraryPath())}`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { slugify, unsplashSource, measure, ingestOne };
