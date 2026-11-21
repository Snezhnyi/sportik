import type {
  Exercise, Prescription, Program, ProgramExercise, Recommendation, RestTimer, Workout, WorkoutExercise, WorkoutSet,
} from './types';
import type { SequenceItem } from './schedule';
import { defaultRestSec } from './exerciseLibrary';
import { estimate1RM } from './adaptiveLoad';
import { newId } from '../lib/id';
import { toLocalDate } from '../lib/dates';

/** Pure functions over the Workout document. Every mutation returns a new object. */

export interface Performance {
  workout: Workout;
  exercise: WorkoutExercise;
  sets: WorkoutSet[];
}

/** Completed performances of an exercise, most recent first. */
export function performances(workouts: Iterable<Workout>, exerciseId: string, excludeWorkoutId?: string): Performance[] {
  const out: Performance[] = [];
  for (const w of workouts) {
    if (w.status !== 'completed' || w.id === excludeWorkoutId) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const sets = ex.sets.filter((s) => s.done && s.reps !== null);
      if (sets.length) out.push({ workout: w, exercise: ex, sets });
    }
  }
  return out.sort((a, b) => b.workout.startedAt - a.workout.startedAt);
}

const blankSet = (weight: number | null = null, reps: number | null = null): WorkoutSet =>
  ({ id: newId('set'), weight, reps, rir: null, done: false, completedAt: null, restTakenSec: null });

/**
 * Suggested values for the sets: last performance (set by set), with an accepted engine
 * recommendation applied on top. First time — program weight if set, reps left for the user.
 */
export function prefillSets(
  target: Prescription,
  history: Performance[],
  recommendations: Recommendation[],
): WorkoutSet[] {
  const last = history[0];
  if (!last) return Array.from({ length: target.sets }, () => blankSet(target.weight, null));

  const accepted = recommendations
    .filter((r) => r.decision === 'accepted' && r.exerciseId === last.exercise.exerciseId && (r.decidedAt ?? 0) >= last.workout.startedAt)
    .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))[0];

  return Array.from({ length: target.sets }, (_, i) => {
    const src = last.sets[Math.min(i, last.sets.length - 1)];
    let weight = src.weight;
    let reps = src.reps;
    if (accepted && accepted.toWeight !== null && accepted.toWeight !== src.weight) {
      // A heavier weight starts at the bottom of the range; a lighter one keeps the reps.
      if (accepted.action === 'increase') reps = target.repsMin;
      weight = accepted.toWeight;
    }
    return blankSet(weight, reps);
  });
}

export function toPrescription(pe: ProgramExercise): Prescription {
  const { sets, repsMin, repsMax, weight, restSec, intensity, rirMin, rirMax } = pe;
  return { sets, repsMin, repsMax, weight, restSec, intensity, rirMin, rirMax };
}

export function buildWorkoutExercise(
  exercise: Exercise,
  target: Prescription,
  opts: { programExerciseId?: string | null; alternatives?: string[]; notes?: string; originalExerciseId?: string | null },
  history: Performance[],
  recommendations: Recommendation[],
): WorkoutExercise {
  return {
    id: newId('wex'),
    exerciseId: exercise.id,
    originalExerciseId: opts.originalExerciseId ?? null,
    programExerciseId: opts.programExerciseId ?? null,
    name: exercise.name,
    target,
    alternatives: opts.alternatives ?? [],
    notes: opts.notes ?? '',
    status: 'pending',
    startedAt: null,
    finishedAt: null,
    sets: prefillSets(target, history, recommendations),
  };
}

export interface WorkoutContext {
  exercises: Map<string, Exercise>;
  workouts: Workout[];
  recommendations: Recommendation[];
  now?: number;
}

