/**
 * Layout 15, carousel set: the reveal slide.
 *
 * The answer the swipe was for: one statement, large and in the accent
 * color, with an optional line of detail. It pays off the cover's question
 * and should leave the reader smarter, not just surprised.
 */

'use strict';

const { words, wordmark, eyebrow, slideFoot } = require('../_shared/h');

module.exports = {
  id: 'carousel-reveal',
  title: 'Carousel reveal',
  format: 'carousel',
  surfaces: ['dark', 'light'],
  props: {
    eyebrow: { maxChars: 32 },
    statement: { required: true, maxChars: 100 },
    detail: { maxChars: 180 },
  },

  render({ props, brand, surface, slide }) {
    const detail = props.detail
      ? `<p class="body-copy cr-detail" data-fit="[32,30,28,26,24]" data-lines>${words(props.detail)}</p>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region cr-region" data-fit-box>
        ${eyebrow(props.eyebrow)}
        <div class="cr-bar"></div>
        <h1 class="headline cr-statement" data-fit="[84,76,68,62,56,50]" data-lines>${words(props.statement)}</h1>
        ${detail}
      </div>
      ${slideFoot(slide)}
      <style>
        .cr-region { justify-content: center; }
        .cr-bar { width: 96px; height: 8px; background: var(--accent-graphic); margin-bottom: 44px; }
        .cr-statement { color: var(--accent); }
        .cr-detail { margin-top: 44px; max-width: 860px; }
      </style>`;
  },
};
