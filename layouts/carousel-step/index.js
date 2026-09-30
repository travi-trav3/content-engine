/**
 * Layout 15, carousel set: the step slide.
 *
 * One step of a multi-slide post (an Instagram carousel, a LinkedIn
 * multi-image post): a large step number, a headline and a short body,
 * with the slide's position and a swipe cue on every slide but the last.
 * The position comes from the carousel renderer (engine/render/carousel.js),
 * never from copy, so numbering cannot drift from the slide order. The set
 * is cover, steps (or stat cards), an optional reveal, and a close.
 */

'use strict';

const { words, wordmark, eyebrow, slideFoot } = require('../_shared/h');

const pad = (n) => String(n).padStart(2, '0');

module.exports = {
  id: 'carousel-step',
  title: 'Carousel step',
  format: 'carousel',
  surfaces: ['dark', 'light'],
  props: {
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 70 },
    body: { maxChars: 200 },
  },

  render({ props, brand, surface, slide }) {
    // Numbered from the first step, not the cover; a reveal-flip's evidence
    // slides are not numbered at all.
    const number = slide && slide.numbered !== false ? `<div class="cs-number">${pad(slide.step || slide.index)}</div>` : '';
    const body = props.body
      ? `<p class="body-copy cs-body" data-fit="[32,30,28,26,24]" data-lines>${words(props.body)}</p>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region cs-region" data-fit-box>
        ${number}
        ${eyebrow(props.eyebrow)}
        <h1 class="headline" data-fit="${number ? '[70,64,60,56,52]' : '[88,80,72,64,58,52]'}" data-lines>${words(props.headline)}</h1>
        ${body}
      </div>
      ${slideFoot(slide)}
      <style>
        .cs-region { justify-content: center; }
        .cs-number {
          font-family: var(--font-display); font-weight: var(--fw-bold); font-size: 180px;
          line-height: 0.9; letter-spacing: -0.04em; color: var(--accent-graphic); margin-bottom: 40px;
        }
        .cs-body { margin-top: 40px; max-width: 860px; }
      </style>`;
  },
};
