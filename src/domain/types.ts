/** Calendar date in the user's local time zone, `YYYY-MM-DD`. */
export type LocalDate = string;

export type MuscleGroup =
  | 'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps'
  | 'abs' | 'forearms' | 'cardio' | 'other';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'smith' | 'ezbar'
  | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export type Mechanics = 'compound' | 'isolation';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleGroup;
  /** Free-form secondary muscles, e.g. "передняя дельта". */
  secondary: string[];
  equipment: Equipment;
  mechanics: Mechanics;
  aliases?: string[];
  mediaUrl?: string;
  custom?: boolean;
  /** Built-in exercises can be hidden but never deleted (history references them). */
  hidden?: boolean;
}

export type Intensity = 'light' | 'medium' | 'heavy';

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Recommended working weight, kg. null — not set. */
  weight: number | null;
  restSec: number;
  intensity: Intensity | null;
  /** Target reps-in-reserve range. null — engine falls back to the default 1–2. */
  rirMin: number | null;
  rirMax: number | null;
}

export interface ProgramExercise extends Prescription {
  id: string;
  exerciseId: string;
  notes: string;
  /** Exercise ids that can replace this one during a workout. */
  alternatives: string[];
}

export interface ProgramDay {
  id: string;
  name: string;
  focus: string;
  exercises: ProgramExercise[];
}

/** A block (mesocycle/phase). Simple programs have exactly one block. */
export interface ProgramBlock {
  id: string;
  name: string;
  days: ProgramDay[];
}

export type ScheduleSlot = 'train' | 'rest';

export interface ProgramSchedule {
  /** 'cycle' — repeating pattern from startDate (2x2 = train,train,rest,rest); 'weekly' — weekdays. */
  kind: 'cycle' | 'weekly';
  cycle: ScheduleSlot[];
  /** 0 = Monday ... 6 = Sunday. */
  weekdays: number[];
  startDate: LocalDate;
  /** How many times each block is run before moving to the next one. */
  blockRepeats: number;
}

export type ProgramStatus = 'active' | 'saved' | 'archived';

export interface Program {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  status: ProgramStatus;
  /** When the program was last made active — used to sort "return to a previous program". */
  activatedAt: number | null;
  schedule: ProgramSchedule;
  blocks: ProgramBlock[];
  /** Index into the flattened sequence of sessions (see schedule.ts). */
  progressIndex: number;
}

export interface WorkoutSet {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  /** A set counts only after the user confirmed it. Prefilled values are just suggestions. */
  done: boolean;
  completedAt: number | null;
  /** Actual rest taken after this set, seconds. */
  restTakenSec: number | null;
}

export type WorkoutExerciseStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  /** Set when the exercise was swapped during the workout; program is not changed. */
  originalExerciseId: string | null;
  programExerciseId: string | null;
  name: string;
  /** Snapshot of the prescription at workout time — history survives program edits. */
  target: Prescription;
  alternatives: string[];
  notes: string;
  status: WorkoutExerciseStatus;
  startedAt: number | null;
  finishedAt: number | null;
  sets: WorkoutSet[];
}

export interface RestTimer {
  setId: string;
  startedAt: number;
  durationMs: number;
  /** When paused: the moment of pause. Remaining time is frozen until resumed. */
  pausedAt: number | null;
  /** Accumulated paused milliseconds (not counted as elapsed rest). */
  pausedMs: number;
}

export type WorkoutStatus = 'in_progress' | 'completed';

export interface Workout {
  id: string;
  status: WorkoutStatus;
  date: LocalDate;
  programId: string | null;
  programName: string;
  blockId: string | null;
  blockName: string;
  dayId: string | null;
  dayName: string;
  /** Position in the program sequence that this workout fulfils. */
  sequenceIndex: number | null;
  startedAt: number;
  finishedAt: number | null;
  /** Explicit pause of the whole workout (rest does NOT pause it). */
  pausedAt: number | null;
  pausedMs: number;
  currentExercise: number;
  rest: RestTimer | null;
  exercises: WorkoutExercise[];
  comment: string;
  /** Marked as done from the calendar without logging sets. */
  manual: boolean;
}

export type Sex = 'male' | 'female' | null;
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'hypertrophy' | 'fat_loss' | 'maintenance' | 'strength';

export interface Profile {
  name: string;
  sex: Sex;
  heightCm: number | null;
  targetWeightKg: number | null;
  level: Level;
  goal: Goal;
  notes: string;
  onboarded: boolean;
}

export interface WeightEntry {
  id: string;
  date: LocalDate;
  weightKg: number;
  createdAt: number;
}

/** 'rest' — force a rest day; 'train' — force a planned training on a day the schedule marks as rest. */
export type CalendarMark = 'rest' | 'train';

export interface CalendarOverride {
  date: LocalDate;
  mark: CalendarMark;
  note: string;
}

export type LoadAction = 'increase' | 'keep' | 'decrease';

export interface Recommendation {
  id: string;
  createdAt: number;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  action: LoadAction;
  fromWeight: number | null;
  toWeight: number | null;
  reason: string;
  decision: 'pending' | 'accepted' | 'rejected';
  decidedAt: number | null;
}

export interface Settings {
  /** Minimal weight increments by equipment, kg. */
  increments: Record<Equipment, number>;
  defaultRestSec: number;
  sound: boolean;
}
