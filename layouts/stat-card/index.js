/**
 * Layout 3: stat card.
 *
 * One approved statistic, large, with what it measures and where it comes
 * from. One number per card: the two-stat contrast pair is retired, and the
 * source line is required because an unattributed number is the defect this
 * layout exists to prevent. Whether the number is approved is the stat
 * gate's job; this layout only refuses to render one without a source.
 */

'use strict';

const { esc, words, wordmark, eyebrow } = require('../_shared/h');

module.exports = {
  id: 'stat-card',
  title: 'Stat card',
  format: 'data',
  surfaces: ['light', 'dark'],
  props: {
    eyebrow: { maxChars: 32 },
    value: { required: true, maxChars: 6 },
    unit: { maxChars: 12 },
    label: { required: true, maxChars: 90 },
    context: { maxChars: 140 },
    source: { required: true, maxChars: 48 },
  },

  render({ props, brand, surface }) {
    const unit = props.unit ? `<span class="sc-unit">${esc(props.unit)}</span>` : '';
    const context = props.context
      ? `<p class="body-copy sc-context" data-fit="[30,28,26,24,22]" data-lines>${words(props.context)}</p>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region" data-fit-box>
        ${eyebrow(props.eyebrow)}
        <div class="sc-figure"><span class="sc-value" data-fit="[240,220,200,180,160]">${esc(props.value)}</span>${unit}</div>
        <p class="headline sc-label" data-fit="[50,46,42,38,34]" data-lines>${words(props.label)}</p>
        ${context}
      </div>
      <div class="foot"><div class="rule"></div><span class="nowrap">${esc(props.source)}</span></div>
      <style>
        .sc-figure { display: flex; align-items: baseline; gap: 24px; color: var(--accent); }
        .sc-value {
          font-family: var(--font-display); font-weight: var(--fw-bold);
          line-height: 0.9; letter-spacing: -0.04em;
        }
        .sc-unit { font-size: 64px; font-weight: var(--fw-head); letter-spacing: var(--ls-display); }
        .sc-label { margin-top: 36px; max-width: 880px; }
        .sc-context { margin-top: 36px; max-width: 800px; }
      </style>`;
  },
};
