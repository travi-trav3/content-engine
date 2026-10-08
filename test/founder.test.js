/**
 * founder.test.js
 *
 * Source mode without a key: a made-up founder's sources (a call transcript
 * with an interviewer, a note, a voice memo with a recorded transcript), the
 * source gate case by case, the founder slots and their brief topics, a slot
 * written after one rewrite, a slot that cannot be sourced, the drafts in an
 * in-memory Buffer, and notes on a founder draft read back by sync.
 *
 *   node test/founder.test.js
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.CE_WORKSPACE = 'brands/clubpilot';

const { workspace } = require('../engine/lib/workspace');
const src = require('../engine/generate/sources');
const gate = require('../engine/gates/source-gate');
const founder = require('../engine/generate/founder');
const { createMock } = require('../engine/generate/providers/mock');
const { createMockBuffer } = require('../engine/buffer/mock');
const { syncOnce } = require('../engine/buffer/sync');
const feedbackLog = require('../engine/feedback/log');

const WS = workspace();
const FIX = path.join(__dirname, 'fixtures', 'founder');
const C = '2026-10-02-call-with-dana.md';
const N = 'dana-notes.md';
const NOW = Date.parse('2026-10-01T12:00:00Z');
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const base = read(path.join(WS.dir, 'config.json'));
const config = {
  ...base,
  // Two Tuesday slots, as the recorded responses were made for; a sign-off, to test the mechanism.
  founder: { ...base.founder, name: 'Dana', names: ['Dana', 'Dana Reyes'], signOff: 'Dana Reyes, Founder', slots: [{ dayOfBatch: 1, time: '07:40' }, { dayOfBatch: 8, time: '07:40' }] },
  buffer: { ...base.buffer, organizationId: 'org-test', channels: { instagram: 'ch-ig', linkedin_page: 'ch-li', linkedin_byron: 'ch-founder' }, reviewers: [] },
};
const notifier = { sent: [], async send(m) { this.sent.push(m); } };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-founder-'));
  const sourcesDir = path.join(tmp, 'sources');
  fs.mkdirSync(sourcesDir);
  for (const f of fs.readdirSync(path.join(FIX, 'sources'))) fs.copyFileSync(path.join(FIX, 'sources', f), path.join(sourcesDir, f));

  console.log('== sources: whose words are whose ==');
  const provider = createMock({ dir: FIX });
  const loaded = await src.loadSources({ dir: sourcesDir, provider, founderNames: config.founder.names });
  const by = new Map(loaded.sources.map((s) => [s.name, s]));
  const call = by.get(C);
  check('a call with speaker turns is a transcript; only the founder\'s turns are the founder\'s',
    call.kind === 'transcript' && call.turns.filter((t) => t.founder).length === 3 && call.turns.filter((t) => t.speaker === 'Interviewer').every((t) => !t.founder));
  check('a note without turns is all the founder\'s', by.get(N).kind === 'document' && by.get(N).turns.every((t) => t.founder));
  const memo = by.get('voice-memo-oct-6.m4a');
  check('a voice memo is transcribed once and saved beside it', memo && memo.kind === 'voice memo' && /morning at a club last spring/.test(memo.text)
    && fs.existsSync(path.join(sourcesDir, 'voice-memo-oct-6.m4a.transcript.json')) && provider.calls.filter((c) => c.transcribe).length === 1);
  const again = await src.loadSources({ dir: sourcesDir, provider, founderNames: config.founder.names });
  check('and not sent again while it is unchanged', provider.calls.filter((c) => c.transcribe).length === 1 && again.sources.length === 3);
  check('the transcripts are not read as sources themselves', !again.sources.some((s) => s.name.endsWith('.json')));
  const big = await src.loadSources({ dir: sourcesDir, founderNames: config.founder.names, maxAudioBytes: 10 });
  fs.rmSync(path.join(sourcesDir, 'voice-memo-oct-6.m4a.transcript.json'));
  const fresh = await src.loadSources({ dir: sourcesDir, founderNames: config.founder.names, maxAudioBytes: 10 });
  check('a recording too big to transcribe is reported, not dropped silently', big.problems.length === 0 && fresh.problems.length === 1 && /cannot be transcribed/.test(fresh.problems[0]));
  const noProvider = await src.loadSources({ dir: sourcesDir, founderNames: config.founder.names });
  check('without a provider a new memo waits, reported as untranscribed', noProvider.untranscribed.includes('voice-memo-oct-6.m4a'));
  await src.loadSources({ dir: sourcesDir, provider, founderNames: config.founder.names });
  const sources = (await src.loadSources({ dir: sourcesDir, founderNames: config.founder.names })).sources;

  console.log('== the source gate, sentence by sentence ==');
  const opts = { ...gate.optionsFrom(config), signOff: null };
  const post = (sentences, extra = {}) => {
    const paragraphs = [{ sentences }];
    return { id: 't', paragraphs, caption: gate.assembleCaption(paragraphs, null), ...extra };
  };
  const s = (text, ...refs) => ({ text, refs: refs.map(([source, quote]) => ({ source, quote })) });
  const rules = (p) => gate.checkPost(p, sources, opts).map((f) => f.rule);
  check('a faithful restatement passes', rules(post([
    s('The front desk answers the same handful of questions all day.', [C, 'The front desk answers the same handful of questions all day.']),
    s('They use different channels for different jobs, and clubs should let them.', [C, 'They use different channels for different jobs, and I think clubs should let them.']),
  ])).length === 0, rules(post([s('x')])).join());
  check('a transition and a reader question need no quote', rules(post([s('Here\'s the thing.'), s('What is your front desk answering today?')])).length === 0);
  check('a claim with no quote fails (source.unreferenced)', rules(post([s('I ran the front desk at a club for years.')])).includes('source.unreferenced'));
  check('a quote that is not in the source fails (source.quoteNotFound)',
    rules(post([s('Members want an app for everything.', [C, 'Members want an app for everything.'])])).includes('source.quoteNotFound'));
  check('the interviewer\'s words are never the founder\'s (source.notFounder)',
    rules(post([s('Email is dead for quick answers.', [C, 'Members just want answers fast, and email is dead for that.'])])).includes('source.notFounder'));
  check('a quote must name a real source (source.unknownSource)', rules(post([s('The newsletter matters.', ['board-minutes.md', 'The newsletter matters to members'])])).includes('source.unknownSource'));
  check('a two-word quote proves nothing (source.quoteTooShort)', rules(post([s('The newsletter matters.', [C, 'newsletter matters'])])).includes('source.quoteTooShort'));
  check('a number the quote does not have fails (source.number)',
    rules(post([s('Members read the newsletter on Sunday and text the club 40 times a week.', [C, 'Members read the newsletter on Sunday and text the club on Tuesday.'])])).includes('source.number'));
  check('so does a name (source.name)',
    rules(post([s('Members at Pebble Ridge read the newsletter on Sunday.', [C, 'Members read the newsletter on Sunday and text the club on Tuesday.'])])).includes('source.name'));
  check('a sentence that drifts from its quote fails (source.overlap)',
    rules(post([s('I built an assistant because every manager I hired quit within a year.', [C, 'The front desk answers the same handful of questions all day.'])])).includes('source.overlap'));
  check('a sentence that negates where the quote does not fails (source.negation)',
    rules(post([s('Email is not the place a club tells its story.', [C, 'Email is still the place a club tells its story.'])])).includes('source.negation'));
  check('a quote may skip words with "...", in order, within one turn',
    rules(post([s('The front desk answers the same questions, and it pulls the staff away from members.', [C, 'The front desk answers the same handful of questions all day... it pulls them away from the members standing right in front of them.'])])).length === 0);
  const extra = post([s('Email is still the place a club tells its story.', [C, 'Email is still the place a club tells its story.'])]);
  extra.caption += '\n\nAnd I have the numbers to prove it.';
  check('a caption with a line the sentences do not have fails (source.caption)', rules(extra).includes('source.caption'));
  check('a founder post carries no first comment (source.firstComment)', rules({ ...post([s('Here\'s the thing.')]), firstComment: 'Link in the comments.' }).includes('source.firstComment'));
  check('with no material at all, nothing passes (source.noSources)', gate.checkPost(post([s('Here\'s the thing.')]), [], opts).some((f) => f.rule === 'source.noSources'));

  console.log('== founder slots and their topics ==');
  const brief = { name: 'map', month: '2026-10', items: [
    { id: 'map/founder-w1', channel: 'founder', week: 1, title: 'Email still has a job', body: 'Email is not the problem.' },
    { id: 'map/founder-w2', channel: 'founder', week: 2, title: 'Members do not think in channels', body: null },
    { id: 'map/ig-01', channel: 'instagram', week: 1, title: 'Not for the founder' },
  ] };
  const slots = founder.planFounder({ config, start: '2026-10-05', batchNo: 1, briefs: [brief] });
  check('two slots, Tuesdays at 7:40 Pacific, on the founder\'s channel', slots.length === 2 && slots.map((p) => p.dueAt).join() === '2026-10-06T07:40:00-07:00,2026-10-13T07:40:00-07:00'
    && slots.every((p) => p.channel === 'linkedin_byron' && p.founderVoice && p.layout === 'text' && p.status === 'planned'), JSON.stringify(slots.map((p) => p.dueAt)));
  check('each takes the brief\'s founder idea for its week', slots.map((p) => p.briefItem).join() === 'map/founder-w1,map/founder-w2');
  const later = founder.planFounder({ config, start: '2026-10-05', batchNo: 2, briefs: [brief], priors: [{ founder: [{ briefItem: 'map/founder-w1' }] }] });
  check('an idea used before is not used again, and no slot runs a later week\'s idea', later[0].briefItem === null && later[1].briefItem === 'map/founder-w2');
  const byron = founder.planFounder({ config: base, start: '2026-10-19', batchNo: 7 });
  check('Byron\'s config: two founder posts a week, Tuesday and Thursday, with no sign-off (2026-10-08)',
    byron.length === 4 && byron.map((p) => p.date).join() === '2026-10-20,2026-10-22,2026-10-27,2026-10-29' && base.founder.signOff === null, byron.map((p) => p.date).join());
  check('founder posts are off unless the config turns them on', founder.planFounder({ config: { ...config, founder: { ...config.founder, enabled: false } }, start: '2026-10-05', batchNo: 1 }).length === 0);

  console.log('== filling the slots: written, or stuck and reported ==');
  const contentDir = path.join(tmp, 'content');
  const batchDir = path.join(contentDir, 'batch-01');
  fs.mkdirSync(batchDir, { recursive: true });
  const ledgerFile = path.join(batchDir, 'ledger.json');
  fs.writeFileSync(ledgerFile, JSON.stringify({ batch: 'Test batch 01', window: '2026-10-05 to 2026-10-18', posts: [], founder: slots }, null, 2));
  const fillProvider = createMock({ dir: FIX });
  const buffer = createMockBuffer({ channels: config.buffer.channels });
  const filled = await founder.fillAll({ contentDir, brandDir: WS.brandDir, sourcesDir, config, provider: fillProvider, notifier, buffer, push: true, now: NOW });
  let ledger = read(ledgerFile);
  const [f1, f2] = ledger.founder;
  const f1Calls = fillProvider.calls.filter((c) => c.key === 'founder-b01-f1');
  check('the first slot is written after one rewrite', f1.status === 'written' && f1Calls.length === 2, `${f1.status}, ${f1Calls.length} call(s)`);
  check('the rewrite was told what failed: the invented line and the interviewer\'s words',
    /source\.unreferenced/.test(f1Calls[1].user) && /source\.notFounder/.test(f1Calls[1].user));
  check('the brief topic reached the writer', /Title: Email still has a job/.test(f1Calls[0].user));
  check('every sentence carries its quotes and the caption is those sentences plus the sign-off',
    f1.paragraphs.every((p) => p.sentences.every((x) => x.refs.length || /\?$/.test(x.text))) && f1.caption.endsWith('\n\nDana Reyes, Founder') && f1.postText === f1.caption);
  check('the post names its sources, for the brand gate and for a person', /2026-10-02-call-with-dana\.md, dana-notes\.md/.test(f1.sourceNote) && f1.sources.every((x) => x.sha256));
  check('the second slot fails every rewrite and is left for a person', f2.status === 'failed' && fillProvider.calls.filter((c) => c.key === 'founder-b01-f2').length === 3
    && f2.findings.some((f) => /^source\.(overlap|number)/.test(f)), f2.findings && f2.findings.join('; '));
  check('the founder is told, with the reason', notifier.sent.some((m) => /could not be written within the source checks/.test(m) && /source\./.test(m)));
  const drafts = buffer.calls.filter((c) => c.op === 'createPost');
  check('the written post is a text-only draft on the founder\'s channel', drafts.length === 1 && drafts[0].input.channelId === 'ch-founder'
    && drafts[0].input.assets.length === 0 && drafts[0].input.saveToDraft === true && drafts[0].input.text === f1.caption, JSON.stringify(drafts.map((d) => d.input.channelId)));
  check('the ledger records the draft; the failed slot has none', f1.buffer && f1.buffer.id && !f2.buffer && filled.drafted.length === 1);

  const callsBefore = fillProvider.calls.length;
  await founder.fillAll({ contentDir, brandDir: WS.brandDir, sourcesDir, config, provider: fillProvider, notifier, buffer, now: NOW + 3600000 });
  check('nothing new in sources: the stuck slot is not tried again', fillProvider.calls.length === callsBefore);
  fs.writeFileSync(path.join(sourcesDir, 'dana-more.md'), 'I worked the desk at my first club for a summer, and the same questions came every morning.\n');
  await founder.fillAll({ contentDir, brandDir: WS.brandDir, sourcesDir, config, provider: fillProvider, notifier, buffer, now: NOW + 7200000 });
  check('new material: the stuck slot is tried again; the written one is not',
    fillProvider.calls.filter((c) => c.key === 'founder-b01-f2').length === 6 && fillProvider.calls.filter((c) => c.key === 'founder-b01-f1').length === 2);
  fs.rmSync(path.join(sourcesDir, 'dana-more.md'));

  console.log('== a slot with nothing to write from asks for it ==');
  const askLedger = { founder: [{ ...slots[0], id: 'b09-f1', status: 'planned' }] };
  const asker = { async generate() { return { data: { supported: false, questions: ['What happened the first morning you watched the desk?', 'What did the staff say?', 'What did you change after?'], understood: '', summary: '', paragraphs: [] }, usage: { input: 0, cachedInput: 0, output: 0 } }; } };
  const ar = await founder.fillFounder({ ledger: askLedger, config, brandDir: WS.brandDir, sources: [], provider: asker, now: NOW });
  const ask = founder.askMessage(askLedger.founder, config);
  check('nothing is written; the slot waits with questions', ar.needsSource.length === 1 && askLedger.founder[0].status === 'needs-source' && !askLedger.founder[0].caption);
  check('the ask says what to record and where it goes', /Dana's LinkedIn post for Tue, Oct 6/.test(ask) && /"Email still has a job"/.test(ask) && /1\. What happened/.test(ask) && /Drive folder Sources/.test(ask), ask);

  console.log('== a note on a founder draft ==');
  const feedbackFile = path.join(tmp, 'feedback.jsonl');
  const syncProvider = createMock({ dir: FIX });
  for (let i = 0; i < 2; i += 1) await syncProvider.generate({ key: 'founder-b01-f1' }); // the fill's two answers
  const pid = f1.buffer.id;
  buffer.human.note(pid, 'Shorter, please. Drop the newsletter line.');
  const sync = (now) => syncOnce({ config, buffer, host: null, provider: syncProvider, notifier, contentDir, sourcesDir, library: null, feedbackFile, now });
  const r1 = await sync(NOW + 86400000);
  ledger = read(ledgerFile);
  const live = buffer.posts.get(pid);
  check('the note is applied through the founder writer and the gates', r1.revised.includes('b01-f1') && !/newsletter/.test(ledger.founder[0].caption), JSON.stringify(r1));
  check('the new caption is swapped into the same draft, tagged Revised', live.text === ledger.founder[0].caption && live.tags.some((t) => t.name === 'Revised') && live.assets.length === 0);
  check('no renderer was needed', !r1.deferred.length);
  check('the log records how the note was read', feedbackLog.load(feedbackFile).some((e) => e.kind === 'note' && e.applied && /shorter/i.test(e.understood)));

  buffer.human.edit(pid, `Every club I visit has the same morning.\n\n${live.text}`);
  await sync(NOW + 2 * 86400000);
  buffer.human.note(pid, 'Keep my new first line and cut the question at the end.');
  const r2 = await sync(NOW + 3 * 86400000);
  ledger = read(ledgerFile);
  const lastCall = syncProvider.calls.filter((c) => c.key === 'founder-b01-f1').pop();
  check('a caption the founder edited joins the sources as the founder\'s own words', /<source name="buffer-edit\.md"/.test(lastCall.user) && /Every club I visit has the same morning\./.test(lastCall.user));
  check('so the revision keeps the founder\'s line', r2.revised.includes('b01-f1') && ledger.founder[0].caption.startsWith('Every club I visit has the same morning.')
    && ledger.founder[0].paragraphs[0].sentences[0].refs[0].source === 'buffer-edit.md');
  check('the edit was recorded as feedback before the note', feedbackLog.load(feedbackFile).some((e) => e.kind === 'caption-edit' && e.post === 'b01-f1'));

  console.log('== regression: the Aug 24 founder post ==');
  const b3 = read(path.join(WS.contentDir, 'batch-03', 'ledger.json'));
  const aug24 = b3.posts.find((p) => p.id === 'b3-08-founder-li');
  check('it fails the source gate: no sentence of it is sourced', gate.checkPost(aug24, sources, opts).some((f) => f.rule === 'source.noSentences'));

  console.log(failures ? `\nfounder: ${failures} CHECK(S) FAILED` : '\nfounder: ALL CHECKS PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
