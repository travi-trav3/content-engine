/**
 * pdf.js
 *
 * A carousel's slides as one PDF, one slide per page at the slide's pixel
 * size. LinkedIn shows a document post as a swipeable carousel; several
 * images in one LinkedIn post show as a grid instead. Instagram takes the
 * slides as images and needs none of this.
 *
 *   await slidesToPdf(['a-01.png', 'a-02.png'], { out: 'a.pdf' })
 */

'use strict';

const fs = require('fs');
const sharp = require('sharp');
const { chromium } = require('playwright-core');
const { chromiumPath } = require('./render');

async function slidesToPdf(files, { out, title = '' } = {}) {
  if (!files.length) throw new Error('a carousel PDF needs at least one slide');
  const { width, height } = await sharp(files[0]).metadata();
  for (const f of files.slice(1)) {
    const m = await sharp(f).metadata();
    if (m.width !== width || m.height !== height) throw new Error(`${f} is ${m.width}x${m.height}; every slide must be ${width}x${height}`);
  }
  const pages = files.map((f) => `<div class="p"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title><style>
    @page { size: ${width}px ${height}px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .p { width: ${width}px; height: ${height}px; page-break-after: always; overflow: hidden; }
    .p:last-child { page-break-after: auto; }
    img { display: block; width: ${width}px; height: ${height}px; }
  </style></head><body>${pages}</body></html>`;
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: out, width: `${width}px`, height: `${height}px`, printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
  return { out, pages: files.length, width, height };
}

module.exports = { slidesToPdf };
