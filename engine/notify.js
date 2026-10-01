/**
 * notify.js
 *
 * Plain-text messages to the people running the engine: a batch landed in
 * Buffer, a note was applied, a note could not be applied and why, a
 * caption edit trips a check. Slack incoming webhook when config.json
 * notify.slackWebhookEnv names a set variable; otherwise the console.
 */

'use strict';

function createNotifier(config = {}, { fetchImpl = fetch, log = console.log, mock = false } = {}) {
  const sent = [];
  if (mock) {
    return { name: 'mock', sent, async send(text) { sent.push(text); } };
  }
  const env = config.notify && config.notify.slackWebhookEnv;
  const url = env && process.env[env];
  if (!url) {
    return { name: 'console', sent, async send(text) { sent.push(text); log(`[notify] ${text}`); } };
  }
  return {
    name: 'slack',
    sent,
    async send(text) {
      sent.push(text);
      const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      // A failed notification never fails the run; the ledger and the log hold the record.
      if (!res.ok) log(`[notify] Slack returned ${res.status}; message was: ${text}`);
    },
  };
}

module.exports = { createNotifier };
