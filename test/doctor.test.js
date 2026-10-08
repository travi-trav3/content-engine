/**
 * doctor.test.js
 *
 * The preflight against stubbed services: a fully set-up instance passes;
 * the state of the Club Pilot accounts on Oct 5 (Instagram disconnected,
 * the founder's LinkedIn locked on a plan with too few channels), a private
 * assets repository, a model the key cannot use and a rejected key each
 * fail with the fix; missing optional services only warn.
 *
 *   node test/doctor.test.js
 */

'use strict';

process.env.CE_WORKSPACE = 'brands/clubpilot';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { workspace } = require('../engine/lib/workspace');
const { preflight, format } = require('../engine/doctor');

const WS = workspace();
const base = JSON.parse(fs.readFileSync(path.join(WS.dir, 'config.json'), 'utf8'));
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};

const IDS = { org: 'o00000000000000000000001', ig: 'c0000000000000000000000a', li: 'c0000000000000000000000b', byron: 'c0000000000000000000000c' };
const config = {
  ...base,
  buffer: { ...base.buffer, organizationId: IDS.org, channels: { instagram: IDS.ig, linkedin_page: IDS.li, linkedin_byron: IDS.byron }, reviewers: ['byron@clubpilot.test'] },
  assets: { ...base.assets, repo: 'clubpilot/social-assets' },
  drive: { ...base.drive, rootFolderId: 'root123' },
};
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  OPENAI_API_KEY: 'sk-test', BUFFER_API_KEY: 'buf', ASSETS_PUSH_TOKEN: 'ghp', SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x', UNSPLASH_ACCESS_KEY: 'un',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'engine@cp.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
};

/** Stubbed services; `state` sets how each answers. */
function services(state) {
  const calls = [];
  const reply = (status, json) => ({ status, ok: status < 300, json: async () => json, text: async () => JSON.stringify(json) });
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith('https://api.openai.com/v1/models/')) return reply(state.model || 200, {});
    if (url === 'https://api.buffer.com') {
      if (state.bufferUnauthorized) return reply(200, { errors: [{ message: 'Not authorized', extensions: { code: 'UNAUTHORIZED' } }] });
      return reply(200, { data: {
        account: { organizations: [{ id: IDS.org, name: 'Club Pilot', limits: { channels: state.limit || 4 } }] },
        channels: [
          { id: IDS.ig, name: 'club.pilot.app', service: 'instagram', type: 'business', isDisconnected: Boolean(state.igDisconnected), isLocked: false },
          { id: IDS.li, name: 'club-pilot', service: 'linkedin', type: 'page', isDisconnected: false, isLocked: false },
          { id: IDS.byron, name: 'byronwhite', service: 'linkedin', type: 'profile', isDisconnected: false, isLocked: Boolean(state.byronLocked) },
          ...(state.extraChannels || []),
        ],
      } });
    }
    if (url.startsWith('https://api.github.com/repos/')) return reply(200, { private: Boolean(state.privateRepo), permissions: { push: true } });
    if (url.startsWith('https://hooks.slack.test')) return reply(200, {});
    if (url.startsWith('https://oauth2.googleapis.com/token')) return reply(state.driveDenied ? 400 : 200, state.driveDenied ? { error: 'invalid_grant' } : { access_token: 't', expires_in: 3600 });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files')) return reply(200, { files: [{ id: 'f1', name: 'Inbox' }, { id: 'f2', name: 'Active' }] });
    if (url.startsWith('https://api.unsplash.com/')) return reply(200, { results: [] });
    return reply(404, {});
  };
  fn.calls = calls;
  return fn;
}
const rules = (r, status) => r.checks.filter((c) => c.status === status);
const has = (r, status, re) => r.checks.some((c) => c.status === status && re.test(`${c.detail} ${c.fix || ''}`));

