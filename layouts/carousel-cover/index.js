/**
 * Layout 15, carousel set: the cover slide.
 *
 * The first slide of a carousel: the hook that earns the swipe. A question,
 * a tension or an incomplete thought, set large, with an optional second
 * line in the accent color, on a dark or light surface or over a library
 * photo. The swipe cue and position come from the carousel renderer.
 */

'use strict';

const { esc, words, wordmark, photo, slideFoot } = require('../_shared/h');

module.exports = {
  id: 'carousel-cover',
  title: 'Carousel cover',
  format: 'carousel',
  surfaces: ['dark', 'light', 'photo'],
  props: {
    photo: { type: 'photo', need: 'fullBleed' },
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 80 },
    emphasis: { maxChars: 70 },
  },

  render({ props, brand, surface, photos, slide }) {
    const onPhoto = surface === 'photo' && photos && photos.photo;
    const eyebrow = props.eyebrow ? `<div class="eyebrow cc-eyebrow">${esc(props.eyebrow)}</div>` : '';
    const emphasis = props.emphasis ? ` <span class="accent emphasis">${words(props.emphasis)}</span>` : '';
    return `
      ${onPhoto ? `<div class="cc-photo">${photo(photos.photo)}</div><div class="cc-scrim"></div>` : ''}
      ${wordmark(brand, surface === 'photo' ? 'dark' : surface)}
      <div class="region cc-region${onPhoto ? ' cc-on-photo' : ''}" data-fit-box>
        ${eyebrow}
        <h1 class="headline cc-headline" data-fit="[88,80,72,64,58,52]" data-lines>${words(props.headline)}${emphasis}</h1>
      </div>
      ${slideFoot(slide)}
      <style>
        .cc-photo { position: absolute; inset: 0; }
        .cc-scrim {
          position: absolute; inset: 0;
          background:
            linear-gradient(to bottom, var(--scrim-strong) 0px, var(--scrim-mid) 200px, var(--scrim-clear) 420px),
            linear-gradient(to top, var(--scrim-strong) 0%, var(--scrim-strong) 26%, var(--scrim-mid) 50%, var(--scrim-clear) 72%);
        }
        .cc-region { justify-content: center; }
        .cc-region.cc-on-photo { justify-content: flex-end; }
        .cc-eyebrow { margin-bottom: 26px; }
      </style>`;
  },
};
