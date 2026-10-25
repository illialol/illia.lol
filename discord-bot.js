import { Client, Events, GatewayIntentBits } from 'discord.js';
import { serializePresence, unavailable } from './presence.js';

export function startDiscordPresence({ token, guildId, userId }, suppliedClient) {
  let snapshot = unavailable('Discord status is not configured yet.');
  let member;
  let generation = 0;
  let stopped = false;
  let retry;
  const client = suppliedClient ?? new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences],
    allowedMentions: { parse: [] },
  });

  function clear(message) {
    generation++;
    member = undefined;
    snapshot = unavailable(message);
  }

  function scheduleSync() {
    clearTimeout(retry);
    if (!stopped) retry = setTimeout(() => { void sync(); }, 30_000);
  }

  async function sync() {
    if (stopped || !client.isReady()) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild?.available) {
      clear('The bot cannot reach the configured Discord server.');
      scheduleSync();
      return;
    }
    const currentGeneration = ++generation;
    try {
      // Request this one member with their presence, including on initial connection.
      guild.presences.cache.delete(userId);
      const result = await guild.members.fetch({ user: [userId], withPresences: true, time: 15_000 });
      if (stopped || currentGeneration !== generation || !client.isReady()) return;
      member = result.get(userId);
      if (!member) throw new Error('The configured account is not in this server.');
      snapshot = serializePresence(member);
      clearTimeout(retry);
    } catch {
      if (currentGeneration !== generation || stopped) return;
      clear('Discord status is unavailable. Check the server, user ID, and bot intents.');
      console.error('Could not fetch the configured Discord member. Check IDs, membership, and privileged intents.');
      scheduleSync();
    }
  }

  client.on(Events.ClientReady, () => { console.log('Discord bot connected.'); void sync(); });
  client.on(Events.GuildCreate, guild => { if (guild.id === guildId) void sync(); });
  client.on(Events.GuildAvailable, guild => { if (guild.id === guildId) void sync(); });
  client.on(Events.GuildUnavailable, guild => {
    if (guild.id === guildId) clear('The Discord server is temporarily unavailable.');
  });
  client.on(Events.GuildDelete, guild => {
    if (guild.id === guildId) clear('The bot is no longer in the configured Discord server.');
  });
  client.on(Events.GuildMemberRemove, removed => {
    if (removed.guild.id === guildId && removed.id === userId) clear('This user is no longer in the configured Discord server.');
  });
  client.on(Events.GuildMemberAdd, added => {
    if (added.guild.id === guildId && added.id === userId) void sync();
  });
  client.on(Events.PresenceUpdate, (_old, next) => {
    if (next.guild.id !== guildId || next.userId !== userId || !client.isReady()) return;
    if (!member) { void sync(); return; }
    snapshot = serializePresence(member, next);
  });
  client.on(Events.UserUpdate, (_old, user) => {
    if (user.id === userId && member && client.isReady()) snapshot = serializePresence(member);
  });
  client.on(Events.ShardDisconnect, () => clear('Reconnecting to Discord…'));
  client.on(Events.ShardReconnecting, () => clear('Reconnecting to Discord…'));
  client.on(Events.ShardResume, () => { void sync(); });
  client.on(Events.Error, () => {
    console.error('Discord connection error. The client will attempt to reconnect.');
    clear('Discord status is temporarily unavailable.');
    scheduleSync();
  });

  if (token && guildId && userId) {
    snapshot = unavailable('Connecting to Discord…');
    client.login(token).catch(() => {
      clear('Discord status is unavailable. The bot needs configuration.');
      console.error('Discord login failed. Check DISCORD_BOT_TOKEN and enable Presence and Server Members intents. Redeploy after fixing configuration.');
    });
  } else {
    console.warn('Live Discord status disabled. Set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and DISCORD_USER_ID to enable it.');
  }

  return {
    getSnapshot: () => snapshot,
    close: async () => { stopped = true; clearTimeout(retry); clear(); await client.destroy(); },
  };
}
