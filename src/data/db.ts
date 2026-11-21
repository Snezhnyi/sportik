import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface StoredDoc<T = unknown> {
  id: string;
  type: string;
  updatedAt: number;
  deleted: boolean;
  data: T;
}

interface Schema extends DBSchema {
  docs: { key: string; value: StoredDoc };
  /** Local changes not yet acknowledged by the server. Keyed by doc id: newer edits replace older ones. */
  outbox: { key: string; value: StoredDoc };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDb(name = 'sportik'): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('docs', { keyPath: 'id' });
      db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadAll(): Promise<StoredDoc[]> {
  return (await getDb()).getAll('docs');
}

/** Writes the doc and queues it for sync in a single transaction — no window where one exists without the other. */
export async function writeLocal(doc: StoredDoc): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['docs', 'outbox'], 'readwrite');
  await Promise.all([tx.objectStore('docs').put(doc), tx.objectStore('outbox').put(doc), tx.done]);
}

export async function applyRemote(docs: StoredDoc[]): Promise<StoredDoc[]> {
  const db = await getDb();
  const tx = db.transaction(['docs', 'outbox'], 'readwrite');
  const applied: StoredDoc[] = [];
  for (const doc of docs) {
    const [local, pending] = await Promise.all([tx.objectStore('docs').get(doc.id), tx.objectStore('outbox').get(doc.id)]);
    // A pending local edit that is newer wins; it will be pushed on the next sync.
    if (pending && pending.updatedAt >= doc.updatedAt) continue;
    if (local && local.updatedAt >= doc.updatedAt) continue;
    await tx.objectStore('docs').put(doc);
    applied.push(doc);
  }
  await tx.done;
  return applied;
}

export async function readOutbox(limit = 200): Promise<StoredDoc[]> {
  const db = await getDb();
  return (await db.getAll('outbox')).slice(0, limit);
}

/** Remove acknowledged items, unless they were edited again while the request was in flight. */
export async function ackOutbox(sent: StoredDoc[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  for (const d of sent) {
    const cur = await tx.store.get(d.id);
    if (cur && cur.updatedAt === d.updatedAt) await tx.store.delete(d.id);
  }
  await tx.done;
}

export async function outboxCount(): Promise<number> {
  return (await getDb()).count('outbox');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await getDb()).get('meta', key) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key);
}
