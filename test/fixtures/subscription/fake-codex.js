#!/usr/bin/env node
/**
 * A stand-in for the Codex CLI in tests. Called as the codex provider calls
 * `codex exec`: it reads the request on stdin, answers the request id named
 * by --output-schema from the recorded responses in FAKE_CODEX_ANSWERS
 * (<key>.json, an array answering successive rounds), writes the answer to
 * --output-last-message, logs the call to FAKE_CODEX_LOG, and refreshes the
 * login in CODEX_HOME the way the real CLI may. FAKE_CODEX_LIMIT_AFTER=n
 * answers n requests, then fails as a usage limit does.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (f) => args[args.indexOf(f) + 1];
let input = '';
process.stdin.on('data', (d) => { input += d; }).on('end', () => {
  const log = process.env.FAKE_CODEX_LOG;
  const done = log && fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length : 0;
  const id = path.basename(flag('--output-schema')).replace(/\.schema\.json$/, '');
  if (log) fs.appendFileSync(log, `${JSON.stringify({ id, args, home: process.env.CODEX_HOME || null, bytes: input.length })}\n`);
  const limit = Number(process.env.FAKE_CODEX_LIMIT_AFTER || 0);
  if (limit && done >= limit) {
    process.stderr.write("ERROR: You've hit your usage limit. Try again at 3:00 PM.\n");
    process.exit(1);
  }
  if (process.env.CODEX_HOME && fs.existsSync(path.join(process.env.CODEX_HOME, 'auth.json'))) {
    const auth = JSON.parse(fs.readFileSync(path.join(process.env.CODEX_HOME, 'auth.json'), 'utf8'));
    fs.writeFileSync(path.join(process.env.CODEX_HOME, 'auth.json'), JSON.stringify({ ...auth, last_refresh: 'refreshed by the fake CLI' }));
  }
  const m = /^(.*?)(?:--(\d+))?$/.exec(id);
  const file = path.join(process.env.FAKE_CODEX_ANSWERS, `${m[1]}.json`);
  if (!fs.existsSync(file)) {
    process.stderr.write(`no recorded answer for ${id}\n`);
    process.exit(1);
  }
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const k = m[2] ? Number(m[2]) : 1;
  const answer = Array.isArray(rec) ? rec[Math.min(k - 1, rec.length - 1)] : rec;
  fs.writeFileSync(flag('--output-last-message'), `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);
});
