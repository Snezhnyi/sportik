import type { Intensity } from '../domain/types';
import { normalizeName } from '../domain/exerciseLibrary';

/**
 * Turns raw spreadsheet rows (any of .xlsx/.xls/.csv) into a structured draft program.
 * Pure function: no file APIs, no library lookups — easy to test and to reuse.
 */

export type Cell = string | number | boolean | null | undefined;

export interface SheetInput {
  name: string;
  rows: Cell[][];
}

export interface ImportedExercise {
  /** 1-based row number in the source sheet, for error messages. */
  row: number;
  sheet: string;
  name: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  restSec: number | null;
  intensity: Intensity | null;
  rirMin: number | null;
  rirMax: number | null;
  notes: string;
  /** Fields that could not be recognized and fell back to defaults. */
  issues: string[];
}

export interface ImportedDay {
  name: string;
  exercises: ImportedExercise[];
}

export interface ImportedBlock {
  name: string;
  days: ImportedDay[];
}

export interface ImportWarning {
  sheet: string;
  row: number | null;
  message: string;
}

export type ColumnKind =
  | 'name' | 'setsReps' | 'sets' | 'reps' | 'weight' | 'intensity' | 'rir' | 'rpe' | 'rest' | 'notes';

export interface ParseResult {
  blocks: ImportedBlock[];
  warnings: ImportWarning[];
  /** Detected columns per sheet, for the "what we recognized" panel. */
  columns: Record<string, Partial<Record<ColumnKind, number>>>;
  exerciseCount: number;
}

const HEADER_PATTERNS: [ColumnKind, RegExp][] = [
  ['setsReps', /подход[а-я]*\s*[xх×*]\s*повтор|sets\s*[xх×*]\s*reps|схема/],
  ['name', /упражнен|exercise|название|movement/],
  ['sets', /подход|^sets?$|сеты/],
  ['reps', /повтор|^reps?$|repetitions/],
  ['weight', /вес|weight|кг|^kg$|нагрузк/],
  ['intensity', /интенсивн|intensity|усили/],
  ['rir', /\brir\b|запас/],
  ['rpe', /\brpe\b/],
  ['rest', /отдых|rest|пауза/],
  ['notes', /коммент|заметк|примечан|notes?|comment|техник/],
];

const BLOCK_RE = /^(блок|неделя|нед\.|фаза|мезоцикл|микроцикл|цикл|этап|block|week|phase|mesocycle)(?![а-яa-z])/;
const DAY_RE = /^(тренировка|трен\.|день|занятие|workout|day|session)(?![а-яa-z])|^[a-zа-я]\s*[:.)\-—–]|^(день|day)\s*[a-zа-я0-9]/;

const SETS_REPS_RE = /(\d{1,2})\s*[xх×*]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(\s*\+)?/;
const SETS_REPS_LIST_RE = /(\d{1,2})\s*[xх×*]\s*(\d{1,3}(?:\s*[,/]\s*\d{1,3})+)/;
const SETS_WORDS_RE = /(\d{1,2})\s*подход[а-я]*\s*(?:по\s*)?(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/;
const RANGE_RE = /^(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(\s*\+)?$/;
const WEIGHT_RE = /(?:@|по)?\s*(\d+(?:[.,]\d+)?)\s*(?:кг|kg|kgs)(?![а-яa-z])/;

export const INTENSITY_RIR: Record<Intensity, [number, number]> = {
  light: [5, 6],
  medium: [3, 4],
  heavy: [0, 1],
};

const str = (c: Cell): string => (c === null || c === undefined ? '' : String(c)).replace(/\s+/g, ' ').trim();
const num = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function parseIntensity(raw: string): Intensity | null {
  const s = normalizeName(raw);
  if (/^(легк|light|easy|лайт)/.test(s)) return 'light';
  if (/^(средн|medium|moderate|умерен)/.test(s)) return 'medium';
  if (/^(тяжел|heavy|hard|максим)/.test(s)) return 'heavy';
  return null;
}

export function parseSetsReps(raw: string): { sets: number; repsMin: number; repsMax: number; weight: number | null } | null {
  const s = normalizeName(raw);
  const weight = parseWeightInText(s);
  const list = s.match(SETS_REPS_LIST_RE);
  if (list) {
    const reps = list[2].split(/[,/]/).map((x) => Number(x.trim()));
    return { sets: Number(list[1]), repsMin: Math.min(...reps), repsMax: Math.max(...reps), weight };
  }
  const m = s.match(SETS_REPS_RE) ?? s.match(SETS_WORDS_RE);
  if (!m) return null;
  const sets = Number(m[1]);
  const a = Number(m[2]);
  const b = m[3] ? Number(m[3]) : a;
  return { sets, repsMin: Math.min(a, b), repsMax: Math.max(a, b), weight };
}

function parseWeightInText(s: string): number | null {
  const m = s.match(WEIGHT_RE);
  return m ? num(m[1]) : null;
}

export function parseWeight(raw: string): number | null {
  const s = normalizeName(raw);
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)/);
  return m ? num(m[1]) : null;
}

