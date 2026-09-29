/**
 * render.js
 *
 * Renders a layout with props to an exact-size PNG, and reports anything a
 * viewer would see as broken: a font that fell back, an image that did not
 * load, text that overflows its box or leaves the canvas, and a headline or
 * body line holding a single word.
 *
 * Layouts are designed on one 1080 x 1350 canvas. Each platform size is the
 * same 4:5 composition supersampled to its width and downscaled with
 * lanczos3, so layouts never carry per-platform pixel values.
 *
 *   const r = await createRenderer();
 *   const result = await r.render({ layout: 'type-card', surface: 'dark',
 *                                   size: 'ig', props, out: 'x.png' });
 *   await r.close();
 *
 * Chromium comes from PW_CHROMIUM, else the build pinned by playwright-core
 * (`npx playwright-core install chromium`), which is also what cloud
 * sandboxes preinstall under PLAYWRIGHT_BROWSERS_PATH.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const { ROOT, workspace } = require('../lib/workspace');
const photoLibrary = require('../photos/library');

const DESIGN = { width: 1080, height: 1350 };
const SUPERSAMPLE = 2;
const SIZES = {
  ig: { width: 1080, height: 1350 },
  li: { width: 1200, height: 1500 },
};

const MIME = {
  '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function chromiumPath() {
  let pinned = null;
  try { pinned = chromium.executablePath(); } catch { /* not installed */ }
  const found = [process.env.PW_CHROMIUM, pinned].find((p) => p && fs.existsSync(p));
  if (!found) {
    throw new Error('No Chromium found. Run `npx playwright-core install chromium`, or set PW_CHROMIUM to a Chromium binary.');
  }
  return found;
}

function loadLayout(id) {
  if (!/^[a-z0-9-]+$/.test(String(id))) throw new Error(`Invalid layout id "${id}"`);
  const file = path.join(ROOT, 'layouts', id, 'index.js');
  if (!fs.existsSync(file)) throw new Error(`Unknown layout "${id}" (no layouts/${id}/index.js)`);
  return require(file);
}

/**
 * Prop specs:
 *   { required, maxChars }                          text (the default type)
 *   { type: 'enum', values: [...] }                 one of a fixed set
 *   { type: 'list', item: 'text', maxChars,         array of strings
 *     minItems, maxItems }
 *   { type: 'list', item: { field: spec, ... },     array of objects
 *     minItems, maxItems }
 *   { type: 'photo', need, requireTags }            a photo id from photos/library.json;
 *                                                   resolved and checked by resolvePhotos()
 */
function checkValue(name, spec, value, errors) {
  const type = spec.type || 'text';
  const empty = value === undefined || value === null
    || (type !== 'list' && String(value).trim() === '')
    || (type === 'list' && Array.isArray(value) && value.length === 0);
  if (empty) {
    if (spec.required) errors.push(`${name} is required`);
    return;
  }
  if (type === 'text') {
    if (typeof value !== 'string') errors.push(`${name} must be text`);
    else if (spec.maxChars && value.length > spec.maxChars) {
      errors.push(`${name} is ${value.length} characters; the layout allows ${spec.maxChars}`);
    }
  } else if (type === 'photo') {
    if (typeof value !== 'string') errors.push(`${name} must be a photo id`);
  } else if (type === 'enum') {
    if (!spec.values.includes(value)) errors.push(`${name} must be one of: ${spec.values.join(', ')}`);
  } else if (type === 'list') {
    if (!Array.isArray(value)) { errors.push(`${name} must be a list`); return; }
    if (spec.minItems && value.length < spec.minItems) errors.push(`${name} needs at least ${spec.minItems} items`);
    if (spec.maxItems && value.length > spec.maxItems) errors.push(`${name} allows at most ${spec.maxItems} items`);
    value.forEach((item, i) => {
      if (spec.item === 'text') {
        checkValue(`${name}[${i}]`, { required: true, maxChars: spec.maxChars }, item, errors);
      } else {
        checkObject(`${name}[${i}]`, spec.item, item, errors);
      }
    });
  }
}

