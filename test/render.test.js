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
const { renderCarousel } = require('../engine/render/carousel');
const photoLibrary = require('../engine/photos/library');

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
  // Goldens are lossless WebP: the same pixels as the PNG at about 60% of
  // the size, which matters once photo layouts are in the set.
  const golden = path.join(GOLDENS, `${name}.webp`);
  if (!fs.existsSync(golden) && process.env.CI) {
    return { ok: false, note: `no golden ${path.relative(WS.dir, golden)}; generate it locally and commit it` };
  }
  if (UPDATE || !fs.existsSync(golden)) {
    fs.mkdirSync(GOLDENS, { recursive: true });
    await sharp(png).webp({ lossless: true, effort: 6 }).toFile(golden);
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

// A fixture is a props object, or { slide, props } for a layout that shows
// its position in a carousel.
function readFixture(id) {
  const raw = JSON.parse(fs.readFileSync(path.join(WS.dir, 'test-props', `${id}.json`), 'utf8'));
  const keys = Object.keys(raw).sort().join(',');
  return keys === 'props,slide' ? raw : { props: raw };
}

function layoutsWithFixtures() {
  const dir = path.join(WS.dir, 'test-props');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: path.basename(f, '.json'), ...readFixture(path.basename(f, '.json')) }));
}

// A layout that needs assets the brand does not have yet (a product
// screenshot) must refuse to render until the library holds one.
function unmetRequirement(layout, lib) {
  const tags = (layout.requires && layout.requires.photoTags) || [];
  if (!tags.length) return null;
  const has = lib.photos.some((p) => p.reviewed && !p.restricted && tags.every((t) => (p.tags || []).includes(t)));
  return has ? null : tags.join(', ');
}

