/**
 * client.js
 *
 * Buffer's GraphQL API (https://api.buffer.com, Bearer key), the few calls
 * the engine makes: create a draft, edit it, read posts back with their
 * notes, and the tags that mark the engine's drafts. No SDK; the key comes
 * from the environment variable config.json names (buffer.apiKeyEnv).
 *
 * Buffer answers HTTP 200 for GraphQL errors: system errors arrive in
 * `errors` (UNAUTHORIZED, NOT_FOUND, RATE_LIMIT_EXCEEDED ...), and a
 * mutation's own failure arrives as a MutationError member of its union.
 * Both throw here, with Buffer's message. Rate limits (HTTP 429 or
 * RATE_LIMIT_EXCEEDED) and 5xx are retried with backoff. Limits are per
 * client: 100 requests per 15 minutes, 250 to 500 a day by plan.
 *
 * Verified against the live schema and existing posts (2026-10-01): notes
 * are readable (Post.notes, type userGenerated for a person's note) but
 * the public API has no mutation to write one; an Instagram carousel is a
 * post of type "post" with several image assets.
 */

'use strict';

const ENDPOINT = 'https://api.buffer.com';

const POST_FIELDS = `
  id status dueAt sentAt text externalLink channelId channelService createdAt updatedAt
  tags { id name }
  notes { id text type createdAt author { name email } }
  assets { type source }
  error { message }
`;

const Q = {
  createPost: `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { ${POST_FIELDS} } }
      ... on MutationError { message }
    }
  }`,
  editPost: `mutation EditPost($input: EditPostInput!) {
    editPost(input: $input) {
      ... on PostActionSuccess { post { ${POST_FIELDS} } }
      ... on MutationError { message }
    }
  }`,
  post: `query Post($input: PostInput!) { post(input: $input) { ${POST_FIELDS} } }`,
  posts: `query Posts($input: PostsInput!, $first: Int, $after: String) {
    posts(input: $input, first: $first, after: $after) {
      edges { node { ${POST_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  tags: `query Tags($input: TagsInput!, $after: String) {
    tagsV2(input: $input, first: 100, after: $after) {
      edges { node { id name } }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  createTag: `mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      ... on TagActionSuccess { tag { id name } }
      ... on MutationError { message }
    }
  }`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class BufferError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function createBuffer({ apiKey, apiKeyEnv = 'BUFFER_API_KEY', endpoint = ENDPOINT, fetchImpl = fetch, retries = 4, backoffMs = 2000 } = {}) {
  const key = apiKey || process.env[apiKeyEnv];
  if (!key) throw new Error(`No Buffer API key: set ${apiKeyEnv}`);

  async function gql(query, variables) {
    let last;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (res.status === 429 || res.status >= 500) {
        last = new BufferError(`Buffer returned HTTP ${res.status}`, res.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'UNEXPECTED');
        if (attempt < retries) { await sleep(backoffMs * 2 ** attempt); continue; }
        throw last;
      }
      if (!res.ok) throw new BufferError(`Buffer returned HTTP ${res.status}: ${await res.text()}`, 'HTTP');
      const body = await res.json();
      if (body.errors && body.errors.length) {
        const e = body.errors[0];
        const code = (e.extensions && e.extensions.code) || 'UNEXPECTED';
        last = new BufferError(`Buffer: ${e.message}`, code);
        if (code === 'RATE_LIMIT_EXCEEDED' && attempt < retries) { await sleep(backoffMs * 2 ** attempt); continue; }
        throw last;
      }
      return body.data;
    }
    throw last;
  }

  /** A mutation's union result: the success member, or its error message thrown. */
  function unwrap(result, field, name) {
    if (result && result[field]) return result[field];
    throw new BufferError(`Buffer ${name}: ${(result && result.message) || 'no result'}`, 'MUTATION');
  }

  async function createPost(input) {
    const data = await gql(Q.createPost, { input });
    return unwrap(data.createPost, 'post', 'createPost');
  }

  async function editPost(input) {
    const data = await gql(Q.editPost, { input });
    return unwrap(data.editPost, 'post', 'editPost');
  }

  /** One post, or null when it no longer exists (deleted in Buffer). */
  async function getPost(id) {
    try {
      return (await gql(Q.post, { input: { id } })).post;
    } catch (e) {
      if (e.code === 'NOT_FOUND') return null;
      throw e;
    }
  }

  /** Every post matching the filter, following pages. */
  async function listPosts({ organizationId, tagIds, channelIds, status, createdAfter }) {
    const filter = {};
    if (tagIds && tagIds.length) filter.tags = { in: tagIds, isEmpty: false };
    if (channelIds && channelIds.length) filter.channelIds = channelIds;
    if (status && status.length) filter.status = status;
    if (createdAfter) filter.createdAt = { start: createdAfter };
    const out = [];
    let after = null;
    do {
      const data = await gql(Q.posts, { input: { organizationId, filter }, first: 100, after });
      for (const e of data.posts.edges || []) out.push(e.node);
      after = data.posts.pageInfo.hasNextPage ? data.posts.pageInfo.endCursor : null;
    } while (after);
    return out;
  }

  async function listTags(organizationId) {
    const out = [];
    let after = null;
    do {
      const data = await gql(Q.tags, { input: { organizationId }, after });
      for (const e of data.tagsV2.edges || []) out.push(e.node);
      after = data.tagsV2.pageInfo.hasNextPage ? data.tagsV2.pageInfo.endCursor : null;
    } while (after);
    return out;
  }

  async function createTag(organizationId, name, color) {
    const data = await gql(Q.createTag, { input: { organizationId, tag: { name, color } } });
    return unwrap(data.createTag, 'tag', 'createTag');
  }

  return { name: 'buffer', createPost, editPost, getPost, listPosts, listTags, createTag, gql };
}

/** Tag ids by name, creating the ones the organization lacks. */
async function ensureTags(buffer, organizationId, names, colors = {}) {
  const have = new Map((await buffer.listTags(organizationId)).map((t) => [t.name.toLowerCase(), t.id]));
  const out = {};
  for (const [role, name] of Object.entries(names)) {
    let id = have.get(name.toLowerCase());
    if (!id) {
      id = (await buffer.createTag(organizationId, name, colors[role] || '#6B7280')).id;
      have.set(name.toLowerCase(), id);
    }
    out[role] = id;
  }
  return out;
}

module.exports = { createBuffer, ensureTags, BufferError, QUERIES: Q, ENDPOINT };
