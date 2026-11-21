import type { Workout, WeightEntry } from './types';
import { doneSetsCount, elapsedMs, isWeighted, workoutVolume } from './workout';
import { estimate1RM } from './adaptiveLoad';

export interface OverallStats {
  workouts: number;
  totalMs: number;
  avgMs: number;
  sets: number;
  volume: number;
}

export function overallStats(workouts: Workout[]): OverallStats {
  const done = workouts.filter((w) => w.status === 'completed');
  const timed = done.filter((w) => !w.manual);
  const totalMs = timed.reduce((t, w) => t + elapsedMs(w), 0);
  return {
    workouts: done.length,
    totalMs,
    avgMs: timed.length ? totalMs / timed.length : 0,
    sets: done.reduce((n, w) => n + doneSetsCount(w), 0),
    volume: done.reduce((v, w) => v + workoutVolume(w), 0),
  };
}

export interface ExercisePoint {
  date: string;
  startedAt: number;
  /** Heaviest working weight in the session. */
  topWeight: number;
  /** Reps achieved with the top weight (best set at that weight). */
  topReps: number;
  totalReps: number;
  e1rm: number;
}

export interface ExerciseStats {
  points: ExercisePoint[];
  totalSets: number;
  record: { weight: number; reps: number; date: string } | null;
  best: { weight: number; reps: number; e1rm: number; date: string } | null;
  lastWeight: number | null;
}

export function exerciseStats(workouts: Workout[], exerciseId: string): ExerciseStats {
  const points: ExercisePoint[] = [];
  let totalSets = 0;
  let record: ExerciseStats['record'] = null;
  let best: ExerciseStats['best'] = null;

  const sorted = workouts.filter((w) => w.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.done && s.reps));
    if (!sets.length) continue;
    totalSets += sets.length;
    const weighted = sets.filter(isWeighted);
    const topWeight = Math.max(0, ...sets.map((s) => s.weight ?? 0));
    const topReps = Math.max(...sets.filter((s) => (s.weight ?? 0) === topWeight).map((s) => s.reps!));
    const e1rm = Math.max(0, ...weighted.map((s) => estimate1RM(s.weight!, s.reps!, null)));
    points.push({ date: w.date, startedAt: w.startedAt, topWeight, topReps, totalReps: sets.reduce((n, s) => n + s.reps!, 0), e1rm });
    if (!record || topWeight > record.weight || (topWeight === record.weight && topReps > record.reps)) {
      record = { weight: topWeight, reps: topReps, date: w.date };
    }
    for (const s of weighted) {
      const v = estimate1RM(s.weight!, s.reps!, null);
      if (!best || v > best.e1rm) best = { weight: s.weight!, reps: s.reps!, e1rm: v, date: w.date };
    }
  }
  return { points, totalSets, record, best, lastWeight: points.length ? points[points.length - 1].topWeight : null };
}

export const sortedWeights = (entries: Iterable<WeightEntry>) =>
  [...entries].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

export function currentBodyWeight(entries: Iterable<WeightEntry>): WeightEntry | null {
  const s = sortedWeights(entries);
  return s.length ? s[s.length - 1] : null;
}
