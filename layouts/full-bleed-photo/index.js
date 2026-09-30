/**
 * Layout 11: full-bleed photo.
 *
 * A library photo across the whole canvas with a headline set over a scrim,
 * at the bottom (default) or the top. For posts where the place carries the
 * idea: the course at first light, the marina on a Saturday. Choose a photo
 * whose calm zones sit where the type goes; the scrim keeps white ink
 * readable either way, but a busy zone under the headline still looks busy.
 */

'use strict';

const { esc, words, wordmark, photo } = require('../_shared/h');

module.exports = {
  id: 'full-bleed-photo',
  title: 'Full-bleed photo',
  format: 'photo',
  surfaces: ['photo'],
  props: {
    photo: { type: 'photo', need: 'fullBleed', required: true },
    position: { type: 'enum', values: ['bottom', 'top'] },
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 64 },
    emphasis: { maxChars: 64 },
    body: { maxChars: 140 },
  },

  render({ props, brand, photos }) {
    const pos = props.position || 'bottom';
    // A bright sky behind the wordmark gets a darker corner (most skies
    // measure above 120; the library records each zone's brightness).
    const brightTop = (photos.photo.zones['top-left'] || 0) > 120;
    const eyebrow = props.eyebrow ? `<div class="eyebrow fb-eyebrow">${esc(props.eyebrow)}</div>` : '';
    const emphasis = props.emphasis ? ` <span class="accent emphasis">${words(props.emphasis)}</span>` : '';
    const body = props.body
      ? `<p class="body-copy fb-body" data-fit="[32,30,28,26]" data-lines>${words(props.body)}</p>`
      : '';
    return `
      <div class="fb-photo">${photo(photos.photo)}</div>
      <div class="fb-scrim fb-scrim-${pos}${brightTop ? ' fb-bright-top' : ''}"></div>
      ${wordmark(brand, 'dark')}
      <div class="fb-text fb-${pos}" data-fit-box>
        ${eyebrow}
        <h1 class="headline fb-headline" data-fit="[78,72,66,60,54]" data-lines>${words(props.headline)}${emphasis}</h1>
        ${body}
      </div>
      <style>
        .fb-photo { position: absolute; inset: 0; }
        .fb-scrim { position: absolute; inset: 0; }
        .fb-scrim-bottom {
          background:
            linear-gradient(to bottom, var(--scrim-mid) 0px, var(--scrim-clear) 300px),
            linear-gradient(to top, var(--scrim-strong) 0%, var(--scrim-strong) 20%, var(--scrim-mid) 44%, var(--scrim-clear) 66%);
        }
        .fb-scrim-bottom.fb-bright-top {
          background:
            linear-gradient(to bottom, var(--scrim-strong) 0px, var(--scrim-mid) 190px, var(--scrim-clear) 380px),
            linear-gradient(to top, var(--scrim-strong) 0%, var(--scrim-strong) 20%, var(--scrim-mid) 44%, var(--scrim-clear) 66%);
        }
        .fb-scrim-top {
          background: linear-gradient(to bottom, var(--scrim-strong) 0%, var(--scrim-strong) 22%, var(--scrim-mid) 46%, var(--scrim-clear) 68%);
        }
        .fb-text {
          position: absolute; left: 81px; right: 81px; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .fb-bottom { top: 640px; bottom: 96px; justify-content: flex-end; }
        .fb-top { top: 220px; bottom: 700px; justify-content: flex-start; }
        .fb-eyebrow { margin-bottom: 22px; }
        .fb-body { margin-top: 30px; max-width: 820px; }
      </style>`;
  },
};
