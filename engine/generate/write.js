/**
 * write.js
 *
 * Step two: write one post from its plan entry. The model fills the
 * layout's props (held to a schema built from the layout itself), the
 * caption, the first comment, the alt text and the earns-its-place line,
 * and asks for a photo by subject, time of day and tags. The engine then
 * picks the photo from the library, fills the fixed props (the thread's
 * sender comes from the plan), and validates everything the layout would
 * refuse at render time. Errors go back to the model for a revision.
 *
 * Later steps (the gates, the renderer) call writePost again with their
 * findings as feedback, so one function owns every rewrite.
 *
 * `entry` is a plan entry plus what the batch runner attaches: layoutModule
 * (the loaded layout), photoProps, fixed (props the engine fills), layoutInfo
 * (the layout's menu text) and slotIndex.
 */

'use strict';

const { validateProps } = require('../render/render');
const { propsSchema, PHOTO_VOCAB } = require('./catalog');
const { brandContext } = require('./context');
const { ownAsk } = require('./cta');

const nullable = (schema) => ({ ...schema, type: [schema.type, 'null'], ...(schema.enum ? { enum: [...schema.enum, null] } : {}) });

function postSchema(entry, brand) {
  const props = propsSchema(entry.layoutModule, brand);
  if (entry.fixed.includes('sender')) {
    delete props.properties.sender;
    props.required = props.required.filter((k) => k !== 'sender');
  }
  const properties = {
    props,
    caption: { type: 'string' },
    firstComment: { type: 'string' },
    altText: { type: 'string' },
    earnsItsPlace: { type: 'string' },
  };
  if (entry.photoProps.length) {
    properties.photo = {
      type: 'object',
      properties: {
        subject: { type: 'string', enum: PHOTO_VOCAB.subjects },
        time: nullable({ type: 'string', enum: PHOTO_VOCAB.times }),
        people: nullable({ type: 'string', enum: PHOTO_VOCAB.people }),
        tags: { type: 'array', items: { type: 'string' }, description: 'Up to three tags from the library.' },
      },
      required: ['subject', 'time', 'people', 'tags'],
      additionalProperties: false,
    };
  }
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const SYSTEM = (brandName) => `You write social posts for ${brandName} from an approved plan entry. The plan decided what the post says; you decide how it reads.

The brand files are the authority on voice, positioning, capability and proof. Follow them exactly.

The graphic:
- It carries the plan's message and is read in about three seconds. Shorter beats clever. Stay inside every character limit.
- Sentence case for headlines. No em dashes or en dashes anywhere; use a comma, a period or a colon. No exclamation marks.
- Numbers: only statistics from approved-stats.json, worded as that file allows and attributed as it says, never presented as a ${brandName} result. Clock times and small everyday counts are fine.
- Never write a real club's name except as approved-clubs.json allows. Thread senders are the fictional demo club the plan names.

Threads:
- The member writes the way a member texts a club. The club answers from the source document the plan names, gives the answer, and cites the document class ("per the facility hours").
- The club never books, reserves, confirms, assigns, dispatches, charges or completes anything. It answers from documents, or passes the question to staff.
- An escalation is exactly: the question, the offer to pass it to the team, the member's yes, the handoff. Nothing after the handoff.

The words around the graphic:
- caption: adds a layer the graphic does not say. Two to five short paragraphs, peer to peer, one operator talking to another. No hashtags. Never write a call to action, a link or "link in bio": when the post has one (<cta>), the engine adds it as the caption's last line, so end the caption where that invitation reads naturally next, without repeating it.
- firstComment: one or two sentences that add one more thought. Not a call to action, not a restatement.
- altText: describe the image and quote its visible words.
- earnsItsPlace: one sentence naming what makes this a post only ${brandName} could publish. "On brand" is not a reason.
- photo (photo layouts only): the plan's photoSubject, the time of day the copy implies, whether people are in it, and up to three tags from the library.

Return only the JSON the schema asks for. Optional props you do not use are null.`;

function writeRequest({ brandText, entry, layoutInfo, revision }) {
  const plan = { ...entry };
  for (const k of ['fixed', 'photoProps', 'layoutInfo', 'layoutModule', 'slotIndex', 'ctaLine', 'ctaVariant']) delete plan[k];
  const parts = [
    brandText,
    '<layout>', layoutInfo, '</layout>',
    '<plan_entry>', JSON.stringify(plan, null, 1), '</plan_entry>',
  ];
  if (entry.ctaLine) parts.push(`<cta>The engine ends this caption with: ${entry.ctaLine}</cta>`);
  if (entry.channel === 'instagram') parts.push('<channel>Instagram: the caption can be short; the first line must stand alone.</channel>');
  else parts.push('<channel>LinkedIn company page: the caption can run longer and reason more; the first two lines show before "see more".</channel>');
  if (revision) {
    parts.push('<revision>',
      'Your previous draft of this post failed these checks. Return a complete corrected post, changing what the failures require and keeping what passed.',
      'Failures:', revision.failures.map((f) => `- ${f}`).join('\n'),
      'Previous draft:', JSON.stringify(revision.previous, null, 1), '</revision>');
  }
  return parts.join('\n');
}

/** Drops nulls: optional props and optional fields inside list items. */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

/**
 * The least recently used photo that fits, relaxing the request one step at
 * a time (tags, then people, then time) but never the subject or a tag the
 * layout requires. Returns { photo, matched, dropped } or null.
 */
function choosePhoto({ lib, library, request, spec, exclude, now }) {
  const required = spec.requireTags || [];
  const tries = [
    { tags: [request.subject, request.time, request.people, ...(request.tags || [])], dropped: [] },
    { tags: [request.subject, request.time, request.people], dropped: ['tags'] },
    { tags: [request.subject, request.time], dropped: ['tags', 'people'] },
    { tags: [request.subject, request.people], dropped: ['tags', 'time'] },
    { tags: [request.subject], dropped: ['tags', 'people', 'time'] },
  ];
  for (const t of tries) {
    const tags = [...new Set([...t.tags.filter(Boolean), ...required])];
    const found = lib.select(library, { tags, need: spec.need || 'any', exclude, now });
    if (found.length) return { photo: found[0], matched: tags, dropped: t.dropped };
  }
  return null;
}

/** Everything the renderer would refuse, plus the photo, found before rendering. */
function finish({ entry, data, brand, lib, library, usedPhotos, config = {} }) {
  const failures = [];
  const props = clean(data.props || {});
  if (entry.fixed.includes('sender')) props.sender = entry.sender;
  const photos = [];
  let photoMatch = null;
  const now = Date.parse(entry.dueAt);
  for (const spec of entry.photoProps) {
    const request = data.photo || { subject: entry.photoSubject, tags: [] };
    if (request.subject !== entry.photoSubject) {
      failures.push(`photo.subject is "${request.subject}" but the plan's photoSubject is "${entry.photoSubject}"`);
    }
    const pick = choosePhoto({ lib, library, request, spec, exclude: usedPhotos, now });
    if (!pick) {
      failures.push(`no available photo for ${spec.key}: subject "${request.subject}"${spec.need ? `, ${spec.need} resolution` : ''}`);
      continue;
    }
    props[spec.key] = pick.photo.id;
    photos.push(pick.photo.id);
    photoMatch = { id: pick.photo.id, matched: pick.matched, dropped: pick.dropped };
  }
  failures.push(...validateProps(entry.layoutModule, props));
  if (!failures.length && entry.layoutModule.check) failures.push(...entry.layoutModule.check({ props, brand }));
  for (const k of ['caption', 'firstComment', 'altText', 'earnsItsPlace']) {
    if (!String(data[k] || '').trim()) failures.push(`${k} is empty`);
  }
  for (const k of ['caption', 'firstComment']) {
    const asks = ownAsk(data[k], config);
    if (asks.length) failures.push(`${k} contains ${asks.join(' and ')}. The engine adds the only call to action; remove it.`);
  }
  return {
    failures,
    post: {
      props,
      photos,
      photoMatch,
      caption: String(data.caption || '').trim(),
      firstComment: String(data.firstComment || '').trim(),
      altText: String(data.altText || '').trim(),
      earnsItsPlace: String(data.earnsItsPlace || '').trim(),
    },
  };
}

/**
 * Writes one post, revising on its own failures. feedback (from the gates
 * or the renderer) starts the call as a revision of `previous`.
 * Returns { post, failures, rounds, raw }.
 */
async function writePost({ provider, entry, brand, brandDir, config, lib, library, usedPhotos, feedback, previous, brandText, log = () => {} }) {
  const schema = postSchema(entry, brand);
  const text = brandText || brandContext(brandDir);
  const maxRounds = 1 + ((config.maxRevisions && config.maxRevisions.post) ?? 2);
  let revision = feedback && feedback.length ? { failures: feedback, previous } : null;
  let result = null;
  let raw = null;
  let round = 0;
  while (round < maxRounds) {
    round += 1;
    const { data, usage } = await provider.generate({
      key: `post-${entry.slotIndex}`,
      system: SYSTEM(config.brand || brand.name),
      user: writeRequest({ brandText: text, entry, layoutInfo: entry.layoutInfo, revision }),
      schema,
      schemaName: 'post',
    });
    raw = data;
    result = finish({ entry, data, brand, lib, library, usedPhotos, config });
    log({ step: 'write', id: entry.id, round, usage, failures: result.failures });
    if (!result.failures.length) break;
    revision = { failures: result.failures, previous: data };
  }
  return { ...result, rounds: round, raw };
}

module.exports = { writePost, postSchema, choosePhoto, clean, finish };
