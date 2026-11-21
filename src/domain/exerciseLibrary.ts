import type { Equipment, Exercise, Mechanics, MuscleGroup } from './types';

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'legs', label: 'Ноги' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'abs', label: 'Пресс' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'cardio', label: 'Кардио' },
  { id: 'other', label: 'Другое' },
];

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'cable', label: 'Блок' },
  { id: 'smith', label: 'Смит' },
  { id: 'ezbar', label: 'EZ-гриф' },
  { id: 'bodyweight', label: 'Свой вес' },
  { id: 'kettlebell', label: 'Гиря' },
  { id: 'band', label: 'Резина' },
  { id: 'other', label: 'Другое' },
];

export const muscleLabel = (m: MuscleGroup) => MUSCLE_GROUPS.find((g) => g.id === m)?.label ?? m;
export const equipmentLabel = (e: Equipment) => EQUIPMENT.find((g) => g.id === e)?.label ?? e;

type Seed = [id: string, name: string, primary: MuscleGroup, equipment: Equipment, mechanics: Mechanics, secondary: string[], aliases?: string[]];

const SEED: Seed[] = [
  // Грудь
  ['bench_press', 'Жим штанги лёжа', 'chest', 'barbell', 'compound', ['трицепс', 'передняя дельта'], ['жим лежа', 'жим лёжа', 'жим штанги лежа']],
  ['incline_bench_press', 'Жим штанги лёжа под углом 30°', 'chest', 'barbell', 'compound', ['передняя дельта', 'трицепс'], ['жим лежа 30°', 'жим лёжа 30°', 'жим лежа 30', 'жим на наклонной', 'жим лежа под углом']],
  ['db_bench_press', 'Жим гантелей лёжа', 'chest', 'dumbbell', 'compound', ['трицепс', 'передняя дельта'], ['жим гантелей лежа']],
  ['incline_db_press', 'Жим гантелей на наклонной', 'chest', 'dumbbell', 'compound', ['передняя дельта', 'трицепс'], ['жим гантелей под углом']],
  ['machine_chest_press', 'Жим в тренажёре на грудь', 'chest', 'machine', 'compound', ['трицепс'], ['жим в тренажере', 'жим в тренажёре']],
  ['smith_bench_press', 'Жим лёжа в Смите', 'chest', 'smith', 'compound', ['трицепс', 'передняя дельта'], ['жим в смите', 'жим лежа в смите']],
  ['dips', 'Отжимания на брусьях', 'chest', 'bodyweight', 'compound', ['трицепс', 'передняя дельта'], ['брусья']],
  ['push_ups', 'Отжимания от пола', 'chest', 'bodyweight', 'compound', ['трицепс'], ['отжимания']],
  ['db_flyes', 'Разведения гантелей лёжа', 'chest', 'dumbbell', 'isolation', [], ['разводка гантелей', 'разведения гантелей']],
  ['cable_crossover', 'Сведения в кроссовере', 'chest', 'cable', 'isolation', [], ['кроссовер', 'сведение рук в кроссовере']],
  ['pec_deck', 'Сведения в тренажёре (бабочка)', 'chest', 'machine', 'isolation', [], ['бабочка', 'пек-дек']],
  // Спина
  ['lat_pulldown', 'Тяга вертикального блока', 'back', 'cable', 'compound', ['бицепс', 'задняя дельта'], ['тяга верхнего блока', 'вертикальная тяга']],
  ['seated_cable_row', 'Тяга горизонтального блока', 'back', 'cable', 'compound', ['бицепс', 'задняя дельта'], ['тяга нижнего блока', 'горизонтальная тяга']],
  ['pull_ups', 'Подтягивания', 'back', 'bodyweight', 'compound', ['бицепс'], ['подтягивания на турнике']],
  ['barbell_row', 'Тяга штанги в наклоне', 'back', 'barbell', 'compound', ['бицепс', 'задняя дельта'], ['тяга в наклоне']],
  ['db_row', 'Тяга гантели в наклоне', 'back', 'dumbbell', 'compound', ['бицепс'], ['тяга гантели одной рукой']],
  ['t_bar_row', 'Тяга Т-грифа', 'back', 'barbell', 'compound', ['бицепс'], ['т-тяга']],
  ['machine_row', 'Тяга в рычажном тренажёре', 'back', 'machine', 'compound', ['бицепс'], ['хаммер тяга']],
  ['deadlift', 'Становая тяга', 'back', 'barbell', 'compound', ['ягодицы', 'бицепс бедра', 'трапеции'], ['становая']],
  ['hyperextension', 'Гиперэкстензия', 'back', 'bodyweight', 'isolation', ['ягодицы', 'бицепс бедра'], []],
  ['shrugs', 'Шраги', 'back', 'dumbbell', 'isolation', ['трапеции'], ['шраги с гантелями']],
  // Ноги
  ['back_squat', 'Присед со штангой', 'legs', 'barbell', 'compound', ['ягодицы', 'разгибатели спины'], ['приседания со штангой', 'присед']],
  ['front_squat', 'Фронтальный присед', 'legs', 'barbell', 'compound', ['ягодицы'], []],
  ['romanian_deadlift', 'Румынская тяга', 'legs', 'barbell', 'compound', ['ягодицы', 'разгибатели спины'], ['румынка', 'rdl']],
  ['leg_press', 'Жим ногами', 'legs', 'machine', 'compound', ['ягодицы'], ['жим ногами в тренажере']],
  ['hack_squat', 'Гакк-присед', 'legs', 'machine', 'compound', ['ягодицы'], ['гакк']],
  ['bulgarian_split_squat', 'Болгарские выпады', 'legs', 'dumbbell', 'compound', ['ягодицы'], ['болгарские сплит-приседания']],
  ['lunges', 'Выпады с гантелями', 'legs', 'dumbbell', 'compound', ['ягодицы'], ['выпады']],
  ['leg_extension', 'Разгибания ног в тренажёре', 'legs', 'machine', 'isolation', ['квадрицепс'], ['разгибания ног в тренажере', 'разгибание ног']],
  ['leg_curl', 'Сгибания ног в тренажёре', 'legs', 'machine', 'isolation', ['бицепс бедра'], ['сгибания ног в тренажере', 'сгибание ног']],
  ['hip_thrust', 'Ягодичный мост со штангой', 'legs', 'barbell', 'compound', ['ягодицы'], ['ягодичный мост', 'хип-траст']],
  ['smith_calf_raise', 'Подъём на носки в Смите', 'legs', 'smith', 'isolation', ['икры'], ['подъем на носки в смите', 'подъём на носки в смите']],
  ['seated_calf_raise', 'Подъём на носки сидя', 'legs', 'machine', 'isolation', ['икры'], ['подъем на носки сидя']],
  ['standing_calf_raise', 'Подъём на носки стоя', 'legs', 'machine', 'isolation', ['икры'], ['подъем на носки', 'подъем на носки стоя']],
  // Плечи
  ['ohp', 'Жим штанги стоя', 'shoulders', 'barbell', 'compound', ['трицепс'], ['армейский жим', 'жим стоя']],
  ['seated_db_press', 'Жим гантелей сидя', 'shoulders', 'dumbbell', 'compound', ['трицепс'], ['жим гантелей сидя на плечи']],
  ['machine_shoulder_press', 'Жим в тренажёре на плечи', 'shoulders', 'machine', 'compound', ['трицепс'], []],
  ['lateral_raise', 'Отведения гантелей в стороны', 'shoulders', 'dumbbell', 'isolation', ['средняя дельта'], ['отведения на дельты', 'махи в стороны', 'махи гантелями']],
  ['cable_lateral_raise', 'Отведения в блоке', 'shoulders', 'cable', 'isolation', ['средняя дельта'], ['махи в кроссовере']],
  ['rear_delt_fly', 'Разведения на заднюю дельту', 'shoulders', 'dumbbell', 'isolation', ['задняя дельта'], ['махи в наклоне', 'задняя дельта']],
  ['face_pull', 'Тяга каната к лицу', 'shoulders', 'cable', 'isolation', ['задняя дельта'], ['фейс-пул']],
  ['upright_row', 'Тяга штанги к подбородку', 'shoulders', 'barbell', 'compound', ['трапеции'], ['протяжка']],
  // Бицепс
  ['db_supination_curl', 'Подъём гантелей на бицепс с супинацией', 'biceps', 'dumbbell', 'isolation', ['брахиалис'], ['подъем гантелей на бицепс с супинацией', 'сгибания с супинацией']],
  ['ez_curl', 'Подъём EZ-грифа на бицепс', 'biceps', 'ezbar', 'isolation', ['брахиалис'], ['подъем ez грифа на бицепс', 'подъем ez-грифа на бицепс']],
  ['barbell_curl', 'Подъём штанги на бицепс', 'biceps', 'barbell', 'isolation', [], ['подъем штанги на бицепс']],
  ['hammer_curl', 'Молотки', 'biceps', 'dumbbell', 'isolation', ['брахиорадиалис', 'предплечья'], ['молот', 'сгибания молот']],
  ['preacher_curl', 'Сгибания на скамье Скотта', 'biceps', 'ezbar', 'isolation', [], ['скамья скотта']],
  ['cable_curl', 'Сгибания рук в блоке', 'biceps', 'cable', 'isolation', [], ['бицепс в блоке']],
  // Трицепс
  ['skull_crusher', 'Французский жим лёжа', 'triceps', 'ezbar', 'isolation', [], ['французский жим лежа', 'французский жим']],
  ['pushdown', 'Разгибания рук в блоке на трицепс', 'triceps', 'cable', 'isolation', [], ['разгибания рук в блоке', 'разгибания на трицепс в блоке']],
  ['overhead_extension', 'Разгибания из-за головы', 'triceps', 'dumbbell', 'isolation', [], ['французский жим сидя']],
  ['close_grip_bench', 'Жим узким хватом', 'triceps', 'barbell', 'compound', ['грудь'], ['жим лежа узким хватом']],
  // Пресс
  ['crunches', 'Скручивания', 'abs', 'bodyweight', 'isolation', [], []],
  ['hanging_leg_raise', 'Подъём ног в висе', 'abs', 'bodyweight', 'isolation', [], ['подъем ног в висе']],
  ['plank', 'Планка', 'abs', 'bodyweight', 'isolation', [], []],
  ['cable_crunch', 'Скручивания в блоке', 'abs', 'cable', 'isolation', [], ['молитва']],
  // Предплечья
  ['wrist_curl', 'Сгибания кисти со штангой', 'forearms', 'barbell', 'isolation', ['сгибатели предплечья'], ['сгибания кисти со штангой упор в скамью', 'сгибания кистей']],
  ['reverse_wrist_curl', 'Разгибания кисти со штангой', 'forearms', 'barbell', 'isolation', ['разгибатели предплечья'], ['разгибания кисти со штангой упор в скамью', 'разгибания кистей']],
  ['farmer_walk', 'Прогулка фермера', 'forearms', 'dumbbell', 'compound', ['трапеции'], []],
  // Кардио
  ['treadmill', 'Беговая дорожка', 'cardio', 'machine', 'compound', [], ['бег']],
  ['bike', 'Велотренажёр', 'cardio', 'machine', 'compound', [], ['велотренажер']],
  ['rowing_machine', 'Гребной тренажёр', 'cardio', 'machine', 'compound', [], ['гребля']],
  // Другое
  ['kb_swing', 'Махи гирей', 'other', 'kettlebell', 'compound', ['ягодицы', 'бицепс бедра'], []],
];

export const BUILTIN_EXERCISES: Exercise[] = SEED.map(([id, name, primary, equipment, mechanics, secondary, aliases]) => ({
  id: `ex.${id}`,
  name,
  primary,
  equipment,
  mechanics,
  secondary,
  aliases,
}));

/** Lowercase, ё→е, unify quotes/spaces/degree signs — used for matching names from imports. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[‐-―]/g, '-')
    .replace(/\s*°\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findExerciseByName(name: string, library: Exercise[]): Exercise | undefined {
  const n = normalizeName(name);
  return library.find((e) => normalizeName(e.name) === n || e.aliases?.some((a) => normalizeName(a) === n));
}

/** Default rest by mechanics: heavier compound lifts need longer breaks. */
export function defaultRestSec(ex: Pick<Exercise, 'mechanics' | 'primary'>): number {
  if (ex.primary === 'cardio') return 60;
  return ex.mechanics === 'compound' ? 150 : 90;
}
