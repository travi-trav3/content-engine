/**
 * render.test.js
 *
 * Every layout renders at every platform size and surface with no issues,
 * matches its golden image within tolerance, and the render QA catches the
 * failures it exists to catch. Uses the Club Pilot fixture brand.
 *
 *   node test/render.test.js
 *   UPDATE_GOLDENS=1 node test/render.test.js   # after an intended visual change
 *
 * Goldens are compared with a tolerance, not byte for byte: font
 * rasterization can differ slightly between machines on the same Chromium.
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { workspace } = require('../engine/lib/workspace');
const { createRenderer, loadLayout, validateProps, SIZES } = require('../engine/render/render');

const WS = workspace();
const LAYOUTS_DIR = path.join(__dirname, '..', 'layouts');
const renderBrand = () => JSON.parse(fs.readFileSync(path.join(WS.brandDir, 'render.json'), 'utf8'));
const GOLDENS = path.join(WS.dir, 'goldens');
const OUT = path.join(__dirname, 'output');
const UPDATE = process.env.UPDATE_GOLDENS === '1';

// A pixel "differs" when any channel moves by more than PIXEL_DELTA.
const PIXEL_DELTA = 40;
const MAX_DIFFERING = 0.005; // share of pixels
const MAX_MEAN_ABS = 1.5; // mean absolute channel difference, 0-255

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

async function compareToGolden(png, name) {
  const golden = path.join(GOLDENS, `${name}.png`);
  if (UPDATE || !fs.existsSync(golden)) {
    fs.mkdirSync(GOLDENS, { recursive: true });
    fs.writeFileSync(golden, png);
    return { ok: true, note: UPDATE ? 'golden updated' : 'golden created' };
  }
  const [a, b] = await Promise.all([png, fs.readFileSync(golden)]
    .map((buf) => sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { ok: false, note: `size ${a.info.width}x${a.info.height} vs golden ${b.info.width}x${b.info.height}` };
  }
  let differing = 0;
  let sumAbs = 0;
  for (let i = 0; i < a.data.length; i += 3) {
    let maxDelta = 0;
    for (let c = 0; c < 3; c += 1) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      sumAbs += d;
      if (d > maxDelta) maxDelta = d;
    }
    if (maxDelta > PIXEL_DELTA) differing += 1;
  }
  const share = differing / (a.data.length / 3);
  const meanAbs = sumAbs / a.data.length;
  return {
    ok: share <= MAX_DIFFERING && meanAbs <= MAX_MEAN_ABS,
    note: `${(share * 100).toFixed(3)}% pixels differ, mean abs ${meanAbs.toFixed(2)}`,
  };
}

function layoutsWithFixtures() {
  const dir = path.join(WS.dir, 'test-props');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: path.basename(f, '.json'), props: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

function checkLayoutContract() {
  console.log('== every layout keeps the layout contract ==');
  const tokens = fs.readFileSync(path.join(WS.brandDir, 'tokens.css'), 'utf8');
  const ids = fs.readdirSync(LAYOUTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
  for (const id of ids) {
    const layout = loadLayout(id);
    check(`${id}: id matches its folder`, layout.id === id, layout.id);
    check(`${id}: has a test-props fixture`, fs.existsSync(path.join(WS.dir, 'test-props', `${id}.json`)));
    const missing = layout.surfaces.filter((s) => !tokens.includes(`.surface-${s}`));
    check(`${id}: every surface is defined by the brand tokens`, missing.length === 0, missing.join(', '));
    const src = fs.readFileSync(path.join(LAYOUTS_DIR, id, 'index.js'), 'utf8');
    const hexes = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    check(`${id}: uses tokens, not hex colors`, hexes.length === 0, hexes.join(', '));
  }
  for (const file of fs.readdirSync(path.join(LAYOUTS_DIR, '_shared'))) {
    const src = fs.readFileSync(path.join(LAYOUTS_DIR, '_shared', file), 'utf8');
    const hexes = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    check(`_shared/${file}: uses tokens, not hex colors`, hexes.length === 0, hexes.join(', '));
  }
}

(async () => {
  checkLayoutContract();
  const renderer = await createRenderer();
  try {
    console.log('== every layout, surface and size renders clean and matches its golden ==');
    for (const { id, props } of layoutsWithFixtures()) {
      const layout = require(path.join('..', 'layouts', id, 'index.js'));
      for (const surface of layout.surfaces) {
        for (const size of Object.keys(SIZES)) {
          const name = `${id}-${surface}-${size}`;
          const r = await renderer.render({ layout: id, surface, size, props, out: path.join(OUT, `${name}.png`) });
          const meta = await sharp(r.png).metadata();
          check(`${name} is ${SIZES[size].width}x${SIZES[size].height}`,
            meta.width === SIZES[size].width && meta.height === SIZES[size].height, `${meta.width}x${meta.height}`);
          check(`${name} has no render issues`, r.issues.length === 0,
            r.issues.map((i) => `${i.rule}: ${i.detail}`).join(' | '));
          const g = await compareToGolden(r.png, name);
          check(`${name} matches golden (${g.note})`, g.ok, g.note);
        }
      }
    }

    console.log('== render QA catches what it exists to catch ==');
    const lone = await renderer.render({
      layout: 'type-card', size: 'ig', props: { headline: 'Unquestionably' },
    });
    check('a one-word headline is flagged (render.singleWordLine)',
      lone.issues.some((i) => i.rule === 'render.singleWordLine'));

    const long = 'Members read the notice and still ask the front desk, because the answer lives somewhere they cannot find on a Saturday morning. ';
    const overflow = await renderer.render({
      layout: 'type-card', size: 'ig', validate: false,
      props: { headline: 'The same question, all season long.', body: long.repeat(20) },
    });
    check('copy that cannot fit is flagged (render.overflow)',
      overflow.issues.some((i) => i.rule === 'render.overflow'));

    let threw = null;
    try {
      await renderer.render({ layout: 'type-card', size: 'ig', props: { headline: 'x'.repeat(71) } });
    } catch (e) { threw = e.message; }
    check('a headline over the layout limit is rejected before rendering', /70/.test(threw || ''), threw || 'did not throw');

    threw = null;
    try {
      await renderer.render({ layout: 'type-card', size: 'ig', props: { headline: 'Fine headline here', cta: 'Book now' } });
    } catch (e) { threw = e.message; }
    check('an unknown prop is rejected', /not a prop/.test(threw || ''), threw || 'did not throw');

    console.log('== prop validation ==');
    const fixture = (id) => JSON.parse(fs.readFileSync(path.join(WS.dir, 'test-props', `${id}.json`), 'utf8'));
    const rejects = (label, id, mutate, pattern) => {
      const props = fixture(id);
      mutate(props);
      const errors = validateProps(loadLayout(id), props);
      check(`rejects ${label}`, errors.some((e) => pattern.test(e)), errors.join('; ') || 'accepted');
    };
    rejects('a list with too few items', 'numbered-list', (p) => { p.items = p.items.slice(0, 2); }, /at least 3/);
    rejects('a list item over its limit', 'numbered-list', (p) => { p.items[0] = 'x'.repeat(49); }, /items\[0\]/);
    rejects('a stat without a source', 'stat-card', (p) => { delete p.source; }, /source is required/);
    rejects('a message from anyone but member or club', 'message-thread',
      (p) => { p.messages[1].from = 'assistant'; }, /from must be one of/);
    rejects('an unknown field on a message', 'message-thread',
      (p) => { p.messages[0].avatar = 'CP'; }, /avatar is not an allowed field/);
    rejects('an escalation continued past the handoff', 'escalation-thread',
      (p) => { p.followUp = 'You are all set for 8:10.'; }, /followUp is not a prop/);
    rejects('a hub channel with an unknown icon', 'communication-hub',
      (p) => { p.channels[0].icon = 'logo'; }, /icon must be one of/);

    console.log('== the escalation thread ends at the handoff ==');
    const esc = fixture('escalation-thread');
    const html = loadLayout('escalation-thread').render({ props: esc, brand: renderBrand(), surface: 'dark' });
    const beats = [...html.matchAll(/class="bubble (member|club)"/g)].map((m) => m[1]);
    check('four beats: member, club, member, club', beats.join(',') === 'member,club,member,club', beats.join(','));
    const lastBubble = html.lastIndexOf('class="bubble ');
    const afterLast = html.slice(lastBubble).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    check('the last bubble is the handoff', afterLast.includes(esc.handoff.split(' ').slice(-3).join(' ')), afterLast.slice(0, 120));
  } finally {
    await renderer.close();
  }

  console.log(failures === 0 ? '\nrender: ALL CHECKS PASS' : `\nrender: ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
