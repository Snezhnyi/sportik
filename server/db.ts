import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Document store. Every entity of the app (program, workout, weight entry...) is a
 * JSON document owned by a user. Conflicts are resolved last-write-wins by `updatedAt`;
 * `seq` is a server-side monotonically increasing cursor used for incremental pulls.
 */
export interface SyncDoc {
  id: string;
  type: string;
  updatedAt: number;
  deleted?: boolean;
  data: unknown;
}

const PULL_LIMIT = 2000;

export interface DocStore {
  push(userId: string, docs: SyncDoc[]): void;
  pullSince(userId: string, cursor: number): { cursor: number; more: boolean; docs: SyncDoc[] };
}

export function openStore(path: string): DocStore {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS docs (
      user_id    TEXT    NOT NULL,
      id         TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0,
      data       TEXT    NOT NULL,
      seq        INTEGER NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS docs_user_seq ON docs (user_id, seq);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
  `);

  const nextSeq = db.prepare(`UPDATE meta SET value = value + 1 WHERE key = 'seq' RETURNING value`);
  // Only overwrite when the incoming version is newer: re-sending the same set twice is a no-op.
  const upsert = db.prepare(`
    INSERT INTO docs (user_id, id, type, updated_at, deleted, data, seq)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, id) DO UPDATE SET
      type = excluded.type, updated_at = excluded.updated_at, deleted = excluded.deleted,
      data = excluded.data, seq = excluded.seq
    WHERE excluded.updated_at > docs.updated_at
  `);
  const existing = db.prepare(`SELECT updated_at FROM docs WHERE user_id = ? AND id = ?`);
  const since = db.prepare(
    `SELECT id, type, updated_at, deleted, data, seq FROM docs WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ${PULL_LIMIT}`,
  );

  return {
    push(userId, docs) {
      db.exec('BEGIN');
      try {
        for (const d of docs) {
          const row = existing.get(userId, d.id) as { updated_at: number } | undefined;
          if (row && row.updated_at >= d.updatedAt) continue;
          const { value } = nextSeq.get() as { value: number };
          upsert.run(userId, d.id, d.type, d.updatedAt, d.deleted ? 1 : 0, JSON.stringify(d.data ?? null), value);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    pullSince(userId, cursor) {
      const rows = since.all(userId, cursor) as Array<{
        id: string; type: string; updated_at: number; deleted: number; data: string; seq: number;
      }>;
      return {
        cursor: rows.length ? rows[rows.length - 1].seq : cursor,
        more: rows.length === PULL_LIMIT,
        docs: rows.map((r) => ({
          id: r.id,
          type: r.type,
          updatedAt: r.updated_at,
          deleted: r.deleted === 1,
          data: JSON.parse(r.data),
        })),
      };
    },
  };
}
