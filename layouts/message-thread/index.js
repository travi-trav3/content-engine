/**
 * Layout 6: message thread.
 *
 * A headline over a phone showing a member texting the club and the club
 * answering. For posts where the assistant answers from a club document.
 * Whether the answer is one a document could give is the capability gate's
 * job (depictsAssistant, interactionType: answer, sourceDocument).
 */

'use strict';

const { esc, wordmark, headlineWords } = require('../_shared/h');
const { bubble, device, threadCss } = require('../_shared/thread');

module.exports = {
  id: 'message-thread',
  title: 'Message thread',
  surfaces: ['dark'],
  props: {
    headline: { required: true, maxChars: 60 },
    emphasis: { maxChars: 60 },
    sender: { required: true, maxChars: 32 },
    timestamp: { maxChars: 24 },
    messages: {
      type: 'list', required: true, minItems: 1, maxItems: 4,
      item: {
        from: { type: 'enum', values: ['member', 'club'], required: true },
        text: { required: true, maxChars: 120 },
      },
    },
    signoff: { maxChars: 60 },
  },

  render({ props, brand, surface }) {
    const signoff = props.signoff ? `<div class="foot"><span>${esc(props.signoff)}</span></div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="mt-top" data-fit-box>
        <h1 class="headline" data-fit="[62,56,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
      </div>
      <div class="mt-stage" data-fit-box>
        ${device({
          brand,
          sender: props.sender,
          timestamp: props.timestamp,
          bubbles: props.messages.map((m) => bubble(m.from, m.text)),
        })}
      </div>
      ${signoff}
      <style>
        ${threadCss}
        .mt-top { position: absolute; left: 81px; right: 81px; top: 220px; height: 250px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .mt-stage { position: absolute; left: 0; right: 0; top: 500px; bottom: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      </style>`;
  },
};
