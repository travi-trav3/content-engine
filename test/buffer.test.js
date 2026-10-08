/**
 * buffer.test.js
 *
 * Buffer, the assets host and the feedback loop, without any account:
 *
 *   - the GraphQL client against a stubbed fetch (auth, union errors, a
 *     deleted post, rate-limit retry, paging)
 *   - the GitHub assets host against a stubbed fetch (content-hashed names,
 *     no re-upload, byte verification)
 *   - a recorded batch pushed to an in-memory Buffer: one draft per post,
 *     carousels as images on Instagram and a PDF on LinkedIn, idempotent
 *   - the reviewer's week, played on the mock: schedule, caption edits,
 *     a delete, a publish, and notes that change the words, the layout, the
 *     caption, ask for the impossible, or ask for nothing; then the feedback
 *     the next batch reads
 *
 *   node test/buffer.test.js
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../engine/lib/workspace');
const { createBuffer, ensureTags } = require('../engine/buffer/client');
const { createMockBuffer } = require('../engine/buffer/mock');
const { createGithubHost, createMockHost, hashedKey } = require('../engine/publish/host');
const { slidesToPdf } = require('../engine/render/pdf');
const { pushBatch, skipReason } = require('../engine/buffer/push');
const { syncOnce } = require('../engine/buffer/sync');
const { captionBody } = require('../engine/feedback/revise');
const feedbackLog = require('../engine/feedback/log');
const { createNotifier } = require('../engine/notify');
const { createMock } = require('../engine/generate/providers/mock');
const { runBatch } = require('../engine/generate/batch');
const { writeRequest } = require('../engine/generate/write');
const { checkAll, priorLedgers } = require('../engine/gates/check-batch');
const photoLib = require('../engine/photos/library');

const WS = workspace();
const GEN_FIXTURES = path.join(__dirname, 'fixtures', 'generate', 'clubpilot');
const SYNC_FIXTURES = path.join(__dirname, 'fixtures', 'sync', 'clubpilot');
const OUT = path.join(__dirname, 'output', 'buffer');
const NOW = Date.parse('2026-09-30T12:00:00Z');
const baseConfig = JSON.parse(fs.readFileSync(path.join(WS.dir, 'config.json'), 'utf8'));
const CHANNELS = { instagram: 'c0000000000000000000000a', linkedin_page: 'c0000000000000000000000b', linkedin_byron: null };
// The calendar the recorded batch was planned on (test/fixtures/generate/clubpilot/recorded-cadence.json).
const RECORDED = JSON.parse(fs.readFileSync(path.join(GEN_FIXTURES, 'recorded-cadence.json'), 'utf8'));
const config = {
  ...baseConfig, cadence: RECORDED.cadence, founder: { ...baseConfig.founder, slots: RECORDED.founderSlots },
  buffer: { ...baseConfig.buffer, organizationId: 'o00000000000000000000001', channels: CHANNELS },
};

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** A fetch stub: answers each call with the next scripted response and records the request. */
function stubFetch(script) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body });
    const next = typeof script === 'function' ? script(url, init, calls.length) : script.shift();
    const status = next.status || 200;
    const bytes = next.bytes || Buffer.from(next.text !== undefined ? next.text : JSON.stringify(next.json || {}));
    return {
      status, ok: status >= 200 && status < 300,
      json: async () => JSON.parse(bytes.toString()),
      text: async () => bytes.toString(),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  /* ------------------------------------------------------------------ */
  console.log('== the Buffer client ==');
  {
    const post = { id: 'p1', status: 'draft', text: 'Hello', notes: [], tags: [], assets: [] };
    const f = stubFetch([
      { json: { data: { createPost: { post } } } },
      { json: { data: { createPost: { message: 'Text is required' } } } },
      { json: { errors: [{ message: 'Post not found', extensions: { code: 'NOT_FOUND' } }] } },
      { status: 429, json: {} },
      { json: { data: { posts: { edges: [{ node: { id: 'a' } }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } } } },
      { json: { data: { posts: { edges: [{ node: { id: 'b' } }], pageInfo: { hasNextPage: false, endCursor: null } } } } },
    ]);
    const b = createBuffer({ apiKey: 'k-test', fetchImpl: f, backoffMs: 0 });
    const created = await b.createPost({ channelId: 'c', text: 'Hello' });
    check('a draft is created with the Bearer key', created.id === 'p1' && f.calls[0].init.headers.authorization === 'Bearer k-test'
      && f.calls[0].url === 'https://api.buffer.com');
    check('every mutation asks for MutationError, as Buffer requires', /\.\.\. on MutationError/.test(f.calls[0].body.query));
    let err = null;
    try { await b.createPost({ channelId: 'c' }); } catch (e) { err = e; }
    check('a mutation error in the union throws with Buffer\'s message', err && /Text is required/.test(err.message));
    check('a deleted post reads as null, not an error', (await b.getPost('gone')) === null);
    const listed = await b.listPosts({ organizationId: 'o', tagIds: ['t'] });
    check('a rate limit is retried, and pages are followed', listed.map((p) => p.id).join() === 'a,b', JSON.stringify(listed));
    check('the posts filter carries the engine tag', f.calls[4].body.variables.input.filter.tags.in[0] === 't');
    let noKey = null;
    try { createBuffer({ apiKeyEnv: 'CE_TEST_NO_SUCH_KEY' }); } catch (e) { noKey = e; }
    check('no key, no client (the key comes only from the environment)', noKey && /CE_TEST_NO_SUCH_KEY/.test(noKey.message));
    const mock = createMockBuffer();
    const ids = await ensureTags(mock, 'o', { engine: 'Content engine', revised: 'Revised' });
    const again = await ensureTags(mock, 'o', { engine: 'Content engine', revised: 'Revised' });
    check('tags are created once and found after', ids.engine === again.engine && mock.calls.filter((c) => c.op === 'createTag').length === 2);
  }

  /* ------------------------------------------------------------------ */
  console.log('== the assets host ==');
  {
    const tmp = path.join(OUT, 'host');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const file = path.join(tmp, 'a.png');
    fs.writeFileSync(file, Buffer.from('not really a png'));
    const served = new Map();
    const f = stubFetch((url, init) => {
      if (url.startsWith('https://api.github.com') && init.method === 'PUT') {
        const key = decodeURIComponent(url.split('/contents/')[1]);
        served.set(key, Buffer.from(JSON.parse(init.body).content, 'base64'));
        return { status: 201, json: {} };
      }
      if (url.startsWith('https://api.github.com')) {
        const key = decodeURIComponent(url.split('/contents/')[1].split('?')[0]);
        return served.has(key) ? { status: 200, json: {} } : { status: 404, json: {} };
      }
      const key = url.split('/main/')[1];
      return served.has(key) ? { status: 200, bytes: served.get(key) } : { status: 404, text: '' };
    });
    const host = createGithubHost({ repo: 'club/social-assets', token: 't', fetchImpl: f, verifyDelayMs: 0 });
    const r = await host.publish(file, 'batch-07/b07-01.png');
    check('the name carries the content hash', r.key === hashedKey('batch-07/b07-01.png', r.sha256) && /b07-01-[0-9a-f]{10}\.png$/.test(r.key), r.key);
    check('served from raw.githubusercontent.com', r.url === `https://raw.githubusercontent.com/club/social-assets/main/${r.key}`, r.url);
    const puts = () => f.calls.filter((c) => c.init.method === 'PUT').length;
    check('uploaded once', puts() === 1);
    await host.publish(file, 'batch-07/b07-01.png');
    check('the same bytes are not uploaded again', puts() === 1);
    const stale = stubFetch((url, init) => (url.startsWith('https://api.github.com') ? { status: init.method === 'PUT' ? 201 : 404, json: {} } : { status: 200, bytes: Buffer.from('old bytes') }));
    let staleErr = null;
    try { await createGithubHost({ repo: 'club/social-assets', token: 't', fetchImpl: stale, verifyTries: 2, verifyDelayMs: 0 }).publish(file, 'x.png'); } catch (e) { staleErr = e; }
    check('a URL that serves other bytes is refused before Buffer sees it', staleErr && /did not serve the uploaded bytes/.test(staleErr.message));
  }

  /* ------------------------------------------------------------------ */
  console.log('== a recorded batch, pushed to Buffer as drafts ==');
  const dir = path.join(OUT, 'run');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
  for (const b of fs.readdirSync(WS.contentDir).filter((d) => /^batch-\d{2}$/.test(d))) {
    fs.cpSync(path.join(WS.contentDir, b), path.join(dir, 'content', b), { recursive: true });
  }
  const contentDir = path.join(dir, 'content');
  const stagingDir = path.join(dir, 'staging');
  const feedbackFile = path.join(dir, 'feedback', 'log.jsonl');
  const gen = await runBatch({ provider: createMock({ dir: GEN_FIXTURES }), config, contentDir, stagingDir, start: '2026-10-05', now: NOW, feedbackFile });
  check('the recorded batch generates clean', gen.ok, gen.stage);
  const batchDir = path.join(contentDir, 'batch-06');
  const ledgerFile = path.join(batchDir, 'ledger.json');
  check('every post records the model\'s draft, for later revisions', read(ledgerFile).posts.every((p) => p.draft && p.draft.caption));

  // One render goes missing, as in a separate workflow run: push re-renders it.
  fs.rmSync(path.join(stagingDir, 'batch-06', 'b06-01-hundred-million-calls-li.png'));
  const buffer = createMockBuffer({ channels: CHANNELS });
  const host = createMockHost();
  const notifier = createNotifier(config, { mock: true });
  const library = photoLib.load();
  const pushed = await pushBatch({ batchNo: 6, config, buffer, host, notifier, contentDir, stagingDir: path.join(stagingDir, 'batch-06'), library, now: NOW });
  const ledger = read(ledgerFile);
  check('ten drafts; only the two founder slots wait, for the founder\'s own words', pushed.drafted.length === 10 && pushed.skipped.length === 2
    && pushed.skipped.every((x) => /^b06-f\d$/.test(x.id) && x.waiting && /founder's own words/.test(x.reason)), JSON.stringify(pushed.skipped));
  check('a missing render is re-rendered byte for byte', pushed.warnings.length === 0, pushed.warnings.join('; '));
  const creates = buffer.calls.filter((c) => c.op === 'createPost').map((c) => c.input);
  check('every one is a draft at its planned time, never scheduled',
    creates.every((i) => i.saveToDraft === true && i.mode === 'customScheduled' && i.schedulingType === 'automatic' && /Z$/.test(i.dueAt)));
  check('every draft carries the engine tag and its first comment', creates.every((i, k) => i.tagIds.length === 1
    && (i.metadata.instagram || i.metadata.linkedin).firstComment === ledger.posts[k].firstComment));
  check('captions go out as the ledger\'s postText, CTA line included', creates.every((i, k) => i.text === ledger.posts[k].postText)
    && ledger.posts.filter((p) => p.cta).every((p) => creates.find((i) => i.text.endsWith(p.cta))));
  const igCarousel = ledger.posts.find((p) => p.layout === 'carousel' && p.channel === 'instagram');
  const igInput = creates[ledger.posts.indexOf(igCarousel)];
  check('an Instagram carousel is a post with one image per slide, each with alt text',
    igInput.metadata.instagram.type === 'post' && igInput.assets.length === igCarousel.slides.length && igInput.assets.every((a) => a.image && a.image.metadata.altText));
  const liCarousel = ledger.posts.find((p) => p.layout === 'carousel' && p.channel === 'linkedin_page');
  const liInput = creates[ledger.posts.indexOf(liCarousel)];
  check('a LinkedIn carousel is one PDF document, so it swipes', liInput.assets.length === 1 && liInput.assets[0].document
    && /\.pdf$/.test(liInput.assets[0].document.url) && liInput.assets[0].document.thumbnailUrl && liInput.assets[0].document.title);
  const pdfKey = [...host.files.keys()].find((k) => k.endsWith('.pdf'));
  check('the PDF has a page per slide', pdfKey && (host.files.get(pdfKey).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === liCarousel.slides.length);
  check('every image is published under a content-hashed name', [...host.files.keys()].every((k) => /-[0-9a-f]{10}\.(png|pdf|jpg)$/.test(k)));
  check('the ledger records each draft', ledger.posts.every((p) => p.buffer && p.buffer.id && p.buffer.status === 'draft' && p.buffer.tagIds.engine));
  fs.writeFileSync(path.join(OUT, 'push-message.txt'), `${notifier.sent.join('\n\n---\n\n')}\n`);
  check('the reviewer is told, with the contact sheet', notifier.sent.length === 1 && /10 drafts to review/.test(notifier.sent[0]) && /contact-sheet/.test(notifier.sent[0]), notifier.sent[0]);
  check('and asked, once, for the founder posts\' material', /Byron's LinkedIn post for Tue, Oct 6/.test(notifier.sent[0]) && /Drive folder Sources/.test(notifier.sent[0])
    && ledger.founder.every((p) => p.askedAt));
  const again = await pushBatch({ batchNo: 6, config, buffer, host, notifier, contentDir, stagingDir: path.join(stagingDir, 'batch-06'), library, now: NOW });
  check('pushing again drafts nothing twice, and does not ask again', again.drafted.length === 0 && buffer.posts.size === 10 && notifier.sent.length === 1);
  check('a post that fails a gate is never drafted', /fails its gates/.test(skipReason({ status: 'rendered' }, { gateFindings: ['brand.emDash: x'], channelId: 'c', now: NOW })));
  check('a channel not yet in Buffer is skipped, with the reason', /no Buffer channel/.test(skipReason({ status: 'rendered', channel: 'linkedin_byron' }, { channelId: null, now: NOW })));
  check('a slot that has passed is skipped', /has passed/.test(skipReason({ status: 'rendered', dueAt: '2026-09-01T09:00:00-07:00' }, { channelId: 'c', now: NOW })));

  /* ------------------------------------------------------------------ */
  console.log('== sync: nothing changed ==');
  const sync = (provider) => syncOnce({ config, buffer, host, provider, notifier, contentDir, stagingDir, library, feedbackFile, now: NOW + 86400000 });
  const provider = createMock({ dir: SYNC_FIXTURES });
  buffer.calls.length = 0;
  const quiet = await sync(provider);
  check('one Buffer request when nothing changed', buffer.calls.length === 1 && buffer.calls[0].op === 'listPosts', buffer.calls.map((c) => c.op).join());
  check('and nothing recorded', quiet.revised.length + quiet.captionEdits.length + quiet.approved.length === 0);

  /* ------------------------------------------------------------------ */
  console.log('== sync: the reviewer\'s week ==');
  const byIdx = (i) => read(ledgerFile).posts[i];
  const bid = (i) => byIdx(i).buffer.id;
  const before = read(ledgerFile);
  buffer.human.schedule(bid(1)); // the humor carousel, approved as is
  const editedText = `${captionBody(buffer.posts.get(bid(3)).text, before.posts[3])} One more thing — the grill closes at 9.\n\n${before.posts[3].cta}`;
  buffer.human.edit(bid(3), editedText); // a caption edit with an em dash
  buffer.human.remove(bid(7)); // the proof bar, deleted
  buffer.human.publish(bid(6)); // went out
  buffer.human.note(bid(8), 'Make the line under Fog delay shorter, it should hit faster.');
  buffer.human.note(bid(4), 'Can this be a simple text card on the light background instead?');
  buffer.human.note(bid(0), 'Caption is too long. Cut it in half.');
  buffer.human.note(bid(9), 'Swap this for a custom illustration of our dining room.');
  buffer.human.note(bid(5), 'Love this one.');
  buffer.human.note(bid(2), 'Travis only: checking this works.', { name: 'Someone Else', email: 'someone@else.test' });
  const assetsBefore = (i) => JSON.stringify(buffer.posts.get(bid(i)).assets);
  const snapshot = Object.fromEntries([0, 4, 8, 9].map((i) => [i, assetsBefore(i)]));
  notifier.sent.length = 0;
  const week = await syncOnce({ config: { ...config, buffer: { ...config.buffer, reviewers: ['byron@clubpilot.test'] } }, buffer, host, provider, notifier, contentDir, stagingDir, library, feedbackFile, now: NOW + 2 * 86400000 });
  const after = read(ledgerFile);
  fs.writeFileSync(path.join(OUT, 'messages.txt'), `${notifier.sent.join('\n\n---\n\n')}\n`);
  check('the scheduled draft is recorded as approved', week.approved.includes(before.posts[1].id) && after.posts[1].buffer.status === 'scheduled');
  check('the deleted draft is recorded as deleted', week.deleted.includes(before.posts[7].id) && after.posts[7].buffer.status === 'deleted');
  check('the published post is recorded with its link', after.posts[6].buffer.status === 'sent' && after.posts[6].buffer.externalLink);

  const p8 = after.posts[8];
  check('a note on the words: the image is revised', week.revised.includes(p8.id) && p8.subhead === 'Not for the early doubles.', p8.subhead);
  check('the photo stays when the note did not ask for a new one', p8.photos[0] === before.posts[8].photos[0], `${before.posts[8].photos[0]} -> ${p8.photos[0]}`);
  check('the caption stays when the note was about the image', p8.caption === before.posts[8].caption && buffer.posts.get(bid(8)).text === before.posts[8].buffer.text);
  check('the new image replaces the old in the same draft, tagged Revised',
    assetsBefore(8) !== snapshot[8] && buffer.posts.get(bid(8)).tags.map((t) => t.name).sort().join() === 'Content engine,Revised' && buffer.posts.size === 9);
  check('the revision is recorded on the post', p8.buffer.revisions.length === 1 && /early doubles|Shorten/.test(JSON.stringify(p8.buffer.revisions[0])));
  const reviseCall = provider.calls.find((c) => c.key === 'revise-8');
  check('the writer got the note itself', reviseCall && reviseCall.user.includes('Make the line under Fog delay shorter'));

  const p4 = after.posts[4];
  check('a note asking for another layout switches it', p4.layout === 'type-card' && p4.renderSurface === 'light', `${p4.layout} ${p4.renderSurface}`);
  const plan = read(path.join(batchDir, 'plan.json'));
  const gatesAfter = checkAll({ plan, ledger: after, priors: priorLedgers(contentDir, 'batch-06'), brandDir: WS.brandDir });
  const own = (id) => gatesAfter.flatMap((g) => g.failures).filter((f) => String(f.id).startsWith(id));
  check('the plan follows the ledger, so the batch still checks clean', own(p4.id).length === 0 && own(p8.id).length === 0 && own(after.posts[0].id).length === 0,
    gatesAfter.flatMap((g) => g.failures).map((f) => `${f.id} ${f.rule}`).join('; '));

  const p0 = after.posts[0];
  const edit0 = buffer.calls.filter((c) => c.op === 'editPost' && c.input.id === bid(0)).pop();
  check('a note asking for a caption change rewrites the caption in Buffer', p0.caption.length < before.posts[0].caption.length
    && edit0 && edit0.input.text === p0.postText && edit0.input.metadata.linkedin.firstComment === p0.firstComment);

  check('a request the engine cannot make changes nothing in Buffer', assetsBefore(9) === snapshot[9]
    && buffer.posts.get(bid(9)).tags.some((t) => t.name === 'Needs a look'));
  check('and the reviewer is told why', notifier.sent.some((m) => /Could not apply the note/.test(m) && /custom illustration/.test(m)));
  check('a note that asks for nothing changes nothing, and says so', !week.revised.includes(before.posts[5].id)
    && notifier.sent.some((m) => /asks for no change/.test(m)));
  check('a note from someone outside the reviewers list is ignored', !provider.calls.some((c) => c.key === 'note-2'));

  check('an edited caption is recorded, never changed', week.captionEdits.includes(before.posts[3].id) && buffer.posts.get(bid(3)).text === editedText);
  check('an edit that trips a gate is tagged Check caption and reported, by rule',
    buffer.posts.get(bid(3)).tags.some((t) => t.name === 'Check caption') && notifier.sent.some((m) => /brand\.emDash/.test(m)));

  const log = feedbackLog.load(feedbackFile);
  const kinds = log.map((e) => e.kind);
  check('the week is in the feedback log', ['approved', 'deleted', 'published', 'caption-edit', 'note'].every((k) => kinds.includes(k)), kinds.join());
  const summary = feedbackLog.summary(log, { reviewer: 'Byron' });
  check('the summary for the next batch carries the notes, the edit, the delete and the lessons',
    /early doubles|Fog delay/.test(summary) && /edited the caption: added "One more thing — the grill closes at 9\."/.test(summary) && /deleted the draft/.test(summary)
      && /as few words as possible/.test(summary) && /Not applied/.test(summary), summary);
  check('a caption edit is quoted as what changed, not as two whole captions',
    JSON.stringify(feedbackLog.editSpan('Pool hours on the weekend. See you there.', 'Pool hours on the holiday weekend. See you there.')) === JSON.stringify({ removed: '', added: 'holiday' })
    && JSON.stringify(feedbackLog.editSpan('Keep this. Drop this sentence. End.', 'Keep this. End.')) === JSON.stringify({ removed: 'Drop this sentence.', added: '' })
    && JSON.stringify(feedbackLog.editSpan('The cat sat.', 'The cats sat.')) === JSON.stringify({ removed: 'cat', added: 'cats' }));
  check('no doubled full stops in the summary', !/\.\./.test(summary.replace(/\.\.\./g, '')));
  const wr = writeRequest({ brandText: '<brand_file name="BRAND.md">x</brand_file>', entry: { channel: 'instagram' }, layoutInfo: 'type-card', reviewerFeedback: summary });
  check('the writer reads it, after the brand files', wr.startsWith('<brand_file') && wr.includes('<reviewer_feedback>'));

  /* ------------------------------------------------------------------ */
  console.log('== sync: run again ==');
  notifier.sent.length = 0;
  const providerCalls = provider.calls.length;
  const rerun = await syncOnce({ config: { ...config, buffer: { ...config.buffer, reviewers: ['byron@clubpilot.test'] } }, buffer, host, provider, notifier, contentDir, stagingDir, library, feedbackFile, now: NOW + 3 * 86400000 });
  check('a note is acted on once', rerun.revised.length === 0 && rerun.notApplied.length === 0 && provider.calls.length === providerCalls);
  check('the revision is not read back as a caption edit', !rerun.captionEdits.length, rerun.captionEdits.join());
  check('the log does not repeat itself', feedbackLog.load(feedbackFile).length === log.length);

  /* ------------------------------------------------------------------ */
  console.log('== sync: Chromium only when a note needs it ==');
  buffer.human.note(bid(9), 'Make the headline shorter.');
  const deferred = await syncOnce({ config: { ...config, buffer: { ...config.buffer, reviewers: ['byron@clubpilot.test'] } }, buffer, host, provider, notifier, contentDir, stagingDir, library, feedbackFile,
    deferRenders: true, canRenderNow: () => false, now: NOW + 3.5 * 86400000 });
  check('without Chromium the note waits, unread, for the second pass', deferred.deferred.length === 1
    && !read(ledgerFile).posts[9].buffer.notesSeen.includes(buffer.posts.get(bid(9)).notes.slice(-1)[0].id));
  // Mark it read by hand so the outage test below starts clean.
  { const l = read(ledgerFile); l.posts[9].buffer.notesSeen.push(buffer.posts.get(bid(9)).notes.slice(-1)[0].id); fs.writeFileSync(ledgerFile, JSON.stringify(l, null, 2)); }

  console.log('== a batch every other week ==');
  {
    const { batchDue } = require('../engine/generate/batch');
    const pri = [{ posts: [{ dueAt: '2026-10-18T16:40:00-07:00' }] }];
    check('not due while the last post is more than a week out', !batchDue(pri, Date.parse('2026-10-05T14:00:00Z'), 7).due);
    check('due once it is under a week out', batchDue(pri, Date.parse('2026-10-12T14:00:00Z'), 7).due);
    check('due when nothing has been planned', batchDue([], NOW, 7).due);
  }

  /* ------------------------------------------------------------------ */
  console.log('== sync: the model is down ==');
  const down = { name: 'down', calls: [], async generate({ key }) { this.calls.push(key); throw new Error('provider unavailable'); } };
  const byron = { ...config, buffer: { ...config.buffer, reviewers: ['byron@clubpilot.test'] } };
  buffer.human.note(bid(2), 'Shorter headline please.');
  notifier.sent.length = 0;
  const tries = [];
  for (let i = 0; i < 3; i += 1) {
    tries.push(await syncOnce({ config: byron, buffer, host, provider: down, notifier, contentDir, stagingDir, library, feedbackFile, now: NOW + (4 + i) * 86400000 }));
  }
  const p2 = read(ledgerFile).posts[2];
  check('a note that fails to process is retried on the next runs, not dropped',
    down.calls.length === 3 && tries[0].notApplied.length === 0 && tries[1].notApplied.length === 0, down.calls.join());
  check('after three failures a person takes it: Needs a look, and a message',
    tries[2].notApplied.length === 1 && buffer.posts.get(bid(2)).tags.some((t) => t.name === 'Needs a look')
      && notifier.sent.some((m) => /failed three times/.test(m)) && p2.buffer.notesSeen.length === 1, notifier.sent.join(' | '));

  /* ------------------------------------------------------------------ */
  console.log('== slides to PDF ==');
  {
    const files = [1, 2, 3].map((n) => path.join(stagingDir, 'batch-06', `${liCarousel.id}-0${n}.png`));
    const r = await slidesToPdf(files, { out: path.join(OUT, 'three.pdf') });
    check('three slides, three pages, at the slide size', r.pages === 3 && r.width === 1200 && r.height === 1500);
  }

  console.log(failures ? `\nbuffer: ${failures} CHECK(S) FAILED` : '\nbuffer: ALL CHECKS PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
