/**
 * Layout 15: carousel step.
 *
 * One step of a multi-slide post (an Instagram carousel, a LinkedIn
 * multi-image post): a large step number, a headline and a short body,
 * with the slide's position and a swipe cue on every slide but the last.
 * The position comes from the carousel renderer (engine/render/carousel.js),
 * never from copy, so numbering cannot drift from the slide order. A
 * carousel opens and closes with any other layout (a type card, a question
 * card) and uses this one for the steps between.
 */

'use strict';

const { esc, words, wordmark, eyebrow } = require('../_shared/h');

const pad = (n) => String(n).padStart(2, '0');

module.exports = {
  id: 'carousel-step',
  title: 'Carousel step',
  surfaces: ['dark', 'light'],
  props: {
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 70 },
    body: { maxChars: 200 },
  },

  render({ props, brand, surface, slide }) {
    const number = slide ? `<div class="cs-number">${pad(slide.index)}</div>` : '';
    const body = props.body
      ? `<p class="body-copy cs-body" data-fit="[32,30,28,26,24]" data-lines>${words(props.body)}</p>`
      : '';
    const position = slide
      ? `<div class="foot"><span class="nowrap">${pad(slide.index)} / ${pad(slide.total)}</span><div class="rule"></div>${
        slide.index < slide.total ? '<span class="nowrap cs-next">Swipe <span class="cs-arrow">&rarr;</span></span>' : ''}</div>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region cs-region" data-fit-box>
        ${number}
        ${eyebrow(props.eyebrow)}
        <h1 class="headline" data-fit="[70,64,60,56,52]" data-lines>${words(props.headline)}</h1>
        ${body}
      </div>
      ${position}
      <style>
        .cs-region { justify-content: center; }
        .cs-number {
          font-family: var(--font-display); font-weight: var(--fw-bold); font-size: 180px;
          line-height: 0.9; letter-spacing: -0.04em; color: var(--accent-graphic); margin-bottom: 40px;
        }
        .cs-body { margin-top: 40px; max-width: 860px; }
        .cs-next { color: var(--accent); font-weight: var(--fw-head); }
        .cs-arrow { display: inline-block; margin-left: 6px; }
      </style>`;
  },
};
