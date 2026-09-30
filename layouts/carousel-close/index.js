/**
 * Layout 15, carousel set: the closing slide.
 *
 * The takeaway, and optionally a "try this at your club" box: the same
 * technique turned into something the reader can use with their own
 * members. This slide gives, it does not ask: in a generated carousel the
 * ask is the end card after it (carousel-cta).
 */

'use strict';

const { esc, words, wordmark, slideFoot } = require('../_shared/h');

module.exports = {
  id: 'carousel-close',
  title: 'Carousel close',
  format: 'carousel',
  surfaces: ['dark', 'light'],
  props: {
    headline: { required: true, maxChars: 80 },
    body: { maxChars: 200 },
    tryTitle: { maxChars: 40 },
    tryBody: { maxChars: 160 },
  },

  render({ props, brand, surface, slide }) {
    const body = props.body
      ? `<p class="body-copy ck-body" data-fit="[30,28,26,24]" data-lines>${words(props.body)}</p>`
      : '';
    const tryBox = props.tryTitle || props.tryBody
      ? `<div class="ck-try">
          ${props.tryTitle ? `<div class="ck-try-title">${esc(props.tryTitle)}</div>` : ''}
          ${props.tryBody ? `<p class="ck-try-body" data-fit="[28,26,24,22]" data-lines>${words(props.tryBody)}</p>` : ''}
        </div>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region ck-region" data-fit-box>
        <h1 class="headline" data-fit="[66,60,56,52,48]" data-lines>${words(props.headline)}</h1>
        ${body}
        ${tryBox}
      </div>
      ${slideFoot(slide)}
      <style>
        .ck-region { justify-content: center; }
        .ck-body { margin-top: 36px; max-width: 880px; }
        .ck-try {
          margin-top: 52px; padding: 34px 38px; border-radius: var(--r-lg);
          border: 2px solid var(--accent-graphic); background: var(--bg-raised);
        }
        .ck-try-title {
          font-size: 22px; font-weight: var(--fw-bold); letter-spacing: var(--ls-eyebrow);
          text-transform: uppercase; color: var(--accent); margin-bottom: 14px;
        }
        .ck-try-body { color: var(--ink-body); line-height: var(--lh-body); font-weight: var(--fw-body); }
      </style>`;
  },
};
