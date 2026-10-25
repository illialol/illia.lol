const gate = document.querySelector('.GUNS__43-018c3d03-bfee722b-0ec7977f');
const video = document.querySelector('#local-background');
gate.setAttribute('role', 'button');
gate.setAttribute('tabindex', '0');
gate.setAttribute('aria-label', 'Enter profile and play background video');
function enter() {
  document.body.classList.add('local-entered');
  gate.setAttribute('aria-hidden', 'true');
  gate.setAttribute('tabindex', '-1');
  video.volume = 0.5;
  video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
  setTimeout(() => { gate.hidden = true; }, 500);
}
gate.addEventListener('click', enter, { once: true });
gate.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); }
});

const card = document.querySelector('#discord-presence');
const name = document.querySelector('#discord-name');
const status = document.querySelector('#discord-status');
const avatar = document.querySelector('#discord-avatar');
const guildTag = document.querySelector('#discord-guild-tag');
const guildBadge = document.querySelector('#discord-guild-badge');
const guildName = document.querySelector('#discord-guild-name');
const activityList = document.querySelector('#discord-activities');
const message = document.querySelector('#discord-message');
const statusLabels = { online: 'Online', idle: 'Idle', dnd: 'Do not disturb', offline: 'Offline' };
const activityLabels = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 5: 'Competing in' };
let lastData;
let activityKey;
let activityIndex = 0;
let activityTimer;

function safeDiscordImage(url) {
  return typeof url === 'string' && /^https:\/\/cdn\.discordapp\.com\/(avatars|embed\/avatars|guild-tag-badges|emojis)\//.test(url);
}

function rotateActivity() {
  const items = [...activityList.children];
  if (!items.length) return;
  activityIndex %= items.length;
  items.forEach((item, index) => {
    item.dataset.active = String(index === activityIndex);
    item.setAttribute('aria-hidden', String(index !== activityIndex));
  });
}

function renderActivities(data, connected) {
  const active = connected && data.status !== 'offline';
  const activities = active ? (data.activities || []).slice(0, 3) : [];
  const customStatus = active ? data.customStatus : null;
  const emoji = active ? data.customEmoji : null;
  const key = JSON.stringify([activities, customStatus, emoji]);
  if (key === activityKey) return;
  activityKey = key;
  clearInterval(activityTimer);
  activityIndex = 0;
  activityList.replaceChildren();
  for (const activity of activities) {
    const item = document.createElement('p');
    item.className = 'discord-activity';
    const prefix = document.createElement('strong');
    prefix.textContent = `${activityLabels[activity.type] || 'Activity:'} `;
    item.append(prefix, document.createTextNode(activity.name));
    item.title = [activity.details, activity.state].filter(Boolean).join(' · ');
    activityList.append(item);
  }
  if (customStatus || emoji) {
    const item = document.createElement('p');
    item.className = 'discord-activity';
    if (safeDiscordImage(emoji?.url)) {
      const image = document.createElement('img');
      image.src = emoji.url;
      image.alt = emoji.name || '';
      item.append(image);
    }
    item.append(document.createTextNode(customStatus || ''));
    activityList.append(item);
  }
  rotateActivity();
  if (activityList.children.length > 1) {
    activityTimer = setInterval(() => { activityIndex++; rotateActivity(); }, 10_000);
  }
}

function renderPresence(data) {
  const serialized = JSON.stringify(data);
  if (serialized === lastData) return;
  lastData = serialized;
  const connected = data.connected && Object.hasOwn(statusLabels, data.status);
  card.dataset.status = connected ? data.status : 'unknown';
  name.textContent = connected ? data.user?.username || 'Discord' : 'Discord';
  status.textContent = connected ? statusLabels[data.status] : 'Unavailable';
  const avatarURL = connected && data.user?.avatar;
  const safeAvatar = safeDiscordImage(avatarURL);
  avatar.parentElement.hidden = !safeAvatar;
  if (safeAvatar) avatar.src = avatarURL;
  else avatar.removeAttribute('src');
  const tag = connected && data.user?.guildTag;
  guildTag.hidden = !tag?.tag;
  guildName.textContent = tag?.tag || '';
  const safeBadge = safeDiscordImage(tag?.badge);
  guildBadge.hidden = !safeBadge;
  if (safeBadge) guildBadge.src = tag.badge;
  else guildBadge.removeAttribute('src');
  renderActivities(data, connected);
  message.textContent = connected ? '' : data.message || 'Live status is temporarily unavailable.';
  message.hidden = connected;
}

let timer;
let refreshing = false;
async function refreshPresence() {
  clearTimeout(timer);
  if (refreshing) return;
  if (document.hidden) { timer = setTimeout(refreshPresence, 10_000); return; }
  refreshing = true;
  try {
    const response = await fetch('/api/presence', { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error('Status unavailable');
    renderPresence(await response.json());
  } catch {
    renderPresence({ connected: false, message: 'Live status is temporarily unavailable.' });
  } finally {
    refreshing = false;
    timer = setTimeout(refreshPresence, 10_000);
  }
}
if (location.protocol === 'http:' || location.protocol === 'https:') {
  void refreshPresence();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshPresence(); });
} else {
  renderPresence({ connected: false, message: 'Live status is available on the hosted page.' });
}
