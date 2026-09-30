/**
 * catalog.js
 *
 * What the generator may draw with: every layout the brand can render right
 * now, with its rotation format, the plan gate's coarse shell, a one-paragraph
 * description taken from the layout's own header comment, and its props as a
 * strict JSON schema for the model to fill.
 *
 * A layout is left out when the brand lacks what it requires (the product
 * screenshot until a real screenshot is in the library), when it needs a
 * person-supplied source (founder portrait and quote card belong to source
 * mode), when it is not a single image (carousel step, rendered through a
 * carousel spec), or when the brand's config excludes it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/workspace');
const { loadLayout } = require('../render/render');
const review = require('../photos/review');

const LAYOUTS_DIR = path.join(ROOT, 'layouts');

// Needs words the founder or a third party actually said, from sources/.
const SOURCE_MODE_ONLY = ['founder-portrait', 'quote-card'];
// Rendered as slides through engine/render/carousel.js, not as one image.
const NOT_SINGLE_IMAGE = ['carousel-step'];

/** The plan gate's coarse visual shell for a rotation format. */
function shellOf(format) {
  if (format === 'thread') return 'thread';
  if (format === 'photo' || format === 'portrait') return 'photo-full-bleed';
  return 'dark-type';
}

/** The first paragraph after the title line of a layout's header comment. */
function describe(id) {
  const src = fs.readFileSync(path.join(LAYOUTS_DIR, id, 'index.js'), 'utf8');
  const m = /\/\*\*([\s\S]*?)\*\//.exec(src);
  if (!m) return '';
  const lines = m[1].split('\n').map((l) => l.replace(/^\s*\* ?/, '')).join('\n').trim().split(/\n\s*\n/);
  return (lines[1] || lines[0] || '').replace(/\s+/g, ' ').trim();
}

function listIds() {
  return fs.readdirSync(LAYOUTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name).sort();
}

function unmetRequirement(layout, library) {
  const tags = (layout.requires && layout.requires.photoTags) || [];
  if (!tags.length) return null;
  const ok = library.photos.some((p) => p.reviewed && !p.restricted && tags.every((t) => (p.tags || []).includes(t)));
  return ok ? null : `needs a reviewed photo tagged ${tags.join(', ')}`;
}

function registryValues(spec, brand) {
  if (!spec.registry) return null;
  const value = spec.registry.split('.').reduce((o, k) => (o ? o[k] : undefined), brand);
  return value ? Object.keys(value) : [];
}

/**
 * A prop spec as a JSON schema in the strict subset structured outputs
 * accept: every property required, optional ones nullable, no additional
 * properties. Lengths and counts go in descriptions and are enforced after
 * the call by validateProps, because strict mode does not reliably enforce
 * them.
 */
function specToSchema(spec, brand) {
  const type = spec.type || 'text';
  const nullable = (t) => (spec.required ? t : [t, 'null']);
  if (type === 'text') {
    return { type: nullable('string'), description: spec.maxChars ? `At most ${spec.maxChars} characters.` : 'Text.' };
  }
  if (type === 'enum') {
    return { type: nullable('string'), enum: spec.required ? spec.values : [...spec.values, null] };
  }
  if (type === 'list') {
    const values = registryValues(spec, brand);
    let items;
    if (spec.item === 'text') {
      items = values ? { type: 'string', enum: values } : { type: 'string', description: `At most ${spec.maxChars} characters.` };
    } else {
      const properties = {};
      for (const [k, s] of Object.entries(spec.item)) properties[k] = specToSchema(s, brand);
      items = { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
    }
    const count = [spec.minItems && `at least ${spec.minItems}`, spec.maxItems && `at most ${spec.maxItems}`]
      .filter(Boolean).join(', ');
    return { type: nullable('array'), items, description: count ? `A list: ${count} items.` : 'A list.' };
  }
  throw new Error(`No schema for prop type "${type}"`);
}

/** Props the model writes: everything except photos, which the engine selects. */
function propsSchema(layout, brand) {
  const properties = {};
  for (const [k, spec] of Object.entries(layout.props)) {
    if (spec.type === 'photo') continue;
    properties[k] = specToSchema(spec, brand);
  }
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const photoProps = (layout) => Object.entries(layout.props).filter(([, s]) => s.type === 'photo').map(([k, s]) => ({ key: k, ...s }));

/** One line per prop, for prompts: name, required, limit, allowed values. */
function propsSummary(layout, brand) {
  return Object.entries(layout.props).map(([k, s]) => {
    const t = s.type || 'text';
    const bits = [s.required ? 'required' : 'optional'];
    if (t === 'text' && s.maxChars) bits.push(`max ${s.maxChars} chars`);
    if (t === 'enum') bits.push(`one of ${s.values.join(' | ')}`);
    if (t === 'photo') bits.push('selected by the engine from the photo library');
    if (t === 'list') {
      bits.push(`list of ${s.minItems || 0}-${s.maxItems || 'n'}`);
      const values = registryValues(s, brand);
      if (values) bits.push(`values from: ${values.join(', ')}`);
      else if (s.item === 'text') bits.push(`each max ${s.maxChars} chars`);
      else bits.push(`items { ${Object.entries(s.item).map(([ik, is]) => `${ik}${is.maxChars ? ` <=${is.maxChars}` : ''}${is.values ? ` (${is.values.join('|')})` : ''}`).join(', ')} }`);
    }
    return `${k}: ${bits.join(', ')}`;
  });
}

/**
 * The layouts this brand can generate with now.
 * config.excludeLayouts: ids the brand has turned off.
 */
function loadCatalog({ brand, library, config = {} }) {
  const exclude = new Set(config.excludeLayouts || []);
  return listIds().map((id) => {
    const layout = loadLayout(id);
    let reason = null;
    if (exclude.has(id)) reason = 'excluded in config.json';
    else if (SOURCE_MODE_ONLY.includes(id)) reason = 'source mode only';
    else if (NOT_SINGLE_IMAGE.includes(id)) reason = 'carousel slides only';
    else reason = unmetRequirement(layout, library);
    return {
      id,
      layout,
      title: layout.title,
      format: layout.format,
      shell: shellOf(layout.format),
      surfaces: layout.surfaces,
      description: describe(id),
      photoProps: photoProps(layout),
      eligible: !reason,
      reason,
    };
  });
}

/** Photo vocabulary for the model's photo requests. */
const PHOTO_VOCAB = { subjects: review.SUBJECTS, times: review.TIMES, people: review.PEOPLE };

module.exports = { loadCatalog, propsSchema, propsSummary, specToSchema, shellOf, PHOTO_VOCAB };
