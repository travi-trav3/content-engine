/**
 * subscription.test.js
 *
 * Writing on the client's ChatGPT subscription, with no API key:
 *
 *   exchange   requests and answers on disk; a missing or off-schema answer
 *              waits, an answered one replays, a changed request is answered
 *              again, and answers alone resume on a fresh machine
 *   login      the ChatGPT login for Codex, encrypted with the repository key
 *   agent      the routine run as Codex in ChatGPT runs it: stop, answer the
 *              requests, run again, until the October batch is written, the
 *              same batch the recorded run writes
 *   codex      the routine run unattended (GitHub Actions): every request
 *              answered by `codex exec` (a stand-in CLI here), the login
 *              restored privately and saved back when refreshed; a usage
 *              limit stops it and the next run finishes with no request asked twice
 *   change     a change asked of Codex in conversation goes through the
 *              writer and every gate, and push --open swaps it into the draft
 *
 *   node test/subscription.test.js
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.CE_WORKSPACE = 'brands/clubpilot';

const { workspace } = require('../engine/lib/workspace');
const { createAgent, isPending } = require('../engine/generate/providers/agent');
const { createCodex } = require('../engine/generate/providers/codex');
const { createMock } = require('../engine/generate/providers/mock');
const codexAuth = require('../engine/codex-auth');
const { routine } = require('../engine/routine');
const { runBatch } = require('../engine/generate/batch');
const { makeChange } = require('../engine/feedback/change');
const { pushOpen } = require('../engine/buffer/push');
const { createMockBuffer } = require('../engine/buffer/mock');
const { createMockHost } = require('../engine/publish/host');
const { contentSignature } = require('../engine/buffer/media');
const photoLib = require('../engine/photos/library');

const WS = workspace();
const GEN = path.join(__dirname, 'fixtures', 'generate', 'clubpilot');
const FAKE_CODEX = path.join(__dirname, 'fixtures', 'subscription', 'fake-codex.js');
const NOW = Date.parse('2026-09-30T12:00:00Z');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

// The live config, on the calendar the recorded batch was planned on.
const RECORDED = read(path.join(GEN, 'recorded-cadence.json'));
const live = read(path.join(WS.dir, 'config.json'));
const config = {
  ...live, cadence: RECORDED.cadence, founder: { ...live.founder, slots: RECORDED.founderSlots },
  buffer: { ...live.buffer, organizationId: 'o00000000000000000000001', channels: { instagram: 'c0000000000000000000000a', linkedin_page: 'c0000000000000000000000b', linkedin_byron: null } },
};

/** A content folder holding the shipped batches, as an instance has them. */
function freshContent(dir) {
  const content = path.join(dir, 'content');
  fs.mkdirSync(content, { recursive: true });
  for (const d of fs.readdirSync(WS.contentDir)) fs.cpSync(path.join(WS.contentDir, d), path.join(content, d), { recursive: true });
  return content;
}

/** Answers every open request from the recorded responses, as an agent would write them. */
function answerFromRecorded(exchange) {
  let n = 0;
  for (const f of fs.readdirSync(path.join(exchange, 'requests')).filter((x) => x.endsWith('.md'))) {
    const id = f.slice(0, -3);
    const out = path.join(exchange, 'responses', `${id}.json`);
    if (fs.existsSync(out)) continue;
    const m = /^(.*?)(?:--(\d+))?$/.exec(id);
    const rec = read(path.join(GEN, `${m[1]}.json`));
    const k = m[2] ? Number(m[2]) : 1;
    fs.writeFileSync(out, JSON.stringify(Array.isArray(rec) ? rec[Math.min(k - 1, rec.length - 1)] : rec));
    n += 1;
  }
  return n;
}

