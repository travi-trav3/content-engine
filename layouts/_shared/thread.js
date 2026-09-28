/**
 * The phone and message thread shared by the thread layouts.
 *
 * The sender is always the club (a fictional demo club; the brand gate checks
 * the roster), never the product or a character. The product appears only in
 * the brand's "powered by" microline from render.json.
 */

'use strict';

const { esc, words, initials } = require('./h');

const BUBBLE_FIT = '[25,24,23,22,21,20]';

function bubble(from, text) {
  return `<div class="bubble ${from === 'member' ? 'member' : 'club'}" data-fit="${BUBBLE_FIT}" data-lines="orphans">${words(text)}</div>`;
}

function device({ brand, sender, timestamp, bubbles, after = '' }) {
  const t = brand.thread || {};
  const sub = [t.channelLabel, t.poweredBy].filter(Boolean).map(esc).join(' &middot; ');
  const stamp = timestamp ? `<div class="stamp">${esc(timestamp)}</div>` : '';
  return `
    <div class="device">
      <div class="screen">
        <div class="notch"></div>
        <div class="thread-head">
          <div class="avatar">${esc(initials(sender))}</div>
          <div><div class="sender">${esc(sender)}</div><div class="sender-sub">${sub}</div></div>
        </div>
        <div class="thread-body">${stamp}${bubbles.join('')}${after}</div>
      </div>
    </div>`;
}

const threadCss = `
  .device {
    width: 680px; border-radius: 56px; padding: 16px;
    background: var(--device); border: 1px solid var(--device-edge);
    box-shadow: 0 40px 80px -24px rgba(0, 0, 0, 0.85);
  }
  .screen { position: relative; border-radius: 40px; overflow: hidden; background: var(--device-screen); }
  .notch {
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 136px; height: 28px; background: var(--device); border-radius: 0 0 16px 16px;
  }
  .thread-head {
    display: flex; align-items: center; gap: 14px; padding: 36px 26px 18px;
    background: var(--device-header); border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .avatar {
    flex: none; width: 50px; height: 50px; border-radius: 999px; background: var(--avatar-bg);
    color: var(--avatar-ink); display: flex; align-items: center; justify-content: center;
    font-size: 21px; font-weight: var(--fw-bold);
  }
  .sender { color: var(--device-ink); font-size: 25px; font-weight: var(--fw-head); }
  .sender-sub { color: var(--device-muted); font-size: 17px; margin-top: 2px; }
  .thread-body { display: flex; flex-direction: column; gap: 13px; padding: 22px 22px 30px; }
  .stamp {
    align-self: center; color: var(--device-muted); font-size: 14px;
    font-weight: var(--fw-head); letter-spacing: 0.04em; margin-bottom: 2px;
  }
  .bubble {
    max-width: 80%; padding: 15px 20px; border-radius: 22px; line-height: 1.34;
    font-weight: var(--fw-body); color: var(--bubble-ink);
  }
  .bubble.member { align-self: flex-end; background: var(--bubble-out); border-bottom-right-radius: 8px; }
  .bubble.club { align-self: flex-start; background: var(--bubble-in); border-bottom-left-radius: 8px; }
`;

module.exports = { bubble, device, threadCss };
