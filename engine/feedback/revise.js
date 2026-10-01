/**
 * revise.js
 *
 * A reviewer's note on a Buffer draft, turned into a new version of the
 * post in the same draft. The reviewer never edits the graphic; the note
 * says what to change, in plain words.
 *
 *   1. read     the model reads the notes against the post and says what
 *               they ask for: new words, a different photo, the other
 *               surface, another layout, a caption rewrite, or nothing it can
 *               make (and why). It also names any preference worth keeping.
 *   2. rewrite  the writer revises the post with the request quoted. The
 *               photo stays unless the note asks for a new one; the caption
 *               stays as it is in Buffer (with the reviewer's own edits)
 *               unless the note asks for a caption change.
 *   3. check    every gate runs on the batch with the revision in place, and
 *               the post renders. Its own failures go back to the writer, as
 *               in a batch run. New batch-level findings (a layout change
 *               that breaks the rotation) do not block the reviewer's
 *               explicit request; they are reported.
 *   4. swap     the new renders are published and replace the draft's images
 *               in place (tagged Revised); the ledger and plan record it.
 *
 * What cannot be made is never guessed at: the draft is tagged "Needs a
 * look", the reason goes to the notifier, and nothing in Buffer changes.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workEntry, findingsByPost, renderFeedback } = require('../generate/batch');
const { writePost } = require('../generate/write');
const { ledgerEntry } = require('../generate/ledger');
const { shellOf } = require('../generate/catalog');
const { photoSummary } = require('../generate/context');
const { checkAll } = require('../gates/check-batch');
const { publishMedia, channelMetadata, renderFiles } = require('../buffer/media');

const pad2 = (n) => String(n).padStart(2, '0');
const channelName = (c) => (String(c).startsWith('linkedin') ? 'LinkedIn' : 'Instagram');
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

/** Layouts a single post may switch to: eligible, single-image, not a thread (threads carry a sender and a depicted exchange the plan set up). */
function switchTargets(catalog) {
  return catalog.filter((c) => c.eligible && c.format !== 'thread' && !('sender' in c.layout.props));
}

/** The caption as it now reads in Buffer, without the engine's CTA line. */
function captionBody(text, post) {
  const t = norm(text);
  const cta = norm(post.cta);
  if (cta && t.endsWith(cta)) return norm(t.slice(0, t.length - cta.length));
  return t;
}

