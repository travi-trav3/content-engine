/**
 * source-gate.js
 *
 * Founder voice restates a recorded source. On Aug 24 a post on the company
 * page spoke as Byron about an experience he never had; he called it "just
 * plain confusing like me being an operator, inventor, sitting in a room."
 * The brand gate already demands a sourceNote. This gate checks the words:
 * a founder post is a list of sentences, each carrying the exact quotes it
 * restates, and
 *
 *   source.noSources      there is no material from the founder at all
 *   source.noSentences    the post is not broken into sourced sentences
 *   source.unreferenced   a sentence that says something carries no quote
 *   source.unknownSource  a quote names a file that is not in sources/
 *   source.quoteTooShort  a quote under four words proves nothing
 *   source.quoteNotFound  the quote is not in that source, word for word
 *   source.notFounder     the quote is someone else's turn in a transcript
 *   source.number         a number the sentence states is not in its quotes
 *   source.name           a name the sentence uses is not in its quotes
 *   source.overlap        too few of the sentence's words come from its
 *                         quotes: it says something the founder did not
 *   source.negation       the sentence negates where its quotes do not
 *   source.caption        the caption is not the sourced sentences (plus the
 *                         engine's sign-off): something unsourced was added
 *   source.firstComment   a founder post carries text outside the caption
 *
 * A sentence with no content words ("Here's the thing.") needs no quote, nor
 * does a closing question to the reader that asserts nothing (no "I" or
 * "we", no number, no name).
 *
 * Passing is not proof of faithfulness: a sentence can reuse the founder's
 * words and still bend them. The reviewer is the founder, and every founder
 * post is a draft the founder approves.
 */

'use strict';

const path = require('path');
const src = require('../generate/sources');

const FAIL = 'FAIL';
const FIRST_PERSON = /\b(i|i'm|i've|i'd|i'll|me|my|mine|we|we're|we've|us|our|ours)\b/i;
const NEGATION = /\b(not|never|no|none|nothing|without|cannot|can't|don't|doesn't|didn't|won't|wouldn't|isn't|aren't|wasn't|weren't|shouldn't|couldn't|hasn't|haven't)\b/i;
const MONTHS_DAYS = new Set('january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday'.split(' '));
const QUOTE_MIN_WORDS = 4;

