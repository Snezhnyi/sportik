import type { Exercise, MuscleGroup, Program, ProgramBlock, ProgramSchedule } from '../domain/types';
import { defaultRestSec, findExerciseByName, normalizeName } from '../domain/exerciseLibrary';
import type { ImportedExercise, ParseResult } from './parseTable';
import { newId } from '../lib/id';
import { toLocalDate } from '../lib/dates';

/** Editable state of the import preview. */
export interface DraftExercise extends ImportedExercise {
  key: string;
  /** Matched library exercise; null — a new custom exercise will be created. */
  exerciseId: string | null;
  newPrimary: MuscleGroup;
}
export interface DraftDay { key: string; name: string; exercises: DraftExercise[] }
export interface DraftBlock { key: string; name: string; days: DraftDay[] }
export interface ImportDraft {
  name: string;
  description: string;
  schedule: ProgramSchedule;
  blocks: DraftBlock[];
}

const MUSCLE_HINTS: [RegExp, MuscleGroup][] = [
  [/кист|предплеч|запяст|хват/, 'forearms'],
  [/бицепс|молот|сгибани[ея] рук/, 'biceps'],
  [/трицепс|французск|разгибани[ея] рук|брусь/, 'triceps'],
  [/присед|выпад|ног|бедр|икр|носк|ягод|румынск|гакк/, 'legs'],
  [/дельт|плеч|махи|отведени|армейск|жим .*сидя|жим .*стоя|протяжк/, 'shoulders'],
  [/тяга|подтяг|спин|гиперэкст|шраг/, 'back'],
  [/жим .*леж|груд|отжим|сведени|развод|бабочк|кроссовер/, 'chest'],
  [/пресс|скручив|планк/, 'abs'],
  [/бег|велос|кардио|гребл|эллипс|скакалк/, 'cardio'],
];

export function guessMuscle(name: string): MuscleGroup {
  const n = normalizeName(name);
  for (const [re, m] of MUSCLE_HINTS) if (re.test(n)) return m;
  return 'other';
}

/** 2 days per block → 2x2 cycle (the most common split for such programs); 3 → Mon/Wed/Fri; etc. */
export function guessSchedule(daysPerBlock: number, fileName: string): ProgramSchedule {
  const base = { cycle: [] as ProgramSchedule['cycle'], weekdays: [] as number[], startDate: toLocalDate(), blockRepeats: 1 };
  if (/2\s*[xх×]\s*2/i.test(fileName) || daysPerBlock === 2) {
    return { ...base, kind: 'cycle', cycle: ['train', 'train', 'rest', 'rest'] };
  }
  if (daysPerBlock === 3) return { ...base, kind: 'weekly', weekdays: [0, 2, 4] };
  if (daysPerBlock === 4) return { ...base, kind: 'weekly', weekdays: [0, 1, 3, 4] };
  return { ...base, kind: 'cycle', cycle: [...Array(Math.max(1, daysPerBlock)).fill('train'), 'rest'] };
}

export function toDraft(result: ParseResult, library: Exercise[], fileName: string): ImportDraft {
  const daysPerBlock = Math.max(0, ...result.blocks.map((b) => b.days.length));
  return {
    name: fileName.replace(/\.(xlsx|xls|csv|ods)$/i, '').trim() || 'Импортированная программа',
    description: `Импорт из файла ${fileName}`,
    schedule: guessSchedule(daysPerBlock, fileName),
    blocks: result.blocks.map((b) => ({
      key: newId('b'),
      name: b.name,
      days: b.days.map((d) => ({
        key: newId('d'),
        name: d.name,
        exercises: d.exercises.map((e) => ({
          ...e,
          key: newId('e'),
          exerciseId: findExerciseByName(e.name, library)?.id ?? null,
          newPrimary: guessMuscle(e.name),
        })),
      })),
    })),
  };
}

