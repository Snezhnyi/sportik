import { useSyncExternalStore } from 'react';
import { ackOutbox, applyRemote, getMeta, outboxCount, readOutbox, setMeta, type StoredDoc } from './db';
import { ingest } from './store';
import { getInitData } from '../telegram/tg';

/** 'forbidden' — this Telegram account is not in the server's allowlist; syncing stops. */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'forbidden';

interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

let status: SyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

function authHeader(): string {
  const initData = getInitData();
  return initData ? `tma ${initData}` : 'dev';
}

async function syncOnce(): Promise<void> {
  if (status.state === 'forbidden') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus({ state: 'offline', pending: await outboxCount() });
    return;
  }
  setStatus({ state: 'syncing' });
  try {
    let cursor = (await getMeta<number>('cursor')) ?? 0;
    for (let round = 0; round < 50; round++) {
      const outgoing = await readOutbox();
      // BASE_URL is '/' in dev and e.g. '/sportik/' when the app is served under a path.
      const res = await fetch(`${import.meta.env.BASE_URL}api/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: authHeader() },
        body: JSON.stringify({ cursor, changes: outgoing }),
      });
      if (res.status === 403) {
        setStatus({ state: 'forbidden', error: 'Доступ закрыт' });
        return;
      }
      if (!res.ok) throw new Error(res.status === 401 ? 'Нет авторизации Telegram' : `Сервер ответил ${res.status}`);
      const body = (await res.json()) as { cursor: number; more: boolean; docs: StoredDoc[] };
      await ackOutbox(outgoing);
      ingest(await applyRemote(body.docs.map((d) => ({ ...d, deleted: !!d.deleted }))));
      cursor = body.cursor;
      await setMeta('cursor', cursor);
      if (!body.more && (await outboxCount()) === 0) break;
    }
    failures = 0;
    setStatus({ state: 'idle', pending: await outboxCount(), lastSyncedAt: Date.now(), error: null });
  } catch (e) {
    failures++;
    const offline = e instanceof TypeError; // fetch network failure
    setStatus({ state: offline ? 'offline' : 'error', pending: await outboxCount(), error: (e as Error).message });
    // Exponential backoff, capped at 1 minute. Local data is safe in IndexedDB meanwhile.
    schedule(Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)));
  }
}

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => (running = null));
  return running;
}

/** Debounced sync after local edits: a burst of set edits becomes a single request. */
export function schedule(delay = 800) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delay);
  void outboxCount().then((pending) => setStatus({ pending }));
}

export function startSyncLoop() {
  void syncNow();
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => void syncNow(), 60_000);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => status,
  );
}
