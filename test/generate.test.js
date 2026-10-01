/**
 * generate.test.js
 *
 * The generator, without an API key: the posting calendar, the layout
 * catalog and its schemas, the OpenAI request and response handling (with a
 * stubbed fetch), the prop-to-ledger mapping, and full batch runs against
 * recorded responses in test/fixtures/generate/clubpilot.
 *
 * The recorded batch is a real ten-post plan for Oct 5 to 18 2026 that
 * passes every gate. Two of its posts are recorded as a first draft that
 * repeats wording from batch 5 and a revision, so the run exercises the
 * rewrite loop: gate failure, feedback to the writer, revision, pass.
 *
 *   node test/generate.test.js
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../engine/lib/workspace');
const { slotsFor, nextMonday, offsetMinutes } = require('../engine/generate/slots');
const { loadCatalog, propsSchema } = require('../engine/generate/catalog');
const { requestBody, outputText, createOpenAI } = require('../engine/generate/providers/openai');
const { createMock } = require('../engine/generate/providers/mock');
const { creativeFields } = require('../engine/generate/ledger');
const { writePost } = require('../engine/generate/write');
const { runBatch, workEntry, findingsByPost } = require('../engine/generate/batch');
const { ctaTypesOf, assignVariants, assignEndCards, validateLibrary, ownAsk } = require('../engine/generate/cta');
const { checkAll } = require('../engine/gates/check-batch');
const { loadLayout } = require('../engine/render/render');
const photoLib = require('../engine/photos/library');

const WS = workspace();
const FIXTURES = path.join(__dirname, 'fixtures', 'generate', 'clubpilot');
const OUT = path.join(__dirname, 'output', 'generate');
const config = JSON.parse(fs.readFileSync(path.join(WS.dir, 'config.json'), 'utf8'));
const brand = JSON.parse(fs.readFileSync(path.join(WS.brandDir, 'render.json'), 'utf8'));
const NOW = Date.parse('2026-09-30T12:00:00Z');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

/** A fresh content directory holding copies of the shipped batches, as history. */
function freshContent(name) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
  for (const b of fs.readdirSync(WS.contentDir).filter((d) => /^batch-\d{2}$/.test(d))) {
    fs.cpSync(path.join(WS.contentDir, b), path.join(dir, 'content', b), { recursive: true });
  }
  return dir;
}

