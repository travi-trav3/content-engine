#!/usr/bin/env node
/**
 * doctor.js
 *
 * The preflight: everything a live run needs, checked in one go, each
 * failure with the fix. Run it after setting up an instance and whenever a
 * scheduled run fails for a reason that is not the content.
 *
 *   node engine/doctor.js                 config, secrets, and a live check of each service
 *   node engine/doctor.js --offline       config and secrets only, no network
 *   node engine/doctor.js --slack-test    also post a test message to the Slack channel
 *
 * Required for a batch to reach Buffer: the model and its key, Buffer (key,
 * organization, every cadence channel connected and unlocked), the public
 * assets repository and its token, a cadence the plan gate accepts, the
 * brand files and the CTA library. Optional, reported as warnings: Slack,
 * the reviewer allowlist, the Drive photo library, the Unsplash scout, and
 * founder posts (the founder's channel, material, the transcription model).
 * Exit 1 when anything required fails.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('./lib/workspace');

const OK = 'ok';
const FAIL = 'fail';
const WARN = 'warn';
const SKIP = 'skip';

const serviceOf = (channel) => (String(channel).startsWith('linkedin') ? 'linkedin' : String(channel).split('_')[0]);

async function preflight({ config, env = process.env, fetchImpl = fetch, live = true, slackTest = false, ws = workspace() }) {
  const checks = [];
  const add = (area, status, detail, fix = null, required = true) => checks.push({ area, status, detail, fix, required });
  const secret = (name) => (name && env[name] ? env[name] : null);

  /* -- model ------------------------------------------------------------ */
  const p = config.provider || {};
  const openaiKey = secret(p.apiKeyEnv || 'OPENAI_API_KEY');
  if (p.name !== 'openai') add('model', WARN, `provider is "${p.name}"; only openai runs live`, 'Set config.json provider.name to "openai".');
  if (!p.model) add('model', FAIL, 'no model in config.json', 'Set config.json provider.model to a model this key can use.');
  if (!openaiKey) add('model', FAIL, `${p.apiKeyEnv || 'OPENAI_API_KEY'} is not set`, 'Add the OpenAI API key (an account with billing) as a repository secret.');
  if (live && openaiKey && p.model) {
    const res = await fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(p.model)}`, { headers: { authorization: `Bearer ${openaiKey}` } }).catch((e) => ({ status: 0, error: e }));
    if (res.status === 200) add('model', OK, `${p.model} is available to this key`);
    else if (res.status === 401) add('model', FAIL, 'OpenAI rejected the key', 'Check the OPENAI_API_KEY secret; create a new key if it was revoked.');
    else if (res.status === 404) add('model', FAIL, `${p.model} is not available to this key`, 'Pick a model the account can use (platform.openai.com, Limits) and set provider.model.');
    else add('model', FAIL, `OpenAI answered ${res.status || res.error.message}`, 'Retry; if it persists, check status.openai.com.');
  }

  /* -- Buffer ----------------------------------------------------------- */
  const b = config.buffer || {};
  const bufferKey = secret(b.apiKeyEnv || 'BUFFER_API_KEY');
  const cadenceChannels = [...new Set(((config.cadence || {}).slots || []).map((s) => s.channel))];
  if (!bufferKey) add('buffer', FAIL, `${b.apiKeyEnv || 'BUFFER_API_KEY'} is not set`, 'Create an API key at publish.buffer.com/settings/api in the account that holds the channels, and add it as a repository secret.');
  if (!b.organizationId) add('buffer', FAIL, 'no buffer.organizationId in config.json', 'Run node engine/buffer/setup.js and copy the organization id.');
  for (const ch of cadenceChannels) {
    if (!(b.channels || {})[ch]) add('buffer', FAIL, `no Buffer channel id for ${ch}, which the cadence posts to`, 'Run node engine/buffer/setup.js and copy the channel id into buffer.channels.');
  }
  for (const [ch, id] of Object.entries(b.channels || {})) {
    if (!id && !cadenceChannels.includes(ch) && !((config.founder || {}).enabled && ch === (config.founder.channel || 'linkedin_byron'))) add('buffer', WARN, `${ch} has no Buffer channel yet (not in the cadence, so nothing is lost)`, null, false);
  }
  if (live && bufferKey && b.organizationId) {
    const { createBuffer } = require('./buffer/client');
    try {
      const buffer = createBuffer({ apiKey: bufferKey, fetchImpl, retries: 0 });
      const data = await buffer.gql(`query($org: OrganizationId!) {
        account { organizations { id name limits { channels } } }
        channels(input: { organizationId: $org }) { id name service type isDisconnected isLocked }
      }`, { org: b.organizationId });
      const org = data.account.organizations.find((o) => o.id === b.organizationId);
      if (!org) add('buffer', FAIL, `organization ${b.organizationId} is not in this key's account`, `The key belongs to an account with ${data.account.organizations.map((o) => `"${o.name}"`).join(', ')}. Use a key from the account that holds Club Pilot's channels, or fix buffer.organizationId.`);
      else add('buffer', OK, `organization "${org.name}"`);
      const byId = new Map(data.channels.map((c) => [c.id, c]));
      for (const [ch, id] of Object.entries(b.channels || {})) {
        if (!id) continue;
        const c = byId.get(id);
        const needed = cadenceChannels.includes(ch);
        if (!c) { add('buffer', needed ? FAIL : WARN, `${ch}: channel ${id} is not in this organization`, 'Run node engine/buffer/setup.js and copy the right id.', needed); continue; }
        if (c.service !== serviceOf(ch)) add('buffer', FAIL, `${ch}: channel "${c.name}" is ${c.service}, not ${serviceOf(ch)}`, 'Swap the channel ids in buffer.channels.', needed);
        else if (c.isDisconnected) add('buffer', needed ? FAIL : WARN, `${ch}: "${c.name}" is disconnected`, `Reconnect it in Buffer (Settings, Channels, ${c.name}, Reconnect).`, needed);
        else if (c.isLocked) add('buffer', needed ? FAIL : WARN, `${ch}: "${c.name}" is locked`, `Buffer locks channels above the plan's limit${org && org.limits ? ` (${org.limits.channels} on this plan, ${data.channels.length} connected)` : ''}: upgrade the plan or disconnect a channel you do not need.`, needed);
        else add('buffer', OK, `${ch}: "${c.name}" connected`);
      }
    } catch (e) {
      add('buffer', FAIL, e.message, e.code === 'UNAUTHORIZED' ? 'The Buffer key was rejected; create a new one.' : 'Retry; check the key and buffer.organizationId.');
    }
  }
  if (!(b.reviewers || []).length) add('buffer', WARN, 'buffer.reviewers is empty: any person\'s note on a draft is acted on', 'Add the reviewer\'s Buffer login email to buffer.reviewers.', false);

  /* -- assets repository ------------------------------------------------ */
  const a = config.assets || {};
  const assetsToken = secret(a.tokenEnv || 'ASSETS_PUSH_TOKEN');
  if (a.host !== 'github') add('assets', WARN, `assets.host is "${a.host}"; only github runs live`, 'Set assets.host to "github".');
  if (!a.repo) add('assets', FAIL, 'no assets.repo in config.json', 'Create a public repository for rendered images and set assets.repo to "owner/name".');
  if (!assetsToken) add('assets', FAIL, `${a.tokenEnv || 'ASSETS_PUSH_TOKEN'} is not set`, 'Create a fine-grained token with Contents read and write on the assets repository only, and add it as a repository secret.');
  if (live && a.repo && assetsToken) {
    const res = await fetchImpl(`https://api.github.com/repos/${a.repo}`, { headers: { authorization: `Bearer ${assetsToken}`, accept: 'application/vnd.github+json', 'user-agent': 'content-engine' } }).catch((e) => ({ status: 0, error: e }));
    if (res.status === 200) {
      const repo = await res.json();
      if (repo.private) add('assets', FAIL, `${a.repo} is private`, 'Buffer fetches images by URL, so the assets repository must be public (it holds rendered posts only).');
      else if (repo.permissions && repo.permissions.push === false) add('assets', FAIL, `the token cannot write to ${a.repo}`, 'Give the token Contents read and write on this repository.');
      else add('assets', OK, `${a.repo} is public${repo.permissions ? ' and writable' : ''}`);
    } else if (res.status === 404 || res.status === 401) {
      add('assets', FAIL, `the token cannot see ${a.repo}`, 'Check the repository name and the token\'s repository access.');
    } else add('assets', FAIL, `GitHub answered ${res.status || res.error.message}`, 'Retry.');
  }

  /* -- notifications ---------------------------------------------------- */
  const slack = secret((config.notify || {}).slackWebhookEnv);
  if (!slack) add('notify', WARN, 'no Slack webhook: messages to the reviewer go to the run log only', 'Create an incoming webhook for the reviewer\'s channel and add it as SLACK_WEBHOOK_URL.', false);
  else if (live && slackTest) {
    const res = await fetchImpl(slack, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Content engine preflight: messages from the engine reach this channel.' }) }).catch((e) => ({ status: 0, error: e }));
    add('notify', res.status === 200 ? OK : WARN, res.status === 200 ? 'test message sent' : `Slack answered ${res.status || res.error.message}`, res.status === 200 ? null : 'Check the webhook URL.', false);
  }

  /* -- cadence ------------------------------------------------------------ */
  const slots = ((config.cadence || {}).slots || []);
  const li = slots.filter((s) => String(s.channel).startsWith('linkedin')).length;
  if (!slots.length) add('cadence', FAIL, 'config.json cadence has no slots', 'Add the posting slots.');
  else if (li * 2 < slots.length) add('cadence', FAIL, `LinkedIn has ${li} of ${slots.length} slots; the plan gate requires at least half`, 'Change the cadence, or change the rule with a regression case (AGENTS.md rule 1).');
  else add('cadence', OK, `${slots.length} slots per ${(config.cadence.batchDays || 14)} days, ${li} on LinkedIn`);
  for (const ch of cadenceChannels) if (!(config.channels || {})[ch]) add('cadence', FAIL, `${ch} is in the cadence but not in config.json channels`, 'Add it with its size (ig or li).');

  /* -- brand files, CTA library, photos, briefs ------------------------- */
  const { BRAND_FILES } = require('./generate/context');
  const missing = BRAND_FILES.filter((f) => !fs.existsSync(path.join(ws.brandDir, f)));
  if (missing.length) add('brand', FAIL, `missing brand files: ${missing.join(', ')}`, 'Restore them from the core or write them.');
  else add('brand', OK, `${BRAND_FILES.length} brand files`);
  const { validateLibrary } = require('./generate/cta');
  const ctaErrors = validateLibrary(config);
  if (ctaErrors.length) add('brand', FAIL, `CTA library: ${ctaErrors.join('; ')}`, 'Fix cta.variants and cta.endCards in config.json.');
  const photoLib = require('./photos/library');
  const lib = photoLib.load(path.join(ws.dir, 'photos', 'library.json'));
  const inRotation = photoLib.select(lib, { days: 0 }).length;
  add('photos', inRotation >= 30 ? OK : WARN, `${inRotation} photos in rotation`, inRotation >= 30 ? null : 'Add photos (Drive Inbox) or review the unreviewed ones; photo posts repeat when the library is thin.', false);
  const briefsDir = path.join(ws.dir, 'briefs');
  if (fs.existsSync(briefsDir)) {
    const { loadBriefs } = require('./generate/brief');
    const { briefs, unread } = await loadBriefs({ dir: briefsDir });
    if (unread.length) add('briefs', WARN, `not read yet: ${unread.join(', ')}`, 'Run node engine/generate/brief.js (needs the OpenAI key).', false);
    else if (briefs.length) add('briefs', OK, `${briefs.length} brief${briefs.length === 1 ? '' : 's'} read: ${briefs.map((x) => x.source).join(', ')}`, null, false);
  }

  /* -- Drive and the scout (optional) ----------------------------------- */
  const d = config.drive || {};
  const google = secret(d.credentialsEnv || 'GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!d.rootFolderId || !google) {
    add('drive', WARN, `the Drive photo library is not set up (${[!d.rootFolderId && 'drive.rootFolderId', !google && (d.credentialsEnv || 'GOOGLE_SERVICE_ACCOUNT_JSON')].filter(Boolean).join(', ')} missing)`, 'engine/photos/README.md, "The Drive library": a service account, its key as a secret, the folder shared with it.', false);
  } else if (live) {
    try {
      const creds = JSON.parse(google);
      const { createDrive } = require('./drive/client');
      const folders = await createDrive({ credentials: creds, fetchImpl, retries: 0 }).listFolder(d.rootFolderId, { foldersOnly: true });
      add('drive', OK, `the photo folder is shared with the service account (${folders.length} subfolders)`, null, false);
    } catch (e) {
      let email = '';
      try { email = JSON.parse(google).client_email; } catch { /* not JSON */ }
      add('drive', FAIL, `cannot read the photo folder: ${e.message.slice(0, 120)}`, `Share the folder with ${email || 'the service account'} as an editor, and check drive.rootFolderId (the last part of the folder's URL).`, false);
    }
  }
  const unsplashKey = secret((config.scout || {}).accessKeyEnv || 'UNSPLASH_ACCESS_KEY');
  if (!unsplashKey) add('scout', WARN, 'no Unsplash key: the weekly scout will not run', 'Create an Unsplash developer app and add its access key as UNSPLASH_ACCESS_KEY.', false);
  else if (live) {
    const res = await fetchImpl('https://api.unsplash.com/search/photos?query=golf&per_page=1', { headers: { authorization: `Client-ID ${unsplashKey}` } }).catch((e) => ({ status: 0, error: e }));
    add('scout', res.status === 200 ? OK : FAIL, res.status === 200 ? 'Unsplash key works' : `Unsplash answered ${res.status || res.error.message}`, res.status === 200 ? null : 'Check the access key.', false);
  }

  /* -- founder posts (optional) ----------------------------------------- */
  const f = config.founder || {};
  if (f.enabled) {
    const ch = f.channel || 'linkedin_byron';
    if (!(b.channels || {})[ch]) add('founder', WARN, `founder posts are on, but ${ch} has no Buffer channel: they are written and wait, undrafted`, `Connect the founder's LinkedIn in Buffer and put its id in buffer.channels.${ch}.`, false);
    if (!(f.slots || []).length) add('founder', WARN, 'founder posts are on, with no founder.slots', 'Add the founder\'s posting days and times to config.json founder.slots.', false);
    if (!(f.names || []).length) add('founder', WARN, 'founder.names is empty: no turn in a call transcript can be recognized as the founder\'s', 'List the names the founder appears under in transcripts.', false);
    const sourcesDir = path.join(ws.dir, 'sources');
    const files = fs.existsSync(sourcesDir) ? fs.readdirSync(sourcesDir).filter((x) => !x.startsWith('.') && !x.endsWith('.json') && !/^readme/i.test(x)) : [];
    if (files.length) add('founder', OK, `${files.length} source file${files.length === 1 ? '' : 's'} in the founder's own words`, null, false);
    else add('founder', WARN, 'no material from the founder yet: each founder slot will ask for it with questions', 'A voice memo in the Drive folder Sources, or a note in sources/, gives the founder posts their words.', false);
    const tm = f.transcribeModel || 'gpt-4o-transcribe';
    if (live && openaiKey) {
      const res = await fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(tm)}`, { headers: { authorization: `Bearer ${openaiKey}` } }).catch((e) => ({ status: 0, error: e }));
      if (res.status === 200) add('founder', OK, `${tm} (voice memos) is available to this key`, null, false);
      else add('founder', WARN, `${tm} is not available to this key (${res.status || res.error.message}): voice memos cannot be transcribed`, 'Set config.json founder.transcribeModel to a transcription model the account can use; documents still work.', false);
    }
  }

  const ready = !checks.some((c) => c.required && c.status === FAIL);
  return { checks, ready };
}

function format({ checks, ready }) {
  const mark = { ok: 'ok  ', fail: 'FAIL', warn: 'warn', skip: 'skip' };
  const lines = checks.map((c) => `${mark[c.status]}  ${c.area.padEnd(8)} ${c.detail}${c.fix && c.status !== OK ? `\n${' '.repeat(15)}fix: ${c.fix}` : ''}`);
  lines.push('', ready ? 'Ready: a batch can reach Buffer.' : `Not ready: ${checks.filter((c) => c.required && c.status === FAIL).length} required check(s) failed.`);
  return lines.join('\n');
}

module.exports = { preflight, format, OK, FAIL, WARN, SKIP };

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    const ws = workspace();
    const config = JSON.parse(fs.readFileSync(path.join(ws.dir, 'config.json'), 'utf8'));
    const r = await preflight({ config, live: !argv.includes('--offline'), slackTest: argv.includes('--slack-test'), ws });
    console.log(format(r));
    process.exit(r.ready ? 0 : 1);
  })().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
}
