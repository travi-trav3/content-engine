/**
 * Layout 5: question card.
 *
 * One question for club leaders, set large beside an accent bar, with
 * optional context. The objective is a reply, so there is no product in it.
 */

'use strict';

const { esc, words, wordmark, eyebrow } = require('../_shared/h');

module.exports = {
  id: 'question-card',
  title: 'Question card',
  format: 'type-card',
  surfaces: ['light', 'dark'],
  props: {
    eyebrow: { maxChars: 32 },
    question: { required: true, maxChars: 110 },
    context: { maxChars: 150 },
    signoff: { maxChars: 48 },
  },

  render({ props, brand, surface }) {
    const context = props.context
      ? `<p class="body-copy qn-context" data-fit="[32,30,28,26,24]" data-lines>${words(props.context)}</p>`
      : '';
    const signoff = props.signoff
      ? `<div class="foot"><div class="rule"></div><span class="nowrap">${esc(props.signoff)}</span></div>`
      : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region" data-fit-box>
        <div class="qn-block">
          ${eyebrow(props.eyebrow)}
          <h1 class="headline qn-question" data-fit="[84,76,68,62,56,50]" data-lines>${words(props.question)}</h1>
          ${context}
        </div>
      </div>
      ${signoff}
      <style>
        .qn-block { border-left: 10px solid var(--accent-graphic); padding-left: 52px; }
        .qn-context { margin-top: 44px; max-width: 780px; }
      </style>`;
  },
};