/** Does a value fit the strict schema subset the engine sends? */
function conforms(schema, value, at = '$') {
  if (schema.anyOf) {
    const tries = schema.anyOf.map((b) => conforms(b, value, at));
    return tries.some((t) => t.length === 0) ? [] : tries.sort((a, b) => a.length - b.length)[0];
  }
  const types = [].concat(schema.type || []);
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
  const t = typeOf(value);
  if (types.length && !types.includes(t) && !(t === 'integer' && types.includes('number'))) return [`${at}: ${t} is not ${types.join('|')}`];
  if (schema.enum && !schema.enum.includes(value)) return [`${at}: ${JSON.stringify(value)} not in enum`];
  if (t === 'object') {
    const errs = [];
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}.${k}: missing`);
    for (const k of Object.keys(value)) {
      if (!schema.properties[k]) errs.push(`${at}.${k}: not in schema`);
      else errs.push(...conforms(schema.properties[k], value[k], `${at}.${k}`));
    }
    return errs;
  }
  if (t === 'array') return value.flatMap((v, i) => conforms(schema.items, v, `${at}[${i}]`));
  return [];
}

/** Every object in a schema lists all its properties as required and allows no others. */
function strict(schema, at = '$') {
  const errs = [];
  if (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'))) {
    if (schema.additionalProperties !== false) errs.push(`${at}: additionalProperties is not false`);
    const keys = Object.keys(schema.properties || {});
    if (keys.sort().join() !== [...(schema.required || [])].sort().join()) errs.push(`${at}: required does not list every property`);
    for (const k of keys) errs.push(...strict(schema.properties[k], `${at}.${k}`));
  }
  if (schema.items) errs.push(...strict(schema.items, `${at}[]`));
  if (schema.anyOf) schema.anyOf.forEach((b, i) => errs.push(...strict(b, `${at}|${i}`)));
  return errs;
}

(async () => {
  console.log('== the posting calendar ==');
  const slots = slotsFor({ cadence: config.cadence, start: '2026-10-26', timeZone: config.timezone });
  check('two weeks of Club Pilot cadence is ten slots', slots.length === 10, String(slots.length));
  check('LinkedIn carries at least half the slots', slots.filter((s) => s.channel.startsWith('linkedin')).length >= 5);
  check('a slot before the clocks change is on daylight time', slots[0].dueAt === '2026-10-26T08:35:00-07:00', slots[0].dueAt);
  check('a slot after the clocks change is on standard time', slots.find((s) => s.date === '2026-11-02').dueAt === '2026-11-02T07:55:00-08:00');
  check('offsets come from the time zone, not the machine', offsetMinutes('2026-07-01', '12:00', 'Europe/London') === 60);
  check('a batch starts on a Monday', nextMonday('2026-09-30') === '2026-10-05');

  console.log('== the layout catalog ==');
  const library = photoLib.load();
  const catalog = loadCatalog({ brand, library, config });
  const eligible = catalog.filter((c) => c.eligible).map((c) => c.id);
  check('eleven layouts are generatable for Club Pilot', eligible.length === 11, eligible.join(', '));
  check('the product screenshot waits for a real screenshot',
    /tagged product-screenshot/.test(catalog.find((c) => c.id === 'product-screenshot').reason || '')
    && !eligible.includes('product-screenshot'));
  check('the founder portrait and quote card are source-mode only',
    ['founder-portrait', 'quote-card'].every((id) => catalog.find((c) => c.id === id).reason === 'source mode only'));
  const loose = catalog.filter((c) => c.eligible).flatMap((c) => strict(propsSchema(c.layout, brand), c.id));
  check('every props schema is strict (all properties required, no extras)', loose.length === 0, loose.join('; '));
  const proofSchema = propsSchema(loadLayout('proof-bar'), brand);
  check('proof-bar logos are limited to the registry', JSON.stringify(proofSchema.properties.logos.items.enum) === JSON.stringify(Object.keys(brand.proof.logos)));

  console.log('== the OpenAI provider ==');
  const body = requestBody({ model: 'm', system: 's', user: 'u', schema: { type: 'object' }, schemaName: 'post', reasoningEffort: 'medium' });
  check('requests strict JSON-schema output', body.text.format.type === 'json_schema' && body.text.format.strict === true && body.text.format.name === 'post');
  check('sends the system prompt as instructions and asks OpenAI not to store it', body.instructions === 's' && body.store === false);
  const reply = (text) => ({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }] });
  check('reads the output text past other output items', outputText(reply('{"a":1}')) === '{"a":1}');
  let threw = null;
  try { outputText({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }); } catch (e) { threw = e.message; }
  check('a refusal fails the step', /refused/.test(threw || ''), threw || 'accepted');
  threw = null;
  try { outputText({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }); } catch (e) { threw = e.message; }
  check('an incomplete response fails the step', /max_output_tokens/.test(threw || ''), threw || 'accepted');
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  threw = null;
  try { createOpenAI({ model: 'm' }); } catch (e) { threw = e.message; }
  check('a missing key fails before any request', /OPENAI_API_KEY is not set/.test(threw || ''), threw || 'accepted');
  process.env.OPENAI_API_KEY = 'test-key';
  let attempts = 0;
  let sentAuth = null;
  const fetchImpl = async (url, init) => {
    attempts += 1;
    sentAuth = init.headers.Authorization;
    if (attempts === 1) return { ok: false, status: 429, json: async () => ({ error: { message: 'slow down' } }) };
    return { ok: true, status: 200, json: async () => ({ ...reply('{"posts":[]}'), usage: { input_tokens: 10, output_tokens: 2, input_tokens_details: { cached_tokens: 8 } } }) };
  };
  const oa = createOpenAI({ model: 'm', fetchImpl });
  const got = await oa.generate({ system: 's', user: 'u', schema: {}, schemaName: 'x' });
  check('a rate-limited request is retried and then succeeds', attempts === 2 && Array.isArray(got.data.posts), `attempts ${attempts}`);
  check('the key goes only in the Authorization header', sentAuth === 'Bearer test-key');
  check('usage reports cached input tokens', got.usage.cachedInput === 8 && got.usage.input === 10);
  if (saved === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved;

  console.log('== every word on the image reaches the gates ==');
  const stat = creativeFields(loadLayout('stat-card'), { value: '67%', label: 'of members opt in to text', context: 'Including members over 60.', source: 'Club Pilot blog' });
  check('a stat card\'s number and label are one headline', stat.headline === '67% of members opt in to text');
  check('its context and source are on-card text', /over 60/.test(stat.text) && /blog/.test(stat.text));
  const esc = creativeFields(loadLayout('escalation-thread'), { headline: 'H', sender: 'Oakcrest Country Club', question: 'Q?', offer: 'O', reply: 'R', handoff: 'Sent.' });
  check('an escalation becomes a four-beat thread ending at the handoff',
    esc.thread.map((m) => m.from).join() === 'member,assistant,member,assistant' && esc.thread[3].text === 'Sent.' && esc.headline === 'H');
  const hub = creativeFields(loadLayout('communication-hub'), { headline: 'H', channels: [{ label: 'Email', icon: 'email' }, { label: 'Text', icon: 'text' }], hubLabel: 'One inbox' });
  check('list items and hub labels are on-card text, icons are not', /Email/.test(hub.text) && /One inbox/.test(hub.text) && !/email\b/.test(hub.text));

  console.log('== the recorded responses fit the schemas the engine sends ==');
  // Checked through the planner and writer themselves: a response that does
  // not fit would not be what a strict-schema provider returns.
  const planFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'plan.json'), 'utf8'));
  const { planSchema } = require('../engine/generate/plan');
  const pillars = require('../engine/gates/plan-gate').PILLARS.filter((p) => !config.excludePillars.includes(p));
  const demoClubs = JSON.parse(fs.readFileSync(path.join(WS.brandDir, 'demo-clubs.json'), 'utf8')).clubs.map((c) => c.name);
  const pSchema = planSchema({ catalog, pillars, demoClubs, ctaTypes: ctaTypesOf(config), slotCount: 10, carousels: true });
  const planErrs = conforms(pSchema, planFixture);
  check('the recorded plan fits the plan schema', planErrs.length === 0, planErrs.slice(0, 5).join('; '));

  console.log('== a full batch, recorded ==');
  const dir = freshContent('batch');
  const mock = createMock({ dir: FIXTURES });
  const events = [];
  const r = await runBatch({
    provider: mock, contentDir: path.join(dir, 'content'), stagingDir: path.join(dir, 'staging'),
    start: '2026-10-05', now: NOW, log: (e) => events.push(e),
  });
  check('the batch finishes ready for review', r.ok && r.stage === 'done', JSON.stringify({ stage: r.stage, unresolved: r.unresolved, failures: r.failures }));
  check('it is numbered after the shipped batches', r.batch === 'batch-06');
  const batchDir = path.join(dir, 'content', 'batch-06');
  const planDoc = JSON.parse(fs.readFileSync(path.join(batchDir, 'plan.json'), 'utf8'));
  const ledger = JSON.parse(fs.readFileSync(path.join(batchDir, 'ledger.json'), 'utf8'));
  check('the plan says it is reviewed as Buffer drafts, not approved by anyone',
    planDoc.posts.every((p) => p.review === 'buffer-drafts' && !p.approvedBy));
  check('ten posts, all rendered', ledger.posts.length === 10 && ledger.posts.every((p) => p.status === 'rendered'),
    ledger.posts.map((p) => `${p.id}:${p.status}`).join(', '));
  const writeSchemaErrs = [];
  const byLayout = new Map(catalog.map((c) => [c.id, c]));
  const { postSchema } = require('../engine/generate/write');
  for (const call of mock.calls.filter((c) => c.key.startsWith('post-'))) {
    const i = Number(call.key.slice(5));
    const schema = postSchema(workEntry(planDoc.posts[i], i, byLayout, brand), brand);
    check(`${call.key}: the schema the engine sent is strict`, strict(schema).length === 0, strict(schema).join('; '));
    const recorded = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${call.key}.json`), 'utf8'));
    for (const resp of [].concat(recorded)) writeSchemaErrs.push(...conforms(schema, resp, call.key));
  }
  check('every recorded post fits its layout\'s post schema', writeSchemaErrs.length === 0, [...new Set(writeSchemaErrs)].slice(0, 5).join('; '));
  const post0Calls = mock.calls.filter((c) => c.key === 'post-0');
  check('a post that repeated batch-5 wording was rewritten once', post0Calls.length === 2, String(post0Calls.length));
  check('the rewrite request quoted the gate finding', /dedupe\.sharedPhrasing/.test(post0Calls[1] ? post0Calls[1].user : ''));
  check('the brand files lead every prompt, so the provider can cache them',
    mock.calls.every((c) => c.user.startsWith('<brand_file name="BRAND.md">')));
  const gates = checkAll({ plan: planDoc, ledger, priors: ['01', '02', '03', '04', '05'].map((n) => JSON.parse(fs.readFileSync(path.join(dir, 'content', `batch-${n}`, 'ledger.json'), 'utf8'))), brandDir: WS.brandDir });
  check('the written ledger passes every gate on its own', gates.every((g) => g.pass), gates.filter((g) => !g.pass).map((g) => g.label).join(', '));
  const photoIds = ledger.posts.flatMap((p) => p.photos);
  check('no photo is used twice in a batch', new Set(photoIds).size === photoIds.length, photoIds.join(', '));
  check('the thread senders come from the plan', ledger.posts.filter((p) => p.thread).every((p) => p.props.sender === p.sender && demoClubs.includes(p.sender)));
  check('every post records what its render drew', ledger.posts.every((p) => p.renderedText && p.renderedText.includes(p.headline.split(' ')[0])));
  const ig = ledger.posts.find((p) => p.channel === 'instagram');
  const li = ledger.posts.find((p) => p.channel === 'linkedin_page');
  check('each channel renders at its own size', ig.dimensions === '1080x1350' && li.dimensions === '1200x1500');
  check('the report and contact sheet are written', fs.existsSync(path.join(batchDir, 'report.md')) && fs.existsSync(path.join(batchDir, 'contact-sheet.jpg')));
  check('renders stay out of the content folder', !fs.readdirSync(batchDir).some((f) => f.endsWith('.png')));

  console.log('== carousels: one post in three, planned as a whole ==');
  const carousels = ledger.posts.filter((p) => p.layout === 'carousel');
  check('three or four of ten posts are carousels', carousels.length >= 3 && carousels.length <= 4, String(carousels.length));
  const skipPillars = config.cta.endCardSkipPillars || [];
  const askingCarousels = carousels.filter((p) => !skipPillars.includes(p.pillar));
  const funny = carousels.filter((p) => skipPillars.includes(p.pillar));
  check('the recorded batch has a humor carousel and asking carousels', funny.length >= 1 && askingCarousels.length >= 2,
    `${funny.length} humor, ${askingCarousels.length} asking`);
  const content = (p) => p.slides.length - (p.endCard ? 1 : 0);
  check('each carousel has 4 to 8 content slides, every one rendered',
    carousels.every((p) => content(p) >= 4 && content(p) <= 8 && p.slides.every((sl) => sl.render && sl.render.issues.length === 0)),
    carousels.map((p) => `${p.id}:${p.slides.length}`).join(', '));
  check('a carousel opens on a cover, gives its takeaway, then ends on the end card',
    askingCarousels.every((p) => p.slides[0].layout === 'carousel-cover'
      && p.slides[p.slides.length - 2].layout === 'carousel-close' && p.slides[p.slides.length - 1].layout === 'carousel-cta'));
  check('a humor carousel ends on its close: no end card after the joke',
    funny.every((p) => !p.endCard && p.slides[p.slides.length - 1].layout === 'carousel-close'
      && !p.slides.some((sl) => sl.layout === 'carousel-cta')));
  check('each asking carousel has a different end card', new Set(askingCarousels.map((p) => p.endCard)).size === askingCarousels.length,
    askingCarousels.map((p) => p.endCard).join(', '));
  check('a carousel asks once at most: on its end card, never in the caption too', carousels.every((p) => p.ctaType === 'none' && !p.cta));
  check('end cards point to the demo on LinkedIn and the bio on Instagram', askingCarousels.every((p) => {
    const card = p.slides[p.slides.length - 1].props;
    return p.channel.startsWith('linkedin') ? card.link === config.cta.endCardLink.linkedin : card.link === config.cta.endCardLink.instagram;
  }));
  const { engineChecks } = require('../engine/generate/plan');
  const doubleAsk = planDoc.posts.map((e) => (e.layout === 'carousel' ? { ...e, ctaType: 'demo' } : e));
  check('the planner refuses a carousel that also asks in its caption',
    engineChecks(doubleAsk, { slots: planDoc.posts.map((e, i) => ({ slot: i, date: e.date, channel: e.channel })), catalog, pillars, library, lib: photoLib, config })
      .some((f) => /ask is its end card/.test(f)));
  const cards = assignEndCards([
    { id: 'x', layout: 'carousel', channel: 'instagram', dueAt: '2026-10-20T09:00:00-07:00' },
  ], [{ posts: [{ endCard: 'see-it', dueAt: '2026-10-06T12:05:00-07:00' }] }], config);
  check('the next end card is one not used recently', cards[0].endCard && cards[0].endCard !== 'see-it', cards[0].endCard);
  const skipped = assignEndCards([{ id: 'h', layout: 'carousel', pillar: 'Humor', channel: 'instagram', dueAt: '2026-10-20T09:00:00-07:00' }], [], config);
  check('a Humor carousel gets no end card', !skipped[0].endCard && !skipped[0].endCardProps);
  const flip = carousels.find((p) => p.carouselKind === 'reveal-flip');
  check('a reveal-flip has its reveal slide', flip && flip.slides.some((sl) => sl.layout === 'carousel-reveal'));
  const list = carousels.find((p) => p.carouselKind === 'list');
  check('list items are numbered from 01, not from the cover', list && /\b01\b/.test(list.slides[1].renderedText), list && list.slides[1].renderedText);
  check('every slide goes to Buffer with alt text', carousels.every((p) => p.assets.length === p.slides.length && p.assets.every((a) => a.altText)));
  check('a photo cover uses a library photo', carousels.filter((p) => p.renderSurface === 'photo').every((p) => p.photos.length === 1 && p.slides[0].props.photo === p.photos[0]));
  const routed = findingsByPost([{ failures: [
    { id: 'b06-07-x (slide 6)', rule: 'brand.copyCap.card', detail: 'too long' },
    { id: '(batch)', rule: 'rotation.noNewPairing', detail: 'batch-level' },
  ] }], ['b06-07-x']);
  check('a slide\'s gate finding goes back to its post, naming the slide',
    routed.size === 1 && routed.get('b06-07-x')[0] === 'slide 6: brand.copyCap.card: too long', JSON.stringify([...routed]));

  console.log('== humor: a regular part of the plan ==');
  const jokes = ledger.posts.filter((p) => p.pillar === 'Humor');
  check('two of ten posts are Humor (one in five)', jokes.length === 2, String(jokes.length));
  check('each names its mechanism and lands without a footer', jokes.every((p) => p.humorMechanism && p.standsWithoutFooter === true));
  check('each goes to Buffer as a draft for Byron to approve', jokes.every((p) => p.review === 'buffer-drafts' && !p.approvedBy));

  console.log('== calls to action: one in four, rotating, added by the engine ==');
  const asking = ledger.posts.filter((p) => p.ctaType !== 'none');
  check('two of ten posts ask (one in four)', asking.length === 2, String(asking.length));
  check('no two asks in a row on one channel', ['instagram', 'linkedin_page'].every((ch) => {
    const seq = ledger.posts.filter((p) => p.channel === ch).map((p) => p.ctaType !== 'none');
    return !seq.some((a, i) => a && seq[i + 1]);
  }));
  check('each ask uses a different line from the library', new Set(asking.map((p) => p.ctaVariant)).size === asking.length);
  check('LinkedIn asks carry the link; Instagram asks point to the bio',
    asking.every((p) => (p.channel.startsWith('linkedin') ? p.cta.includes(config.cta.link) : /Link in bio\.$/.test(p.cta))),
    asking.map((p) => `${p.channel}: ${p.cta}`).join(' | '));
  check('the ask is the last line of what Buffer gets', asking.every((p) => p.postText === `${p.caption}\n\n${p.cta}`));
  check('posts that do not ask carry no ask', ledger.posts.filter((p) => p.ctaType === 'none').every((p) => !p.cta && p.postText === p.caption));
  check('the Club Pilot CTA library is sound (both channels, no dashes, no sales push)', validateLibrary(config).length === 0, validateLibrary(config).join('; '));
  const history = [{ posts: [
    { ctaVariant: 'live-demo', dueAt: '2026-09-20T09:00:00-07:00' },
    { ctaVariant: 'meet-the-team', dueAt: '2026-09-28T09:00:00-07:00' },
  ] }];
  const next = assignVariants([
    { id: 'a', channel: 'instagram', ctaType: 'demo', dueAt: '2026-10-05T09:00:00-07:00' },
    { id: 'b', channel: 'linkedin_page', ctaType: 'demo', dueAt: '2026-10-09T09:00:00-07:00' },
  ], history, config);
  check('the next asks use lines not used recently', next.every((e) => !['live-demo', 'meet-the-team'].includes(e.ctaVariant)),
    next.map((e) => e.ctaVariant).join(', '));
  check('a caption with its own ask is caught', ownAsk('Great stuff. Link in bio.', config).length === 1 && ownAsk('Book at clubpilot.com/demo', config).length === 1);
  check('a caption that pitches is caught', /sales/.test(ownAsk('Our sales team would love to talk.', config).join()));

  console.log('== a plan that fails its checks is revised ==');
  const revDir = path.join(OUT, 'revision-fixtures');
  fs.rmSync(revDir, { recursive: true, force: true });
  fs.cpSync(FIXTURES, revDir, { recursive: true });
  const bad = JSON.parse(JSON.stringify(planFixture));
  bad.posts[1].ctaType = 'demo'; // an ask right before another ask on Instagram
  bad.posts[5].ctaType = 'demo'; // and a fourth ask in ten posts
  fs.writeFileSync(path.join(revDir, 'plan.json'), JSON.stringify([bad, planFixture]));
  const revMock = createMock({ dir: revDir });
  const revContent = freshContent('revision');
  const rr = await runBatch({
    provider: revMock, contentDir: path.join(revContent, 'content'), stagingDir: path.join(revContent, 'staging'),
    start: '2026-10-05', now: NOW, planOnly: true,
  });
  const planCalls = revMock.calls.filter((c) => c.key === 'plan');
  check('the plan took two rounds', rr.ok && planCalls.length === 2, `${rr.stage}, ${planCalls.length} call(s)`);
  check('the revision request quoted the failures', /plan\.ctaAdjacent/.test(planCalls[1] ? planCalls[1].user : '')
    && /call to action/.test(planCalls[1] ? planCalls[1].user : ''));

  console.log('== plan-approval mode stops for a person ==');
  const apContent = freshContent('approval');
  const ap = await runBatch({
    provider: createMock({ dir: FIXTURES }), config: { ...config, review: 'plan-approval' },
    contentDir: path.join(apContent, 'content'), stagingDir: path.join(apContent, 'staging'), start: '2026-10-05', now: NOW,
  });
  const apPlan = JSON.parse(fs.readFileSync(path.join(apContent, 'content', 'batch-06', 'plan.json'), 'utf8'));
  check('the run stops after the plan', ap.stage === 'awaiting-plan-approval' && !fs.existsSync(path.join(apContent, 'content', 'batch-06', 'ledger.json')));
  check('the plan waits with an empty approvedBy, not a review mode', apPlan.posts.every((p) => p.approvedBy === '' && !p.review));

  console.log('== a post that cannot be fixed is left for a person ==');
  const stuckDir = path.join(OUT, 'stuck-fixtures');
  fs.rmSync(stuckDir, { recursive: true, force: true });
  fs.mkdirSync(stuckDir, { recursive: true });
  const stuck = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'post-9.json'), 'utf8'));
  stuck.props.headline = 'x'.repeat(80);
  fs.writeFileSync(path.join(stuckDir, 'post-9.json'), JSON.stringify(stuck));
  const entry = planDoc.posts[9];
  const c9 = catalog.find((x) => x.id === entry.layout);
  const stuckMock = createMock({ dir: stuckDir });
  const w9 = await writePost({
    provider: stuckMock, brand, brandDir: WS.brandDir, config, lib: photoLib, library, usedPhotos: [],
    entry: { ...entry, slotIndex: 9, layoutModule: c9.layout, photoProps: c9.photoProps, fixed: ['sender'], layoutInfo: c9.id },
  });
  check('the writer stops after its revision budget', stuckMock.calls.length === 1 + config.maxRevisions.post, String(stuckMock.calls.length));
  check('and reports what is still wrong', w9.failures.some((f) => /headline is 80 characters/.test(f)), w9.failures.join('; '));

  console.log(failures === 0 ? '\ngenerate: ALL CHECKS PASS' : `\ngenerate: ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