export function parseRest(raw: string): number | null {
  const s = normalizeName(raw);
  if (!s) return null;
  const mmss = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(мин|min|м|m|сек|sec|с|s)?/);
  if (!m) return null;
  const v = num(m[1]);
  if (v === null) return null;
  const unit = m[2] ?? '';
  if (/^(мин|min|м|m)$/.test(unit)) return Math.round(v * 60);
  if (unit) return Math.round(v);
  return v <= 10 ? Math.round(v * 60) : Math.round(v); // bare "2" in a rest column means minutes
}

function parseRir(raw: string, kind: 'rir' | 'rpe'): [number, number] | null {
  const s = normalizeName(raw).replace(/^(rir|rpe)\s*/, '');
  const m = s.match(/^(\d+(?:[.,]5)?)(?:\s*[-–—]\s*(\d+(?:[.,]5)?))?/);
  if (!m) return null;
  let a = num(m[1])!;
  let b = m[2] ? num(m[2])! : a;
  if (kind === 'rpe') [a, b] = [10 - b, 10 - a];
  const clamp = (x: number) => Math.max(0, Math.min(6, Math.round(x)));
  return [clamp(Math.min(a, b)), clamp(Math.max(a, b))];
}

function detectHeader(rows: Cell[][]): { index: number; columns: Partial<Record<ColumnKind, number>> } | null {
  const limit = Math.min(rows.length, 15);
  for (let r = 0; r < limit; r++) {
    const columns: Partial<Record<ColumnKind, number>> = {};
    rows[r].forEach((cell, c) => {
      const s = normalizeName(str(cell));
      if (!s || s.length > 40) return;
      for (const [kind, re] of HEADER_PATTERNS) {
        if (re.test(s) && columns[kind] === undefined) {
          columns[kind] = c;
          return;
        }
      }
    });
    const kinds = Object.keys(columns).length;
    if (kinds >= 2 && (columns.name !== undefined || columns.setsReps !== undefined || columns.sets !== undefined)) {
      if (columns.name === undefined) columns.name = 0;
      return { index: r, columns };
    }
  }
  return null;
}

/** No header row: guess columns from the content of the first rows. */
function inferColumns(rows: Cell[][]): Partial<Record<ColumnKind, number>> {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const score = (c: number, test: (s: string) => boolean) =>
    rows.slice(0, 200).reduce((acc, r) => acc + (test(str(r[c])) ? 1 : 0), 0);
  const columns: Partial<Record<ColumnKind, number>> = {};
  let best = { c: -1, n: 0 };
  for (let c = 0; c < width; c++) {
    const n = score(c, (s) => !!parseSetsReps(s));
    if (n > best.n) best = { c, n };
  }
  if (best.c >= 0) columns.setsReps = best.c;
  for (let c = 0; c < width; c++) {
    if (c === columns.setsReps) continue;
    if (columns.intensity === undefined && score(c, (s) => !!parseIntensity(s)) >= 2) columns.intensity = c;
  }
  let nameBest = { c: 0, n: -1 };
  for (let c = 0; c < width; c++) {
    if (c === columns.setsReps || c === columns.intensity) continue;
    const n = score(c, (s) => /[a-zа-яё]{3,}/i.test(s) && !parseSetsReps(s));
    if (n > nameBest.n) nameBest = { c, n };
  }
  columns.name = nameBest.c;
  return columns;
}

interface Marker { kind: 'block' | 'day'; name: string }

