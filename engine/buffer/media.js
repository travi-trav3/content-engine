/**
 * media.js
 *
 * A ledger post as Buffer receives it: its renders published to the assets
 * host, and the draft input that points at them. Shared by push (a new
 * batch) and sync (a revision swapped into an existing draft).
 *
 *   single image      one image asset with the writer's alt text
 *   Instagram carousel one image asset per slide (Buffer stores it as a post
 *                     of type "post" with several images)
 *   LinkedIn carousel  one PDF document, a page per slide, so it swipes;
 *                     buffer.linkedinCarousel "images" sends the slides as
 *                     images instead (LinkedIn shows those as a grid)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { slidesToPdf } = require('../render/pdf');

const pad2 = (n) => String(n).padStart(2, '0');
const isLinkedIn = (channel) => String(channel).startsWith('linkedin');

/** The render files a post needs, in order. */
function renderFiles(post, dir) {
  return post.slides
    ? post.slides.map((sl) => path.join(dir, `${post.id}-${pad2(sl.index)}.png`))
    : [path.join(dir, `${post.id}.png`)];
}

/**
 * Renders whatever is missing from dir, from the props the ledger recorded.
 * The renderer is deterministic for a given Chromium build and font set, so
 * the bytes should match the ledger's fingerprint; a mismatch is returned as
 * a warning (the pixels may differ from the contact sheet), never hidden.
 */
async function ensureRenders({ post, dir, renderer, library, size }) {
  const files = renderFiles(post, dir);
  const warnings = [];
  const jobs = post.slides
    ? post.slides.map((sl, i) => ({ file: files[i], layout: sl.layout, surface: sl.surface, props: sl.props, sha: sl.render && sl.render.sha256, stored: sl }))
    : [{ file: files[0], layout: post.layout, surface: post.renderSurface, props: post.props, sha: post.render && post.render.sha256 }];
  fs.mkdirSync(dir, { recursive: true });
  for (const j of jobs) {
    if (fs.existsSync(j.file)) continue;
    if (!renderer) throw new Error(`${j.file} is missing and no renderer was given`);
    const slide = j.stored ? slideContext(post, j.stored) : undefined;
    const r = await renderer.render({ layout: j.layout, surface: j.surface, size, props: j.props, slide, library, out: j.file });
    if (r.issues.length) throw new Error(`${post.id}: re-render of ${path.basename(j.file)} has issues: ${r.issues.map((i) => i.rule).join(', ')}`);
    if (j.sha && r.sha256 !== j.sha) warnings.push(`${path.basename(j.file)} re-rendered with different bytes than the batch run`);
  }
  return { files, warnings };
}

/** The slide context the carousel layouts read, rebuilt from a ledger slide. */
function slideContext(post, sl) {
  const steps = post.slides.filter((s) => s.layout === 'carousel-step');
  const step = sl.layout === 'carousel-step' ? steps.indexOf(sl) + 1 : undefined;
  return { index: sl.index, total: post.slides.length, step, numbered: post.carouselKind !== 'reveal-flip' };
}

/**
 * Publishes a post's renders and returns Buffer's asset inputs plus what was
 * published (for the ledger). key: the folder in the assets repository.
 */
async function publishMedia({ post, files, host, folder, config = {}, workDir }) {
  const published = [];
  for (const [i, file] of files.entries()) {
    const r = await host.publish(file, `${folder}/${path.basename(file)}`);
    published.push({ kind: 'image', file: path.basename(file), url: r.url, sha256: r.sha256, altText: altTextOf(post, i) });
  }
  const asDocument = post.slides && isLinkedIn(post.channel) && ((config.buffer || {}).linkedinCarousel || 'document') === 'document';
  if (!asDocument) {
    return {
      media: published.map((p) => ({ image: { url: p.url, metadata: { altText: p.altText } } })),
      published,
    };
  }
  const pdf = path.join(workDir || path.dirname(files[0]), `${post.id}.pdf`);
  await slidesToPdf(files, { out: pdf, title: documentTitle(post) });
  const r = await host.publish(pdf, `${folder}/${post.id}.pdf`);
  published.push({ kind: 'document', file: path.basename(pdf), url: r.url, sha256: r.sha256 });
  return {
    media: [{ document: { url: r.url, title: documentTitle(post), thumbnailUrl: published[0].url } }],
    published,
  };
}

function altTextOf(post, i) {
  const a = (post.assets || [])[i];
  return (a && a.altText) || post.altText || '';
}

/** A LinkedIn document's title: the cover's headline, kept short. */
function documentTitle(post) {
  const t = String(post.headline || post.message || post.id).replace(/\s+/g, ' ').trim();
  return t.length > 100 ? `${t.slice(0, 97).replace(/\s+\S*$/, '')}...` : t;
}

/** The metadata Buffer needs for the channel: post type and the first comment. */
function channelMetadata(post) {
  const first = post.firstComment ? { firstComment: post.firstComment } : {};
  if (isLinkedIn(post.channel)) return { linkedin: { ...first } };
  return { instagram: { type: 'post', shouldShareToFeed: true, ...first } };
}

/** A new draft in Buffer for a ledger post. */
function draftInput(post, { channelId, media, tagIds }) {
  return {
    channelId,
    text: post.postText || post.caption,
    assets: media,
    metadata: channelMetadata(post),
    mode: 'customScheduled',
    dueAt: new Date(post.dueAt).toISOString(),
    saveToDraft: true,
    schedulingType: 'automatic',
    tagIds,
    source: 'content-engine',
  };
}

module.exports = { renderFiles, ensureRenders, publishMedia, draftInput, channelMetadata, documentTitle, slideContext };
