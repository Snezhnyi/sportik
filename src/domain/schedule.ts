import type { CalendarOverride, LocalDate, Program, ProgramBlock, ProgramDay, ProgramSchedule, Workout } from './types';
import { addDays, diffDays, weekday } from '../lib/dates';

/** One session of the program's linear sequence: blocks × repeats × days. */
export interface SequenceItem {
  index: number;
  block: ProgramBlock;
  blockIndex: number;
  repeat: number;
  day: ProgramDay;
}

export function programSequence(p: Program): SequenceItem[] {
  const out: SequenceItem[] = [];
  const repeats = Math.max(1, p.schedule.blockRepeats);
  p.blocks.forEach((block, blockIndex) => {
    for (let repeat = 0; repeat < repeats; repeat++) {
      for (const day of block.days) {
        if (day.exercises.length) out.push({ index: out.length, block, blockIndex, repeat, day });
      }
    }
  });
  return out;
}

/** The program loops: after the last session it starts from the first block again. */
export function sequenceAt(p: Program, index: number): SequenceItem | null {
  const seq = programSequence(p);
  if (!seq.length) return null;
  const i = ((index % seq.length) + seq.length) % seq.length;
  return seq[i];
}

export const nextSession = (p: Program) => sequenceAt(p, p.progressIndex);

export function sequenceLabel(p: Program, item: SequenceItem): string {
  const parts: string[] = [];
  if (p.blocks.length > 1) parts.push(item.block.name);
  if (p.schedule.blockRepeats > 1) parts.push(`проход ${item.repeat + 1}/${p.schedule.blockRepeats}`);
  return parts.join(' · ');
}

export function isScheduledTraining(s: ProgramSchedule, date: LocalDate): boolean {
  const diff = diffDays(s.startDate, date);
  if (diff < 0) return false;
  if (s.kind === 'weekly') return s.weekdays.includes(weekday(date));
  if (!s.cycle.length) return false;
  return s.cycle[diff % s.cycle.length] === 'train';
}

export type DayStatus = 'done' | 'planned' | 'missed' | 'rest' | 'none';

export interface CalendarDay {
  date: LocalDate;
  status: DayStatus;
  workouts: Workout[];
  /** Name of the planned session (future planned days only). */
  plannedName: string | null;
  plannedItem: SequenceItem | null;
  override: CalendarOverride | null;
}

interface CalendarInput {
  program: Program | null;
  workouts: Workout[];
  overrides: Map<LocalDate, CalendarOverride>;
  today: LocalDate;
}

function isPlanned(date: LocalDate, program: Program | null, overrides: Map<LocalDate, CalendarOverride>): boolean {
  const o = overrides.get(date);
  if (o?.mark === 'rest') return false;
  if (o?.mark === 'train') return true;
  return !!program && isScheduledTraining(program.schedule, date);
}

/**
 * Classifies each date: actually done (completed workout) beats everything; otherwise a planned
 * training is "planned" from today on and "missed" in the past; everything else is rest.
 * Future planned days are labeled with the program's upcoming sessions in order.
 */
export function buildCalendar(from: LocalDate, to: LocalDate, input: CalendarInput): CalendarDay[] {
  const { program, overrides, today } = input;
  const byDate = new Map<LocalDate, Workout[]>();
  for (const w of input.workouts) {
    if (w.status !== 'completed') continue;
    byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  }

  // Label future planned days: walk from today, consuming the program sequence.
  const labels = new Map<LocalDate, SequenceItem>();
  if (program && diffDays(today, to) >= 0) {
    let idx = program.progressIndex;
    const doneToday = byDate.has(today);
    for (let d = doneToday ? addDays(today, 1) : today; diffDays(d, to) >= 0; d = addDays(d, 1)) {
      if (!isPlanned(d, program, overrides)) continue;
      const item = sequenceAt(program, idx++);
      if (item) labels.set(d, item);
    }
  }

  const days: CalendarDay[] = [];
  for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) {
    const workouts = byDate.get(d) ?? [];
    const override = overrides.get(d) ?? null;
    const planned = isPlanned(d, program, overrides);
    const startsAt = program?.schedule.startDate;
    let status: DayStatus;
    if (workouts.length) status = 'done';
    else if (planned) status = diffDays(d, today) > 0 ? 'missed' : 'planned';
    else if (override?.mark === 'rest' || (startsAt && diffDays(startsAt, d) >= 0)) status = 'rest';
    else status = 'none';
    const item = status === 'planned' ? labels.get(d) ?? null : null;
    days.push({ date: d, status, workouts, plannedItem: item, plannedName: item?.day.name ?? null, override });
  }
  return days;
}