const comparable = (ledger) => ledger.posts.map((p) => ({ id: p.id, layout: p.layout, caption: p.caption, props: p.props, slides: p.slides && p.slides.map((s) => s.props), photos: p.photos }));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-subscription-'));
  const schema = { type: 'object', additionalProperties: false, required: ['n'], properties: { n: { type: 'integer' } } };

  console.log('== the exchange ==');
  const ex = path.join(tmp, 'exchange-unit');
  const ask = (system, user = 'input') => createAgent({ dir: ex, brandDir: WS.brandDir }).generate({ key: 'step', system, user, schema, schemaName: 'unit' });
  let waited = null;
  try { await ask('do it', '<brand_file name="BRAND.md">\nthe whole brand file\n</brand_file>\nthe input'); } catch (e) { waited = e; }
  const req = fs.readFileSync(path.join(ex, 'requests', 'step.md'), 'utf8');
  check('a call with no answer waits, and its request says where the answer goes', isPending(waited) && /responses\/step\.json/.test(req) && /## Answer schema/.test(req));
  check('an agent\'s request points at the brand files instead of repeating them', /<brand_file name="BRAND.md" path="brands\/clubpilot\/brand\/BRAND.md"\/>/.test(req) && !req.includes('the whole brand file'));
  fs.writeFileSync(path.join(ex, 'responses', 'step.json'), '{"n":"one"}');
  waited = null;
  try { await ask('do it', '<brand_file name="BRAND.md">\nthe whole brand file\n</brand_file>\nthe input'); } catch (e) { waited = e; }
  check('an answer off the schema is not used: it waits, saying why', isPending(waited) && /\$\.n: string is not integer/.test(waited.reason || ''), waited && waited.message);
  fs.writeFileSync(path.join(ex, 'responses', 'step.json'), '{"n":1}');
  const replay = await ask('do it', '<brand_file name="BRAND.md">\nthe whole brand file\n</brand_file>\nthe input');
  check('an answered call replays', replay.data.n === 1);
  fs.rmSync(path.join(ex, 'requests'), { recursive: true });
  const fresh = await ask('do it', '<brand_file name="BRAND.md">\nthe whole brand file\n</brand_file>\nthe input');
  check('answers alone resume on a fresh machine (each keeps the hash of its request)', fresh.data.n === 1);
  waited = null;
  try { await ask('do it differently'); } catch (e) { waited = e; }
  check('a changed request is answered again; the old answer is set aside', isPending(waited) && fs.existsSync(path.join(ex, 'responses', 'step.json.stale')));

  console.log('== the ChatGPT login ==');
  const key = crypto.randomBytes(32).toString('base64');
  const login = { tokens: { id_token: 'i', access_token: 'a', refresh_token: 'r' }, last_refresh: '2026-10-08T00:00:00Z' };
  const blob = codexAuth.encrypt(Buffer.from(JSON.stringify(login)), key);
  check('it is stored encrypted: no token in the file', !/refresh_token|"r"/.test(blob) && JSON.parse(codexAuth.decrypt(blob, key)).tokens.refresh_token === 'r');
  let wrong = null;
  try { codexAuth.decrypt(blob, crypto.randomBytes(32).toString('base64')); } catch (e) { wrong = e.message; }
  check('the wrong key does not open it', /does not open/.test(wrong || ''));

  console.log('== the routine, run as Codex in ChatGPT runs it (agent) ==');
  const agentDir = path.join(tmp, 'agent');
  const agentContent = freshContent(agentDir);
  const agentEx = path.join(agentDir, 'exchange');
  const runs = [];
  let last = null;
  for (let i = 1; i <= 8; i += 1) {
    const provider = createAgent({ dir: agentEx, brandDir: WS.brandDir });
    last = await routine({
      config, provider, contentDir: agentContent, briefsDir: path.join(WS.dir, 'briefs'), sourcesDir: path.join(agentDir, 'sources'), brandDir: WS.brandDir,
      now: NOW, batchOptions: { stagingDir: path.join(agentDir, 'staging'), start: '2026-10-05' },
    });
    runs.push({ steps: last.steps, waiting: last.waiting.map((w) => path.basename(w.request, '.md')) });
    if (!last.waiting.length) break;
    answerFromRecorded(agentEx);
  }
  check('it stops at each stage for answers: the plan, the ten posts, the two rewrites, the founder posts',
    runs.length === 5 && runs[0].waiting.join() === 'plan' && runs[1].waiting.length === 10 && runs[2].waiting.join() === 'post-0--2,post-5--2'
    && runs[3].waiting.join() === 'founder-b06-f1,founder-b06-f2' && runs[4].waiting.length === 0, JSON.stringify(runs.map((r) => r.waiting)));
  check('and finishes the batch in the same folder, never starting another',
    fs.existsSync(path.join(agentContent, 'batch-06', 'ledger.json')) && !fs.existsSync(path.join(agentContent, 'batch-07')) && /batch: none due/.test(runs[4].steps.join(' ')));
  const mockDir = path.join(tmp, 'mock');
  await runBatch({ provider: createMock({ dir: GEN }), config, contentDir: freshContent(mockDir), stagingDir: path.join(mockDir, 'staging'), start: '2026-10-05', now: NOW });
  const agentLedger = read(path.join(agentContent, 'batch-06', 'ledger.json'));
  check('the batch is the one the recorded run writes, post for post', JSON.stringify(comparable(agentLedger)) === JSON.stringify(comparable(read(path.join(mockDir, 'content', 'batch-06', 'ledger.json')))));
  check('every gate passed and every render is clean', agentLedger.posts.every((p) => p.status === 'rendered'));

  console.log('== the routine, unattended (codex exec on the ChatGPT login) ==');
  const cxDir = path.join(tmp, 'codex');
  const cxContent = freshContent(cxDir);
  const blobFile = path.join(cxDir, 'codex-auth.enc');
  fs.writeFileSync(blobFile, blob);
  const logFile = path.join(cxDir, 'codex-calls.jsonl');
  const cxEnv = (extra = {}) => ({ ...process.env, CODEX_AUTH_KEY: key, FAKE_CODEX_ANSWERS: GEN, FAKE_CODEX_LOG: logFile, ...extra });
  const codexRun = (env) => routine({
    config, provider: createCodex({ dir: path.join(cxDir, 'exchange'), cli: [FAKE_CODEX], blobFile, env }),
    contentDir: cxContent, briefsDir: path.join(WS.dir, 'briefs'), sourcesDir: path.join(cxDir, 'sources'), brandDir: WS.brandDir,
    now: NOW, batchOptions: { stagingDir: path.join(cxDir, 'staging'), start: '2026-10-05' },
  });
  let limited = null;
  try { await codexRun(cxEnv({ FAKE_CODEX_LIMIT_AFTER: '6' })); } catch (e) { limited = e; }
  check('a usage limit stops the run with an error the workflow recognizes', limited && limited.limit === true, limited && limited.message);
  const callsBefore = fs.readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  fs.rmSync(path.join(cxDir, 'exchange', 'requests'), { recursive: true, force: true });
  const done = await codexRun(cxEnv());
  const calls = fs.readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const answeredTwice = calls.slice(callsBefore.length).filter((c) => callsBefore.slice(0, 6).some((b) => b.id === c.id)).map((c) => c.id);
  check('the next run, on a fresh machine with the kept answers, finishes with nothing asked twice', !done.waiting.length && answeredTwice.length === 0
    && fs.existsSync(path.join(cxContent, 'batch-06', 'ledger.json')), `${done.steps.join(' | ')}; asked again: ${answeredTwice.join(', ')}`);
  check('Codex runs read-only, held to the request\'s schema, in a private home with the client\'s login',
    calls.every((c) => c.args[0] === 'exec' && c.args.includes('read-only') && c.args.includes('--output-schema') && c.args.includes('--output-last-message') && c.args[c.args.length - 1] === '-' && c.home));
  check('Codex gets the brand files in full (it answers from the request alone)', calls.find((c) => c.id === 'plan').bytes > 50000);
  check('the refreshed login is saved back, still encrypted', JSON.parse(codexAuth.decrypt(fs.readFileSync(blobFile, 'utf8'), key)).last_refresh === 'refreshed by the fake CLI');
  check('the same batch as the agent wrote', JSON.stringify(comparable(read(path.join(cxContent, 'batch-06', 'ledger.json')))) === JSON.stringify(comparable(agentLedger)));

  console.log('== a change asked of Codex, then Buffer ==');
  const buffer = createMockBuffer({ channels: config.buffer.channels });
  const host = createMockHost();
  const library = photoLib.load();
  const first = await pushOpen({ config, buffer, host, contentDir: agentContent, stagingDir: path.join(agentDir, 'staging', 'batch-06'), library, now: NOW });
  check('push --open drafts the new batch', first.length === 1 && first[0].drafted.length === 10, JSON.stringify(first.map((r) => [r.batch, r.drafted.length])));
  const quiet = await pushOpen({ config, buffer, host, contentDir: agentContent, stagingDir: path.join(agentDir, 'staging', 'batch-06'), library, now: NOW });
  check('run again with nothing changed, it does nothing', quiet.length === 0);
  let ledger = read(path.join(agentContent, 'batch-06', 'ledger.json'));
  const index = ledger.posts.findIndex((p) => p.layout !== 'carousel' && !p.thread && /\n\n/.test(p.caption));
  const target = ledger.posts[index];
  const shorter = { ...target.draft, caption: target.draft.caption.split('\n\n').slice(0, -1).join('\n\n') };
  const changeEx = path.join(tmp, 'change-exchange');
  fs.mkdirSync(path.join(changeEx, 'responses'), { recursive: true });
  fs.writeFileSync(path.join(changeEx, 'responses', `note-${index}.json`), JSON.stringify({ understood: 'Cut the last paragraph of the caption.', actionable: true, layout: null, surface: null, newPhoto: false, photoSubject: null, changeCaption: true, cannotDo: null, lesson: null }));
  fs.writeFileSync(path.join(changeEx, 'responses', `revise-${index}.json`), JSON.stringify(shorter));
  const changed = await makeChange({
    config, provider: createAgent({ dir: changeEx, brandDir: WS.brandDir }), postId: target.id, note: 'Shorter caption, please: drop the last paragraph.',
    contentDir: agentContent, sourcesDir: path.join(agentDir, 'sources'), feedbackFile: path.join(agentDir, 'feedback.jsonl'), library, now: NOW + 3600000,
  });
  ledger = read(path.join(agentContent, 'batch-06', 'ledger.json'));
  const after = ledger.posts[index];
  check('the change goes through the writer, the gates and the renderer, into the ledger', changed.applied && changed.changed.includes('caption')
    && after.caption === shorter.caption && after.status === 'rendered', JSON.stringify({ applied: changed.applied, reason: changed.reason, changed: changed.changed }));
  check('Buffer is not touched; the draft is now behind the ledger', buffer.posts.get(after.buffer.id).text === target.buffer.text && contentSignature(after) !== after.buffer.signature);
  check('the change is logged as feedback, from Codex', fs.readFileSync(path.join(agentDir, 'feedback.jsonl'), 'utf8').includes('"via":"codex"'));
  buffer.calls.length = 0;
  const updated = await pushOpen({ config, buffer, host, contentDir: agentContent, stagingDir: path.join(agentDir, 'staging', 'batch-06'), library, now: NOW + 7200000 });
  const edit = buffer.calls.find((c) => c.op === 'editPost');
  check('push --open updates that draft in place, caption only, tagged Revised', updated.length === 1 && updated[0].updated.map((u) => `${u.id}:${u.changed.join('+')}`).join() === `${target.id}:caption`
    && edit && edit.input.id === target.buffer.id && edit.input.text === after.postText && !edit.input.assets && buffer.posts.get(target.buffer.id).tags.some((t) => t.name === 'Revised'),
  JSON.stringify(updated.map((u) => u.updated)));
  check('no new draft was made for it', !buffer.calls.some((c) => c.op === 'createPost'));
  ledger = read(path.join(agentContent, 'batch-06', 'ledger.json'));
  const p2 = ledger.posts[index];
  p2.buffer.captionEdited = true; // the reviewer edits the caption in Buffer, then asks Codex for a different change
  p2.caption = `${p2.caption} Edited in the repository.`;
  p2.postText = p2.caption + (p2.cta ? `\n\n${p2.cta}` : '');
  fs.writeFileSync(path.join(agentContent, 'batch-06', 'ledger.json'), JSON.stringify(ledger, null, 2));
  buffer.calls.length = 0;
  const kept = await pushOpen({ config, buffer, host, contentDir: agentContent, stagingDir: path.join(agentDir, 'staging', 'batch-06'), library, now: NOW + 9000000 });
  check('a caption edited in Buffer is never overwritten from the repository', !buffer.calls.some((c) => c.op === 'editPost' && c.input.text)
    && kept[0].warnings.some((w) => /edited in Buffer; the words in Buffer stay/.test(w)));

  console.log(failures ? `\nsubscription: ${failures} CHECK(S) FAILED` : '\nsubscription: ALL CHECKS PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
