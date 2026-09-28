/**
 * contact-sheet.js
 *
 * Lays rendered posts out in one image so a batch can be judged as a set:
 * the gates catch structure, only eyes catch a batch that all looks the same.
 *
 *   node engine/render/contact-sheet.js --out sheet.png a.png b.png c.png ...
 *   await contactSheet(files, { out, columns: 4, tileWidth: 360 })
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function contactSheet(files, { out, columns = 4, tileWidth = 360, gap = 24, labels = true } = {}) {
  if (!files.length) throw new Error('contact sheet needs at least one image');
  const tileHeight = Math.round(tileWidth * 1.25);
  const labelHeight = labels ? 34 : 0;
  const rows = Math.ceil(files.length / columns);
  const width = gap + columns * (tileWidth + gap);
  const height = gap + rows * (tileHeight + labelHeight + gap);

  const composites = [];
  for (const [i, file] of files.entries()) {
    const x = gap + (i % columns) * (tileWidth + gap);
    const y = gap + Math.floor(i / columns) * (tileHeight + labelHeight + gap);
    const tile = await sharp(file).resize(tileWidth, tileHeight, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
    composites.push({ input: tile, left: x, top: y });
    if (labels) {
      const label = path.basename(file, path.extname(file));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${labelHeight}">
        <text x="0" y="24" font-family="sans-serif" font-size="18" fill="#4b5563">${escXml(label)}</text></svg>`;
      composites.push({ input: Buffer.from(svg), left: x, top: y + tileHeight });
    }
  }

  const png = await sharp({ create: { width, height, channels: 3, background: '#e5e7eb' } })
    .composite(composites).png().toBuffer();
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
  }
  return png;
}

module.exports = { contactSheet };

if (require.main === module) {
  const opts = {};
  const files = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--columns') opts.columns = Number(argv[++i]);
    else files.push(argv[i]);
  }
  if (!opts.out || !files.length) {
    console.error('usage: node engine/render/contact-sheet.js --out sheet.png [--columns N] image.png [image.png ...]');
    process.exit(2);
  }
  contactSheet(files, opts).then(() => console.log(opts.out)).catch((e) => { console.error(e.message); process.exit(1); });
}
