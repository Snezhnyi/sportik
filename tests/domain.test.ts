import { describe, expect, it } from 'vitest';
import { intensityAdjustment, recommendLoad, type EngineInput } from '../src/domain/adaptiveLoad';
import { buildCalendar, programSequence } from '../src/domain/schedule';
import * as W from '../src/domain/workout';
import type { Program, Workout } from '../src/domain/types';
import { BUILTIN_EXERCISES } from '../src/domain/exerciseLibrary';

const bench = { equipment: 'barbell', mechanics: 'compound', primary: 'chest' } as const;
const base = (sets: [number, number, number | null][], extra: Partial<EngineInput> = {}): EngineInput => ({
  prescription: { repsMin: 8, repsMax: 12, rirMin: null, rirMax: null },
  exercise: bench,
  sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir })),
  increment: 2.5,
  ...extra,
});

describe('AdaptiveLoadEngine', () => {
  it('rule 1: all top reps with RIR 3–6 → increase 2–5%', () => {
    const r = recommendLoad(base([[60, 12, 4], [60, 12, 3], [60, 12, 3]]))!;
    expect(r.action).toBe('increase');
    expect(r.suggestedWeight).toBe(62.5);
  });

  it('rule 2: in range with RIR 1–2 → keep', () => {
    expect(recommendLoad(base([[60, 10, 2], [60, 9, 1], [60, 9, 1]]))!.action).toBe('keep');
  });

  it('rule 3: most sets below range → decrease', () => {
    const r = recommendLoad(base([[60, 7, 0], [60, 6, 0], [60, 9, 1]]))!;
    expect(r.action).toBe('decrease');
    expect(r.suggestedWeight).toBeLessThan(60);
  });

  it('rule 4: unplanned failure → never increase', () => {
    const r = recommendLoad(base([[60, 12, 0], [60, 12, 3], [60, 12, 4]]))!;
    expect(r.action).not.toBe('increase');
  });

  it('respects target RIR from intensity: RIR 5 in a light block is on plan', () => {
    const r = recommendLoad(base([[50, 10, 5], [50, 10, 6], [50, 10, 5]], { prescription: { repsMin: 8, repsMax: 12, rirMin: 5, rirMax: 6 } }))!;
    expect(r.action).toBe('keep');
  });

  it('failure is fine in a heavy block (target RIR 0–1)', () => {
    const r = recommendLoad(base([[70, 9, 0], [70, 8, 0], [70, 8, 1]], { prescription: { repsMin: 8, repsMax: 12, rirMin: 0, rirMax: 1 } }))!;
    expect(r.action).toBe('keep');
  });

  it('double progression: top of range on target twice in a row → small increase', () => {
    const sets: [number, number, number][] = [[60, 12, 2], [60, 12, 2], [60, 12, 1]];
    expect(recommendLoad(base(sets))!.rule).toBe('top_once');
    const r = recommendLoad(base(sets, { previous: sets.map(([weight, reps, rir]) => ({ weight, reps, rir })) }))!;
    expect(r.action).toBe('increase');
  });

  it('uses the configured minimal increment', () => {
    const r = recommendLoad(base([[20, 12, 5], [20, 12, 5]], { exercise: { equipment: 'machine', mechanics: 'isolation', primary: 'legs' }, increment: 5 }))!;
    expect(r.suggestedWeight).toBe(25);
  });

  it('suggests lower weight when switching from heavy to light intensity', () => {
    const adj = intensityAdjustment(
      { sets: [{ weight: 70, reps: 8, rir: 1 }], target: { repsMin: 8, repsMax: 12, rirMin: 0, rirMax: 1 } },
      { repsMin: 8, repsMax: 12, rirMin: 5, rirMax: 6 },
      2.5,
    )!;
    expect(adj.weight).toBeLessThan(70);
  });
});

function program(): Program {
  const ex = (exerciseId: string) => ({ id: `pe-${exerciseId}`, exerciseId, sets: 3, repsMin: 8, repsMax: 12, weight: null, restSec: 90, intensity: null, rirMin: null, rirMax: null, notes: '', alternatives: [] });
  return {
    id: 'p', name: 'P', description: '', createdAt: 0, updatedAt: 0, status: 'active', activatedAt: 0, progressIndex: 0,
    schedule: { kind: 'cycle', cycle: ['train', 'train', 'rest', 'rest'], weekdays: [], startDate: '2026-11-02', blockRepeats: 1 },
    blocks: [
      { id: 'b1', name: 'Блок 1', days: [{ id: 'd1', name: 'Т1', focus: '', exercises: [ex('ex.bench_press')] }, { id: 'd2', name: 'Т2', focus: '', exercises: [ex('ex.back_squat')] }] },
      { id: 'b2', name: 'Блок 2', days: [{ id: 'd3', name: 'Т1', focus: '', exercises: [ex('ex.bench_press')] }, { id: 'd4', name: 'Т2', focus: '', exercises: [ex('ex.back_squat')] }] },
    ],
  };
}

