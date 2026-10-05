/**
 * sources.js
 *
 * The founder's own words, as source mode reads them. A source is a file in
 * the workspace's sources/ folder:
 *
 *   document     Word (.docx), Markdown or text the founder wrote: a post, a
 *                note, an email, an answer typed out
 *   transcript   a document with speaker turns ("Name: words", or a speaker
 *                line with a timestamp followed by the words, as Zoom and
 *                Otter export them). Only the founder's turns are theirs; the
 *                other turns are context, never quotable as the founder
 *   voice memo   audio (.m4a, .mp3, .wav, ...), transcribed once by the
 *                provider and saved beside it as <file>.transcript.json with
 *                the audio's sha256, so it is sent again only when it changes.
 *                A memo is the founder speaking, all of it theirs
 *
 * sources/ holds only material that is the founder's own words. An article
 * about the company, or a colleague's notes, does not go here: everything in
 * a document without speaker turns is treated as the founder's.
 *
 * The matching helpers (tokens, contentWords, locate) are what the source
 * gate uses to check that a quote is really in a source and really the
 * founder's.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { workspace } = require('../lib/workspace');
const { sourceText } = require('./brief');

const TEXT_EXT = ['.md', '.txt', '.docx'];
const AUDIO_EXT = ['.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.wav', '.webm', '.ogg', '.flac'];
// The transcription endpoint's upload limit.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ------------------------------------------------------------------ *
 * Words
 * ------------------------------------------------------------------ */

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'uhm']);

