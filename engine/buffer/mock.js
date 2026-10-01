/**
 * mock.js
 *
 * An in-memory Buffer with the client's methods, for tests and dry runs
 * before Byron's account exists. It also plays the reviewer: note(), edit(),
 * schedule(), remove() and publish() do what a person does in Buffer's UI,
 * so the feedback loop can be tested end to end.
 */

'use strict';

function createMockBuffer({ channels = {} } = {}) {
  const posts = new Map();
  const tags = [];
  const calls = [];
  let seq = 0;
  const id = () => (seq += 1).toString(16).padStart(24, '0');
  const now = () => new Date(Date.UTC(2026, 9, 1, 16, 0, seq)).toISOString();
  const channelService = (cid) => (Object.entries(channels).find(([, v]) => v === cid) || [''])[0].startsWith('linkedin') ? 'linkedin' : 'instagram';
  const copy = (p) => JSON.parse(JSON.stringify(p));
  const tagObjs = (ids) => (ids || []).map((t) => tags.find((x) => x.id === t)).filter(Boolean);
  const assetsOf = (input) => (input || []).map((a) => (a.image
    ? { type: 'image', source: a.image.url, altText: (a.image.metadata || {}).altText || '' }
    : a.document ? { type: 'document', source: a.document.url, title: a.document.title } : { type: 'video', source: a.video.url }));

  async function createPost(input) {
    calls.push({ op: 'createPost', input: copy(input) });
    if (!Object.values(channels).includes(input.channelId)) throw new Error(`Buffer createPost: unknown channel ${input.channelId}`);
    if (!input.text) throw new Error('Buffer createPost: Text is required');
    const p = {
      id: id(),
      status: input.saveToDraft ? 'draft' : 'scheduled',
      dueAt: input.dueAt || null,
      sentAt: null,
      text: input.text,
      externalLink: null,
      channelId: input.channelId,
      channelService: channelService(input.channelId),
      createdAt: now(),
      updatedAt: now(),
      tags: tagObjs(input.tagIds),
      notes: [],
      assets: assetsOf(input.assets),
      metadata: copy(input.metadata || {}),
      error: null,
    };
    posts.set(p.id, p);
    return copy(p);
  }

  async function editPost(input) {
    calls.push({ op: 'editPost', input: copy(input) });
    const p = posts.get(input.id);
    if (!p) throw new Error('Buffer editPost: Post not found');
    if (input.text !== undefined) p.text = input.text;
    if (input.assets) p.assets = assetsOf(input.assets);
    if (input.tagIds) p.tags = tagObjs(input.tagIds);
    if (input.metadata) p.metadata = copy(input.metadata);
    p.updatedAt = now();
    return copy(p);
  }

  async function getPost(pid) {
    calls.push({ op: 'getPost', id: pid });
    return posts.has(pid) ? copy(posts.get(pid)) : null;
  }

  async function listPosts({ tagIds, channelIds, status } = {}) {
    calls.push({ op: 'listPosts' });
    return [...posts.values()]
      .filter((p) => !tagIds || !tagIds.length || p.tags.some((t) => tagIds.includes(t.id)))
      .filter((p) => !channelIds || !channelIds.length || channelIds.includes(p.channelId))
      .filter((p) => !status || !status.length || status.includes(p.status))
      .map(copy);
  }

  async function listTags() { calls.push({ op: 'listTags' }); return tags.map(copy); }

  async function createTag(organizationId, name, color) {
    calls.push({ op: 'createTag', name });
    const t = { id: id(), name, color };
    tags.push(t);
    return copy(t);
  }

  /* -- the reviewer ---------------------------------------------------- */
  const reviewer = { name: 'Byron White', email: 'byron@clubpilot.test' };
  const human = {
    note(pid, text, author = reviewer) {
      const p = posts.get(pid);
      const n = { id: id(), text, type: 'userGenerated', createdAt: now(), author };
      p.notes.push(n);
      return n;
    },
    edit(pid, text) { posts.get(pid).text = text; },
    schedule(pid) { posts.get(pid).status = 'scheduled'; },
    remove(pid) { posts.delete(pid); },
    publish(pid) {
      const p = posts.get(pid);
      p.status = 'sent';
      p.sentAt = now();
      p.externalLink = `https://social.test/${pid}`;
    },
  };

  return { name: 'mock', createPost, editPost, getPost, listPosts, listTags, createTag, calls, posts, human };
}

module.exports = { createMockBuffer };