/** Converts the draft into program blocks, creating custom exercises for unmatched names (deduplicated). */
function materialize(draft: ImportDraft, library: Exercise[]): { blocks: ProgramBlock[]; newExercises: Exercise[] } {
  const created = new Map<string, Exercise>();
  const byId = new Map(library.map((e) => [e.id, e]));

  const resolve = (e: DraftExercise): Exercise => {
    if (e.exerciseId && byId.has(e.exerciseId)) return byId.get(e.exerciseId)!;
    const key = normalizeName(e.name);
    let ex = created.get(key);
    if (!ex) {
      ex = {
        id: newId('ex'), name: e.name.trim(), primary: e.newPrimary, secondary: [],
        equipment: 'other', mechanics: e.newPrimary === 'legs' || e.newPrimary === 'back' || e.newPrimary === 'chest' ? 'compound' : 'isolation',
        custom: true,
      };
      created.set(key, ex);
    }
    return ex;
  };

  const blocks = draft.blocks.map((b) => ({
    id: newId('blk'),
    name: b.name,
    days: b.days.map((d) => ({
      id: newId('day'),
      name: d.name,
      focus: '',
      exercises: d.exercises.map((e) => {
        const ex = resolve(e);
        const repsMin = e.repsMin ?? 8;
        return {
          id: newId('pex'),
          exerciseId: ex.id,
          sets: e.sets ?? 3,
          repsMin,
          repsMax: Math.max(repsMin, e.repsMax ?? repsMin),
          weight: e.weight,
          restSec: e.restSec ?? defaultRestSec(ex),
          intensity: e.intensity,
          rirMin: e.rirMin,
          rirMax: e.rirMax,
          notes: e.notes,
          alternatives: [],
        };
      }),
    })),
  }));
  return { blocks, newExercises: [...created.values()] };
}

export function draftToProgram(draft: ImportDraft, library: Exercise[], now = Date.now()): { program: Program; newExercises: Exercise[] } {
  const { blocks, newExercises } = materialize(draft, library);
  return {
    program: {
      id: newId('prg'),
      name: draft.name.trim() || 'Программа',
      description: draft.description,
      createdAt: now,
      updatedAt: now,
      status: 'saved',
      activatedAt: null,
      schedule: draft.schedule,
      blocks,
      progressIndex: 0,
    },
    newExercises,
  };
}

export type AppendResult =
  | { ok: true; program: Program; newExercises: Exercise[]; summary: string }
  | { ok: false; reason: string };

/**
 * Adds imported data to an existing program:
 *  - both single-block → imported days are appended to the program's block;
 *  - otherwise imported blocks are appended as new blocks, provided every block has the
 *    same number of days as the program's blocks (so the schedule keeps working).
 */
export function appendToProgram(program: Program, draft: ImportDraft, library: Exercise[], now = Date.now()): AppendResult {
  const { blocks, newExercises } = materialize(draft, library);
  if (!blocks.length) return { ok: false, reason: 'В файле нет упражнений для добавления.' };

  if (program.blocks.length <= 1 && blocks.length === 1) {
    const target = program.blocks[0] ?? { id: newId('blk'), name: 'Блок 1', days: [] };
    const merged = { ...target, days: [...target.days, ...blocks[0].days] };
    return {
      ok: true, newExercises,
      program: { ...program, blocks: [merged], updatedAt: now },
      summary: `Добавлено дней: ${blocks[0].days.length}`,
    };
  }

  const existingDays = program.blocks[0]?.days.length ?? 0;
  const mismatch = blocks.find((b) => b.days.length !== existingDays);
  if (existingDays && mismatch) {
    return {
      ok: false,
      reason: `Структура не совпадает: в программе по ${existingDays} дн. в блоке, а в файле в «${mismatch.name}» — ${mismatch.days.length}. Импортируйте файл как новую программу.`,
    };
  }
  const names = new Set(program.blocks.map((b) => normalizeName(b.name)));
  const renamed = blocks.map((b, i) => (names.has(normalizeName(b.name)) ? { ...b, name: `Блок ${program.blocks.length + i + 1}` } : b));
  return {
    ok: true, newExercises,
    program: { ...program, blocks: [...program.blocks, ...renamed], updatedAt: now },
    summary: `Добавлено блоков: ${blocks.length}`,
  };
}
