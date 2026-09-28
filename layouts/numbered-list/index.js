/**
 * Layout 2: numbered list.
 *
 * A headline over three to six short numbered items, each on its own ruled
 * row. For posts whose substance is a set of concrete things.
 */

'use strict';

const { esc, words, wordmark, headlineWords, eyebrow } = require('../_shared/h');

module.exports = {
  id: 'numbered-list',
  title: 'Numbered list',
  surfaces: ['light', 'dark'],
  props: {
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 60 },
    emphasis: { maxChars: 60 },
    items: { type: 'list', item: 'text', required: true, minItems: 3, maxItems: 6, maxChars: 48 },
    signoff: { maxChars: 60 },
  },

  render({ props, brand, surface }) {
    const items = props.items.map((item, i) => `
      <li class="nl-row">
        <span class="nl-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="nl-text" data-fit="[40,36,33,30,28]" data-lines="orphans">${words(item)}</span>
      </li>`).join('');
    const signoff = props.signoff ? `<div class="foot"><span>${esc(props.signoff)}</span></div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region" data-fit-box>
        ${eyebrow(props.eyebrow)}
        <h1 class="headline nl-headline" data-fit="[64,58,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
        <ol class="nl-items">${items}</ol>
      </div>
      ${signoff}
      <style>
        .nl-items { list-style: none; margin-top: 44px; border-bottom: 1px solid var(--line); }
        .nl-row {
          display: flex; align-items: baseline; gap: 48px;
          padding: 26px 0; border-top: 1px solid var(--line);
        }
        .nl-num { flex: none; width: 44px; font-size: 30px; font-weight: var(--fw-bold); color: var(--accent); }
        .nl-text { font-weight: var(--fw-body); color: var(--ink); line-height: 1.2; }
      </style>`;
  },
};
