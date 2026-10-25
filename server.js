import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startDiscordPresence } from './discord-bot.js';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

export function createApp(getPresence) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (path === '/api/presence' || path === '/healthz') {
      const data = path === '/healthz' ? { ok: true } : getPresence();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data)); return;
    }
    if (path === '/') path = '/index.html';
    // Only public frontend files can be served. Tokens and source files stay private.
    if (!['/index.html', '/local.js', '/local.css'].includes(path) && !/^\/assets\/[a-f0-9]{16}\.(css|png|mp4|woff2?|ttf)$/.test(path)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    try {
      const file = join(root, path.slice(1));
      const info = await stat(file);
      if (!info.isFile()) { res.writeHead(404); res.end(); return; }
      const extension = path.slice(path.lastIndexOf('.'));
      res.setHeader('Content-Type', types[extension] || 'application/octet-stream');
      if (path.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Accept-Ranges', 'bytes');
      let start = 0, end = info.size - 1;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!range || (!range[1] && !range[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
        if (!range[1]) start = Math.max(0, info.size - Number(range[2]));
        else { start = Number(range[1]); if (range[2]) end = Math.min(Number(range[2]), end); }
        if (start > end || start >= info.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) { res.writeHead(404); res.end('Not found'); }
      else res.destroy();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const userId = process.env.DISCORD_USER_ID?.trim();
  if ((guildId && !/^\d{17,20}$/.test(guildId)) || (userId && !/^\d{17,20}$/.test(userId))) {
    console.error('Discord server and user IDs must be 17–20 digit numeric IDs.');
    process.exit(1);
  }
  const bot = startDiscordPresence({ token, guildId, userId });
  const server = createApp(bot.getSnapshot);
  const port = Number(process.env.PORT || 8080);
  server.listen(port, '0.0.0.0', () => console.log(`Profile server listening on port ${port}.`));
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close();
    await bot.close();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
