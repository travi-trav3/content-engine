/**
 * Markup helpers for layouts. Every piece of copy goes through esc() or
 * words(); layouts never interpolate raw strings.
 */

'use strict';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Wrap each word in a span so the renderer can measure lines. */
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean)
  .map((w) => `<span class="w">${esc(w)}</span>`)
  .join(' ');

/** The brand's wordmark for this surface, from brand/render.json. */
const wordmark = (brand, surface) => {
  const src = brand.wordmark && (brand.wordmark[surface] || brand.wordmark.dark);
  if (!src) return '';
  return `<img class="wordmark" src="/brand/${esc(src)}" alt="${esc(brand.wordmark.alt || brand.name || '')}">`;
};

/** Headline words, with an optional second clause in the accent color on its own line. */
const headlineWords = (headline, emphasis) => words(headline)
  + (emphasis ? ` <span class="accent emphasis">${words(emphasis)}</span>` : '');

const eyebrow = (text) => (text ? `<div class="eyebrow">${esc(text)}</div>` : '');

/**
 * A library photo, resolved by the renderer (see resolvePhotos). Covers its
 * box and keeps the photo's reviewed focus point in frame. data-photo lets
 * the renderer flag a photo shown larger than its real pixels.
 */
const photo = (p, cls = '') => {
  const x = Math.round((p.focus ? p.focus.x : 0.5) * 100);
  const y = Math.round((p.focus ? p.focus.y : 0.5) * 100);
  return `<img class="photo ${esc(cls)}" data-photo src="${esc(p.src)}" alt="" style="object-position: ${x}% ${y}%">`;
};

/** Initials for a sender avatar: first letters of the first two words. */
const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2)
  .map((w) => w[0]).join('').toUpperCase();

module.exports = { esc, words, wordmark, headlineWords, eyebrow, initials, photo };
