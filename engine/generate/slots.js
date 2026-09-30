/**
 * slots.js
 *
 * Turns the cadence in config.json into the batch's posting slots: a date,
 * a local time, a channel, and dueAt as an ISO timestamp with the brand's
 * UTC offset on that date (daylight saving included), so a post planned for
 * 9:50 in Los Angeles is 9:50 there in March and in November.
 *
 *   cadence: { batchDays: 14, slots: [ { day: "mon", time: "09:50", channel: "linkedin_page" }, ... ] }
 *
 * A slot names a weekday (every week of the batch) or a dayOfBatch (0 is the
 * batch's first day), so a two-week pattern can vary its days and times the
 * way the hand-scheduled batches did.
 */

'use strict';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const pad = (n) => String(n).padStart(2, '0');

/** Minutes east of UTC for a wall-clock time in a timezone (e.g. -420 for PDT). */
function offsetMinutes(date, time, timeZone) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const at = (ms) => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  };
  // Two passes settle the offset on either side of a daylight-saving change.
  let offset = (at(wall) - wall) / 60000;
  offset = (at(wall - offset * 60000) - wall + offset * 60000) / 60000;
  return offset;
}

function isoWithOffset(date, time, timeZone) {
  const off = offsetMinutes(date, time, timeZone);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekday = (date) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

/** The Monday on or after a date. */
function nextMonday(date) {
  let d = date;
  while (weekday(d) !== 'mon') d = addDays(d, 1);
  return d;
}

function slotsFor({ cadence, start, timeZone }) {
  if (!cadence || !Array.isArray(cadence.slots) || !cadence.slots.length) {
    throw new Error('config.json cadence.slots is empty');
  }
  const days = cadence.batchDays || 14;
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(start, i);
    for (const s of cadence.slots.filter((x) => x.dayOfBatch === i || (x.day && x.day === weekday(date)))) {
      out.push({ date, time: s.time, channel: s.channel, dueAt: isoWithOffset(date, s.time, timeZone) });
    }
  }
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.channel.localeCompare(b.channel))
    .map((s, i) => ({ slot: i, ...s }));
}

module.exports = { slotsFor, isoWithOffset, offsetMinutes, addDays, nextMonday, weekday };
