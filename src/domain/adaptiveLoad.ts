import type { Equipment, Exercise, LoadAction, Prescription, Settings } from './types';

/**
 * AdaptiveLoadEngine — suggests the load for the next session from the last one.
 *
 * Effort is judged against the exercise's TARGET reps-in-reserve, not a fixed scale:
 * in a "light" block (target RIR 5–6) a set with RIR 5 is exactly on plan, while in a
 * default block (target 1–2) the same set means the weight is too light.
 *
 * The engine never changes anything by itself — it returns a suggestion with a reason,
 * and the user accepts or rejects it.
 */

export interface EngineSet {
  weight: number | null;
  reps: number | null;
  rir: number | null;
}

export type EngineRule =
  | 'too_easy' | 'top_confirmed' | 'top_once' | 'on_target' | 'below_range'
  | 'failure' | 'failure_at_top' | 'reps_progression' | 'bodyweight_top' | 'no_rir' | 'unclear';

export interface LoadRecommendation {
  action: LoadAction;
  currentWeight: number | null;
  suggestedWeight: number | null;
  rule: EngineRule;
  reason: string;
}

export interface EngineInput {
  prescription: Pick<Prescription, 'repsMin' | 'repsMax' | 'rirMin' | 'rirMax'>;
  exercise: Pick<Exercise, 'equipment' | 'mechanics' | 'primary'>;
  /** Completed working sets of the latest session. */
  sets: EngineSet[];
  /** Completed sets of the session before that, if any — used to confirm progress. */
  previous?: EngineSet[] | null;
  increment: number;
}

export const DEFAULT_TARGET_RIR: [number, number] = [1, 2];

export const DEFAULT_INCREMENTS: Record<Equipment, number> = {
  barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, smith: 2.5, ezbar: 2.5,
  bodyweight: 2.5, kettlebell: 4, band: 0, other: 2.5,
};

export const incrementFor = (equipment: Equipment, settings?: Settings | null) =>
  settings?.increments[equipment] ?? DEFAULT_INCREMENTS[equipment];

export function targetRir(p: Pick<Prescription, 'rirMin' | 'rirMax'>): [number, number] {
  if (p.rirMin === null || p.rirMax === null) return DEFAULT_TARGET_RIR;
  return [p.rirMin, p.rirMax];
}

/** Rounds to the nearest multiple of `step` (0 step → one decimal). */
export function roundTo(w: number, step: number): number {
  if (step <= 0) return Math.round(w * 10) / 10;
  return Math.round(Math.round(w / step) * step * 100) / 100;
}

/** Change of at least one increment, otherwise the nearest step change for the given percentage. */
function stepChange(weight: number, pct: number, increment: number, dir: 1 | -1): number {
  const step = increment > 0 ? increment : 0.5;
  const delta = Math.max(step, roundTo(weight * pct, step));
  return Math.max(0, roundTo(weight + dir * delta, step));
}

