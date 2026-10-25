const statuses = new Set(['online', 'idle', 'dnd', 'offline']);

export function unavailable(message = 'Discord status is temporarily unavailable.') {
  return { connected: false, status: null, user: null, customStatus: null, activities: [], message };
}

// Publish only the selected user's display data, never raw guild or member objects.
export function serializePresence(member, presence = member.presence) {
  const user = member.user;
  const status = statuses.has(presence?.status) ? presence.status : 'offline';
  const activities = status === 'offline' ? [] : (presence?.activities ?? []);
  const custom = activities.find(activity => activity.type === 4);
  return {
    connected: true,
    status,
    user: {
      username: user.username,
      displayName: user.globalName || user.username,
      avatar: user.displayAvatarURL({ extension: 'png', size: 128 }),
      guildTag: user.primaryGuild?.identityEnabled && user.primaryGuild.tag ? {
        tag: user.primaryGuild.tag,
        badge: user.guildTagBadgeURL?.({ extension: 'png', size: 32 }) || null,
      } : null,
    },
    customStatus: custom ? [custom.emoji?.id ? null : custom.emoji?.name, custom.state].filter(Boolean).join(' ') : null,
    customEmoji: custom?.emoji?.id ? {
      name: custom.emoji.name,
      url: `https://cdn.discordapp.com/emojis/${custom.emoji.id}.${custom.emoji.animated ? 'gif' : 'png'}`,
    } : null,
    activities: activities.filter(activity => activity.type !== 4).slice(0, 3).map(activity => ({
      type: activity.type,
      name: activity.name,
      details: activity.details || null,
      state: activity.state || null,
    })),
    message: null,
  };
}