// A copy of the library with some entries changed, for renders that need a
// photo in a state the real library does not have.
function libraryWith(changes) {
  const lib = JSON.parse(JSON.stringify(photoLibrary.load()));
  for (const [id, patch] of Object.entries(changes)) Object.assign(lib.photos.find((p) => p.id === id), patch);
  return lib;
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
    const lib = photoLibrary.load();
    for (const { id, props, slide } of layoutsWithFixtures()) {
      const layout = require(path.join('..', 'layouts', id, 'index.js'));
      const unmet = unmetRequirement(layout, lib);
      if (unmet) {
        let threw = null;
        try {
          await renderer.render({ layout: id, size: 'ig', props });
        } catch (e) { threw = e.message; }
        check(`${id} is refused until the library holds a photo tagged ${unmet}`,
          new RegExp(`not tagged ${unmet}`).test(threw || ''), threw || 'rendered');
        // The layout's mechanics still get checked, with the fixture photo
        // standing in for the missing asset. No golden: it is not a real post.
        const stand = libraryWith({ [props.photo]: { tags: [...lib.photos.find((p) => p.id === props.photo).tags, ...unmet.split(', ')] } });
        for (const surface of layout.surfaces) {
          for (const size of Object.keys(SIZES)) {
            const r = await renderer.render({ layout: id, surface, size, props, library: stand, out: path.join(OUT, `${id}-${surface}-${size}.png`) });
            check(`${id}-${surface}-${size} renders clean with a stand-in asset`, r.issues.length === 0,
              r.issues.map((i) => `${i.rule}: ${i.detail}`).join(' | '));
          }
        }
        continue;
      }
      for (const surface of layout.surfaces) {
        for (const size of Object.keys(SIZES)) {
          const name = `${id}-${surface}-${size}`;
          const r = await renderer.render({ layout: id, surface, size, props, slide, out: path.join(OUT, `${name}.png`) });
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

    const refuses = async (label, opts, pattern) => {
      let threw = null;
      try {
        await renderer.render({ size: 'ig', ...opts });
      } catch (e) { threw = e.message; }
      check(`refuses ${label}`, pattern.test(threw || ''), threw || 'rendered');
    };

    // A bottom-aligned box overflows upward, where scrollHeight cannot see it.
    const tall = await renderer.render({
      layout: 'message-thread', size: 'ig', validate: false,
      props: { ...readFixture('message-thread').props, headline: 'One less call to the front desk. '.repeat(4), emphasis: 'And one less member left waiting. '.repeat(2) },
    });
    check('a headline pushed out of the top of its box is flagged (render.overflow)',
      tall.issues.some((i) => i.rule === 'render.overflow'), tall.issues.map((i) => i.rule).join(', ') || 'clean');

    console.log('== photos come only from the reviewed library ==');
    const fb = readFixture('full-bleed-photo').props;
    await refuses('a photo that is not in the library', { layout: 'full-bleed-photo', props: { ...fb, photo: 'not-a-photo' } }, /not in photos\/library\.json/);
    await refuses('a restricted photo', { layout: 'photo-band', props: { ...readFixture('photo-band').props, photo: 'cardmapr-nl-au-tyt7e0lw' } }, /restricted/);
    await refuses('a photo nobody has reviewed',
      { layout: 'full-bleed-photo', props: fb, library: libraryWith({ [fb.photo]: { reviewed: false } }) }, /not been reviewed/);
    await refuses('a photo too small to run full bleed',
      { layout: 'full-bleed-photo', props: { ...fb, photo: 'aleksandr-galichkin-auae3-x-ldu' } }, /too small to run full bleed/);
    await refuses('a stock portrait as the founder',
      { layout: 'founder-portrait', props: { ...readFixture('founder-portrait').props, photo: 'marvin-meyer-bmgdvxn-usq' } }, /not tagged founder/);
    const soft = await renderer.render({
      layout: 'full-bleed-photo', size: 'li', props: { ...fb, photo: 'byron-white-founder' },
      library: libraryWith({ 'byron-white-founder': { fullBleedOk: true } }),
    });
    check('a photo shown larger than its pixels is flagged (render.photoTooSmall)',
      soft.issues.some((i) => i.rule === 'render.photoTooSmall'), soft.issues.map((i) => i.rule).join(', ') || 'clean');
    const used = await renderer.render({ layout: 'photo-band', size: 'ig', props: readFixture('photo-band').props });
    check('a render reports the photos it used', used.photos.join(',') === readFixture('photo-band').props.photo, used.photos.join(','));

    console.log('== the proof bar only says what the registry supports ==');
    const pb = readFixture('proof-bar').props;
    await refuses('a logo missing from the proof registry', { layout: 'proof-bar', props: { ...pb, logos: ['golf-digest', 'forbes'] } }, /not in the brand's proof registry/);
    await refuses('logos that mix relations under one label', { layout: 'proof-bar', props: { ...pb, logos: ['golf-digest', 'pga-show'] } }, /mix relations/);
    const brand = renderBrand();
    brand.proof.logos['test-club'] = { name: 'Test Club', relation: 'trusted', file: { dark: 'assets/proof/golf-digest-on-dark.png' }, height: 80 };
    const trusted = loadLayout('proof-bar').check({ props: { ...pb, logos: ['test-club'] }, brand });
    check('refuses a customer logo without a recorded written approval', trusted.some((e) => /written approval/.test(e)), trusted.join('; ') || 'accepted');

    console.log('== carousels number their slides in order ==');
    const cs = readFixture('carousel-step').props;
    const spec = {
      surface: 'dark',
      slides: [
        { layout: 'type-card', props: readFixture('type-card').props },
        { layout: 'carousel-step', props: cs },
        { layout: 'carousel-step', props: { ...cs, eyebrow: 'Launch day', headline: 'Members ask the way they already ask.' } },
        { layout: 'question-card', props: readFixture('question-card').props },
      ],
    };
    const slides = await renderCarousel(renderer, spec, { size: 'ig', outDir: OUT, name: 'carousel' });
    check('every slide of a four-slide carousel renders clean', slides.every((r) => r.issues.length === 0),
      slides.flatMap((r) => r.issues.map((i) => `${r.slide.index}: ${i.rule}`)).join(', '));
    check('slides keep one surface', slides.every((r) => r.surface === 'dark'), slides.map((r) => r.surface).join(','));
    const stepHtml = loadLayout('carousel-step').render({ props: cs, brand: renderBrand(), surface: 'dark', slide: { index: 3, total: 4 } });
    check('a step shows its position from the carousel, not from copy', /03 \/ 04/.test(stepHtml) && /Swipe/.test(stepHtml));
    const lastHtml = loadLayout('carousel-step').render({ props: cs, brand: renderBrand(), surface: 'dark', slide: { index: 4, total: 4 } });
    check('the last slide has no swipe cue', !/Swipe/.test(lastHtml));
    let one = null;
    try {
      await renderCarousel(renderer, { slides: [spec.slides[0]] }, { size: 'ig' });
    } catch (e) { one = e.message; }
    check('refuses a one-slide carousel', /2 to 10 slides/.test(one || ''), one || 'rendered');

    console.log('== prop validation ==');
    const fixture = (id) => readFixture(id).props;
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