export function createWorkout(program: Program, item: SequenceItem, ctx: WorkoutContext): Workout {
  const now = ctx.now ?? Date.now();
  const exercises = item.day.exercises
    .map((pe) => {
      const ex = ctx.exercises.get(pe.exerciseId);
      if (!ex) return null;
      return buildWorkoutExercise(
        ex, toPrescription(pe),
        { programExerciseId: pe.id, alternatives: pe.alternatives, notes: pe.notes },
        performances(ctx.workouts, ex.id), ctx.recommendations,
      );
    })
    .filter((x): x is WorkoutExercise => x !== null);
  if (exercises[0]) {
    exercises[0].status = 'active';
    exercises[0].startedAt = now;
  }
  return {
    id: newId('wo'),
    status: 'in_progress',
    date: toLocalDate(now),
    programId: program.id,
    programName: program.name,
    blockId: item.block.id,
    blockName: program.blocks.length > 1 ? item.block.name : '',
    dayId: item.day.id,
    dayName: item.day.name,
    sequenceIndex: item.index,
    startedAt: now,
    finishedAt: null,
    pausedAt: null,
    pausedMs: 0,
    currentExercise: 0,
    rest: null,
    exercises,
    comment: '',
    manual: false,
  };
}

/** A completed placeholder created from the calendar ("mark as done" without logging sets). */
export function createManualWorkout(date: string, program: Program | null, item: SequenceItem | null, now = Date.now()): Workout {
  return {
    id: newId('wo'), status: 'completed', date,
    programId: program?.id ?? null, programName: program?.name ?? '',
    blockId: item?.block.id ?? null, blockName: item && program && program.blocks.length > 1 ? item.block.name : '',
    dayId: item?.day.id ?? null, dayName: item?.day.name ?? 'Тренировка',
    sequenceIndex: item?.index ?? null,
    startedAt: now, finishedAt: now, pausedAt: null, pausedMs: 0,
    currentExercise: 0, rest: null, exercises: [], comment: 'Отмечено вручную', manual: true,
  };
}

// ---------- timers ----------

export function elapsedMs(w: Workout, now = Date.now()): number {
  const end = w.finishedAt ?? w.pausedAt ?? now;
  return Math.max(0, end - w.startedAt - w.pausedMs);
}

export function restRemainingMs(r: RestTimer, now = Date.now()): number {
  const elapsed = (r.pausedAt ?? now) - r.startedAt - r.pausedMs;
  return r.durationMs - elapsed;
}

export function restElapsedSec(r: RestTimer, now = Date.now()): number {
  return Math.max(0, Math.round(((r.pausedAt ?? now) - r.startedAt - r.pausedMs) / 1000));
}

// ---------- mutations ----------

function mapExercise(w: Workout, exIdx: number, fn: (e: WorkoutExercise) => WorkoutExercise): Workout {
  return { ...w, exercises: w.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) };
}

/** Rest finished/skipped: store how long the user actually rested after that set. */
function closeRest(w: Workout, now: number): Workout {
  if (!w.rest) return w;
  const taken = restElapsedSec(w.rest, now);
  const setId = w.rest.setId;
  return {
    ...w,
    rest: null,
    exercises: w.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === setId ? { ...s, restTakenSec: taken } : s)),
    })),
  };
}

export function updateSet(w: Workout, exIdx: number, setId: string, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rir'>>): Workout {
  return mapExercise(w, exIdx, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
}

/**
 * Confirms a set. Idempotent: confirming an already-done set only updates its values.
 * Starts the rest timer unless it was the very last set of the workout.
 */
export function completeSet(w: Workout, exIdx: number, setId: string, now = Date.now()): Workout {
  const ex = w.exercises[exIdx];
  const set = ex?.sets.find((s) => s.id === setId);
  if (!ex || !set || set.done) return w;
  let next = closeRest(w, now);
  next = mapExercise(next, exIdx, (e) => {
    // Empty following sets (first time doing the exercise) inherit the values just performed.
    const sets = e.sets.map((s) => {
      if (s.id === setId) return { ...s, done: true, completedAt: now };
      if (s.done) return s;
      return { ...s, weight: s.weight ?? set.weight, reps: s.reps ?? set.reps };
    });
    const allDone = sets.every((s) => s.done);
    return { ...e, sets, status: allDone ? 'done' : 'active', startedAt: e.startedAt ?? now, finishedAt: allDone ? now : null };
  });
  const isLast = exIdx === w.exercises.length - 1 && next.exercises[exIdx].status === 'done';
  if (!isLast) {
    next = { ...next, rest: { setId, startedAt: now, durationMs: ex.target.restSec * 1000, pausedAt: null, pausedMs: 0 } };
  }
  return next;
}

/** Re-opens a done set for editing (values stay). */
export function uncompleteSet(w: Workout, exIdx: number, setId: string): Workout {
  return mapExercise(w, exIdx, (e) => ({
    ...e,
    status: 'active',
    finishedAt: null,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, done: false, completedAt: null } : s)),
  }));
}

