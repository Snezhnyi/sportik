import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSpreadsheetBuffer } from '../src/import/readFile';
import { parseSetsReps, parseRest, parseSheets } from '../src/import/parseTable';

describe('sample program "Муж средний 2х2.xlsx"', () => {
  const sheets = readSpreadsheetBuffer(readFileSync('tests/fixtures/sample-2x2.xlsx'), 'sample-2x2.xlsx');
  const result = parseSheets(sheets);

  it('detects columns from the header row', () => {
    expect(result.columns[sheets[0].name]).toMatchObject({ name: 0, intensity: 1, setsReps: 2 });
  });

  it('finds 8 blocks with 2 days of 6 exercises each', () => {
    expect(result.blocks.map((b) => b.name)).toEqual(Array.from({ length: 8 }, (_, i) => `Блок ${i + 1}`));
    for (const b of result.blocks) {
      expect(b.days.map((d) => d.name)).toEqual(['Тренировка 1', 'Тренировка 2']);
      for (const d of b.days) expect(d.exercises).toHaveLength(6);
    }
    expect(result.exerciseCount).toBe(96);
  });

  it('parses sets, reps and intensity into target RIR', () => {
    const squat = result.blocks[0].days[0].exercises[0];
    expect(squat).toMatchObject({ name: 'Присед со штангой', sets: 4, repsMin: 6, repsMax: 8, intensity: 'medium', rirMin: 3, rirMax: 4 });
    const heavy = result.blocks[1].days[0].exercises[0];
    expect(heavy).toMatchObject({ sets: 5, intensity: 'heavy', rirMin: 0, rirMax: 1 });
    // "тяжелая" without ё and "средняя " with a trailing space
    expect(result.blocks[3].days[0].exercises[0].intensity).toBe('heavy');
    expect(result.blocks[7].days[1].exercises[5].intensity).toBe('medium');
  });

  it('flags the 8-13 range as a probable typo but keeps it', () => {
    const bench = result.blocks[3].days[1].exercises[0];
    expect(bench).toMatchObject({ repsMin: 8, repsMax: 13 });
    expect(result.warnings.some((w) => w.row === 56 && /опечатка/.test(w.message))).toBe(true);
  });

  it('has no other warnings', () => {
    expect(result.warnings.filter((w) => !/опечатка/.test(w.message))).toEqual([]);
  });
});

describe('generic formats', () => {
  it('parses various sets×reps notations', () => {
    expect(parseSetsReps('4х6-8')).toMatchObject({ sets: 4, repsMin: 6, repsMax: 8 });
    expect(parseSetsReps('3 x 10')).toMatchObject({ sets: 3, repsMin: 10, repsMax: 10 });
    expect(parseSetsReps('3×10,10,8')).toMatchObject({ sets: 3, repsMin: 8, repsMax: 10 });
    expect(parseSetsReps('4x8–12 по 40 кг')).toMatchObject({ sets: 4, repsMin: 8, repsMax: 12, weight: 40 });
    expect(parseSetsReps('3 подхода по 12-15')).toMatchObject({ sets: 3, repsMin: 12, repsMax: 15 });
    expect(parseSetsReps('до отказа')).toBeNull();
  });

  it('parses rest values', () => {
    expect(parseRest('90')).toBe(90);
    expect(parseRest('1:30')).toBe(90);
    expect(parseRest('2 мин')).toBe(120);
    expect(parseRest('2')).toBe(120);
  });

  it('handles a CSV with separate columns and lettered days', () => {
    const csv = [
      'Упражнение;Подходы;Повторения;Вес;Отдых;Комментарий',
      'День A — Грудь, плечи;;;;;',
      'Жим лёжа;4;8-12;60 кг;2 мин;пауза внизу',
      'Разводка гантелей;3;12;14;60;',
      'День B — Спина;;;;;',
      'Подтягивания;3;10;;90;',
    ].join('\n');
    const sheets = readSpreadsheetBuffer(new TextEncoder().encode(csv), 'p.csv');
    const r = parseSheets(sheets);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].days.map((d) => d.name)).toEqual(['День A — Грудь, плечи', 'День B — Спина']);
    expect(r.blocks[0].days[0].exercises[0]).toMatchObject({ sets: 4, repsMin: 8, repsMax: 12, weight: 60, restSec: 120, notes: 'пауза внизу' });
    expect(r.warnings).toEqual([]);
  });

  it('treats each sheet as a day when there are no markers', () => {
    const r = parseSheets([
      { name: 'Грудь', rows: [['Упражнение', 'Схема'], ['Жим лёжа', '4x8']] },
      { name: 'Спина', rows: [['Упражнение', 'Схема'], ['Тяга блока', '3x12']] },
    ]);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].days.map((d) => d.name)).toEqual(['Грудь', 'Спина']);
  });

  it('reports what could not be recognized', () => {
    const r = parseSheets([{ name: 'S', rows: [['Упражнение', 'Подходы х повторения'], ['Жим', 'много']] }]);
    expect(r.warnings.map((w) => w.message).join('\n')).toMatch(/не распознана схема «много»/);
  });
});
