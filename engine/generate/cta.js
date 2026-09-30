/**
 * cta.js
 *
 * Calls to action. The planner decides which posts ask (config.json
 * cta.every: one post in N, never two in a row on a channel); this module
 * decides what they say. Each asking post gets a line from the brand's CTA
 * library, least recently used first across every prior batch, and the
 * engine, not the model, adds it as the caption's last line. So the asks
 * rotate instead of going stale, and every one says exactly what the brand
 * approved: a casual meet-the-team session, never a sales push.
 *
 *   cta: { every: 4, type: "demo", link: "https://...",
 *          variants: [ { id, linkedin: "... https://...", instagram: "... Link in bio." } ] }
 */

'use strict';

// Words that turn an invitation into a pitch. The library is checked
// against them, and so is every caption the model writes.
const SALES_WORDS = ['sales', 'pitch', 'buy', 'purchase', 'limited time', 'act now', "don't miss", 'hurry', 'special offer', 'sign up today'];

const postsOf = (l) => (Array.isArray(l) ? l : l.posts || []);

function ctaTypesOf(config) {
  return config.cta ? [config.cta.type || 'demo'] : [];
}

/** How many posts in a batch of n should ask: one in `every`, rounded either way. */
function ctaRange(n, config) {
  const every = config.cta && Number(config.cta.every);
  if (!every) return { min: 0, max: 1, every: null };
  return { min: Math.floor(n / every), max: Math.ceil(n / every), every };
}

/** The channel's form of a variant: LinkedIn carries the link, Instagram points to the bio. */
function ctaLine(config, variantId, channel) {
  const v = (config.cta.variants || []).find((x) => x.id === variantId);
  if (!v) throw new Error(`Unknown CTA variant "${variantId}"`);
  return String(channel).startsWith('linkedin') ? v.linkedin : v.instagram;
}

/**
 * Gives each asking entry the least recently used variant, never repeating
 * one inside the batch. Ties go to the library's order. Sets ctaVariant and
 * ctaLine on the entries; returns them.
 */
function assignVariants(entries, priors, config) {
  const variants = (config.cta && config.cta.variants) || [];
  const lastUsed = new Map(variants.map((v) => [v.id, '']));
  for (const p of priors.flatMap(postsOf)) {
    if (p.ctaVariant && lastUsed.has(p.ctaVariant)) {
      const at = String(p.dueAt || p.date || '');
      if (at > lastUsed.get(p.ctaVariant)) lastUsed.set(p.ctaVariant, at);
    }
  }
  const taken = new Set();
  const asking = entries.filter((e) => e.ctaType && e.ctaType !== 'none')
    .sort((a, b) => String(a.dueAt || a.date).localeCompare(String(b.dueAt || b.date)));
  for (const e of asking) {
    const pick = variants.filter((v) => !taken.has(v.id))
      .sort((a, b) => lastUsed.get(a.id).localeCompare(lastUsed.get(b.id)) || variants.indexOf(a) - variants.indexOf(b))[0];
    if (!pick) throw new Error(`The CTA library has ${variants.length} variants for ${asking.length} asking posts`);
    taken.add(pick.id);
    e.ctaVariant = pick.id;
    e.ctaLine = ctaLine(config, pick.id, e.channel);
  }
  return entries;
}

/**
 * Every carousel ends on an end card (layout carousel-cta): its own ask,
 * seen only by people who swiped to the end. Each carousel gets the least
 * recently used card, never the same one twice in a batch. A carousel
 * carries no caption ask as well; one ask per post. Sets endCard and
 * endCardProps on the carousel entries.
 */
