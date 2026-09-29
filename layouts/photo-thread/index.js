/**
 * Layout 13: photo thread.
 *
 * The message thread set over a library photo: a member texting the club
 * from the course, the dock or the court, and the club answering. The
 * photo places the exchange in club life; the thread is the same one the
 * message-thread layout draws, under the same capability rules.
 */

'use strict';

const { wordmark, headlineWords, photo } = require('../_shared/h');
const { bubble, device, threadCss } = require('../_shared/thread');

module.exports = {
  id: 'photo-thread',
  title: 'Photo thread',
  surfaces: ['photo'],
  props: {
    photo: { type: 'photo', need: 'fullBleed', required: true },
    headline: { required: true, maxChars: 56 },
    emphasis: { maxChars: 56 },
    sender: { required: true, maxChars: 32 },
    timestamp: { maxChars: 24 },
    messages: {
      type: 'list', required: true, minItems: 1, maxItems: 3,
      item: {
        from: { type: 'enum', values: ['member', 'club'], required: true },
        text: { required: true, maxChars: 110 },
      },
    },
  },

  render({ props, brand, photos }) {
    return `
      <div class="pt-photo">${photo(photos.photo)}</div>
      <div class="pt-scrim"></div>
      ${wordmark(brand, 'dark')}
      <div class="pt-top" data-fit-box>
        <h1 class="headline" data-fit="[62,56,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
      </div>
      <div class="pt-stage" data-fit-box>
        ${device({
          brand,
          sender: props.sender,
          timestamp: props.timestamp,
          bubbles: props.messages.map((m) => bubble(m.from, m.text)),
        })}
      </div>
      <style>
        ${threadCss}
        .pt-photo { position: absolute; inset: 0; }
        .pt-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, var(--scrim-strong) 0%, var(--scrim-mid) 36%, var(--scrim-soft) 60%, var(--scrim-mid) 100%);
        }
        .pt-top {
          position: absolute; left: 81px; right: 81px; top: 220px; height: 250px; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
        }
        .pt-stage {
          position: absolute; left: 0; right: 0; top: 510px; bottom: 90px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
      </style>`;
  },
};