function classifyMarker(text: string): Marker['kind'] | null {
  const s = normalizeName(text);
  if (BLOCK_RE.test(s)) return 'block';
  if (DAY_RE.test(s)) return 'day';
  return null;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function parseSheets(sheets: SheetInput[]): ParseResult {
  const warnings: ImportWarning[] = [];
  const columnsBySheet: ParseResult['columns'] = {};
  const blocks: ImportedBlock[] = [];
  const nonEmptySheets = sheets.filter((s) => s.rows.some((r) => r.some((c) => str(c))));
  const multiSheet = nonEmptySheets.length > 1;

  for (const sheet of nonEmptySheets) {
    const header = detectHeader(sheet.rows);
    const columns = header?.columns ?? inferColumns(sheet.rows);
    columnsBySheet[sheet.name] = columns;
    if (!header) {
      warnings.push({ sheet: sheet.name, row: null, message: 'Строка заголовков не найдена — колонки определены по содержимому' });
    }
    if (columns.setsReps === undefined && columns.sets === undefined && columns.reps === undefined) {
      warnings.push({ sheet: sheet.name, row: null, message: 'Не найдена колонка с подходами/повторениями' });
    }

    let block: ImportedBlock | null = null;
    let day: ImportedDay | null = null;
    let sawDayMarker = false;

    const ensureBlock = () => {
      if (!block) {
        block = { name: multiSheet && !sawDayMarker ? 'Основной блок' : 'Блок 1', days: [] };
        blocks.push(block);
      }
      return block;
    };
    const ensureDay = () => {
      if (!day) {
        day = { name: multiSheet ? capitalize(sheet.name) : 'Тренировка', exercises: [] };
        ensureBlock().days.push(day);
      }
      return day;
    };

    // When every sheet is a separate day, they all go into one shared block.
    if (multiSheet && blocks.length > 0 && !sheet.rows.some((r) => r.some((c) => classifyMarker(str(c))))) {
      block = blocks[blocks.length - 1];
    }

    const start = header ? header.index + 1 : 0;
    for (let r = start; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r].map(str);
      const filled = cells.map((s, i) => [s, i] as const).filter(([s]) => s);
      if (!filled.length) continue;
      const rowNo = r + 1;
      const nameText = cells[columns.name ?? 0] ?? '';

      // Marker row: a single filled cell (block / day title).
      if (filled.length === 1) {
        const [text] = filled[0];
        const kind = classifyMarker(text);
        if (kind === 'block') {
          block = { name: capitalize(text), days: [] };
          blocks.push(block);
          day = null;
          continue;
        }
        if (kind === 'day' || (text === nameText && !/\d\s*[xх×*]\s*\d/.test(text) && text.length <= 60 && looksLikeDayTitle(sheet.rows, r, columns))) {
          sawDayMarker = true;
          day = { name: capitalize(text), exercises: [] };
          ensureBlock().days.push(day);
          continue;
        }
      }

      if (!nameText) {
        warnings.push({ sheet: sheet.name, row: rowNo, message: `Строка пропущена: нет названия упражнения («${filled.map(([s]) => s).join(' | ')}»)` });
        continue;
      }

      const ex = parseExerciseRow(cells, columns, sheet.name, rowNo);
      if (ex.issues.length && ex.sets === null && ex.repsMin === null && filled.length === 1) {
        warnings.push({ sheet: sheet.name, row: rowNo, message: `Строка «${nameText}» не похожа на упражнение и пропущена` });
        continue;
      }
      ensureDay().exercises.push(ex);
    }
  }

  // Drop empty days/blocks produced by stray markers.
  for (const b of blocks) b.days = b.days.filter((d) => d.exercises.length);
  const nonEmpty = blocks.filter((b) => b.days.length);

  flagOutlierRanges(nonEmpty, warnings);

  for (const b of nonEmpty) for (const d of b.days) for (const e of d.exercises) {
    for (const issue of e.issues) warnings.push({ sheet: e.sheet, row: e.row, message: `«${e.name}»: ${issue}` });
  }

  const exerciseCount = nonEmpty.reduce((n, b) => n + b.days.reduce((m, d) => m + d.exercises.length, 0), 0);
  if (!exerciseCount) warnings.unshift({ sheet: '', row: null, message: 'Не удалось найти ни одного упражнения' });

  return { blocks: nonEmpty, warnings, columns: columnsBySheet, exerciseCount };
}

/** A lone title is a day header if the following row looks like an exercise. */
function looksLikeDayTitle(rows: Cell[][], r: number, columns: Partial<Record<ColumnKind, number>>): boolean {
  const next = rows[r + 1];
  if (!next) return false;
  const filled = next.map(str).filter(Boolean).length;
  const sr = columns.setsReps !== undefined ? parseSetsReps(str(next[columns.setsReps])) : null;
  return filled >= 2 || !!sr;
}

