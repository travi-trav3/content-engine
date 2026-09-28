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

function validateProps(layout, props) {
  const errors = [];
  for (const [key, spec] of Object.entries(layout.props)) {
    const value = props[key];
    const empty = value === undefined || value === null || String(value).trim() === '';
    if (spec.required && empty) errors.push(`${key} is required`);
    if (!empty && spec.maxChars && String(value).length > spec.maxChars) {
      errors.push(`${key} is ${String(value).length} characters; the layout allows ${spec.maxChars}`);
    }
  }
  for (const key of Object.keys(props)) {
    if (!(key in layout.props)) errors.push(`${key} is not a prop of ${layout.id}`);
  }
  return errors;
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

function documentFor({ layout, props, surface, brand }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/brand/fonts.css">
<link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/layouts/_shared/base.css">
</head><body><div class="canvas surface-${surface}" id="canvas">${layout.render({ props, brand, surface })}</div></body></html>`;
}

/**
 * Runs in the page. Loads every brand font weight, then steps through each
 * [data-fit] element's font sizes together (largest first) until nothing
 * overflows and no [data-lines] line holds a single word.
 */
async function fitAndCheck({ family, weights }) {
  const issues = [];
  for (const w of weights) {
    const faces = await document.fonts.load(`${w} 40px "${family}"`);
    if (!faces.length) issues.push({ rule: 'render.fontMissing', detail: `${family} ${w} did not load; the render would use a fallback font.` });
  }
  await document.fonts.ready;
  for (const img of document.images) {
    if (!img.complete || img.naturalWidth === 0) {
      issues.push({ rule: 'render.imageMissing', detail: `${img.getAttribute('src')} did not load.` });
    }
  }

  const canvas = document.getElementById('canvas').getBoundingClientRect();
  const fitEls = [...document.querySelectorAll('[data-fit]')]
    .map((el) => ({ el, sizes: JSON.parse(el.dataset.fit) }));
  const boxes = [...document.querySelectorAll('[data-fit-box]')];
  const lineEls = [...document.querySelectorAll('[data-lines]')];
  const steps = Math.max(1, ...fitEls.map((f) => f.sizes.length));
  const label = (el) => `.${[...el.classList].join('.')}`;

  const measure = () => {
    const problems = [];
    for (const box of boxes) {
      if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) {
        problems.push({ rule: 'render.overflow', detail: `${label(box)} holds ${box.scrollHeight}px of content in ${box.clientHeight}px.` });
      }
    }
    for (const el of lineEls) {
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
      for (const words of lines.values()) {
        if (words.length === 1) {
          problems.push({ rule: 'render.singleWordLine', detail: `"${words[0]}" sits alone on a line in ${label(el)}.` });
        }
      }
    }
    return problems;
  };

  let step = -1;
  let problems = [];
  for (let i = 0; i < steps; i += 1) {
    for (const f of fitEls) f.el.style.fontSize = `${f.sizes[Math.min(i, f.sizes.length - 1)]}px`;
    problems = measure();
    if (!problems.length) { step = i; break; }
  }
  issues.push(...problems);
  return {
    issues,
    fitStep: step,
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

  async function render({ layout: id, size = 'ig', surface, props = {}, out, validate = true }) {
    const layout = loadLayout(id);
    if (validate) {
      const errors = validateProps(layout, props);
      if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
    }
    const surf = surface || layout.surfaces[0];
    if (!layout.surfaces.includes(surf)) {
      throw new Error(`${id} has no "${surf}" surface (has: ${layout.surfaces.join(', ')})`);
    }
    const target = SIZES[size];
    if (!target) throw new Error(`Unknown size "${size}" (have: ${Object.keys(SIZES).join(', ')})`);

    const docId = crypto.randomUUID();
    docs.set(docId, documentFor({ layout, props, surface: surf, brand }));
    const page = await (await contextFor(size)).newPage();
    try {
      await page.goto(`${origin}/__doc/${docId}`, { waitUntil: 'load' });
      const qa = await page.evaluate(fitAndCheck, { family: brand.fontFamily, weights: brand.fontWeights });
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

module.exports = { createRenderer, loadLayout, validateProps, SIZES, DESIGN };
