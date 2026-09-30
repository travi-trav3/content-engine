/**
 * Layout 1: type card.
 *
 * A headline, an optional second clause set in the accent color on its own
 * line, optional body copy, and an optional sign-off under a rule. The
 * workhorse for posts that carry an idea without a photo.
 */

'use strict';

const { esc, words, wordmark } = require('../_shared/h');

module.exports = {
  id: 'type-card',
  title: 'Type card',
  format: 'type-card',
  surfaces: ['dark', 'light'],
  props: {
    headline: { required: true, maxChars: 70 },
    emphasis: { required: false, maxChars: 70 },
    body: { required: false, maxChars: 170 },
    signoff: { required: false, maxChars: 48 },
  },

  render({ props, brand, surface }) {
    const emphasis = props.emphasis
      ? ` <span class="accent tc-emphasis">${words(props.emphasis)}</span>`
      : '';
    const body = props.body
      ? `<p class="body-copy tc-body" data-fit="[32,30,28,26,24]" data-lines>${words(props.body)}</p>`
      : '';
    const signoff = props.signoff
      ? `<div class="tc-foot"><div class="tc-rule"></div><span class="muted tc-signoff">${esc(props.signoff)}</span></div>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="tc-main" data-fit-box>
        <h1 class="headline tc-headline" data-fit="[80,74,68,62,56]" data-lines>${words(props.headline)}${emphasis}</h1>
        ${body}
      </div>
      ${signoff}
      <style>
        .tc-main {
          position: absolute; left: 81px; right: 81px; top: 230px; bottom: 190px;
          display: flex; flex-direction: column; justify-content: center; overflow: hidden;
        }
        .tc-emphasis { display: block; }
        .tc-body { margin-top: 50px; max-width: 830px; }
        .tc-foot {
          position: absolute; left: 81px; right: 81px; bottom: 88px;
          display: flex; align-items: center; gap: 22px;
        }
        .tc-rule { flex: 1; height: 1px; background: var(--line); }
        .tc-signoff { font-size: 22px; white-space: nowrap; }
      </style>`;
  },
};