(async () => {
  console.log('== a fully set-up instance ==');
  const good = await preflight({ config, env, fetchImpl: services({}), slackTest: true, ws: WS });
  check('passes, every service reached', good.ready && rules(good, 'fail').length === 0, format(good));
  check('and says which model, organization and channels it found', has(good, 'ok', /gpt-5 is available/) && has(good, 'ok', /organization "Club Pilot"/)
    && has(good, 'ok', /instagram: "club\.pilot\.app" connected/) && has(good, 'ok', /linkedin_page: "club-pilot" connected/));
  check('Drive, Unsplash and Slack are checked too', has(good, 'ok', /shared with the service account/) && has(good, 'ok', /Unsplash key works/) && has(good, 'ok', /test message sent/));

  console.log('== the Club Pilot accounts as they stood on Oct 5 ==');
  const today = await preflight({ config, env, fetchImpl: services({ igDisconnected: true, byronLocked: true, extraChannels: [{ id: 'x', name: 'ieatzhealthy', service: 'pinterest', isDisconnected: false, isLocked: false }, { id: 'y', name: 'ieatzhealthy', service: 'instagram', isDisconnected: false, isLocked: false }] }), ws: WS });
  check('not ready: Instagram is disconnected, with how to reconnect', !today.ready && has(today, 'fail', /instagram: "club\.pilot\.app" is disconnected.*Reconnect it in Buffer/));
  check('the locked founder profile warns (not in the cadence yet), with the plan limit named', has(today, 'warn', /linkedin_byron: "byronwhite" is locked.*4 on this plan, 5 connected/));

  console.log('== other ways setup goes wrong ==');
  const repo = await preflight({ config, env, fetchImpl: services({ privateRepo: true }), ws: WS });
  check('a private assets repository fails: Buffer cannot fetch from it', !repo.ready && has(repo, 'fail', /is private.*must be public/));
  const model = await preflight({ config, env, fetchImpl: services({ model: 404 }), ws: WS });
  check('a model the key cannot use fails, naming the model', !model.ready && has(model, 'fail', /gpt-5 is not available to this key/));
  const key = await preflight({ config, env, fetchImpl: services({ bufferUnauthorized: true }), ws: WS });
  check('a rejected Buffer key fails', !key.ready && has(key, 'fail', /Not authorized.*rejected/));
  const drive = await preflight({ config, env, fetchImpl: services({ driveDenied: true }), ws: WS });
  check('a Drive folder the service account cannot read fails as optional, naming the email to share with',
    drive.ready && has(drive, 'fail', /Share the folder with engine@cp\.iam\.gserviceaccount\.com/));
  const lopsided = { ...config, cadence: { ...config.cadence, slots: config.cadence.slots.map((s) => ({ ...s, channel: 'instagram' })) } };
  const cad = await preflight({ config: lopsided, env, fetchImpl: services({}), ws: WS });
  check('a cadence the plan gate would refuse fails before any batch is planned', !cad.ready && has(cad, 'fail', new RegExp(`LinkedIn has 0 of ${config.cadence.slots.length} slots`)));

  console.log('== offline, nothing set ==');
  const offlineFetch = services({});
  const bare = await preflight({ config: base, env: {}, live: false, fetchImpl: offlineFetch, ws: WS });
  check('every missing secret and id is listed, with the fix', !bare.ready
    && ['OPENAI_API_KEY', 'BUFFER_API_KEY', 'buffer.organizationId', 'assets.repo', 'ASSETS_PUSH_TOKEN'].every((s) => has(bare, 'fail', new RegExp(s.replace('.', '\\.')))));
  check('the optional services only warn', ['notify', 'drive', 'scout', 'founder'].every((a) => bare.checks.filter((c) => c.area === a).every((c) => c.status === 'warn' && !c.required)));
  check('founder posts with no channel and no material warn, and say what each needs',
    has(bare, 'warn', /linkedin_byron has no Buffer channel: they are written and wait/) && has(bare, 'warn', /no material from the founder yet/));
  check('and nothing touched the network', offlineFetch.calls.length === 0, String(offlineFetch.calls.length));
  const keysOnly = services({});
  await preflight({ config, env, live: false, fetchImpl: keysOnly, ws: WS });
  check('even with every key set, --offline makes no call', keysOnly.calls.length === 0, String(keysOnly.calls.length));

  console.log(failures ? `\ndoctor: ${failures} CHECK(S) FAILED` : '\ndoctor: ALL CHECKS PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