/** Capitalized words that are not a sentence's first word, nor in the allowed list. */
function namesOf(sentence, allow) {
  const words = String(sentence).replace(/^[^A-Za-z0-9]+/, '').split(/\s+/).slice(1);
  return words.map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9%'’]+$/g, '').replace(/['’]s$/, ''))
    .filter((w) => /^[A-Z]/.test(w) && !/^I(['’].+)?$/.test(w) && !MONTHS_DAYS.has(w.toLowerCase()) && !allow.has(w.toLowerCase()));
}

/** The caption a founder post's sentences make, with the engine's sign-off. */
function assembleCaption(paragraphs, signOff) {
  const body = paragraphs.map((p) => p.sentences.map((s) => String(s.text).trim()).join(' ')).filter(Boolean).join('\n\n');
  return signOff ? `${body}\n\n${signOff}` : body;
}

function flatSentences(post) {
  if (Array.isArray(post.paragraphs)) return post.paragraphs.flatMap((p) => p.sentences || []);
  return Array.isArray(post.sentences) ? post.sentences : [];
}

/**
 * One founder post against the sources. options: { minOverlap, signOff,
 * allowNames, founderNames }. Returns findings ({ id, rule, detail }).
 */
function checkPost(post, sources, options = {}) {
  const id = post.id;
  const out = [];
  const add = (rule, detail) => out.push({ id, rule, detail, severity: FAIL });
  const minOverlap = options.minOverlap ?? 0.6;
  const allow = new Set([...(options.allowNames || []), ...(options.founderNames || [])]
    .flatMap((n) => String(n).split(/\s+/)).map((w) => w.toLowerCase()));
  const allowStems = new Set([...allow].map(src.stem));
  const byName = new Map(sources.map((s) => [s.name, s]));

  if (!sources.some((s) => s.founderWords > 0)) {
    add('source.noSources', 'There is no material in the founder\'s own words (sources/ is empty, or holds no turn by the founder). A founder post is written only from what the founder said.');
  }
  const sents = flatSentences(post);
  if (!sents.length) {
    add('source.noSentences', 'The post is not broken into sentences with the quotes each restates, so nothing shows the founder said any of it. The Aug 24 post spoke as Byron about an experience he never had; he called it "just plain confusing like me being an operator, inventor, sitting in a room."');
    return out;
  }

  sents.forEach((s, i) => {
    const where = `sentence ${i + 1} ("${String(s.text).slice(0, 80)}${String(s.text).length > 80 ? '...' : ''}")`;
    const good = [];
    for (const ref of s.refs || []) {
      const source = byName.get(ref.source) || byName.get(path.basename(String(ref.source)));
      if (!source) { add('source.unknownSource', `${where} quotes "${ref.source}", which is not in sources/.`); continue; }
      if (src.tokens(ref.quote).length < QUOTE_MIN_WORDS) { add('source.quoteTooShort', `${where}: the quote "${ref.quote}" is under ${QUOTE_MIN_WORDS} words. Quote the passage the sentence restates.`); continue; }
      const at = src.locate(source, ref.quote);
      if (!at.found) { add('source.quoteNotFound', `${where}: "${ref.quote}" is not in ${source.name} word for word. Copy the quote exactly as it appears.`); continue; }
      if (!at.founder) { add('source.notFounder', `${where}: "${ref.quote}" was said by ${at.speaker || 'someone else'} in ${source.name}, not by the founder. Another person's words are never the founder's.`); continue; }
      good.push(ref.quote);
    }
    for (const part of src.sentences(s.text)) {
      // The company's and the founder's own names are not claims.
      const words = src.contentWords(part).filter((w) => !allowStems.has(w));
      const nums = src.numbersOf(part);
      const names = namesOf(part, allow);
      const question = /\?["”’)]*$/.test(part.trim()) && !FIRST_PERSON.test(part) && !nums.length && !names.length;
      if (!words.length && !nums.length && !names.length) continue;
      if (question) continue;
      if (!good.length) {
        if (!(s.refs || []).length) add('source.unreferenced', `${where} makes a claim and quotes nothing. Every sentence restates something the founder said, with the quote.`);
        continue;
      }
      const quoteText = good.join(' ');
      const qTokens = new Set(src.tokens(quoteText));
      const qWords = src.contentWords(quoteText);
      const qNums = new Set(src.numbersOf(quoteText));
      const missingNums = nums.filter((n) => !qNums.has(n));
      if (missingNums.length) add('source.number', `${where} states ${missingNums.join(', ')}, which its quotes do not. A number in the founder's voice is one the founder said.`);
      const missingNames = names.filter((n) => !src.tokens(n).every((t) => qTokens.has(t)));
      if (missingNames.length) add('source.name', `${where} names ${missingNames.join(', ')}, which its quotes do not.`);
      const unmatched = words.filter((w) => !qWords.some((q) => src.sameWord(w, q)));
      const share = (words.length - unmatched.length) / words.length;
      if (words.length && share < minOverlap) {
        add('source.overlap', `${where}: ${Math.round(share * 100)}% of its words come from its quotes (needs ${Math.round(minOverlap * 100)}%). Not in the quotes: ${[...new Set(unmatched)].join(', ')}. Say only what the founder said.`);
      }
      if (NEGATION.test(part) && !NEGATION.test(quoteText)) {
        add('source.negation', `${where} negates something its quotes do not negate. Check it has not reversed what the founder said.`);
      }
    }
  });

  if (post.caption != null && Array.isArray(post.paragraphs)) {
    const expected = assembleCaption(post.paragraphs, options.signOff);
    if (src.tokens(post.caption).join(' ') !== src.tokens(expected).join(' ')) {
      add('source.caption', 'The caption is not the sourced sentences plus the sign-off. Every line a founder post publishes comes from its sentences.');
    }
  }
  if (post.firstComment) add('source.firstComment', 'A founder post carries a first comment, which no sentence sources. Founder posts have none.');
  return out;
}

/** Options for checkPost from config.json founder. */
function optionsFrom(config = {}) {
  const f = config.founder || {};
  return { minOverlap: f.minOverlap, signOff: f.signOff || null, allowNames: f.allowNames || [], founderNames: f.names || [] };
}

/**
 * Every gate a founder post faces: this one, and the content gates that read
 * a caption (capability, brand, stat). Rotation, diversity, editorial and
 * the plan gate are about the company feed and do not apply. Returns gate
 * results in checkAll's shape.
 */
function checkFounderPosts({ posts, sources, config, brandDir }) {
  const capability = require('./capability-gate');
  const brand = require('./brand-gate');
  const stat = require('./stat-gate');
  const results = [];
  const run = (label, fn) => {
    try {
      const r = fn();
      results.push({ label, pass: !r.failures.length, failures: r.failures, warnings: r.warnings || [] });
    } catch (e) {
      results.push({ label, pass: false, failures: [{ id: '(founder)', rule: 'gate.error', detail: e.message }], warnings: [] });
    }
  };
  const opts = optionsFrom(config);
  run('source gate', () => ({ failures: posts.flatMap((p) => checkPost(p, sources, opts)) }));
  const ledger = { posts };
  run('capability gate (founder)', () => capability.checkBatch(ledger, brandDir));
  run('brand gate (founder)', () => brand.checkBatch(ledger, brandDir));
  run('stat gate (founder)', () => stat.checkBatch(ledger));
  return results;
}

/** Findings per post id, as "rule: detail" lines. */
function findingsOf(results) {
  const out = new Map();
  for (const r of results) for (const f of r.failures) {
    if (!out.has(f.id)) out.set(f.id, []);
    out.get(f.id).push(`${f.rule}: ${f.detail}`);
  }
  return out;
}

module.exports = { checkPost, checkFounderPosts, findingsOf, assembleCaption, optionsFrom, namesOf, flatSentences };
