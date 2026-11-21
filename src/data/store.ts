import { useSyncExternalStore } from 'react';
import { loadAll, writeLocal, type StoredDoc } from './db';
import type {
  CalendarOverride, Exercise, Profile, Program, Recommendation, Settings, WeightEntry, Workout,
} from '../domain/types';

/**
 * In-memory mirror of the local IndexedDB, grouped by document type.
 * Reads are synchronous (React renders from memory); every write goes to IndexedDB + outbox first.
 */
export interface DocTypes {
  profile: Profile;
  settings: Settings;
  program: Program;
  workout: Workout;
  exercise: Exercise;
  weight: WeightEntry;
  calendar: CalendarOverride;
  recommendation: Recommendation;
}
export type DocType = keyof DocTypes;

type Collection<T> = ReadonlyMap<string, T>;

const collections = new Map<DocType, Map<string, unknown>>();
const versions = new Map<string, number>();
const snapshots = new Map<DocType, Collection<unknown>>();
const listeners = new Set<() => void>();
let changeListener: (() => void) | null = null;
let ready = false;

function coll(type: DocType): Map<string, unknown> {
  let c = collections.get(type);
  if (!c) collections.set(type, (c = new Map()));
  return c;
}

function emit(types: Iterable<DocType>) {
  for (const t of types) snapshots.set(t, new Map(coll(t)));
  for (const l of listeners) l();
}

/** Applies stored docs to memory (from initial load or from the server). */
export function ingest(docs: StoredDoc[]) {
  const touched = new Set<DocType>();
  for (const d of docs) {
    const type = d.type as DocType;
    if ((versions.get(d.id) ?? -1) >= d.updatedAt) continue;
    versions.set(d.id, d.updatedAt);
    if (d.deleted) coll(type).delete(d.id);
    else coll(type).set(d.id, d.data);
    touched.add(type);
  }
  if (touched.size) emit(touched);
}

export async function initStore(): Promise<void> {
  ingest(await loadAll());
  ready = true;
  for (const l of listeners) l();
}

export const isReady = () => ready;

export function onLocalChange(fn: () => void) {
  changeListener = fn;
}

async function write<K extends DocType>(type: K, id: string, data: DocTypes[K] | null): Promise<void> {
  // Strictly increasing per document even if the clock jumps back or two writes share a millisecond.
  const updatedAt = Math.max(Date.now(), (versions.get(id) ?? 0) + 1);
  const doc: StoredDoc = { id, type, updatedAt, deleted: data === null, data };
  versions.set(id, updatedAt);
  if (data === null) coll(type).delete(id);
  else coll(type).set(id, data);
  emit([type]);
  await writeLocal(doc);
  changeListener?.();
}

export const put = <K extends DocType>(type: K, id: string, data: DocTypes[K]) => write(type, id, data);
export const remove = (type: DocType, id: string) => write(type, id, null);

export function get<K extends DocType>(type: K, id: string): DocTypes[K] | undefined {
  return coll(type).get(id) as DocTypes[K] | undefined;
}

export function all<K extends DocType>(type: K): DocTypes[K][] {
  return [...coll(type).values()] as DocTypes[K][];
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const EMPTY: Collection<unknown> = new Map<string, unknown>();

export function useCollection<K extends DocType>(type: K): Collection<DocTypes[K]> {
  return useSyncExternalStore(subscribe, () => (snapshots.get(type) ?? EMPTY) as Collection<DocTypes[K]>);
}

export function useDoc<K extends DocType>(type: K, id: string | null | undefined): DocTypes[K] | undefined {
  const c = useCollection(type);
  return id ? c.get(id) : undefined;
}

export function useReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready);
}