export function addSet(w: Workout, exIdx: number): Workout {
  return mapExercise(w, exIdx, (e) => {
    const last = e.sets[e.sets.length - 1];
    return { ...e, status: e.status === 'done' ? 'active' : e.status, finishedAt: null, sets: [...e.sets, blankSet(last?.weight ?? null, last?.reps ?? null)] };
  });
}

export function removeSet(w: Workout, exIdx: number, setId: string): Workout {
  const next = mapExercise(w, exIdx, (e) => {
    const sets = e.sets.filter((s) => s.id !== setId);
    const allDone = sets.length > 0 && sets.every((s) => s.done);
    return { ...e, sets, status: allDone ? 'done' : e.status };
  });
  return next.rest?.setId === setId ? { ...next, rest: null } : next;
}

export function goToExercise(w: Workout, exIdx: number, now = Date.now()): Workout {
  if (exIdx < 0 || exIdx >= w.exercises.length) return w;
  const next = mapExercise(w, exIdx, (e) => ({
    ...e,
    status: e.status === 'pending' || e.status === 'skipped' ? 'active' : e.status,
    startedAt: e.startedAt ?? now,
  }));
  return { ...next, currentExercise: exIdx };
}

/** Next exercise that still has work to do, after `from`, wrapping around. -1 if none. */
export function nextUnfinished(w: Workout, from: number): number {
  const n = w.exercises.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const s = w.exercises[i].status;
    if (s === 'pending' || s === 'active') return i;
  }
  return -1;
}

export function skipExercise(w: Workout, exIdx: number, now = Date.now()): Workout {
  let next = mapExercise(w, exIdx, (e) => ({ ...e, status: e.sets.some((s) => s.done) ? 'done' : 'skipped', finishedAt: now }));
  const target = nextUnfinished(next, exIdx);
  if (target >= 0) next = goToExercise(next, target, now);
  return next;
}

/**
 * Swaps an exercise only inside this workout. The program stays as is; history of the
 * original exercise is untouched, the new one gets its own history from now on.
 */
export function replaceExercise(w: Workout, exIdx: number, replacement: WorkoutExercise): Workout {
  const old = w.exercises[exIdx];
  if (!old) return w;
  const swapped: WorkoutExercise = {
    ...replacement,
    originalExerciseId: old.originalExerciseId ?? old.exerciseId,
    programExerciseId: old.programExerciseId,
    alternatives: old.alternatives,
    status: 'active',
    startedAt: Date.now(),
  };
  const doneOld = old.sets.filter((s) => s.done);
  const exercises = [...w.exercises];
  if (doneOld.length) {
    // Preserve the already performed part as its own entry so no logged set is lost.
    exercises.splice(exIdx, 1, { ...old, status: 'done', sets: doneOld, finishedAt: Date.now() }, swapped);
    return { ...w, exercises, currentExercise: exIdx + 1 };
  }
  exercises[exIdx] = swapped;
  return { ...w, exercises };
}

export function addExercise(w: Workout, ex: WorkoutExercise): Workout {
  return { ...w, exercises: [...w.exercises, ex] };
}

