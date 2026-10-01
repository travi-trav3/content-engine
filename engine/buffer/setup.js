#!/usr/bin/env node
/**
 * setup.js
 *
 * Prints the Buffer organization and channel ids for config.json, from the
 * account the API key belongs to. Read-only.
 *
 *   BUFFER_API_KEY=... node engine/buffer/setup.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { workspace } = require('../lib/workspace');
const { createBuffer } = require('./client');

const Q = {
  account: 'query { account { email organizations { id name } } }',
  channels: `query Channels($input: ChannelsInput!) {
    channels(input: $input) { id name displayName service type isDisconnected isLocked }
  }`,
};

(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(workspace().dir, 'config.json'), 'utf8'));
  const buffer = createBuffer({ apiKeyEnv: (config.buffer && config.buffer.apiKeyEnv) || 'BUFFER_API_KEY' });
  const { account } = await buffer.gql(Q.account, {});
  console.log(`Buffer account: ${account.email}`);
  for (const org of account.organizations) {
    console.log(`\norganization "${org.name}": ${org.id}`);
    const { channels } = await buffer.gql(Q.channels, { input: { organizationId: org.id } });
    for (const c of channels) {
      const flags = [c.isDisconnected && 'DISCONNECTED', c.isLocked && 'LOCKED'].filter(Boolean).join(', ');
      console.log(`  ${c.service.padEnd(10)} ${c.type.padEnd(8)} ${(c.displayName || c.name).padEnd(32)} ${c.id}${flags ? `  (${flags})` : ''}`);
    }
  }
  console.log('\nPut the organization id in config.json buffer.organizationId and each channel id under buffer.channels.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
