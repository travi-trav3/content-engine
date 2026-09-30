/**
 * Layout 10: proof bar.
 *
 * A proof point (a press line quoted verbatim, set in quotation marks when
 * it carries an attribution, or a plain statement) over a row of logos from the brand's proof registry (render.json "proof"). The
 * label over the logos comes from the registry, never from copy: every logo
 * in a bar must share one relation ("featured", "exhibited", "trusted"),
 * so a bar cannot put an event the brand only exhibited at under "As
 * featured in". A "trusted" logo (a customer) must record its written
 * approval in the registry, because an unapproved club logo is the one
 * mistake this format cannot take back.
 */

'use strict';

const { esc, words, wordmark, eyebrow } = require('../_shared/h');

const logoFile = (entry, surface) => entry.file && (entry.file[surface] || null);

module.exports = {
  id: 'proof-bar',
  title: 'Proof bar',
  format: 'logo-wall',
  surfaces: ['dark'],
  props: {
    eyebrow: { maxChars: 32 },
    headline: { required: true, maxChars: 90 },
    attribution: { maxChars: 48 },
    logos: { type: 'list', item: 'text', registry: 'proof.logos', required: true, minItems: 1, maxItems: 4, maxChars: 40 },
  },

  check({ props, brand }) {
    const registry = (brand.proof && brand.proof.logos) || {};
    const errors = [];
    const entries = [];
    for (const id of props.logos || []) {
      const entry = registry[id];
      if (!entry) {
        errors.push(`logo "${id}" is not in the brand's proof registry (render.json proof.logos; registered: ${Object.keys(registry).join(', ') || 'none'})`);
        continue;
      }
      if (!logoFile(entry, 'dark')) errors.push(`logo "${id}" has no on-dark file`);
      if (entry.relation === 'trusted' && !entry.approval) {
        errors.push(`logo "${id}" is a customer logo without a recorded written approval`);
      }
      entries.push(entry);
    }
    const relations = [...new Set(entries.map((e) => e.relation))];
    if (relations.length > 1) {
      errors.push(`logos mix relations (${relations.join(', ')}); one bar carries one label`);
    }
    if (relations.length === 1 && !(brand.proof.labels || {})[relations[0]]) {
      errors.push(`no label for relation "${relations[0]}" in render.json proof.labels`);
    }
    return errors;
  },

  render({ props, brand, surface }) {
    const registry = brand.proof.logos;
    const entries = props.logos.map((id) => registry[id]);
    const label = brand.proof.labels[entries[0].relation];
    const attribution = props.attribution
      ? `<div class="pr-attr"><div class="pr-dash"></div><span>${esc(props.attribution)}</span></div>`
      : '';
    const logos = entries.map((e) => `<img class="pr-logo" src="/brand/${esc(logoFile(e, surface))}" alt="${esc(e.name)}" style="height: ${Number(e.height) || 80}px">`).join('');
    return `
      ${wordmark(brand, surface)}
      <div class="pr-main" data-fit-box>
        ${eyebrow(props.eyebrow)}
        <h1 class="headline" data-fit="[70,64,58,54,50,46]" data-lines>${props.attribution ? `&ldquo;${words(props.headline)}&rdquo;` : words(props.headline)}</h1>
        ${attribution}
      </div>
      <div class="pr-bar">
        <div class="pr-label"><span>${esc(label)}</span><div class="pr-rule"></div></div>
        <div class="pr-logos">${logos}</div>
      </div>
      <style>
        .pr-main {
          position: absolute; left: 81px; right: 81px; top: 220px; bottom: 470px;
          display: flex; flex-direction: column; justify-content: center; overflow: hidden;
        }
        .pr-attr { display: flex; align-items: center; gap: 22px; margin-top: 44px; font-size: 28px; font-weight: var(--fw-head); color: var(--ink-body); }
        .pr-dash { width: 56px; height: 4px; background: var(--accent-graphic); flex: none; }
        .pr-bar { position: absolute; left: 81px; right: 81px; bottom: 96px; height: 300px; }
        .pr-label {
          display: flex; align-items: center; gap: 24px; font-size: 22px; font-weight: var(--fw-head);
          letter-spacing: var(--ls-eyebrow); text-transform: uppercase; color: var(--ink-muted); white-space: nowrap;
        }
        .pr-rule { flex: 1; height: 1px; background: var(--line); }
        .pr-logos {
          height: 240px; display: flex; align-items: center; justify-content: space-evenly; gap: 72px;
        }
        .pr-logo { display: block; width: auto; max-width: 300px; object-fit: contain; }
      </style>`;
  },
};
