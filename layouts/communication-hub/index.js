/**
 * Layout 8: communication hub.
 *
 * Two to five channels, each a tile with an icon, joined by lines into one
 * hub panel. Channel names and the hub label are props; the icon set is part
 * of the layout.
 */

'use strict';

const { esc, words, wordmark, headlineWords } = require('../_shared/h');

const ICONS = {
  email: '<rect x="4" y="9" width="36" height="26" rx="4"/><path d="M5 11l17 13 17-13"/>',
  text: '<path d="M8 8h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-9 7v-7H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"/>',
  app: '<rect x="12" y="3" width="20" height="38" rx="4"/><path d="M19 35h6"/>',
  assistant: '<path d="M22 4l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/>',
  other: '<circle cx="22" cy="22" r="14"/>',
};

// Geometry on the 1080 x 1350 canvas.
const LEFT = 81;
const WIDTH = 918;
const GAP = 20;
const TILE_TOP = 540;
const TILE_HEIGHT = 160;
const HUB_TOP = 850;
const CENTER = 540;

module.exports = {
  id: 'communication-hub',
  title: 'Communication hub',
  format: 'diagram',
  surfaces: ['dark'],
  props: {
    headline: { required: true, maxChars: 60 },
    emphasis: { maxChars: 60 },
    channels: {
      type: 'list', required: true, minItems: 2, maxItems: 5,
      item: {
        label: { required: true, maxChars: 16 },
        icon: { type: 'enum', values: Object.keys(ICONS), required: true },
      },
    },
    hubLabel: { required: true, maxChars: 28 },
    hubDetail: { maxChars: 64 },
  },

  render({ props, brand, surface }) {
    const n = props.channels.length;
    const tileWidth = (WIDTH - GAP * (n - 1)) / n;
    const centers = props.channels.map((_, i) => LEFT + tileWidth / 2 + i * (tileWidth + GAP));
    const tileBottom = TILE_TOP + TILE_HEIGHT;
    const midY = (tileBottom + HUB_TOP) / 2;
    const paths = centers
      .map((x) => `<path d="M${x.toFixed(1)} ${tileBottom} C${x.toFixed(1)} ${midY} ${CENTER} ${midY} ${CENTER} ${HUB_TOP}"/>`)
      .join('');
    const tiles = props.channels.map((c, i) => `
      <div class="hb-tile" style="left:${(centers[i] - tileWidth / 2).toFixed(1)}px;width:${tileWidth.toFixed(1)}px">
        <svg class="hb-icon" viewBox="0 0 44 44" aria-hidden="true">${ICONS[c.icon]}</svg>
        <div class="hb-label" data-fit="[26,26,24,24,22]" data-lines="orphans">${words(c.label)}</div>
      </div>`).join('');
    const detail = props.hubDetail ? `<div class="hb-detail">${esc(props.hubDetail)}</div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="hb-top" data-fit-box>
        <h1 class="headline" data-fit="[62,56,52,48,44]" data-lines>${headlineWords(props.headline, props.emphasis)}</h1>
      </div>
      <svg class="hb-lines" width="1080" height="1350" viewBox="0 0 1080 1350" aria-hidden="true">${paths}</svg>
      ${tiles}
      <div class="hb-hub"><div class="hb-hub-label">${esc(props.hubLabel)}</div>${detail}</div>
      <style>
        .hb-top { position: absolute; left: 81px; right: 81px; top: 220px; height: 280px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .hb-lines { position: absolute; left: 0; top: 0; fill: none; stroke: var(--accent-graphic); stroke-width: 3; opacity: 0.8; }
        .hb-tile {
          position: absolute; top: ${TILE_TOP}px; height: ${TILE_HEIGHT}px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
          background: var(--bg-raised); border: 1px solid var(--line); border-radius: var(--r-lg);
          text-align: center; padding: 0 12px;
        }
        .hb-icon { width: 46px; height: 46px; fill: none; stroke: var(--accent-graphic); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
        .hb-label { color: var(--ink); font-weight: var(--fw-head); line-height: 1.15; }
        .hb-hub {
          position: absolute; top: ${HUB_TOP}px; left: 50%; transform: translateX(-50%); width: 620px;
          padding: 36px 40px; text-align: center; border-radius: 28px;
          background: var(--bg-raised); border: 2px solid var(--accent-graphic);
        }
        .hb-hub-label { color: var(--ink); font-size: 42px; font-weight: var(--fw-head); letter-spacing: var(--ls-display); }
        .hb-detail { color: var(--ink-muted); font-size: 24px; margin-top: 10px; }
      </style>`;
  },
};
