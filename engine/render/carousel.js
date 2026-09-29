#!/usr/bin/env node
/**
 * carousel.js
 *
 * Renders a multi-slide post (Instagram carousel, LinkedIn multi-image) as
 * one PNG per slide, in order. Every slide is an ordinary layout; each one
 * is told its position ({ index, total }), which the carousel-step layout
 * shows and the others ignore.
 *
 *   node engine/render/carousel.js --spec carousel.json --out renders/ [--name post-03] [--size ig|li|all]
 *
 * carousel.json:
 *   { "surface": "dark",
 *     "slides": [ { "layout": "type-card", "props": { ... } },
 *                 { "layout": "carousel-step", "props": { ... } }, ... ] }
 *
 * "surface" applies to every slide whose layout offers it (a photo layout
 * keeps its photo surface), so a carousel does not flip between dark and
 * light mid-swipe. A slide may still set its own "surface".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createRenderer, loadLayout, SIZES } = require('./render');

const MIN_SLIDES = 2;
const MAX_SLIDES = 10;

function planSlides(spec) {
  const slides = spec.slides || [];
  if (slides.length < MIN_SLIDES || slides.length > MAX_SLIDES) {
    throw new Error(`A carousel has ${MIN_SLIDES} to ${MAX_SLIDES} slides; this one has ${slides.length}`);
  }
  return slides.map((s, i) => {
    const layout = loadLayout(s.layout);
    const surface = s.surface
      || (spec.surface && layout.surfaces.includes(spec.surface) ? spec.surface : layout.surfaces[0]);
    return { layout: s.layout, props: s.props || {}, surface, slide: { index: i + 1, total: slides.length } };
  });
}

/** Renders every slide at one size; returns one result per slide, in order. */
async function renderCarousel(renderer, spec, { size = 'ig', outDir, name = 'carousel' } = {}) {
  const results = [];
  for (const s of planSlides(spec)) {
    const out = outDir ? path.join(outDir, `${name}-${String(s.slide.index).padStart(2, '0')}-${size}.png`) : undefined;
    results.push({ ...(await renderer.render({ ...s, size, out })), slide: s.slide, out });
  }
  return results;
}

module.exports = { renderCarousel, planSlides, MIN_SLIDES, MAX_SLIDES };

if (require.main === module) {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1];
  if (!a.spec || !a.out) {
    console.error('usage: node engine/render/carousel.js --spec <carousel.json> --out <dir> [--name <name>] [--size ig|li|all]');
    process.exit(2);
  }
  (async () => {
    const spec = JSON.parse(fs.readFileSync(a.spec, 'utf8'));
    const sizes = !a.size || a.size === 'all' ? Object.keys(SIZES) : [a.size];
    const renderer = await createRenderer();
    let failed = false;
    try {
      for (const size of sizes) {
        for (const r of await renderCarousel(renderer, spec, { size, outDir: a.out, name: a.name })) {
          console.log(`${r.out}  ${r.layout}  ${r.width}x${r.height}  fit step ${r.fitStep}`);
          for (const issue of r.issues) console.log(`  ISSUE ${issue.rule}: ${issue.detail}`);
          if (r.issues.length) failed = true;
        }
      }
    } finally {
      await renderer.close();
    }
    process.exit(failed ? 1 : 0);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
