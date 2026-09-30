/**
 * carousel.js
 *
 * Carousels as a planned shape. The planner marks a post as a carousel (one
 * post in `carousel.every`, config.json) with a kind; the writer fills a
 * fixed structure (cover, inner slides, an optional reveal, a close); this
 * module turns that structure into slides on the carousel layouts, so the
 * model never chooses layouts slide by slide and every carousel reads as
 * the same family.
 *
 *   reveal-flip   hook on the cover, evidence on the inner slides, the
 *                 answer on the reveal, the takeaway (and "try this at your
 *                 club") on the close
 *   list          one item per inner slide, numbered from 01
 *   steps         a short how-to, numbered from 01
 *
 * An inner slide is a step (carousel-step) or, when it carries an approved
 * statistic, a stat card. The cover takes a photo when the plan puts it on
 * the photo surface; every other slide sits on the cover's dark or light
 * surface (dark after a photo cover).
 */

'use strict';

const KINDS = ['reveal-flip', 'list', 'steps'];

const str = (d) => ({ type: 'string', description: d });
const orNull = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const nullableStr = (d) => ({ type: ['string', 'null'], description: d });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

/** One in `every`, rounded either way, for a batch of n (0..1 when unset). */
function everyRange(n, every) {
  const e = Number(every);
  if (!e) return { min: 0, max: n, every: null };
  return { min: Math.floor(n / e), max: Math.ceil(n / e), every: e };
}

function carouselRange(n, config) {
  return everyRange(n, config.carousel && config.carousel.every);
}

/** The structure the writer fills for a carousel. */
function carouselSchema(entry) {
  return obj({
    cover: obj({
      eyebrow: nullableStr('At most 32 characters.'),
      headline: str('The hook that earns the swipe: a question, a tension or an incomplete thought. At most 80 characters.'),
      emphasis: nullableStr('Optional second line in the accent color. At most 70 characters.'),
    }),
    inner: {
      type: 'array',
      description: 'The slides between the cover and the close. Each is one thought.',
      items: obj({
        eyebrow: nullableStr('At most 32 characters.'),
        headline: nullableStr('At most 70 characters. Required unless the slide is a stat.'),
        body: nullableStr('At most 200 characters (140 on a stat slide).'),
        stat: orNull(obj({
          value: str('The number as approved-stats.json allows it, at most 6 characters.'),
          unit: nullableStr('At most 12 characters.'),
          label: str('What it measures, at most 90 characters.'),
          source: str('Its attribution, at most 48 characters.'),
        })),
      }),
    },
    reveal: orNull(obj({
      eyebrow: nullableStr('At most 32 characters.'),
      statement: str('The answer the swipe was for. At most 100 characters.'),
      detail: nullableStr('At most 180 characters.'),
    })),
    close: obj({
      headline: str('The takeaway. At most 80 characters. All of this slide\'s words together stay at or under 240 characters.'),
      body: nullableStr('At most 200 characters.'),
      tryTitle: nullableStr('Optional label for a technique the club can use with its own members, at most 40 characters.'),
      tryBody: nullableStr('The technique, at most 160 characters.'),
    }),
  });
}

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''));

/**
 * The writer's carousel as slides: [{ layout, surface, props, slide }], where
 * slide is the position context the layouts read (index, total, step,
 * numbered). coverPhoto is the library id the engine picked, if any.
 */
function toSlides(entry, carousel, coverPhoto) {
  const innerSurface = entry.renderSurface === 'photo' ? 'dark' : entry.renderSurface;
  const slides = [];
  slides.push({
    layout: 'carousel-cover',
    surface: entry.renderSurface,
    props: clean({ ...clean(carousel.cover), photo: entry.renderSurface === 'photo' ? coverPhoto : undefined }),
  });
  let step = 0;
  for (const item of carousel.inner || []) {
    if (item.stat) {
      slides.push({
        layout: 'stat-card',
        surface: innerSurface,
        props: clean({ eyebrow: item.eyebrow, ...clean(item.stat), context: item.body }),
      });
    } else {
      step += 1;
      slides.push({
        layout: 'carousel-step',
        surface: innerSurface,
        props: clean({ eyebrow: item.eyebrow, headline: item.headline, body: item.body }),
        step,
      });
    }
  }
  if (carousel.reveal) slides.push({ layout: 'carousel-reveal', surface: innerSurface, props: clean(carousel.reveal) });
  slides.push({ layout: 'carousel-close', surface: innerSurface, props: clean(carousel.close) });
  const total = slides.length;
  return slides.map((s, i) => ({
    layout: s.layout,
    surface: s.surface,
    props: s.props,
    slide: { index: i + 1, total, step: s.step, numbered: entry.carouselKind !== 'reveal-flip' },
  }));
}

/** What the structure itself gets wrong, before any layout validates a slide. */
function structureFailures(entry, carousel, config) {
  const failures = [];
  const min = (config.carousel && config.carousel.minSlides) || 4;
  const max = (config.carousel && config.carousel.maxSlides) || 8;
  const total = 2 + (carousel.inner || []).length + (carousel.reveal ? 1 : 0);
  if (total < min || total > max) failures.push(`the carousel has ${total} slides; it needs ${min} to ${max}`);
  if (entry.carouselKind === 'reveal-flip' && !carousel.reveal) failures.push('a reveal-flip carousel needs its reveal slide');
  if (['list', 'steps'].includes(entry.carouselKind) && (carousel.inner || []).length < 2) {
    failures.push(`a ${entry.carouselKind} carousel needs at least two inner slides`);
  }
  (carousel.inner || []).forEach((item, i) => {
    if (!item.stat && !String(item.headline || '').trim()) failures.push(`inner slide ${i + 1} needs a headline or a stat`);
  });
  return failures;
}

module.exports = { KINDS, everyRange, carouselRange, carouselSchema, toSlides, structureFailures };
