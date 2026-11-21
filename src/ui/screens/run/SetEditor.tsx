import type { WorkoutSet } from '../../../domain/types';
import { NumberInput } from '../../components/common';
import { Icon } from '../../components/Icon';
import { haptic } from '../../../telegram/tg';
import { formatKg } from '../../../lib/format';
import { RIR_LABELS } from './rir';

/** The expanded card of the set being performed: weight, reps, RIR and the confirm button. */
export function SetEditor({ index, set, weightStep, repsHint, rirTarget, onChange, onComplete, onRemove, completeLabel = 'Завершить подход' }: {
  index: number;
  set: WorkoutSet;
  weightStep: number;
  repsHint: string;
  rirTarget: [number, number] | null;
  onChange: (patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rir'>>) => void;
  onComplete: () => void;
  onRemove: () => void;
  completeLabel?: string;
}) {
  const step = weightStep > 0 ? weightStep : 1;
  const bump = (field: 'weight' | 'reps', delta: number) => {
    haptic.select();
    const cur = set[field] ?? 0;
    onChange({ [field]: Math.max(0, Math.round((cur + delta) * 100) / 100) });
  };
  const inTarget = (r: number) => !!rirTarget && r >= rirTarget[0] && r <= rirTarget[1];

  return (
    <div className="set-card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="bold">Подход {index + 1}</span>
        <button className="faint small row" style={{ gap: 4 }} onClick={onRemove}><Icon name="trash" size={15} /> Удалить</button>
      </div>
      <div className="set-fields">
        <div className="big-field">
          <div className="lbl">Вес, кг</div>
          <div className="ctl">
            <button onClick={() => bump('weight', -step)} aria-label="Меньше веса"><Icon name="minus" /></button>
            <NumberInput value={set.weight} onChange={(v) => onChange({ weight: v })} decimal max={1000} placeholder="—" ariaLabel="Вес" />
            <button onClick={() => bump('weight', step)} aria-label="Больше веса"><Icon name="plus" /></button>
          </div>
        </div>
        <div className="big-field">
          <div className="lbl">Повторения</div>
          <div className="ctl">
            <button onClick={() => bump('reps', -1)} aria-label="Меньше повторений"><Icon name="minus" /></button>
            <NumberInput value={set.reps} onChange={(v) => onChange({ reps: v })} max={200} placeholder={repsHint} ariaLabel="Повторения" />
            <button onClick={() => bump('reps', 1)} aria-label="Больше повторений"><Icon name="plus" /></button>
          </div>
        </div>
      </div>
      <div className="rir" role="radiogroup" aria-label="Запас повторений (RIR)">
        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={set.rir === r}
            className={`${set.rir === r ? 'on' : ''} ${inTarget(r) ? 'target' : ''}`}
            onClick={() => { haptic.select(); onChange({ rir: set.rir === r ? null : r }); }}
          >
            {r === 6 ? '6+' : r}
          </button>
        ))}
      </div>
      <div className="rir-hint">
        {set.rir !== null ? `RIR ${set.rir}: ${RIR_LABELS[set.rir].toLowerCase()}` : 'Запас повторений (RIR) — сколько ещё могли бы сделать'}
      </div>
      <button className="btn primary block lg mt-12" disabled={!set.reps} onClick={onComplete}>
        <Icon name="check" /> {completeLabel}
      </button>
      {set.weight !== null && set.reps !== null && (
        <div className="center tiny faint mt-8 num">{formatKg(set.weight)} кг × {set.reps}</div>
      )}
    </div>
  );
}
