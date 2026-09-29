/**
 * Layout 9: product screenshot.
 *
 * A real product screenshot in a plain frame (a phone for mobile captures,
 * a panel for desktop ones) under a headline. The photo must carry the
 * "product-screenshot" tag: screenshots come from the product team and are
 * reviewed into the library like any photo, and nothing here draws product
 * UI. Until the library holds one, this layout cannot render for the brand;
 * that is intended (no fabricated UI).
 */

'use strict';

const { esc, words, wordmark, headlineWords, photo } = require('../_shared/h');

module.exports = {
  id: 'product-screenshot',
  title: 'Product screenshot',
  surfaces: ['dark', 'light'],
  requires: { photoTags: ['product-screenshot'] },
  props: {
    photo: { type: 'photo', requireTags: ['product-screenshot'], required: true },
    frame: { type: 'enum', values: ['phone', 'panel'] },
    headline: { required: true, maxChars: 60 },
    emphasis: { maxChars: 60 },
    caption: { maxChars: 110 },
  },

  render({ props, brand, surface, photos }) {
    const frame = props.frame || 'phone';
    const caption = props.caption
      ? `<p class="ps-caption" data-fit="[26,24,22]" data-lines>${words(props.caption)}</p>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="ps-top" data-fit-box>
        <h1 class="headline" data-fit="[62,56,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
      </div>
      <div class="ps-stage">
        <div class="ps-frame ps-${esc(frame)}"><div class="ps-shot">${photo(photos.photo)}</div></div>
      </div>
      <div class="ps-foot" data-fit-box>${caption}</div>
      <style>
        .ps-top {
          position: absolute; left: 81px; right: 81px; top: 220px; height: 230px; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
        }
        .ps-stage {
          position: absolute; left: 81px; right: 81px; top: 490px; bottom: 190px;
          display: flex; align-items: center; justify-content: center;
        }
        .ps-frame { background: var(--device); border: 1px solid var(--device-edge); box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.7); }
        .ps-shot { width: 100%; height: 100%; overflow: hidden; }
        .ps-shot .photo { object-position: 50% 0% !important; }
        .ps-phone { height: 100%; aspect-ratio: 9 / 19; padding: 12px; border-radius: 48px; }
        .ps-phone .ps-shot { border-radius: 36px; }
        .ps-panel { width: 100%; aspect-ratio: 16 / 10; max-height: 100%; padding: 10px; border-radius: var(--r-lg); }
        .ps-panel .ps-shot { border-radius: calc(var(--r-lg) - 8px); }
        .ps-foot {
          position: absolute; left: 81px; right: 81px; bottom: 80px; height: 90px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .ps-caption { text-align: center; color: var(--ink-muted); max-width: 820px; line-height: var(--lh-body); }
      </style>`;
  },
};
