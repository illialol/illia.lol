# illia.lol profile with your own Discord bot

This version removes the profile view counter and uses your bot in your private Discord server for live status. The page keeps its downloaded video, cursor, fonts, and social links. No guns.lol server is required.

The profile uses the original centered layout from https://guns.lol/illia.mn, with the displayed name changed to illia.lol. Original social links and account IDs remain unchanged. The view counter stays removed and the private-server Discord integration is retained.

The bot receives presence changes from Discord; the browser refreshes from the API every 10 seconds. The card matches the original with a 74px avatar, a status dot, Discord username (not display name), and your enabled server tag/badge when Discord supplies it. A single activity line alternates between activities and custom status every 10 seconds. Custom Discord emoji are supported. Invisible appears offline. During a disconnection the card clears stale presence. The profile heading stays illia.lol; the card shows your actual Discord username.

## 1. Set up the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), select your application (or create one), and go to **Bot**.
2. Under **Privileged Gateway Intents**, enable **Presence Intent** and **Server Members Intent**, then save. **Message Content Intent is not needed.** These intents are required both here and in the application code. See [Discord's intent documentation](https://docs.discord.com/developers/events/gateway#privileged-intents).
3. Copy the **bot token**, or reset it if you do not have it. Put it only in Railway Variables or your local `.env`; never in the HTML, JavaScript sent to the browser, or GitHub.
4. Use **Installation** or **OAuth2 → URL Generator** to create a server installation link with the **bot** scope. Invite the bot to your private server. Administrator and message permissions are not required. If you disabled Public Bot, use the owner account to install it.
5. Make sure your own Discord account is in the same server. Enable **Developer Mode** under Discord **User Settings → Advanced**, then right-click the server to **Copy Server ID** and your account to **Copy User ID**.

The original profile's Discord account ID was `937272367980359710`. Confirm that this is your account. Only that selected account's presence is exposed; private server channels, messages, membership lists, and the server ID are not exposed by the API. Your status and shared activity become visible to anyone who visits your public website.

## 2. Deploy to Railway

1. Upload the contents of this folder to a new GitHub repository. `Dockerfile`, `package.json`, `package-lock.json`, the server modules, `index.html`, `local.js`, `local.css`, and `assets/` must be at the repository root. Keep `.env` and `node_modules` out of the repository; `.gitignore` is included. If using a larger repository, set Railway's **Root Directory** to the folder containing this package.
2. In Railway, choose **New Project → Deploy from GitHub repo** and select that repository.
3. In the service's **Variables**, set:

   | Variable | Value |
   | --- | --- |
   | `DISCORD_BOT_TOKEN` | Your bot token, with no `Bot ` prefix |
   | `DISCORD_GUILD_ID` | Your private server's numeric ID |
   | `DISCORD_USER_ID` | Your account's numeric ID |

4. Deploy. Railway detects the included `Dockerfile`, which installs dependencies and runs `npm start` on Node.js 24. Leave any custom build/start commands empty. Set the service's **Healthcheck Path** to `/healthz`. The app listens on Railway's supplied `PORT` on `0.0.0.0`. See [Railway Dockerfile builds](https://docs.railway.com/builds/dockerfiles).
5. Open **Settings → Networking → Public Networking → Generate Domain**. Visit that domain and click to enter. See [Railway public networking](https://docs.railway.com/networking/public-networking).
6. Keep **one replica** running and leave **Serverless / sleeping** disabled so the bot can stay connected. The web page and bot share this one service; no database, volume, or separate bot deployment is required. See [Railway Serverless](https://docs.railway.com/deployments/serverless).

If you already run code for this same bot elsewhere, use a separate Discord application for this presence service, or integrate this service's presence handling into the existing bot instead of running duplicate bot sessions.

## Run locally

Install Node.js 22.12+ if needed. Copy `.env.example` to `.env` and fill in the three Discord values. Then run:

```sh
npm ci
npm start
```

Open http://localhost:8080/. On Windows, `start-local.cmd` installs dependencies and starts the app. Set `PORT` in `.env` if 8080 is already used and open that port instead. You can still open `index.html` directly for a static preview, but live Discord status requires the Node server.

## Troubleshooting

- **Unavailable:** inspect Railway logs. Confirm both privileged intents, IDs, bot token, and that you and the bot are both in the chosen server. After changing token or intents, redeploy/restart. The page works without credentials, but the status card stays unavailable until configured.
- **Offline while invisible:** this is Discord's expected behavior; bots cannot distinguish invisible from offline.
- **Missing activity or custom status:** confirm that Discord is sharing that activity. Only information Discord sends to the bot can appear.
- **Bot disconnected:** the Discord client reconnects automatically. The card clears stale status while reconnecting and resynchronizes after connection returns.
- **Status takes a moment to change:** allow up to about 10 seconds for the browser to refresh, plus Discord's delivery time. Returning to a background tab refreshes immediately.

## Files and maintenance

- `server.js` serves only the public page/assets plus `/api/presence` and `/healthz`. Source files and `.env` are not publicly served.
- `discord-bot.js` connects to Discord and tracks only the configured account in the configured server; `presence.js` limits the published data.
- Edit `index.html` for profile text and links, `local.css` for styling, and `local.js` for the entrance/video and status card.
- `npm test` checks presence data, bot event handling, and the HTTP server without a Discord token.
- `python download.py` refreshes the original public page and assets and reapplies the counter removal and status card through `customize_page.py`. It overwrites manual changes to `index.html`. The original HTML and download scripts are not needed in a deployed repository.

The original page was downloaded from https://guns.lol/illia.mn on 25 October 2026. This is a customized frontend copy, not the original server source. Keep the original assets' ownership and permissions in mind if you republish them.
