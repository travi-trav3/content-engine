/**
 * schema.js
 *
 * Checks an answer against the strict JSON-schema subset the engine sends
 * with every request (objects with every property required and no others,
 * arrays, enums, nullable types, anyOf). The API enforces it on its side;
 * an answer written by an agent, or returned by the Codex CLI, is checked
 * here before the engine uses it.
 */

'use strict';

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

/** Problems with a value against a schema, as "$.path: what" lines. Empty when it fits. */
function conforms(schema, value, at = '$') {
  if (schema.anyOf) {
    const tries = schema.anyOf.map((b) => conforms(b, value, at));
    return tries.some((t) => t.length === 0) ? [] : tries.sort((a, b) => a.length - b.length)[0];
  }
  const types = [].concat(schema.type || []);
  const t = typeOf(value);
  if (types.length && !types.includes(t) && !(t === 'integer' && types.includes('number'))) return [`${at}: ${t} is not ${types.join('|')}`];
  if (schema.enum && !schema.enum.includes(value)) return [`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`];
  if (t === 'object') {
    const errs = [];
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}.${k}: missing`);
    for (const k of Object.keys(value)) {
      if (!schema.properties || !schema.properties[k]) errs.push(`${at}.${k}: not in the schema`);
      else errs.push(...conforms(schema.properties[k], value[k], `${at}.${k}`));
    }
    return errs;
  }
  if (t === 'array') {
    const errs = [];
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${at}: ${value.length} items, at least ${schema.minItems}`);
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${at}: ${value.length} items, at most ${schema.maxItems}`);
    return [...errs, ...value.flatMap((v, i) => (schema.items ? conforms(schema.items, v, `${at}[${i}]`) : []))];
  }
  return [];
}

module.exports = { conforms };