function checkObject(name, fields, value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${name} must be an object`);
    return;
  }
  for (const [key, spec] of Object.entries(fields)) checkValue(`${name}.${key}`, spec, value[key], errors);
  for (const key of Object.keys(value)) {
    if (!(key in fields)) errors.push(`${name}.${key} is not an allowed field`);
  }
}

function validateProps(layout, props) {
  const errors = [];
  for (const [key, spec] of Object.entries(layout.props)) checkValue(key, spec, props[key], errors);
  for (const key of Object.keys(props)) {
    if (!(key in layout.props)) errors.push(`${key} is not a prop of ${layout.id}`);
  }
  return errors;
}

/**
 * Looks up every photo prop in the library and refuses photos a person has
 * not reviewed, restricted photos, photos without the resolution the layout
 * needs, and photos missing a tag the layout requires (the founder portrait
 * only takes photos tagged "founder").
 */
function resolvePhotos(layout, props, lib) {
  const photos = {};
  const errors = [];
  for (const [key, spec] of Object.entries(layout.props)) {
    if (spec.type !== 'photo' || !props[key]) continue;
    const p = lib.photos.find((x) => x.id === props[key]);
    if (!p) { errors.push(`${key}: photo "${props[key]}" is not in photos/library.json`); continue; }
    if (!p.reviewed) errors.push(`${key}: photo "${p.id}" has not been reviewed`);
    if (p.restricted) errors.push(`${key}: photo "${p.id}" is restricted (${p.notes || 'see library'})`);
    if (spec.need === 'fullBleed' && !p.fullBleedOk) errors.push(`${key}: photo "${p.id}" is too small to run full bleed`);
    if (spec.need === 'band' && !p.bandOk) errors.push(`${key}: photo "${p.id}" is too small for a photo band`);
    const missing = (spec.requireTags || []).filter((t) => !(p.tags || []).includes(t));
    if (missing.length) errors.push(`${key}: photo "${p.id}" is not tagged ${missing.join(', ')}`);
    photos[key] = {
      id: p.id,
      src: `/photos/${p.file}`,
      width: p.width,
      height: p.height,
      tone: p.tone,
      // Measured brightness per zone (0-255), so a layout can darken its
      // scrim where the photo is bright under the wordmark or the type.
      zones: Object.fromEntries(Object.entries(p.zones || {}).map(([k, z]) => [k, z.luminance])),
      focus: p.focus || { x: 0.5, y: 0.5 },
    };
  }
  return { photos, errors };
}

/** Static server: /brand, /layouts, /photos, plus in-memory documents under /__doc. */
function serve(roots, docs) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const notFound = () => { res.statusCode = 404; res.end('not found'); };
    if (urlPath.startsWith('/__doc/')) {
      const html = docs.get(urlPath.slice('/__doc/'.length));
      if (!html) return notFound();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(html);
    }
    const prefix = Object.keys(roots).find((p) => urlPath.startsWith(`/${p}/`));
    if (!prefix) return notFound();
    const base = roots[prefix];
    const file = path.resolve(base, urlPath.slice(prefix.length + 2));
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return notFound();
    }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function documentFor({ layout, props, surface, brand, photos, slide }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/brand/fonts.css">
<link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/layouts/_shared/base.css">
</head><body><div class="canvas surface-${surface}" id="canvas">${layout.render({ props, brand, surface, photos, slide })}</div></body></html>`;
}

/**
 * Runs in the page. Loads every brand font weight, then fits each
 * [data-fit-box] on its own: the [data-fit] elements inside a box step down
 * through their font sizes together (largest first) until the box does not
 * overflow and no [data-lines] line in it holds a single word. Elements
 * outside any box fit as one more group. Boxes are independent so that a
 * long chat bubble cannot shrink the headline above the phone.
 */
