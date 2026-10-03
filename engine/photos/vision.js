/**
 * vision.js
 *
 * A model looks at a new photo and proposes what review.js would record:
 * subject, time of day, people, tags and the crop focus, plus anything that
 * should keep it out of posts until a person decides (a third-party logo, a
 * recognizable face, a real club's name or crest, readable screen text,
 * poor quality, not a club setting).
 *
 * The proposal is a reading, not a release. A photo with any concern goes to
 * a person (Drive's "Needs a look" folder) and stays restricted until that
 * person moves it to Active. Two tags are never proposed, only given by a
 * person: founder (the founder layout's photos) and product-screenshot (real
 * product UI).
 */

'use strict';

const sharp = require('sharp');
const { SUBJECTS, TIMES, PEOPLE } = require('./review');

const CONCERNS = [
  'third-party logo or brand',
  'recognizable face',
  "a real club's name, crest or signage",
  'readable text or screen content',
  'low quality',
  'not a club setting',
];
const PERSON_ONLY_TAGS = ['founder', 'product-screenshot'];

function schema(commonTags) {
  const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  return obj({
    description: { type: 'string', description: 'One plain sentence: what the photo shows.' },
    subject: { type: 'string', enum: SUBJECTS, description: 'The main subject. If none fits, the closest, and list "not a club setting" as a concern.' },
    time: { type: 'string', enum: TIMES },
    people: { type: 'string', enum: PEOPLE, description: 'none, distant (no face readable), or present.' },
    tags: {
      type: 'array', items: { type: 'string' },
      description: `Three to eight lowercase tags for what is in the frame and where text could sit (sky-space-top, calm-bottom). Reuse these when they fit: ${commonTags.join(', ')}.`,
    },
    focus: obj({ x: { type: 'number' }, y: { type: 'number' } }),
    concerns: { type: 'array', items: { type: 'string', enum: CONCERNS }, description: 'Every concern you see; empty if none.' },
  });
}

const SYSTEM = (brand) => `You look at photos for ${brand}'s social media library. The engine picks photos for posts by what you record: the subject, the time of day, whether people are in it, tags, and the point a crop must keep (focus, 0 to 1 across and down). Be literal and accurate. List every concern that should keep a photo out of a brand's posts until a person decides: a logo or brand that is not the club's, a face someone could recognize, a real club's name, crest or signage, readable text or a readable screen, blur or heavy compression, or a setting that is not a private club's (golf, tennis, marina, grounds, clubhouse, members at the club). Return only the JSON the schema asks for.`;

/** The photo as a data URL small enough to send (1024px on the long edge). */
async function dataUrl(buffer) {
  const small = await sharp(buffer).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${small.toString('base64')}`;
}

function commonTagsOf(lib, n = 40) {
  const counts = new Map();
  for (const p of lib.photos) for (const t of p.tags || []) if (!PERSON_ONLY_TAGS.includes(t)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

/**
 * The model's reading of one photo, cleaned: tags lowercased and deduped,
 * person-only tags removed, focus clamped to 0..1.
 */
async function proposeTags({ provider, buffer, id, lib, brandName }) {
  const { data } = await provider.generate({
    key: `vision-${id}`,
    system: SYSTEM(brandName),
    user: `Photo "${id}". Describe it for the library.`,
    schema: schema(commonTagsOf(lib)),
    schemaName: 'photo_reading',
    images: [await dataUrl(buffer)],
  });
  const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0.5));
  const tags = [...new Set((data.tags || []).map((t) => String(t).toLowerCase().trim().replace(/\s+/g, '-')))]
    .filter((t) => t && !PERSON_ONLY_TAGS.includes(t) && t !== data.subject).slice(0, 8);
  return {
    description: String(data.description || '').trim(),
    subject: data.subject,
    time: data.time,
    people: data.people,
    tags,
    focus: { x: clamp(data.focus && data.focus.x), y: clamp(data.focus && data.focus.y) },
    concerns: [...new Set((data.concerns || []).filter((c) => CONCERNS.includes(c)))],
  };
}

module.exports = { proposeTags, dataUrl, commonTagsOf, CONCERNS, PERSON_ONLY_TAGS };