/** Lowercase word tokens; numbers keep their decimals and percent signs; speech fillers dropped. */
function tokens(text) {
  const t = String(text || '').normalize('NFKC').toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
  return (t.match(/[a-z0-9]+(?:['.][a-z0-9]+)*%?/g) || []).filter((w) => !FILLERS.has(w));
}

const STOP = new Set(`a an the and or but if then so as of at by for from in into on onto to with without about over under
up down out off than too very just also only even still yet already again ever here there this that these those it its it's
is are was were be been being am do does did done doing have has had having can could will would shall should may might must
i me my mine myself i'm i've i'd i'll we us our ours we're we've you your yours you're you've he him his she her they them
their theirs they're who whom whose which what when where why how all any each every both either neither some such no nor
not own same other another more most less least much many few lot lots one ones thing things way really quite pretty
like get got gets getting go goes going went make makes made let lets say says said tell told know knew think thought
because while though although until since before after during through across around between among per via yes okay ok
well actually basically maybe perhaps something anything everything nothing someone anyone everyone kind sort part`.split(/\s+/));

// Words that carry no claim: what a transition sentence is made of.
const DISCOURSE = new Set(`here here's there's that's what's point matter matters mean means meant question answer
simple simply truth honestly true story lesson look see`.split(/\s+/));

const NUMBER_WORDS = {
  two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11',
  twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18',
  nineteen: '19', twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80',
  ninety: '90', hundred: '100', thousand: '1000', million: '1000000', billion: '1000000000',
};

function stem(w) {
  let s = w.replace(/'s$/, '').replace(/'$/, '');
  if (s.length > 5 && s.endsWith('ing')) return s.slice(0, -3);
  if (s.length > 4 && /ie[sd]$/.test(s)) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && s.endsWith('ed')) return s.slice(0, -2);
  if (s.length > 4 && s.endsWith('ly')) return s.slice(0, -2);
  if (s.length > 4 && /(ss|x|ch|sh)es$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s;
}

/** The words of a sentence that carry its meaning, stemmed. */
function contentWords(text) {
  return tokens(text).filter((w) => !STOP.has(w) && !DISCOURSE.has(w) && !/^\d/.test(w) && !NUMBER_WORDS[w] && w.length > 1).map(stem);
}

/** Two stemmed words match when equal, or one is the other's longer form ("connect", "connection"). */
function sameWord(a, b) {
  if (a === b) return true;
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n >= 5 && n >= Math.min(a.length, b.length) - 2;
}

/** Numbers in a text, as digits ("forty" and "40%" both give "40"). */
function numbersOf(text) {
  return tokens(text).map((w) => (/^\d/.test(w) ? w.replace(/%$/, '') : NUMBER_WORDS[w])).filter(Boolean);
}

/** Sentences in a text. */
function sentences(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Speaker turns
 * ------------------------------------------------------------------ */

const NAME = "[A-Z][\\w.'’-]*(?:\\s+[A-Z][\\w.'’-]*){0,3}";
const STAMP = '\\(?\\[?\\d{1,2}:\\d{2}(?::\\d{2})?\\]?\\)?';
const INLINE_TURN = new RegExp(`^\\s*(?:${STAMP}\\s*)?(${NAME})\\s*(?:${STAMP})?\\s*:\\s+(.+)$`);
const HEADER_TURN = new RegExp(`^\\s*(${NAME})\\s+${STAMP}\\s*$`);

/**
 * Speaker turns, when the text is a transcript: at least three turn lines
 * by at least two speakers. Otherwise null (the whole text is one author's).
 */
function parseTurns(text) {
  const turns = [];
  let cur = null;
  let turnLines = 0;
  for (const line of String(text).split(/\r?\n/)) {
    const inline = INLINE_TURN.exec(line);
    const header = !inline && HEADER_TURN.exec(line);
    if (inline || header) {
      turnLines += 1;
      cur = { speaker: (inline || header)[1].trim(), text: inline ? inline[2].trim() : '' };
      turns.push(cur);
    } else if (cur && line.trim()) {
      cur.text = `${cur.text} ${line.trim()}`.trim();
    } else if (!cur && line.trim()) {
      cur = { speaker: null, text: line.trim() };
      turns.push(cur);
    }
  }
  const speakers = new Set(turns.map((t) => t.speaker).filter(Boolean));
  return turnLines >= 3 && speakers.size >= 2 ? turns.filter((t) => t.text) : null;
}

/** Whether a speaker label names the founder: the same first name as one of `names`. */
function isFounder(speaker, names = []) {
  if (!speaker) return false;
  const first = (s) => String(s).trim().split(/\s+/)[0].replace(/[.:]$/, '').toLowerCase();
  return names.some((n) => first(n) === first(speaker));
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

function shape({ name, kind, sha, text, founderNames }) {
  const turns = kind === 'voice memo' ? null : parseTurns(text);
  const parts = turns
    ? turns.map((t) => ({ speaker: t.speaker, founder: isFounder(t.speaker, founderNames), text: t.text }))
    : [{ speaker: null, founder: true, text: String(text).trim() }];
  for (const p of parts) p.tokens = tokens(p.text);
  return { name, kind: turns ? 'transcript' : kind, sha256: sha, text: String(text), turns: parts, founderWords: parts.filter((p) => p.founder).reduce((n, p) => n + p.tokens.length, 0) };
}

/**
 * Every source in dir. Audio without a saved transcript is transcribed when
 * a provider that can transcribe is given, and reported as untranscribed
 * otherwise. Returns { sources, untranscribed, problems }.
 */
async function loadSources({ dir = path.join(workspace().dir, 'sources'), provider, founderNames = [], model, maxAudioBytes = MAX_AUDIO_BYTES, log = () => {} } = {}) {
  const out = { sources: [], untranscribed: [], problems: [] };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    const ext = path.extname(f).toLowerCase();
    if (f.startsWith('.') || /^readme/i.test(f) || f.endsWith('.transcript.json')) continue;
    const file = path.join(dir, f);
    if (TEXT_EXT.includes(ext)) {
      const { text, sha } = sourceText(file);
      out.sources.push(shape({ name: f, kind: 'document', sha, text, founderNames }));
      continue;
    }
    if (!AUDIO_EXT.includes(ext)) continue;
    const buf = fs.readFileSync(file);
    const sha = sha256(buf);
    const cache = `${file}.transcript.json`;
    const saved = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : null;
    if (saved && saved.sourceSha256 === sha) {
      out.sources.push(shape({ name: f, kind: 'voice memo', sha, text: saved.text, founderNames }));
      continue;
    }
    if (buf.length > maxAudioBytes) {
      out.problems.push(`${f} is ${(buf.length / 1048576).toFixed(1)} MB; recordings over ${Math.round(maxAudioBytes / 1048576)} MB cannot be transcribed. Split it, or add its transcript as a document.`);
      continue;
    }
    if (!provider || !provider.transcribe) { out.untranscribed.push(f); continue; }
    const r = await provider.transcribe({ key: `transcribe-${f}`, buffer: buf, filename: f, model });
    log({ step: 'transcribe', name: f });
    fs.writeFileSync(cache, `${JSON.stringify({ source: f, sourceSha256: sha, model: r.model || model || null, transcribedAt: new Date().toISOString(), text: r.text }, null, 2)}\n`);
    out.sources.push(shape({ name: f, kind: 'voice memo', sha, text: r.text, founderNames }));
  }
  return out;
}

/** A key that changes whenever any source is added, removed or changed. */
function sourcesKey(sources) {
  return sha256(Buffer.from(sources.map((s) => `${s.name}:${s.sha256}`).sort().join('\n'))).slice(0, 16);
}

/* ------------------------------------------------------------------ *
 * Finding a quote
 * ------------------------------------------------------------------ */

function indexOfSeq(hay, needle, from = 0) {
  if (!needle.length) return -1;
  outer: for (let i = from; i <= hay.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Where a quote is in a source: { found, founder, speaker }. A quote may
 * skip words with "..." inside one turn; its parts must appear in order.
 */
function locate(source, quote) {
  const parts = String(quote).split(/\.{3}|…/).map(tokens).filter((p) => p.length);
  if (!parts.length) return { found: false };
  let other = null;
  for (const turn of source.turns) {
    let at = 0;
    let ok = true;
    for (const p of parts) {
      const i = indexOfSeq(turn.tokens, p, at);
      if (i < 0 || (at && i - at > 80)) { ok = false; break; }
      at = i + p.length;
    }
    if (!ok) continue;
    if (turn.founder) return { found: true, founder: true, speaker: turn.speaker };
    other = other || turn;
  }
  return other ? { found: true, founder: false, speaker: other.speaker } : { found: false };
}

/** The sources as the writer reads them, newest material first, within a size budget. */
function sourcesPrompt(sources, { maxChars = 80000, founderName = 'the founder' } = {}) {
  const blocks = [];
  const left = [];
  let used = 0;
  for (const s of sources) {
    const body = s.kind === 'transcript'
      ? s.turns.map((t) => `${t.speaker || '(unlabeled)'}${t.founder ? ` [${founderName}]` : ''}: ${t.text}`).join('\n')
      : s.text.trim();
    const block = `<source name="${s.name}" kind="${s.kind}">\n${body}\n</source>`;
    if (used + block.length > maxChars) { left.push(s.name); continue; }
    blocks.push(block);
    used += block.length;
  }
  return { text: blocks.join('\n\n'), omitted: left };
}

module.exports = {
  loadSources, sourcesKey, sourcesPrompt, locate, parseTurns, isFounder,
  tokens, contentWords, sameWord, numbersOf, sentences, stem, STOP, TEXT_EXT, AUDIO_EXT, MAX_AUDIO_BYTES,
};
