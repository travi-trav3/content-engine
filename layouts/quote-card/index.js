/**
 * Layout 4: quote card.
 *
 * A quotation with its attribution: the founder's own words from a recorded
 * source, or a third-party quote used verbatim. The layout takes the quote as
 * given; the brand gate checks founder quotes against their source and the
 * locked-quotes list checks press wording.
 */

'use strict';

const { esc, words, wordmark } = require('../_shared/h');

module.exports = {
  id: 'quote-card',
  title: 'Quote card',
  format: 'type-card',
  surfaces: ['light', 'dark'],
  props: {
    quote: { required: true, maxChars: 180 },
    attribution: { required: true, maxChars: 48 },
    role: { maxChars: 64 },
  },

  render({ props, brand, surface }) {
    const role = props.role ? `<div class="qc-role">${esc(props.role)}</div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region" data-fit-box>
        <div class="qc-mark" aria-hidden="true">&ldquo;</div>
        <blockquote class="headline qc-quote" data-fit="[74,68,62,56,50,46,42]" data-lines>${words(props.quote)}</blockquote>
        <div class="qc-attr">
          <div class="qc-bar"></div>
          <div><div class="qc-name">${esc(props.attribution)}</div>${role}</div>
        </div>
      </div>
      <style>
        .qc-mark {
          font-family: var(--font-display); font-weight: var(--fw-bold);
          font-size: 220px; line-height: 0.7; height: 110px; color: var(--accent-graphic);
        }
        .qc-quote { margin-top: 20px; }
        .qc-attr { display: flex; align-items: center; gap: 28px; margin-top: 52px; }
        .qc-bar { width: 64px; height: 4px; background: var(--accent-graphic); flex: none; }
        .qc-name { font-size: 30px; font-weight: var(--fw-head); color: var(--ink); }
        .qc-role { font-size: 24px; color: var(--ink-muted); margin-top: 6px; }
      </style>`;
  },
};