async function fitAndCheck({ family, weights, outputScale }) {
  const issues = [];
  for (const w of weights) {
    const faces = await document.fonts.load(`${w} 40px "${family}"`);
    if (!faces.length) issues.push({ rule: 'render.fontMissing', detail: `${family} ${w} did not load; the render would use a fallback font.` });
  }
  await document.fonts.ready;
  for (const img of document.images) {
    if (!img.complete || img.naturalWidth === 0) {
      issues.push({ rule: 'render.imageMissing', detail: `${img.getAttribute('src')} did not load.` });
      continue;
    }
    // A photo shown larger than its real pixels at the final output size is
    // soft. Covered images are scaled by the larger of the two ratios.
    if (img.hasAttribute('data-photo')) {
      const r = img.getBoundingClientRect();
      const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight) * outputScale;
      if (scale > 1.1) {
        issues.push({ rule: 'render.photoTooSmall', detail: `${img.getAttribute('src')} is upscaled ${scale.toFixed(2)}x at this size.` });
      }
    }
  }

  const canvas = document.getElementById('canvas').getBoundingClientRect();
  const fitEls = [...document.querySelectorAll('[data-fit]')]
    .map((el) => ({ el, sizes: JSON.parse(el.dataset.fit) }));
  const lineEls = [...document.querySelectorAll('[data-lines]')];
  const label = (el) => `.${[...el.classList].join('.')}`;
  const boxOf = (el) => el.closest('[data-fit-box]');
  const groups = [...document.querySelectorAll('[data-fit-box]'), null].map((box) => ({
    box,
    fits: fitEls.filter((f) => boxOf(f.el) === box),
    lines: lineEls.filter((el) => boxOf(el) === box),
  })).filter((g) => g.box || g.fits.length || g.lines.length);

  const measure = (group) => {
    const problems = [];
    const { box } = group;
    if (box && (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)) {
      problems.push({ rule: 'render.overflow', detail: `${label(box)} holds ${box.scrollHeight}px of content in ${box.clientHeight}px.` });
    } else if (box) {
      // A bottom- or center-aligned box overflows upward too, which
      // scrollHeight does not count: compare its children against the box.
      const b = box.getBoundingClientRect();
      const out = [...box.children].find((c) => {
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.position === 'absolute' || c.tagName === 'STYLE') return false;
        const r = c.getBoundingClientRect();
        return r.top < b.top - 1 || r.bottom > b.bottom + 1 || r.left < b.left - 1 || r.right > b.right + 1;
      });
      if (out) {
        const r = out.getBoundingClientRect();
        problems.push({ rule: 'render.overflow', detail: `${label(out)} spans ${Math.round(r.top)}-${Math.round(r.bottom)}px, outside ${label(box)} (${Math.round(b.top)}-${Math.round(b.bottom)}px).` });
      }
    }
    for (const el of group.lines) {
      const lines = new Map();
      for (const w of el.querySelectorAll('.w')) {
        const r = w.getBoundingClientRect();
        if (r.left < canvas.left - 1 || r.right > canvas.right + 1 || r.bottom > canvas.bottom + 1) {
          problems.push({ rule: 'render.offCanvas', detail: `"${w.textContent}" in ${label(el)} runs off the canvas.` });
        }
        const top = Math.round(r.top);
        if (!lines.has(top)) lines.set(top, []);
        lines.get(top).push(w.textContent);
      }
      // data-lines="orphans": a one-line element may hold one word ("Yes
      // please" bubbles, short list items); only a wrapped last word fails.
      if (el.dataset.lines === 'orphans' && lines.size < 2) continue;
      for (const words of lines.values()) {
        if (words.length === 1) {
          problems.push({ rule: 'render.singleWordLine', detail: `"${words[0]}" sits alone on a line in ${label(el)}.` });
        }
      }
    }
    return problems;
  };

  // A group that cannot fit keeps its smallest sizes and reports why.
  const fitSteps = [];
  for (const group of groups) {
    const steps = Math.max(1, ...group.fits.map((f) => f.sizes.length));
    let step = -1;
    let problems = [];
    for (let i = 0; i < steps; i += 1) {
      for (const f of group.fits) f.el.style.fontSize = `${f.sizes[Math.min(i, f.sizes.length - 1)]}px`;
      problems = measure(group);
      if (!problems.length) { step = i; break; }
    }
    fitSteps.push(step);
    issues.push(...problems);
  }
  return {
    issues,
    // Largest step any group needed, or -1 when some group could not fit.
    fitStep: fitSteps.includes(-1) ? -1 : Math.max(0, ...fitSteps),
    fontSizes: fitEls.map((f) => ({ element: label(f.el), px: parseFloat(f.el.style.fontSize) })),
  };
}

