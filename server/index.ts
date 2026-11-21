import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { openStore, type SyncDoc } from './db.ts';
import { isAllowed, parseAllowlist, verifyInitData } from './auth.ts';

loadDotEnv();

const PORT = Number(process.env.PORT ?? 8787);
const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
const ALLOW_DEV_AUTH = process.env.ALLOW_DEV_AUTH === '1';
const ALLOWED = parseAllowlist(process.env.ALLOWED_USER_IDS);
const store = openStore(process.env.DB_PATH ?? './data/sportik.db');

if (!BOT_TOKEN && !ALLOW_DEV_AUTH) {
  console.warn('[auth] BOT_TOKEN is not set and ALLOW_DEV_AUTH is off: every API request will be rejected');
}
console.log(ALLOWED ? `[auth] access limited to ${ALLOWED.size} Telegram user(s)` : '[auth] ALLOWED_USER_IDS is empty: any Telegram user can sign in');
const seenUsers = new Set<number>();

type Env = { Variables: { userId: string } };
const app = new Hono<Env>();

app.get('/api/health', (c) => c.json({ ok: true, time: Date.now() }));

// Public: lets the "open in Telegram" screen link to the bot. BOT_USERNAME wins; otherwise resolved
// once from the token (api.telegram.org may be unreachable from some hosts — that's not fatal).
let botUsername: string | null = process.env.BOT_USERNAME?.replace(/^@/, '') || null;
if (BOT_TOKEN && !botUsername) {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(10_000) })
    .then((r) => r.json() as Promise<{ ok: boolean; result?: { username?: string } }>)
    .then((r) => { botUsername = r.result?.username ?? null; console.log(`[bot] @${botUsername ?? '?'}`); })
    .catch((e) => console.warn('[bot] getMe failed:', (e as Error).message));
}
app.get('/api/info', (c) => c.json({ bot: botUsername }));

app.use('/api/*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  if (header.startsWith('tma ') && BOT_TOKEN) {
    const user = verifyInitData(header.slice(4), BOT_TOKEN);
    if (!user) return c.json({ error: 'invalid_init_data' }, 401);
    // Logged once per user and process, so the owner can find IDs to put into ALLOWED_USER_IDS.
    if (!seenUsers.has(user.id)) {
      seenUsers.add(user.id);
      console.log(`[auth] ${isAllowed(ALLOWED, user.id) ? 'allowed' : 'DENIED'} Telegram user id=${user.id} name=${JSON.stringify(user.first_name ?? '')} username=${user.username ?? '-'}`);
    }
    if (!isAllowed(ALLOWED, user.id)) return c.json({ error: 'forbidden' }, 403);
    c.set('userId', `tg:${user.id}`);
    return next();
  }
  if (header === 'dev' && ALLOW_DEV_AUTH) {
    c.set('userId', 'dev');
    return next();
  }
  return c.json({ error: 'unauthorized' }, 401);
});

const MAX_DOC_BYTES = 512 * 1024;

app.post('/api/sync', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { cursor?: unknown; changes?: unknown } | null;
  if (!body || !Array.isArray(body.changes)) return c.json({ error: 'bad_request' }, 400);
  const cursor = typeof body.cursor === 'number' ? body.cursor : 0;

  const changes: SyncDoc[] = [];
  for (const raw of body.changes as Partial<SyncDoc>[]) {
    if (typeof raw?.id !== 'string' || typeof raw.type !== 'string' || typeof raw.updatedAt !== 'number') {
      return c.json({ error: 'bad_doc' }, 400);
    }
    if (JSON.stringify(raw.data ?? null).length > MAX_DOC_BYTES) return c.json({ error: 'doc_too_large', id: raw.id }, 413);
    changes.push({ id: raw.id, type: raw.type, updatedAt: raw.updatedAt, deleted: !!raw.deleted, data: raw.data });
  }

  const userId = c.get('userId');
  store.push(userId, changes);
  return c.json(store.pullSince(userId, cursor));
});

// Production: serve the built client from the same origin.
if (existsSync('./dist/index.html')) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

function loadDotEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