function assignEndCards(entries, priors, config) {
  const cards = (config.cta && config.cta.endCards) || [];
  const carousels = entries.filter((e) => e.layout === 'carousel')
    .sort((a, b) => String(a.dueAt || a.date).localeCompare(String(b.dueAt || b.date)));
  if (!carousels.length || !cards.length) return entries;
  const lastUsed = new Map(cards.map((c) => [c.id, '']));
  for (const p of priors.flatMap(postsOf)) {
    if (p.endCard && lastUsed.has(p.endCard)) {
      const at = String(p.dueAt || p.date || '');
      if (at > lastUsed.get(p.endCard)) lastUsed.set(p.endCard, at);
    }
  }
  const taken = new Set();
  for (const e of carousels) {
    const pick = cards.filter((c) => !taken.has(c.id))
      .sort((a, b) => lastUsed.get(a.id).localeCompare(lastUsed.get(b.id)) || cards.indexOf(a) - cards.indexOf(b))[0];
    if (!pick) throw new Error(`The end-card library has ${cards.length} cards for ${carousels.length} carousels`);
    taken.add(pick.id);
    const link = (config.cta.endCardLink || {})[String(e.channel).startsWith('linkedin') ? 'linkedin' : 'instagram'];
    e.endCard = pick.id;
    e.endCardProps = { headline: pick.headline, action: pick.action, link };
  }
  return entries;
}

/** Problems with the brand's CTA library itself, so a bad line never ships. */
function validateLibrary(config) {
  const errors = [];
  const cta = config.cta;
  if (!cta) return errors;
  if (!cta.link) errors.push('cta.link is missing');
  const variants = cta.variants || [];
  if (variants.length < 4) errors.push(`cta.variants has ${variants.length}; keep at least 4 so the asks rotate`);
  for (const v of variants) {
    for (const k of ['linkedin', 'instagram']) {
      const line = String(v[k] || '');
      if (!line) { errors.push(`${v.id}: no ${k} line`); continue; }
      if (/[—–]/.test(line)) errors.push(`${v.id} (${k}): dash`);
      if (/!/.test(line)) errors.push(`${v.id} (${k}): exclamation mark`);
      const sales = SALES_WORDS.filter((w) => line.toLowerCase().includes(w));
      if (sales.length) errors.push(`${v.id} (${k}): reads as a sales push (${sales.join(', ')})`);
    }
    if (v.linkedin && !v.linkedin.includes(cta.link)) errors.push(`${v.id}: the LinkedIn line needs the link`);
    if (v.instagram && !/link in bio/i.test(v.instagram)) errors.push(`${v.id}: the Instagram line should point to the link in bio`);
  }
  for (const c of cta.endCards || []) {
    for (const k of ['headline', 'action']) {
      const line = String(c[k] || '');
      if (!line) { errors.push(`end card ${c.id}: no ${k}`); continue; }
      if (/[—–]/.test(line)) errors.push(`end card ${c.id} (${k}): dash`);
      if (/!/.test(line)) errors.push(`end card ${c.id} (${k}): exclamation mark`);
      const sales = SALES_WORDS.filter((w) => line.toLowerCase().includes(w));
      if (sales.length) errors.push(`end card ${c.id} (${k}): reads as a sales push (${sales.join(', ')})`);
    }
  }
  if ((cta.endCards || []).length && !(cta.endCardLink && cta.endCardLink.linkedin && cta.endCardLink.instagram)) {
    errors.push('cta.endCardLink needs a linkedin and an instagram form');
  }
  return errors;
}

/** A caption the model wrote with its own ask in it: the engine owns every CTA. */
function ownAsk(caption, config) {
  const c = String(caption || '');
  const found = [];
  if (config.cta && config.cta.link && c.includes(config.cta.link.replace(/^https?:\/\/(www\.)?/, ''))) found.push('the demo link');
  if (/link in bio/i.test(c)) found.push('"link in bio"');
  const sales = SALES_WORDS.filter((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i').test(c));
  if (sales.length) found.push(`sales language (${sales.join(', ')})`);
  return found;
}

module.exports = { ctaTypesOf, ctaRange, ctaLine, assignVariants, assignEndCards, validateLibrary, ownAsk, SALES_WORDS };