async function createRenderer() {
  const ws = workspace();
  const brand = JSON.parse(fs.readFileSync(path.join(ws.brandDir, 'render.json'), 'utf8'));
  const docs = new Map();
  const server = await serve({
    brand: ws.brandDir,
    layouts: path.join(ROOT, 'layouts'),
    photos: path.join(ws.dir, 'photos'),
  }, docs);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ['--font-render-hinting=none', '--disable-gpu'],
  });
  const contexts = new Map();

  async function contextFor(size) {
    if (!contexts.has(size)) {
      contexts.set(size, await browser.newContext({
        viewport: DESIGN,
        deviceScaleFactor: (SUPERSAMPLE * SIZES[size].width) / DESIGN.width,
      }));
    }
    return contexts.get(size);
  }

  /**
   * slide: { index, total } when the render is one slide of a carousel
   * (see carousel.js); layouts that show a position read it.
   * library: a photo library to use instead of the workspace's (tests).
   */
  async function render({
    layout: id, size = 'ig', surface, props = {}, out, validate = true, slide, library,
  }) {
    const layout = loadLayout(id);
    if (validate) {
      const errors = validateProps(layout, props);
      // A layout's own rules that span props or read the brand (the proof
      // bar's logos must share one relation, and be registered).
      if (!errors.length && layout.check) errors.push(...layout.check({ props, brand }));
      if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
    }
    const surf = surface || layout.surfaces[0];
    if (!layout.surfaces.includes(surf)) {
      throw new Error(`${id} has no "${surf}" surface (has: ${layout.surfaces.join(', ')})`);
    }
    const target = SIZES[size];
    if (!target) throw new Error(`Unknown size "${size}" (have: ${Object.keys(SIZES).join(', ')})`);
    const { photos, errors: photoErrors } = resolvePhotos(layout, props, library || photoLibrary.load());
    if (photoErrors.length) throw new Error(`${id}: ${photoErrors.join('; ')}`);

    const docId = crypto.randomUUID();
    docs.set(docId, documentFor({ layout, props, surface: surf, brand, photos, slide }));
    const page = await (await contextFor(size)).newPage();
    try {
      await page.goto(`${origin}/__doc/${docId}`, { waitUntil: 'load' });
      const qa = await page.evaluate(fitAndCheck, {
        family: brand.fontFamily,
        weights: brand.fontWeights,
        outputScale: target.width / DESIGN.width,
      });
      const shot = await page.screenshot({ clip: { x: 0, y: 0, ...DESIGN }, type: 'png' });
      const png = await sharp(shot)
        .resize(target.width, target.height, { fit: 'fill', kernel: 'lanczos3' })
        .png()
        .toBuffer();
      if (out) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, png);
      }
      return {
        layout: id,
        surface: surf,
        size,
        width: target.width,
        height: target.height,
        issues: qa.issues,
        fitStep: qa.fitStep,
        photos: Object.values(photos).map((p) => p.id),
        fontSizes: qa.fontSizes,
        sha256: crypto.createHash('sha256').update(png).digest('hex'),
        png,
      };
    } finally {
      docs.delete(docId);
      await page.close();
    }
  }

  async function close() {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return { render, close };
}

module.exports = { createRenderer, loadLayout, validateProps, resolvePhotos, SIZES, DESIGN };
