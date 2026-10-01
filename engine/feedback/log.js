/**
 * log.js
 *
 * Everything the reviewer did to a draft, one JSON line per event, in
 * feedback/log.jsonl in the brand's workspace (Byron's repository owns it):
 *
 *   note          a note on a draft, what it was read as, and whether it was
 *                 applied (and what changed) or why not
 *   caption-edit  the caption before and after a person edited it in Buffer
 *   approved      a draft scheduled, with or without edits and revisions
 *   deleted       a draft deleted in Buffer: the clearest "no" there is
 *   published     a post went out
 *
 * summary() turns the recent events into the <reviewer_feedback> block the
 * planner and the writer read, so a batch reflects how the last ones were
 * received. Lessons that keep recurring are candidates for the brand files;
 * a person moves them there, the log never edits a brand file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');

const defaultFile = () => path.join(workspace().dir, 'feedback', 'log.jsonl');

function append(events, file = defaultFile()) {
  const list = [].concat(events).filter(Boolean);
  if (!list.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, list.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

function load(file = defaultFile()) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

const clip = (s, n = 280) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
};
const stop = (s) => String(s || '').trim().replace(/[.\s]+$/, '');

/**
 * What an edit changed: the text between the common start and the common
 * end, widened to whole words, with a little context. A caption edit is
 * usually a sentence; quoting both whole captions would hide it.
 */
function editSpan(before, after) {
  const a = String(before || '');
  const b = String(after || '');
  const word = (ch) => /\S/.test(ch || '');
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;
  // Never split a word: back off while the boundary sits inside one.
  while (p > 0 && word(a[p - 1]) && (word(a[p]) || word(b[p]))) p -= 1;
  while (s > 0 && word(a[a.length - s]) && (word(a[a.length - s - 1]) || word(b[b.length - s - 1]))) s -= 1;
  return { removed: a.slice(p, a.length - s).trim(), added: b.slice(p, b.length - s).trim() };
}

const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const channelName = (c) => (String(c).startsWith('linkedin') ? 'LinkedIn' : 'Instagram');
const what = (e) => `${channelName(e.channel)} ${e.layout || 'post'}${e.pillar ? ` (${e.pillar})` : ''}`;

/**
 * The reviewer's recent feedback as prompt text, newest first, or '' when
 * there is none. reviewer: how to name the person (config.json review.name).
 */
function summary(events, { limit = 20, reviewer = 'The reviewer', since } = {}) {
  const recent = events
    .filter((e) => !since || e.at >= since)
    .filter((e) => e.kind !== 'published')
    .slice(-200);
  if (!recent.length) return '';
  const lines = [];
  const approved = recent.filter((e) => e.kind === 'approved');
  const untouched = approved.filter((e) => !e.edited && !(e.revisions > 0)).length;
  for (const e of recent.filter((x) => x.kind !== 'approved').reverse().slice(0, limit)) {
    if (e.kind === 'note' && e.applied) {
      lines.push(`- ${day(e.at)}, ${what(e)}: note "${clip(e.note, 200)}" Applied: ${stop(e.understood)}${e.changed && e.changed.length ? ` (changed ${e.changed.join(', ')})` : ''}.`);
    } else if (e.kind === 'note') {
      lines.push(`- ${day(e.at)}, ${what(e)}: note "${clip(e.note, 200)}" Not applied: ${stop(e.reason)}.`);
    } else if (e.kind === 'caption-edit') {
      const d = editSpan(e.before, e.after);
      const change = d.removed && d.added ? `changed "${clip(d.removed, 200)}" to "${clip(d.added, 200)}"`
        : d.added ? `added "${clip(d.added, 200)}"` : d.removed ? `cut "${clip(d.removed, 200)}"` : 'changed only spacing';
      lines.push(`- ${day(e.at)}, ${what(e)}: ${reviewer} edited the caption: ${change}.`);
    } else if (e.kind === 'deleted') {
      lines.push(`- ${day(e.at)}, ${what(e)}: ${reviewer} deleted the draft "${clip(e.headline, 120)}" without posting it.`);
    }
  }
  if (approved.length) {
    lines.push(`- ${approved.length} draft${approved.length === 1 ? '' : 's'} scheduled recently, ${untouched} with no edits at all.`);
  }
  const lessons = [...new Set(recent.filter((e) => e.lesson).map((e) => e.lesson))].slice(-10);
  const out = [
    `How ${reviewer} received recent drafts, newest first. Read these as the reviewer's preferences: apply what they teach to this batch, without reusing the reviewer's wording or repeating a topic the reviewer just saw.`,
    ...lines,
  ];
  if (lessons.length) out.push('', 'Preferences stated in the notes:', ...lessons.map((l) => `- ${l}`));
  return out.join('\n');
}

module.exports = { append, load, summary, editSpan, defaultFile };
