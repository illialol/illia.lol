import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server.js';
import { serializePresence, unavailable } from '../presence.js';
import { startDiscordPresence } from '../discord-bot.js';

const userId = '937272367980359710';
const guildId = '123456789012345678';
function makeMember(status = 'online') {
  return {
    id: userId,
    user: { id: userId, username: 'illiaa.m', globalName: 'illia.mn', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
    presence: { status, activities: [{ type: 4, state: 'Working', emoji: { name: '☕' } }, { type: 2, name: 'Spotify', details: 'Song', state: 'Artist' }] },
    // Fields below must never leak into the public response.
    guild: { id: guildId, name: 'Private server' },
    roles: { private: true },
  };
}

test('presence exposes display data and clears activity when offline', () => {
  const data = serializePresence(makeMember());
  assert.equal(data.status, 'online');
  assert.equal(data.customStatus, '☕ Working');
  assert.equal(data.activities[0].name, 'Spotify');
  assert.equal(data.user.displayName, 'illia.mn');
  assert.ok(!JSON.stringify(data).includes(guildId));
  for (const status of ['offline', 'invisible']) {
    const offline = serializePresence(makeMember(status));
    assert.equal(offline.status, 'offline');
    assert.equal(offline.customStatus, null);
    assert.deepEqual(offline.activities, []);
  }
  assert.equal(unavailable().status, null);
});

test('presence includes enabled primary guild tag and custom emoji without exposing server details', () => {
  const member = makeMember();
  member.user.primaryGuild = { identityEnabled: true, tag: 'Nørra', identityGuildId: guildId };
  member.user.guildTagBadgeURL = () => 'https://cdn.discordapp.com/guild-tag-badges/123/badge.png';
  member.presence.activities = [{ type: 4, state: 'Hello', emoji: { id: '123456789012345678', name: 'wave', animated: true } }];
  const data = serializePresence(member);
  assert.equal(data.user.username, 'illiaa.m');
  assert.equal(data.user.guildTag.tag, 'Nørra');
  assert.equal(data.customStatus, 'Hello');
  assert.ok(data.customEmoji.url.endsWith('.gif'));
  assert.equal(data.user.guildTag.identityGuildId, undefined);
  member.user.primaryGuild.identityEnabled = false;
  assert.equal(serializePresence(member).user.guildTag, null);
});

test('bot syncs the target account, filters events, and clears stale status on disconnect', async () => {
  const client = new EventEmitter();
  let current = makeMember();
  let fetchArgs;
  const guild = { id: guildId, available: true, presences: { cache: new Map() }, members: { fetch: async args => { fetchArgs = args; return new Map([[userId, current]]); } } };
  client.guilds = { cache: new Map([[guildId, guild]]) };
  client.isReady = () => true;
  client.login = async () => {};
  client.destroy = async () => {};
  const bot = startDiscordPresence({ token: 'test-only', guildId, userId }, client);
  client.emit('clientReady');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fetchArgs.user, [userId]);
  assert.equal(fetchArgs.withPresences, true);
  assert.equal(bot.getSnapshot().status, 'online');
  client.emit('presenceUpdate', null, { guild: { id: 'other' }, userId, status: 'dnd' });
  assert.equal(bot.getSnapshot().status, 'online');
  client.emit('presenceUpdate', null, { guild, userId: 'other', status: 'dnd' });
  assert.equal(bot.getSnapshot().status, 'online');
  current.presence = { status: 'dnd', activities: [] };
  client.emit('presenceUpdate', null, { guild, userId, ...current.presence });
  assert.equal(bot.getSnapshot().status, 'dnd');
  client.emit('shardReconnecting');
  assert.equal(bot.getSnapshot().connected, false);
  assert.deepEqual(bot.getSnapshot().activities, []);
  current = makeMember('offline');
  client.emit('shardResume');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bot.getSnapshot().status, 'offline');
  client.emit('guildMemberRemove', { guild, id: userId });
  assert.equal(bot.getSnapshot().connected, false);
  await bot.close();
});

test('in-flight member fetch cannot restore stale status after a disconnect', async () => {
  const client = new EventEmitter();
  let resolveFetch;
  const guild = { id: guildId, available: true, presences: { cache: new Map() }, members: { fetch: () => new Promise(resolve => { resolveFetch = resolve; }) } };
  client.guilds = { cache: new Map([[guildId, guild]]) };
  client.isReady = () => true;
  client.login = async () => {};
  client.destroy = async () => {};
  const bot = startDiscordPresence({ token: 'test-only', guildId, userId }, client);
  client.emit('clientReady');
  client.emit('shardDisconnect');
  resolveFetch(new Map([[userId, makeMember()]]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bot.getSnapshot().connected, false);
  await bot.close();
});

test('HTTP server serves the page, fresh status, and video ranges without exposing private files', async t => {
  let snapshot = serializePresence(makeMember());
  const server = createApp(() => snapshot);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('id="discord-presence"'));
  assert.ok(!html.includes('Profile Views'));
  assert.ok(!html.includes('cf-turnstile'));
  assert.ok(!html.includes('User Not found'));
  const status = await fetch(base + '/api/presence');
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal((await status.json()).status, 'online');
  snapshot = unavailable();
  assert.equal((await (await fetch(base + '/api/presence')).json()).connected, false);
  for (const path of ['/.env', '/.env.example', '/server.js', '/package.json', '/node_modules/discord.js/package.json', '/original-page.html', '/assets/../.env', '/assets/%2e%2e%2f.env']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base + '/api/presence', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/healthz')).status, 200);
  const manifest = JSON.parse(await readFile(new URL('../asset-manifest.json', import.meta.url), 'utf8'));
  const video = Object.values(manifest).find(value => value.endsWith('.mp4'));
  const range = await fetch(`${base}/${video}`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(`${base}/${video}`, { headers: { Range: 'bytes=999999999-' } })).status, 416);
  assert.equal((await fetch(base, { method: 'HEAD' })).status, 200);
});
