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

module.exports = { esc, words, wordmark };
