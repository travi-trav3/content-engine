/**
 * Layout 7: escalation thread.
 *
 * The capability boundary's safe pattern, and nothing else:
 *
 *   Member:    a question the club has not published an answer to
 *   Assistant: offers to send it to the club team
 *   Member:    agrees
 *   Assistant: confirms it was sent and that someone will follow up
 *   [the thread is marked for the club team; the post ends here]
 *
 * The four beats are fixed props rather than a free message list, so there
 * is no way to render anything after the handoff: no confirmation, no
 * outcome, no booked court. The wording of each beat is still checked by the
 * capability gate.
 */

'use strict';

const { esc, wordmark, headlineWords } = require('../_shared/h');
const { bubble, device, threadCss } = require('../_shared/thread');

module.exports = {
  id: 'escalation-thread',
  title: 'Escalation thread',
  format: 'thread',
  surfaces: ['dark'],
  props: {
    headline: { required: true, maxChars: 60 },
    emphasis: { maxChars: 60 },
    sender: { required: true, maxChars: 32 },
    timestamp: { maxChars: 24 },
    question: { required: true, maxChars: 110 },
    offer: { required: true, maxChars: 110 },
    reply: { required: true, maxChars: 30 },
    handoff: { required: true, maxChars: 90 },
    signoff: { maxChars: 60 },
  },

  render({ props, brand, surface }) {
    const status = (brand.thread && brand.thread.handoffStatus)
      ? `<div class="handoff-status"><span class="dot"></span>${esc(brand.thread.handoffStatus)}</div>`
      : '';
    const signoff = props.signoff ? `<div class="foot"><span>${esc(props.signoff)}</span></div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="et-top" data-fit-box>
        <h1 class="headline" data-fit="[62,56,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
      </div>
      <div class="et-stage" data-fit-box>
        ${device({
          brand,
          sender: props.sender,
          timestamp: props.timestamp,
          bubbles: [
            bubble('member', props.question),
            bubble('club', props.offer),
            bubble('member', props.reply),
            bubble('club', props.handoff),
          ],
          after: status,
        })}
      </div>
      ${signoff}
      <style>
        ${threadCss}
        .et-top { position: absolute; left: 81px; right: 81px; top: 220px; height: 220px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .et-stage { position: absolute; left: 0; right: 0; top: 470px; bottom: 150px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .handoff-status {
          align-self: flex-start; display: flex; align-items: center; gap: 10px; margin-top: 4px;
          padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.16);
          color: var(--device-muted); font-size: 15px; font-weight: var(--fw-head); letter-spacing: 0.02em;
        }
        .handoff-status .dot { width: 9px; height: 9px; border-radius: 999px; background: var(--accent-graphic); }
      </style>`;
  },
};
