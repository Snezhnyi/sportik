import type { Goal, Level, Profile, Sex } from '../../../domain/types';
import { NumberInput, Segmented } from '../../components/common';

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Новичок' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' },
];

export const GOALS: { value: Goal; label: string }[] = [
  { value: 'hypertrophy', label: 'Набор мышечной массы' },
  { value: 'fat_loss', label: 'Похудение' },
  { value: 'maintenance', label: 'Поддержание формы' },
  { value: 'strength', label: 'Увеличение силы' },
];

const SEX: { value: 'male' | 'female' | 'none'; label: string }[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'none', label: 'Не указан' },
];

export function ProfileForm({ value, onChange, weight, onWeight }: {
  value: Profile;
  onChange: (p: Profile) => void;
  /** Current body weight is stored in the weight history, not in the profile. */
  weight?: number | null;
  onWeight?: (w: number | null) => void;
}) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="stack" style={{ gap: 14 }}>
      <label className="field">
        <span>Имя</span>
        <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Как к вам обращаться" />
      </label>
      <div className="field">
        <span>Пол (необязательно)</span>
        <Segmented value={value.sex ?? 'none'} options={SEX} onChange={(v) => set('sex', v === 'none' ? null : (v as Sex))} />
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Рост, см</span>
          <NumberInput value={value.heightCm} onChange={(v) => set('heightCm', v)} max={250} placeholder="180" />
        </label>
        {onWeight ? (
          <label className="field">
            <span>Текущий вес, кг</span>
            <NumberInput value={weight ?? null} onChange={onWeight} decimal max={400} placeholder="80" />
          </label>
        ) : <div />}
      </div>
      <label className="field">
        <span>Целевой вес, кг (необязательно)</span>
        <NumberInput value={value.targetWeightKg} onChange={(v) => set('targetWeightKg', v)} decimal max={400} placeholder="—" />
      </label>
      <div className="field">
        <span>Уровень подготовки</span>
        <Segmented value={value.level} options={LEVELS} onChange={(v) => set('level', v)} />
      </div>
      <label className="field">
        <span>Тренировочная цель</span>
        <select value={value.goal} onChange={(e) => set('goal', e.target.value as Goal)}>
          {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Дополнительная информация</span>
        <textarea value={value.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Травмы, ограничения, предпочтения…" />
      </label>
    </div>
  );
}
