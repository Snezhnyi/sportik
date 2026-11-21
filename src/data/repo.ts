import { useMemo } from 'react';
import { all, get, put, remove, useCollection, useDoc } from './store';
import { BUILTIN_EXERCISES } from '../domain/exerciseLibrary';
import { DEFAULT_INCREMENTS, incrementFor, recommendLoad } from '../domain/adaptiveLoad';
import { finishWorkout, performances } from '../domain/workout';
import { programSequence } from '../domain/schedule';
import type {
  CalendarMark, CalendarOverride, Exercise, LocalDate, Profile, Program, Recommendation, Settings, WeightEntry, Workout,
} from '../domain/types';
import { newId } from '../lib/id';

/** Application-level operations: combine domain logic with persistence. UI calls only these. */

export const PROFILE_ID = 'profile';
export const SETTINGS_ID = 'settings';

export const DEFAULT_SETTINGS: Settings = { increments: DEFAULT_INCREMENTS, defaultRestSec: 120, sound: true };

export const DEFAULT_PROFILE: Profile = {
  name: '', sex: null, heightCm: null, targetWeightKg: null, level: 'intermediate', goal: 'hypertrophy', notes: '', onboarded: false,
};

// ---------- profile & settings ----------

export const useProfile = () => useDoc('profile', PROFILE_ID) ?? DEFAULT_PROFILE;
export const saveProfile = (p: Profile) => put('profile', PROFILE_ID, p);

export function useSettings(): Settings {
  const s = useDoc('settings', SETTINGS_ID);
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...s, increments: { ...DEFAULT_INCREMENTS, ...s?.increments } }), [s]);
}
export const getSettings = (): Settings => {
  const s = get('settings', SETTINGS_ID);
  return { ...DEFAULT_SETTINGS, ...s, increments: { ...DEFAULT_INCREMENTS, ...s?.increments } };
};
export const saveSettings = (s: Settings) => put('settings', SETTINGS_ID, s);

// ---------- exercise library ----------

/** Built-in exercises merged with user docs (custom ones and edits/hiding of built-ins). */
export function useLibrary(): { list: Exercise[]; byId: Map<string, Exercise> } {
  const docs = useCollection('exercise');
  return useMemo(() => {
    const byId = new Map<string, Exercise>(BUILTIN_EXERCISES.map((e) => [e.id, e]));
    for (const e of docs.values()) byId.set(e.id, e);
    const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return { list, byId };
  }, [docs]);
}

export function libraryNow(): Exercise[] {
  const byId = new Map<string, Exercise>(BUILTIN_EXERCISES.map((e) => [e.id, e]));
  for (const e of all('exercise')) byId.set(e.id, e);
  return [...byId.values()];
}

export const saveExercise = (e: Exercise) => put('exercise', e.id, e);

// ---------- programs ----------

export function usePrograms(): Program[] {
  const c = useCollection('program');
  return useMemo(() => [...c.values()].sort((a, b) => b.updatedAt - a.updatedAt), [c]);
}

export function useActiveProgram(): Program | null {
  const programs = usePrograms();
  return programs.find((p) => p.status === 'active') ?? null;
}

export async function saveProgram(p: Program): Promise<void> {
  // Keep progress inside the sequence when blocks/days were removed.
  const len = programSequence(p).length;
  const progressIndex = len ? Math.min(p.progressIndex, len - 1) : 0;
  await put('program', p.id, { ...p, progressIndex, updatedAt: Date.now() });
}

/** Only one active program: the previous one becomes "saved" with its progress intact. */
export async function activateProgram(id: string): Promise<void> {
  const now = Date.now();
  for (const p of all('program')) {
    if (p.id !== id && p.status === 'active') await put('program', p.id, { ...p, status: 'saved', updatedAt: now });
  }
  const p = get('program', id);
  if (p) await put('program', id, { ...p, status: 'active', activatedAt: now, updatedAt: now });
}

export async function archiveProgram(id: string, archived: boolean): Promise<void> {
  const p = get('program', id);
  if (p) await put('program', id, { ...p, status: archived ? 'archived' : 'saved', updatedAt: Date.now() });
}