function readSchema({ targets, surfaces, subjects }) {
  const nullableEnum = (values, d) => ({ type: ['string', 'null'], enum: [...values, null], description: d });
  const properties = {
    understood: { type: 'string', description: 'One sentence: what the note asks to change, in plain words.' },
    actionable: { type: 'boolean', description: 'False when the note asks for no change to this post: praise, a question for a person, a scheduling remark.' },
    layout: nullableEnum(targets, 'Another layout, only when the note asks for a different kind of image. Null keeps the layout.'),
    surface: nullableEnum(surfaces, 'The background, only when the note asks for it. Null keeps it.'),
    newPhoto: { type: 'boolean', description: 'True only when the note asks for a different photo.' },
    photoSubject: nullableEnum(subjects, 'With newPhoto, the subject the note asks for. Null keeps the planned subject.'),
    changeCaption: { type: 'boolean', description: 'True only when the note asks to change the caption or the first comment.' },
    cannotDo: { type: ['string', 'null'], description: 'Only when the note asks for something this system cannot make: a custom illustration or design outside the layouts, a generated image, a photo the library does not have, a claim the brand files or the capability boundary forbid, a real club name that is not approved, a thread added or removed, or a single image turned into a carousel or back. One sentence the reviewer would understand. Null otherwise.' },
    lesson: { type: ['string', 'null'], description: 'A preference worth applying to future posts, only when the note clearly states or implies one. One sentence. Null otherwise.' },
  };
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const READ_SYSTEM = (brandName) => `You read a reviewer's notes on one ${brandName} social post draft and decide what to change.

The image is built by the engine from a layout, words, and a photo from the brand's library. The engine can change the words on the image, swap the photo for another library photo, switch the background between the layout's surfaces, switch to another layout from the list, and rewrite the caption and first comment. It cannot draw a custom design, generate an image, use a photo the library does not have, add or remove a message thread, turn a single image into a carousel or back, or say anything the brand files forbid.

Notes are about this post only, unless they state a general preference. Read them generously: "punchier" means shorter and sharper; "wrong vibe on the photo" means a different photo. Return only the JSON the schema asks for.`;

function describePost(post, bufferText, library) {
  const photo = (post.photos || []).map((id) => {
    const p = library.photos.find((x) => x.id === id);
    return p ? `${id} (${p.subject}, ${p.time}, ${(p.tags || []).slice(0, 5).join(', ')})` : id;
  }).join('; ');
  return [
    `id: ${post.id}`,
    `channel: ${channelName(post.channel)}, ${post.dueAt}`,
    `pillar: ${post.pillar}`,
    `layout: ${post.layout}${post.slides ? ` (${post.carouselKind}, ${post.slides.length} slides)` : ''}, surface ${post.renderSurface}`,
    `what the image says: ${post.slides ? post.slides.map((s) => `[slide ${s.index}] ${s.renderedText || [s.headline, s.text].filter(Boolean).join(' ')}`).join(' ') : post.renderedText || [post.headline, post.subhead, post.text].filter(Boolean).join(' ')}`,
    `photo: ${photo || 'none'}`,
    `caption now in Buffer: ${norm(bufferText)}`,
    `first comment: ${post.firstComment || ''}`,
  ].join('\n');
}

/** What changed between two ledger posts, in words a person reads. */
function changes(before, after) {
  const out = [];
  if (before.layout !== after.layout) out.push(`layout (${before.layout} to ${after.layout})`);
  if (before.renderSurface !== after.renderSurface) out.push(`background (${before.renderSurface} to ${after.renderSurface})`);
  const words = (p) => (p.slides ? p.slides.map((s) => [s.headline, s.subhead, s.text].join('|')).join('||') : [p.headline, p.subhead, p.text, JSON.stringify(p.thread)].join('|'));
  if (words(before) !== words(after)) out.push('the words on the image');
  if ((before.photos || []).join() !== (after.photos || []).join()) out.push('photo');
  if (norm(before.caption) !== norm(after.caption)) out.push('caption');
  if (norm(before.firstComment) !== norm(after.firstComment)) out.push('first comment');
  return out;
}

const failureKey = (f) => `${f.id}|${f.rule}|${f.detail}`;

/**
 * ctx: { config, brand, brandDir, brandText, catalog, library, lib, provider,
 *        buffer, host, renderer, plan, ledger, priors, batchNo, stagingDir,
 *        tagIds, reviewerFeedback, now, log }
 * Returns { applied, understood, changed, reason, warnings, lesson, post }.
 */
async function reviseFromNotes(ctx, { post, notes, bufferPost }) {
  const { config, brand, catalog, library, lib, provider, plan, ledger, batchNo } = ctx;
  const index = ledger.posts.indexOf(post);
  const nn = pad2(batchNo);
  const noteText = notes.map((n) => n.text).join('\n\n');
  const isCarouselPost = post.layout === 'carousel';
  const targets = isCarouselPost || post.format === 'thread' ? [] : switchTargets(catalog).map((c) => c.id).filter((id) => id !== post.layout);
  const allSurfaces = [...new Set(catalog.flatMap((c) => c.surfaces))];
  const subjects = [...new Set(library.photos.filter((p) => p.reviewed && !p.restricted).map((p) => p.subject))].sort();

  /* -- 1. read the notes -------------------------------------------- */
  const menu = targets.map((id) => {
    const c = catalog.find((x) => x.id === id);
    return `- ${id} (surfaces: ${c.surfaces.join(', ')}): ${c.description}`;
  }).join('\n');
  const user = [
    ctx.brandText,
    '<draft>', describePost(post, bufferPost.text, library), '</draft>',
    '<options>',
    targets.length ? `Layouts this post can switch to:\n${menu}` : 'This post keeps its layout (carousels and threads cannot switch).',
    `Surfaces of the current layout: ${(post.layout === 'carousel' ? ['dark', 'light', 'photo'] : (catalog.find((c) => c.id === post.layout) || { surfaces: [] }).surfaces).join(', ')}`,
    photoSummary(library, lib, Date.parse(post.dueAt)),
    '</options>',
    '<notes>', ...notes.map((n) => `- ${n.author && n.author.name ? `${n.author.name}: ` : ''}${n.text}`), '</notes>',
  ].join('\n');
  const { data: read } = await provider.generate({
    key: `note-${index}`,
    system: READ_SYSTEM(config.brand || brand.name),
    user,
    schema: readSchema({ targets: targets.length ? targets : ['(none)'], surfaces: allSurfaces, subjects }),
    schemaName: 'note_reading',
  });
  const base = { understood: read.understood, lesson: read.lesson || null, warnings: [], changed: [] };
  const newLayout = read.layout && read.layout !== '(none)' ? read.layout : null;
  if (!read.actionable) return { ...base, applied: false, reason: 'the note asks for no change to this post', noChange: true };
  if (read.cannotDo) return { ...base, applied: false, reason: read.cannotDo };

  /* -- the revised plan entry ---------------------------------------- */
  const planEntry = plan.posts.find((e) => e.id === post.id);
  if (!planEntry) return { ...base, applied: false, reason: `${post.id} is not in the batch plan` };
  const entry = { ...planEntry, layout: post.layout, template: post.layout, renderSurface: post.renderSurface, format: post.format, surface: post.surface };
  if (newLayout && newLayout !== post.layout) {
    const c = targets.includes(newLayout) && catalog.find((x) => x.id === newLayout);
    if (!c) return { ...base, applied: false, reason: `"${newLayout}" is not a layout this post can switch to` };
    Object.assign(entry, { layout: c.id, template: c.id, format: c.format, surface: shellOf(c.format) });
    if (!c.surfaces.includes(entry.renderSurface)) entry.renderSurface = c.surfaces[0];
  }
  if (read.surface && read.surface !== entry.renderSurface) {
    const layoutSurfaces = entry.layout === 'carousel' ? ['dark', 'light', 'photo'] : catalog.find((x) => x.id === entry.layout).surfaces;
    if (!layoutSurfaces.includes(read.surface)) {
      return { ...base, applied: false, reason: `the ${entry.layout} layout has no ${read.surface} background (it has ${layoutSurfaces.join(', ')})` };
    }
    entry.renderSurface = read.surface;
    if (entry.layout === 'carousel') entry.surface = read.surface === 'photo' ? 'photo-full-bleed' : 'dark-type';
  }
  if (read.photoSubject && (read.newPhoto || !entry.photoSubject)) entry.photoSubject = read.photoSubject;
  const byLayout = new Map(catalog.map((c) => [c.id, c]));
  const work = workEntry(entry, index, byLayout, brand);
  if (work.photoProps.length && !entry.photoSubject) {
    return { ...base, applied: false, reason: 'the new layout needs a photo and the note does not say what of' };
  }

  // Keep the photo unless the note asked for another, or the layout changed.
  const keepPhotos = {};
  if (!read.newPhoto && entry.layout === post.layout) {
    if (post.slides && post.photos[0]) keepPhotos.photo = post.photos[0];
    else for (const spec of work.photoProps) if (post.props && post.props[spec.key]) keepPhotos[spec.key] = post.props[spec.key];
  }
  const otherPhotos = ledger.posts.filter((p) => p !== post).flatMap((p) => p.photos || []);
  const usedPhotos = read.newPhoto ? [...otherPhotos, ...(post.photos || [])] : otherPhotos;

  const current = captionBody(bufferPost.text, post);
  const request = [
    `The reviewer's note on this draft: "${noteText}"`,
    `What it asks for: ${read.understood}`,
    entry.layout !== post.layout ? `The post is now a ${entry.layout} (${byLayout.get(entry.layout).description}); fill its props.` : null,
    read.newPhoto ? 'Ask for a different photo that fits the note.' : null,
    read.changeCaption
      ? `Rewrite the caption and first comment as the note asks. The caption currently reads (with any edits the reviewer made): "${current}"`
      : 'The note is about the image: return the caption and first comment unchanged.',
  ].filter(Boolean);

  /* -- 2 + 3. rewrite, check, render ---------------------------------- */
  const rounds = 1 + ((config.maxRevisions && config.maxRevisions.post) ?? 2);
  const baseline = new Set(checkAll({ plan, ledger, priors: ctx.priors, brandDir: ctx.brandDir }).flatMap((g) => g.failures).map(failureKey));
  const size = (config.channels[post.channel] || {}).size || 'ig';
  let feedback = request;
  let previous = post.draft;
  let revised = null;
  let files = null;
  let lastFailures = [];
  let newPlan = null;
  let newLedger = null;
  for (let round = 1; round <= rounds; round += 1) {
    const wr = await writePost({
      provider, entry: work, brand, brandDir: ctx.brandDir, config, lib, library, brandText: ctx.brandText,
      reviewerFeedback: ctx.reviewerFeedback, usedPhotos, feedback, previous, reviewer: round === 1,
      keepPhotos, key: `revise-${index}`, log: ctx.log,
    });
    previous = wr.raw;
    if (wr.failures.length) {
      lastFailures = wr.failures;
      feedback = [...request, ...wr.failures];
      continue;
    }
    const written = { ...wr.post };
    if (!read.changeCaption) {
      written.caption = post.caption;
      written.firstComment = post.firstComment;
    }
    // Render first: the ledger entry records what the render drew.
    const stamp = new Date(ctx.now || Date.now()).toISOString().replace(/[-:.]/g, '').slice(0, 15);
    const dir = path.join(ctx.stagingDir, `rev-${post.id}-${stamp}-${round}`);
    fs.mkdirSync(dir, { recursive: true });
    const renderResults = [];
    const issues = [];
    if (written.slides) {
      for (const sl of written.slides) {
        const r = await ctx.renderer.render({ layout: sl.layout, surface: sl.surface, size, props: sl.props, slide: sl.slide, library, out: path.join(dir, `${post.id}-${pad2(sl.slide.index)}.png`) });
        renderResults.push(r);
        for (const i of r.issues) issues.push({ ...i, detail: `slide ${sl.slide.index} (${sl.layout}): ${i.detail}` });
      }
    } else {
      const r = await ctx.renderer.render({ layout: entry.layout, surface: entry.renderSurface, size, props: written.props, library, out: path.join(dir, `${post.id}.png`) });
      renderResults.push(r);
      issues.push(...r.issues);
    }
    const candidate = ledgerEntry({
      index, entry: work, layout: work.layoutModule, post: written, render: written.slides ? renderResults : renderResults[0],
      size, batchNo, draft: wr.raw,
    });
    candidate.buffer = post.buffer;
    newLedger = { ...ledger, posts: ledger.posts.map((p) => (p === post ? candidate : p)) };
    const planEntryOut = { ...planEntry, layout: entry.layout, template: entry.layout, format: entry.format, surface: entry.surface, renderSurface: entry.renderSurface, ...(entry.photoSubject ? { photoSubject: entry.photoSubject } : {}) };
    newPlan = { ...plan, posts: plan.posts.map((e) => (e.id === post.id ? planEntryOut : e)) };
    const gates = checkAll({ plan: newPlan, ledger: newLedger, priors: ctx.priors, brandDir: ctx.brandDir });
    const own = findingsByPost(gates, [post.id]).get(post.id) || [];
    const failing = [...own, ...(issues.length ? renderFeedback(issues) : [])];
    if (failing.length) {
      lastFailures = failing;
      feedback = [...request, ...failing];
      continue;
    }
    base.warnings = gates.flatMap((g) => g.failures)
      .filter((f) => !String(f.id).startsWith(post.id) && !baseline.has(failureKey(f)))
      .map((f) => `${f.rule}: ${f.detail}`);
    revised = candidate;
    files = renderFiles(candidate, dir);
    break;
  }
  if (!revised) {
    return { ...base, applied: false, reason: `the revision still failed its checks: ${lastFailures.slice(0, 4).join('; ')}` };
  }

  /* -- 4. swap the draft's images ------------------------------------- */
  const { media, published } = await publishMedia({ post: revised, files, host: ctx.host, folder: `batch-${nn}`, config, workDir: path.dirname(files[0]) });
  const tagIds = [ctx.tagIds.engine, ctx.tagIds.revised].filter(Boolean);
  const input = { id: post.buffer.id, assets: media, tagIds };
  if (read.changeCaption) {
    input.text = revised.postText;
    input.metadata = channelMetadata(revised);
  }
  const edited = await ctx.buffer.editPost(input);
  revised.buffer = {
    ...post.buffer,
    text: read.changeCaption ? norm(edited.text || input.text) : post.buffer.text,
    firstComment: read.changeCaption ? revised.firstComment : post.buffer.firstComment,
    media: published,
    tagRoles: ['engine', 'revised'],
  };
  ledger.posts[index] = revised;
  for (const [i, e] of plan.posts.entries()) if (e.id === post.id) plan.posts[i] = newPlan.posts[i];
  return { ...base, applied: true, changed: changes(post, revised), post: revised };
}

module.exports = { reviseFromNotes, captionBody, switchTargets, readSchema, changes, describePost };