describe('schedule', () => {
  it('month ranges end on the last day (31st does not overflow)', () => {
    const days = buildCalendar('2026-10-01', '2026-10-31', { program: null, workouts: [], overrides: new Map(), today: '2026-10-31' });
    expect(days).toHaveLength(31);
    expect(days[30].date).toBe('2026-10-31');
  });

  it('flattens blocks into a sequence', () => {
    expect(programSequence(program()).map((s) => `${s.block.name}/${s.day.name}`)).toEqual(['Блок 1/Т1', 'Блок 1/Т2', 'Блок 2/Т1', 'Блок 2/Т2']);
  });

  it('2x2 calendar: planned / rest / missed / done', () => {
    const p = program();
    const done = { id: 'w', status: 'completed', date: '2026-11-02' } as Workout;
    const days = buildCalendar('2026-11-02', '2026-11-09', { program: p, workouts: [done], overrides: new Map(), today: '2026-11-04' });
    expect(days.map((d) => d.status)).toEqual(['done', 'missed', 'rest', 'rest', 'planned', 'planned', 'rest', 'rest']);
    expect(days[4].plannedName).toBe('Т1');
  });

  it('manual rest override removes a planned day', () => {
    const days = buildCalendar('2026-11-06', '2026-11-06', {
      program: program(), workouts: [], overrides: new Map([['2026-11-06', { date: '2026-11-06', mark: 'rest', note: '' }]]), today: '2026-11-01',
    });
    expect(days[0].status).toBe('rest');
  });
});

describe('workout flow', () => {
  const exercises = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
  const p = program();
  const item = programSequence(p)[0];

  it('first time: no prefilled reps; second time: prefilled from last performance', () => {
    let w = W.createWorkout(p, item, { exercises, workouts: [], recommendations: [], now: 1000 });
    expect(w.exercises[0].sets.map((s) => s.reps)).toEqual([null, null, null]);
    const ids = w.exercises[0].sets.map((s) => s.id);
    [[40, 12], [40, 11], [40, 10]].forEach(([wt, r], i) => {
      w = W.updateSet(w, 0, ids[i], { weight: wt, reps: r, rir: 2 });
      w = W.completeSet(w, 0, ids[i], 2000 + i);
    });
    const done = W.finishWorkout(w, '', 5000);
    const next = W.createWorkout(p, item, { exercises, workouts: [done], recommendations: [], now: 10_000 });
    expect(next.exercises[0].sets.map((s) => [s.weight, s.reps, s.done])).toEqual([[40, 12, false], [40, 11, false], [40, 10, false]]);
  });

  it('completing the same set twice is a no-op; rest timer survives a "reload"', () => {
    let w = W.createWorkout(p, item, { exercises, workouts: [], recommendations: [], now: 0 });
    const id = w.exercises[0].sets[0].id;
    w = W.updateSet(w, 0, id, { weight: 50, reps: 10 });
    w = W.completeSet(w, 0, id, 1000);
    const again = W.completeSet(w, 0, id, 2000);
    expect(again).toBe(w);
    const restored = JSON.parse(JSON.stringify(w)) as Workout;
    expect(W.restRemainingMs(restored.rest!, 31_000)).toBe(60_000);
    expect(W.elapsedMs(restored, 31_000)).toBe(31_000);
  });

  it('pause stops the workout clock, rest does not', () => {
    let w = W.createWorkout(p, item, { exercises, workouts: [], recommendations: [], now: 0 });
    w = W.pauseWorkout(w, 10_000);
    w = W.resumeWorkout(w, 70_000);
    expect(W.elapsedMs(w, 80_000)).toBe(20_000);
  });

  it('replacing mid-workout keeps done sets of the original as a separate entry', () => {
    let w = W.createWorkout(p, item, { exercises, workouts: [], recommendations: [], now: 0 });
    const id = w.exercises[0].sets[0].id;
    w = W.completeSet(W.updateSet(w, 0, id, { weight: 50, reps: 10 }), 0, id, 1);
    const repl = W.buildWorkoutExercise(exercises.get('ex.db_bench_press')!, w.exercises[0].target, {}, [], []);
    w = W.replaceExercise(w, 0, repl);
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['ex.bench_press', 'ex.db_bench_press']);
    expect(w.exercises[1].originalExerciseId).toBe('ex.bench_press');
  });

  it('finishing drops unconfirmed suggestions', () => {
    const w = W.createWorkout(p, item, { exercises, workouts: [], recommendations: [], now: 0 });
    const f = W.finishWorkout(W.updateSet(w, 0, w.exercises[0].sets[0].id, { weight: 10, reps: 10 }), '', 100);
    expect(f.exercises[0].sets).toHaveLength(0);
    expect(f.exercises[0].status).toBe('skipped');
  });
});