/** Lower-body compounds tolerate bigger jumps; isolation lifts use small weights so a step is relatively large. */
function basePct(ex: EngineInput['exercise']): number {
  if (ex.mechanics === 'compound' && ex.primary === 'legs') return 0.05;
  if (ex.mechanics === 'compound') return 0.025;
  return 0.05;
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function recommendLoad(input: EngineInput): LoadRecommendation | null {
  const { prescription: p, exercise, increment } = input;
  const sets = input.sets.filter((s) => s.reps !== null && s.reps > 0);
  if (!sets.length) return null;

  const [rirLo, rirHi] = targetRir(p);
  const weights = sets.map((s) => s.weight ?? 0);
  const weight = Math.max(...weights);
  const n = sets.length;
  const reps = sets.map((s) => s.reps!);
  const rirs = sets.map((s) => s.rir).filter((r): r is number => r !== null);
  const hasRir = rirs.length === n;
  const avgRir = rirs.length ? mean(rirs) : null;
  const minRir = rirs.length ? Math.min(...rirs) : null;
  const below = reps.filter((r) => r < p.repsMin).length;
  const allTop = reps.every((r) => r >= p.repsMax);
  const failures = rirs.filter((r) => r === 0).length;
  const rangeText = p.repsMin === p.repsMax ? `${p.repsMax}` : `${p.repsMin}–${p.repsMax}`;
  const targetText = rirLo === rirHi ? `${rirLo}` : `${rirLo}–${rirHi}`;
  const keep = (rule: EngineRule, reason: string): LoadRecommendation =>
    ({ action: 'keep', currentWeight: weight || null, suggestedWeight: weight || null, rule, reason });

  // Bodyweight exercises without extra load progress by reps first.
  if (weight === 0) {
    if (allTop && (minRir === null || minRir >= rirLo)) {
      return {
        action: 'increase', currentWeight: null, suggestedWeight: exercise.equipment === 'bodyweight' ? increment : null,
        rule: 'bodyweight_top',
        reason: `Все подходы на верхней границе (${p.repsMax}) — добавьте отягощение или поднимите диапазон повторений.`,
      };
    }
    return keep('reps_progression', 'Работа с собственным весом: добавляйте по повторению, пока все подходы не достигнут верхней границы.');
  }

  // Rule 3: most sets below the range — the weight is too heavy.
  if (below > n / 2) {
    const deficit = p.repsMin - mean(reps);
    const pct = deficit >= 2 || failures > 0 ? 0.05 : 0.025;
    return {
      action: 'decrease', currentWeight: weight, suggestedWeight: stepChange(weight, pct, increment, -1), rule: 'below_range',
      reason: `В ${below} из ${n} подходов меньше ${p.repsMin} повторений — вес слишком большой для диапазона ${rangeText}. Снижение на ~${Math.round(pct * 100)}%.`,
    };
  }

  // Rule 4: failure when the plan did not ask for it — never increase, maybe decrease.
  if (failures > 0 && rirLo > 0) {
    if (failures >= Math.ceil(n / 2) && !allTop) {
      return {
        action: 'decrease', currentWeight: weight, suggestedWeight: stepChange(weight, 0.025, increment, -1), rule: 'failure',
        reason: `${failures} из ${n} подходов до отказа (RIR 0), а план — RIR ${targetText}. Немного снизим вес, чтобы держать запас.`,
      };
    }
    return keep(allTop ? 'failure_at_top' : 'failure',
      allTop
        ? `Верхняя граница достигнута, но через отказ. Закрепите вес ${fmt(weight)} кг с запасом ${targetText}.`
        : `Были подходы до отказа при плане RIR ${targetText} — вес не увеличиваем.`);
  }

  if (allTop) {
    if (!hasRir) return keep('no_rir', 'Все подходы на верхней границе, но RIR указан не везде. Отметьте RIR, чтобы движок мог предложить прибавку.');
    // Rule 1: top of the range with clearly more reserve than planned.
    if (minRir! > rirHi) {
      const easy = avgRir! - rirHi;
      const pct = Math.min(0.05, Math.max(0.02, basePct(exercise) + (easy >= 3 ? 0.025 : 0)));
      return {
        action: 'increase', currentWeight: weight, suggestedWeight: stepChange(weight, pct, increment, 1), rule: 'too_easy',
        reason: `Все подходы на ${p.repsMax}+ повторений с запасом RIR ${fmt(minRir!)}–${fmt(Math.max(...rirs))} (план ${targetText}). Можно прибавить ~${Math.round(pct * 100)}%.`,
      };
    }
    // Top of the range exactly at planned effort: confirm once more before adding weight (double progression).
    const prev = input.previous?.filter((s) => s.reps !== null && s.reps > 0) ?? [];
    const prevTop = prev.length > 0 && prev.every((s) => (s.weight ?? 0) >= weight && s.reps! >= p.repsMax);
    if (prevTop) {
      return {
        action: 'increase', currentWeight: weight, suggestedWeight: stepChange(weight, basePct(exercise) / 2, increment, 1), rule: 'top_confirmed',
        reason: `Вторую тренировку подряд все подходы на верхней границе (${p.repsMax}) при плановом RIR ${targetText}. Минимальная прибавка.`,
      };
    }
    return keep('top_once', `Верхняя граница достигнута при плановом усилии (RIR ${targetText}). Повторите вес ${fmt(weight)} кг — если получится снова, прибавим.`);
  }

  // Rule 2: within range and effort on plan.
  if (avgRir !== null && avgRir >= rirLo - 0.5 && avgRir <= rirHi + 0.5) {
    return keep('on_target', `Повторения в диапазоне ${rangeText}, RIR по плану (${targetText}). Оставляем ${fmt(weight)} кг и добираем повторения.`);
  }
  if (avgRir !== null && avgRir > rirHi + 0.5) {
    return keep('on_target', `Запас больше плана (RIR ≈${fmt(avgRir)} при цели ${targetText}). Добавляйте повторения до ${p.repsMax} — потом прибавим вес.`);
  }

  // Rule 5: mixed picture — keep and collect more data.
  return keep('unclear', hasRir
    ? 'Результаты неоднозначны — оставляем вес и смотрим на следующую тренировку.'
    : 'Недостаточно данных по RIR — оставляем вес. Отмечайте RIR в каждом подходе.');
}

/** Estimated 1RM with reps in reserve: Epley on (reps + RIR). */
export function estimate1RM(weight: number, reps: number, rir: number | null): number {
  return weight * (1 + (reps + (rir ?? 0)) / 30);
}

/**
 * When a periodized program switches an exercise to a different intensity (e.g. heavy → light block),
 * last session's weight is not a good starting point. Suggest a weight from the estimated 1RM.
 */
export function intensityAdjustment(
  last: { sets: EngineSet[]; target: Pick<Prescription, 'rirMin' | 'rirMax' | 'repsMin' | 'repsMax'> },
  next: Pick<Prescription, 'rirMin' | 'rirMax' | 'repsMin' | 'repsMax'>,
  increment: number,
): { weight: number; lastWeight: number; reason: string } | null {
  const [lastLo, lastHi] = targetRir(last.target);
  const [nextLo, nextHi] = targetRir(next);
  if (lastLo === nextLo && lastHi === nextHi && last.target.repsMin === next.repsMin && last.target.repsMax === next.repsMax) return null;
  const valid = last.sets.filter((s) => s.weight && s.reps);
  if (!valid.length) return null;
  const lastWeight = Math.max(...valid.map((s) => s.weight!));
  const fallbackRir = (lastLo + lastHi) / 2;
  const e1rm = Math.max(...valid.map((s) => estimate1RM(s.weight!, s.reps!, s.rir ?? fallbackRir)));
  const reps = (next.repsMin + next.repsMax) / 2;
  const rir = (nextLo + nextHi) / 2;
  const raw = e1rm / (1 + (reps + rir) / 30);
  const weight = roundTo(raw, increment || 0.5);
  if (Math.abs(weight - lastWeight) < Math.max(increment, 0.5)) return null;
  const dir = weight < lastWeight ? 'легче' : 'тяжелее';
  return {
    weight,
    lastWeight,
    reason: `Интенсивность изменилась (RIR ${lastLo}–${lastHi} → ${nextLo}–${nextHi}). По оценке силы на ${Math.round(reps)} повт. с запасом ${nextLo}–${nextHi} подойдёт ~${fmt(weight)} кг — ${dir} прошлого ${fmt(lastWeight)} кг.`,
  };
}
