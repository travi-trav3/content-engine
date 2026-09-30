/**
 * Layout 15, carousel set: the end card.
 *
 * The last slide of every carousel: a relaxed invitation to meet the team,
 * seen only by people who swiped all the way through. Its words come from
 * the brand's end-card library (config.json cta.endCards), chosen and filled
 * by the engine, never written by the model, so the ask always reads the
 * way the brand approved it.
 */

'use strict';

const { esc, words, wordmark, slideFoot } = require('../_shared/h');

module.exports = {
  id: 'carousel-cta',
  title: 'Carousel end card',
  format: 'carousel',
  surfaces: ['dark', 'light'],
  props: {
    headline: { required: true, maxChars: 80 },
    action: { required: true, maxChars: 90 },
    link: { required: true, maxChars: 40 },
  },

  render({ props, brand, surface, slide }) {
    return `
      ${wordmark(brand, surface)}
      <div class="region ce-region" data-fit-box>
        <h1 class="headline" data-fit="[78,72,66,60,54]" data-lines>${words(props.headline)}</h1>
        <p class="ce-action" data-fit="[40,36,32,30,28]" data-lines>${words(props.action)}</p>
        <div class="ce-link"><span class="ce-dot"></span>${esc(props.link)}</div>
      </div>
      ${slideFoot(slide)}
      <style>
        .ce-region { justify-content: center; }
        .ce-action { margin-top: 40px; color: var(--accent); font-weight: var(--fw-head); line-height: var(--lh-head); max-width: 880px; }
        .ce-link {
          align-self: flex-start; display: flex; align-items: center; gap: 14px; margin-top: 56px;
          padding: 18px 30px; border-radius: var(--r-pill); border: 2px solid var(--accent-graphic);
          font-size: 28px; font-weight: var(--fw-head); color: var(--ink);
        }
        .ce-dot { width: 12px; height: 12px; border-radius: 999px; background: var(--accent-graphic); flex: none; }
      </style>`;
  },
};
