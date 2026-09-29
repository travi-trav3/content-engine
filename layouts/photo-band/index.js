/**
 * Layout 12: photo band.
 *
 * Headline and body on the brand surface, with a library photo running edge
 * to edge across the lower half. The type never sits on the photo, so any
 * reviewed photo with band resolution works, busy or not. The everyday
 * photo post.
 */

'use strict';

const { words, wordmark, eyebrow, headlineWords, photo } = require('../_shared/h');

module.exports = {
  id: 'photo-band',
  title: 'Photo band',
  surfaces: ['dark', 'light'],
  props: {
    photo: { type: 'photo', need: 'band', required: true },
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 64 },
    emphasis: { maxChars: 64 },
    body: { maxChars: 150 },
  },

  render({ props, brand, surface, photos }) {
    const body = props.body
      ? `<p class="body-copy pb-body" data-fit="[30,28,26,24]" data-lines>${words(props.body)}</p>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="pb-text" data-fit-box>
        ${eyebrow(props.eyebrow)}
        <h1 class="headline" data-fit="[66,60,56,52,48]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
        ${body}
      </div>
      <div class="pb-band">${photo(photos.photo)}</div>
      <style>
        .pb-text {
          position: absolute; left: 81px; right: 81px; top: 214px; height: 500px;
          display: flex; flex-direction: column; justify-content: center; overflow: hidden;
        }
        .pb-body { margin-top: 28px; max-width: 860px; }
        .pb-band { position: absolute; left: 0; right: 0; bottom: 0; height: 600px; }
        .pb-band::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0; height: 8px;
          background: var(--accent-graphic); z-index: 1;
        }
      </style>`;
  },
};
