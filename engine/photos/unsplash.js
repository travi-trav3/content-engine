/**
 * unsplash.js
 *
 * Unsplash for the weekly photo scout: search, and download a photo at the
 * library's size. Every download is reported to Unsplash (the photo's
 * download_location), as its API terms require. Unsplash+ (premium)
 * photos are never returned: they are not under the free Unsplash License.
 * The access key comes from the environment variable config.json names
 * (scout.accessKeyEnv, UNSPLASH_ACCESS_KEY).
 */

'use strict';

const API = 'https://api.unsplash.com';

const isPremium = (p) => Boolean(p.premium || p.plus || /plus\.unsplash\.com/.test((p.urls && p.urls.raw) || ''));

function createUnsplash({ accessKey, accessKeyEnv = 'UNSPLASH_ACCESS_KEY', fetchImpl = fetch } = {}) {
  const key = accessKey || process.env[accessKeyEnv];
  if (!key) throw new Error(`No Unsplash access key: set ${accessKeyEnv}`);
  const headers = { authorization: `Client-ID ${key}`, 'accept-version': 'v1' };

  async function getJson(url) {
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`Unsplash ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return res.json();
  }

  async function search(query, { orientation = 'portrait', perPage = 20 } = {}) {
    const json = await getJson(`${API}/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}&content_filter=high`);
    return (json.results || []).filter((p) => !isPremium(p));
  }

  /** The photo at `width` pixels wide, as JPEG bytes; the download is reported to Unsplash. */
  async function download(photo, { width = 2400 } = {}) {
    const res = await fetchImpl(`${photo.urls.raw}${photo.urls.raw.includes('?') ? '&' : '?'}w=${width}&fit=max&q=85&fm=jpg`);
    if (!res.ok) throw new Error(`Unsplash image ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (photo.links && photo.links.download_location) await getJson(photo.links.download_location);
    return buf;
  }

  return { name: 'unsplash', search, download };
}

/** An in-memory Unsplash: results by query, image bytes by id, downloads recorded. */
function createMockUnsplash({ results = {}, images = {} } = {}) {
  const calls = [];
  return {
    name: 'mock',
    calls,
    async search(query) {
      calls.push({ op: 'search', query });
      return (results[query] || []).filter((p) => !isPremium(p));
    },
    async download(photo) {
      calls.push({ op: 'download', id: photo.id });
      return Buffer.from(images[photo.id]);
    },
  };
}

module.exports = { createUnsplash, createMockUnsplash, isPremium };