function parseExerciseRow(cells: string[], columns: Partial<Record<ColumnKind, number>>, sheet: string, row: number): ImportedExercise {
  const at = (k: ColumnKind) => (columns[k] !== undefined ? cells[columns[k]!] ?? '' : '');
  const issues: string[] = [];
  const ex: ImportedExercise = {
    row, sheet,
    name: capitalize(at('name')),
    sets: null, repsMin: null, repsMax: null, weight: null, restSec: null,
    intensity: null, rirMin: null, rirMax: null, notes: '', issues,
  };
  const notes: string[] = [];

  const sr = at('setsReps');
  if (sr) {
    const p = parseSetsReps(sr);
    if (p) Object.assign(ex, { sets: p.sets, repsMin: p.repsMin, repsMax: p.repsMax, weight: p.weight ?? ex.weight });
    else issues.push(`не распознана схема «${sr}»`);
  }
  if (at('sets')) {
    const p = parseSetsReps(at('sets'));
    if (p) Object.assign(ex, { sets: p.sets, repsMin: p.repsMin, repsMax: p.repsMax });
    else {
      const n = parseWeight(at('sets'));
      if (n) ex.sets = Math.round(n); else issues.push(`не распознано число подходов «${at('sets')}»`);
    }
  }
  if (at('reps')) {
    const m = normalizeName(at('reps')).match(RANGE_RE);
    if (m) { ex.repsMin = Number(m[1]); ex.repsMax = Number(m[2] ?? m[1]); }
    else issues.push(`не распознаны повторения «${at('reps')}»`);
  }
  if (at('weight')) {
    const w = parseWeight(at('weight'));
    if (w !== null) ex.weight = w; else notes.push(`Вес: ${at('weight')}`);
  }
  if (at('rest')) {
    const r = parseRest(at('rest'));
    if (r !== null) ex.restSec = r; else issues.push(`не распознан отдых «${at('rest')}»`);
  }
  if (at('intensity')) {
    const i = parseIntensity(at('intensity'));
    if (i) {
      ex.intensity = i;
      [ex.rirMin, ex.rirMax] = INTENSITY_RIR[i];
    } else {
      const rir = parseRir(at('intensity'), /rpe/i.test(at('intensity')) ? 'rpe' : 'rir');
      if (rir) [ex.rirMin, ex.rirMax] = rir; else notes.push(`Интенсивность: ${at('intensity')}`);
    }
  }
  for (const kind of ['rir', 'rpe'] as const) {
    if (!at(kind)) continue;
    const rir = parseRir(at(kind), kind);
    if (rir) [ex.rirMin, ex.rirMax] = rir; else issues.push(`не распознан ${kind.toUpperCase()} «${at(kind)}»`);
  }
  if (at('notes')) notes.push(at('notes'));

  // Cells that are not mapped to any column are kept as notes rather than lost.
  const mapped = new Set(Object.values(columns));
  cells.forEach((s, i) => { if (s && !mapped.has(i)) notes.push(s); });
  ex.notes = notes.join('; ');

  if (ex.sets === null) issues.push('не указано число подходов');
  if (ex.repsMin === null) issues.push('не указаны повторения');
  return ex;
}

/** Same exercise with an unusual rep range (e.g. "8-13" where everywhere else it's "8-12") is likely a typo. */
function flagOutlierRanges(blocks: ImportedBlock[], warnings: ImportWarning[]) {
  const byName = new Map<string, ImportedExercise[]>();
  for (const b of blocks) for (const d of b.days) for (const e of d.exercises) {
    const k = normalizeName(e.name);
    byName.set(k, [...(byName.get(k) ?? []), e]);
  }
  for (const list of byName.values()) {
    const counts = new Map<string, number>();
    for (const e of list) if (e.repsMin !== null) counts.set(`${e.repsMin}-${e.repsMax}`, (counts.get(`${e.repsMin}-${e.repsMax}`) ?? 0) + 1);
    if (counts.size < 2) continue;
    const [common, commonN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    for (const e of list) {
      const k = `${e.repsMin}-${e.repsMax}`;
      if (k !== common && counts.get(k) === 1 && commonN >= 3 && e.repsMin === Number(common.split('-')[0])) {
        warnings.push({ sheet: e.sheet, row: e.row, message: `«${e.name}»: диапазон ${k} встречается один раз, в остальных строках ${common} — возможно, опечатка` });
      }
    }
  }
}