export async function duplicateProgram(id: string): Promise<Program | null> {
  const p = get('program', id);
  if (!p) return null;
  const now = Date.now();
  const copy: Program = {
    ...structuredClone(p),
    id: newId('prg'),
    name: `${p.name} (копия)`,
    status: 'saved',
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    progressIndex: 0,
  };
  // Fresh ids for nested items so the copy can be edited independently.
  for (const b of copy.blocks) {
    b.id = newId('blk');
    for (const d of b.days) {
      d.id = newId('day');
      for (const e of d.exercises) e.id = newId('pex');
    }
  }
  await put('program', copy.id, copy);
  return copy;
}

/** Workouts keep their own snapshot (names + prescriptions), so deleting a program never touches history. */
export const deleteProgram = (id: string) => remove('program', id);

// ---------- workouts ----------

export function useWorkouts(): Workout[] {
  const c = useCollection('workout');
  return useMemo(() => [...c.values()].sort((a, b) => b.startedAt - a.startedAt), [c]);
}

export function useActiveWorkout(): Workout | null {
  const workouts = useWorkouts();
  return workouts.find((w) => w.status === 'in_progress') ?? null;
}

export const saveWorkout = (w: Workout) => put('workout', w.id, w);
export const deleteWorkout = (id: string) => remove('workout', id);

/** Finishes the workout, advances the program and stores the engine's suggestions as pending. */
export async function completeWorkout(w: Workout, comment: string): Promise<Workout> {
  const finished = finishWorkout(w, comment);
  await put('workout', finished.id, finished);

  if (finished.programId && finished.sequenceIndex !== null) {
    const p = get('program', finished.programId);
    if (p && p.progressIndex <= finished.sequenceIndex) {
      await put('program', p.id, { ...p, progressIndex: finished.sequenceIndex + 1, updatedAt: Date.now() });
    }
  }

  const library = new Map(libraryNow().map((e) => [e.id, e]));
  const settings = getSettings();
  const history = all('workout');
  for (const ex of finished.exercises) {
    const meta = library.get(ex.exerciseId);
    const sets = ex.sets.filter((s) => s.done);
    if (!meta || !sets.length) continue;
    const prev = performances(history, ex.exerciseId, finished.id).find((p) => p.workout.startedAt < finished.startedAt);
    const rec = recommendLoad({
      prescription: ex.target, exercise: meta, sets, previous: prev?.sets ?? null,
      increment: incrementFor(meta.equipment, settings),
    });
    if (!rec) continue;
    const doc: Recommendation = {
      id: newId('rec'), createdAt: Date.now(), workoutId: finished.id, exerciseId: ex.exerciseId, exerciseName: ex.name,
      action: rec.action, fromWeight: rec.currentWeight, toWeight: rec.suggestedWeight, reason: rec.reason,
      decision: rec.action === 'keep' ? 'accepted' : 'pending', decidedAt: rec.action === 'keep' ? Date.now() : null,
    };
    await put('recommendation', doc.id, doc);
  }
  return finished;
}

export function useRecommendations(): Recommendation[] {
  const c = useCollection('recommendation');
  return useMemo(() => [...c.values()].sort((a, b) => b.createdAt - a.createdAt), [c]);
}

export async function decideRecommendation(id: string, decision: 'accepted' | 'rejected'): Promise<void> {
  const r = get('recommendation', id);
  if (r) await put('recommendation', id, { ...r, decision, decidedAt: Date.now() });
}

// ---------- body weight ----------

export function useWeights(): WeightEntry[] {
  const c = useCollection('weight');
  return useMemo(() => [...c.values()].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)), [c]);
}

export async function addWeight(date: LocalDate, weightKg: number): Promise<void> {
  const e: WeightEntry = { id: newId('w'), date, weightKg, createdAt: Date.now() };
  await put('weight', e.id, e);
}
export const updateWeight = (e: WeightEntry) => put('weight', e.id, e);
export const deleteWeight = (id: string) => remove('weight', id);

// ---------- calendar ----------

export function useCalendarOverrides(): Map<LocalDate, CalendarOverride> {
  const c = useCollection('calendar');
  return useMemo(() => new Map([...c.values()].map((o) => [o.date, o])), [c]);
}

export async function setCalendarMark(date: LocalDate, mark: CalendarMark | null): Promise<void> {
  const id = `cal_${date}`;
  if (mark === null) await remove('calendar', id);
  else await put('calendar', id, { date, mark, note: '' });
}
