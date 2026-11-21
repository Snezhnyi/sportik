import type { Intensity } from '../../../domain/types';

export const RIR_LABELS: Record<number, string> = {
  0: 'Отказ — ещё одно повторение невозможно',
  1: 'Осталось 1 повторение',
  2: 'Осталось 2 повторения',
  3: 'Осталось 3 повторения',
  4: 'Осталось 4 повторения',
  5: 'Осталось 5 повторений',
  6: 'Осталось 6 и более повторений',
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  light: 'Лёгкая',
  medium: 'Средняя',
  heavy: 'Тяжёлая',
};

export const rirTargetText = (min: number | null, max: number | null) =>
  min === null || max === null ? null : min === max ? `RIR ${min}` : `RIR ${min}–${max}`;
