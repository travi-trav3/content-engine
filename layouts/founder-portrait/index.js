/**
 * Layout 14: founder portrait.
 *
 * The founder's point in their own words, with their portrait and byline.
 * For founder-voice posts in source mode: the quote restates something the
 * founder said or wrote (a talk, a call, a note), and `context` names where
 * it came from. The photo must carry the "founder" tag, so a stock portrait
 * can never stand in for the founder.
 */

'use strict';

const { esc, words, wordmark, photo } = require('../_shared/h');

module.exports = {
  id: 'founder-portrait',
  title: 'Founder portrait',
  surfaces: ['dark', 'light'],
  props: {
    photo: { type: 'photo', requireTags: ['founder'], required: true },
    quote: { required: true, maxChars: 200 },
    name: { required: true, maxChars: 40 },
    role: { required: true, maxChars: 64 },
    context: { maxChars: 64 },
  },

  render({ props, brand, surface, photos }) {
    const context = props.context ? `<div class="fp-context">${esc(props.context)}</div>` : '';
    return `
      ${wordmark(brand, surface)}
      <div class="region fp-region" data-fit-box>
        <blockquote class="headline fp-quote" data-fit="[62,58,54,50,46,42]" data-lines>${words(props.quote)}</blockquote>
        <div class="fp-byline">
          <div class="fp-portrait">${photo(photos.photo)}</div>
          <div>
            <div class="fp-name">${esc(props.name)}</div>
            <div class="fp-role">${esc(props.role)}</div>
            ${context}
          </div>
        </div>
      </div>
      <style>
        .fp-region { justify-content: center; }
        .fp-quote { position: relative; padding-left: 44px; border-left: 6px solid var(--accent-graphic); }
        .fp-byline { display: flex; align-items: center; gap: 36px; margin-top: 64px; }
        .fp-portrait {
          flex: none; width: 220px; height: 220px; border-radius: 999px; overflow: hidden;
          box-shadow: 0 0 0 6px var(--bg), 0 0 0 10px var(--accent-graphic);
          margin-left: 10px;
        }
        .fp-name { font-size: 36px; font-weight: var(--fw-head); color: var(--ink); letter-spacing: var(--ls-display); }
        .fp-role { font-size: 26px; color: var(--ink-body); margin-top: 8px; }
        .fp-context { font-size: 22px; color: var(--ink-muted); margin-top: 14px; }
      </style>`;
  },
};