export function pauseWorkout(w: Workout, now = Date.now()): Workout {
  if (w.pausedAt) return w;
  return { ...w, pausedAt: now, rest: w.rest && !w.rest.pausedAt ? { ...w.rest, pausedAt: now } : w.rest };
}

export function resumeWorkout(w: Workout, now = Date.now()): Workout {
  if (!w.pausedAt) return w;
  const span = now - w.pausedAt;
  return {
    ...w,
    pausedAt: null,
    pausedMs: w.pausedMs + span,
    rest: w.rest?.pausedAt ? { ...w.rest, pausedAt: null, pausedMs: w.rest.pausedMs + (now - w.rest.pausedAt) } : w.rest,
  };
}

export function toggleRestPause(w: Workout, now = Date.now()): Workout {
  const r = w.rest;
  if (!r) return w;
  return {
    ...w,
    rest: r.pausedAt
      ? { ...r, pausedAt: null, pausedMs: r.pausedMs + (now - r.pausedAt) }
      : { ...r, pausedAt: now },
  };
}

export function adjustRest(w: Workout, deltaSec: number): Workout {
  if (!w.rest) return w;
  return { ...w, rest: { ...w.rest, durationMs: Math.max(0, w.rest.durationMs + deltaSec * 1000) } };
}

export const skipRest = (w: Workout, now = Date.now()) => closeRest(w, now);

export function finishWorkout(w: Workout, comment: string, now = Date.now()): Workout {
  let next = closeRest(resumeWorkout(w, now), now);
  next = {
    ...next,
    exercises: next.exercises.map((e) => ({
      ...e,
      // Unconfirmed prefilled sets are suggestions, not results — drop them.
      sets: e.sets.filter((s) => s.done),
      status: e.sets.some((s) => s.done) ? 'done' : 'skipped',
      finishedAt: e.finishedAt ?? (e.sets.some((s) => s.done) ? now : null),
    })),
  };
  return { ...next, status: 'completed', finishedAt: now, comment };
}

// ---------- summary ----------

export const isWeighted = (s: WorkoutSet) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0;

export function workoutVolume(w: Workout): number {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done && isWeighted(s)) v += s.weight! * s.reps!;
  return v;
}

export const doneSetsCount = (w: Workout) => w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

export interface BestSet {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  e1rm: number;
  /** New personal best by estimated 1RM or by max weight compared to all previous workouts. */
  record: 'e1rm' | 'weight' | null;
}

export function bestSets(w: Workout, history: Workout[]): BestSet[] {
  const out: BestSet[] = [];
  for (const e of w.exercises) {
    const sets = e.sets.filter((s) => s.done && isWeighted(s));
    if (!sets.length) continue;
    const top = sets.reduce((a, b) => (estimate1RM(b.weight!, b.reps!, null) > estimate1RM(a.weight!, a.reps!, null) ? b : a));
    const prev = performances(history, e.exerciseId, w.id).filter((p) => p.workout.startedAt < w.startedAt);
    const prevSets = prev.flatMap((p) => p.sets.filter(isWeighted));
    const prevE1 = Math.max(0, ...prevSets.map((s) => estimate1RM(s.weight!, s.reps!, null)));
    const prevMax = Math.max(0, ...prevSets.map((s) => s.weight!));
    const e1rm = estimate1RM(top.weight!, top.reps!, null);
    const maxW = Math.max(...sets.map((s) => s.weight!));
    let record: BestSet['record'] = null;
    if (prevSets.length) {
      if (maxW > prevMax) record = 'weight';
      else if (e1rm > prevE1 + 0.01) record = 'e1rm';
    }
    out.push({ exerciseId: e.exerciseId, name: e.name, weight: top.weight!, reps: top.reps!, e1rm, record });
  }
  return out;
}

export function newExerciseTarget(ex: Exercise, defaults?: Partial<Prescription>): Prescription {
  return {
    sets: 3, repsMin: 8, repsMax: 12, weight: null, restSec: defaultRestSec(ex),
    intensity: null, rirMin: null, rirMax: null, ...defaults,
  };
}
