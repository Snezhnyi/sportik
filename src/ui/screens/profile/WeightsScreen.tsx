import { useState } from 'react';
import { addWeight, deleteWeight, updateWeight, useProfile, useWeights } from '../../../data/repo';
import { Empty, Header, NumberInput, Sheet, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { LineChart } from '../../components/LineChart';
import { formatDate, toLocalDate } from '../../../lib/dates';
import { formatKg } from '../../../lib/format';
import { sortedWeights } from '../../../domain/stats';
import type { WeightEntry } from '../../../domain/types';
import { haptic } from '../../../telegram/tg';

export function WeightsScreen() {
  const weights = useWeights();
  const profile = useProfile();
  const ui = useUi();
  const [editing, setEditing] = useState<WeightEntry | 'new' | null>(null);
  const series = sortedWeights(weights).map((w) => ({ x: w.date, y: w.weightKg }));

  return (
    <div className="screen">
      <Header title="Собственный вес" back right={<button className="icon-btn" onClick={() => setEditing('new')} aria-label="Добавить"><Icon name="plus" /></button>} />
      {series.length > 1 && (
        <div className="card">
          <LineChart points={series} unit="кг" target={profile.targetWeightKg} />
        </div>
      )}
      <button className="btn primary block mt-12" onClick={() => setEditing('new')}><Icon name="plus" /> Записать взвешивание</button>
      <div className="section-title">История</div>
      {weights.length ? (
        <div className="list">
          {weights.map((w, i) => {
            const prev = weights[i + 1];
            const diff = prev ? w.weightKg - prev.weightKg : null;
            return (
              <button key={w.id} className="list-item" onClick={() => setEditing(w)}>
                <span className="grow">{formatDate(w.date, true)}</span>
                {diff !== null && diff !== 0 && (
                  <span className={`small ${diff > 0 ? 'faint' : 'muted'}`}>{diff > 0 ? '+' : ''}{formatKg(Math.round(diff * 10) / 10)}</span>
                )}
                <span className="bold num">{formatKg(w.weightKg)} кг</span>
              </button>
            );
          })}
        </div>
      ) : <Empty icon="⚖️" title="Пока нет записей" />}

      <WeightSheet
        entry={editing}
        onClose={() => setEditing(null)}
        onDelete={async (id) => {
          if (await ui.confirm({ title: 'Удалить запись?', ok: 'Удалить', danger: true })) {
            await deleteWeight(id);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

export function WeightSheet({ entry, onClose, onDelete }: { entry: WeightEntry | 'new' | null; onClose: () => void; onDelete?: (id: string) => void }) {
  const existing = entry && entry !== 'new' ? entry : null;
  const [date, setDate] = useState(toLocalDate());
  const [kg, setKg] = useState<number | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = entry === 'new' ? 'new' : existing?.id ?? null;
  if (key !== lastKey) {
    // Reset form whenever a different entry is opened.
    setLastKey(key);
    setDate(existing?.date ?? toLocalDate());
    setKg(existing?.weightKg ?? null);
  }

  const save = async () => {
    if (!kg) return;
    if (existing) await updateWeight({ ...existing, date, weightKg: kg });
    else await addWeight(date, kg);
    haptic.success();
    onClose();
  };

  return (
    <Sheet open={!!entry} onClose={onClose} title={existing ? 'Изменить запись' : 'Новое взвешивание'}>
      <div className="stack">
        <label className="field">
          <span>Вес, кг</span>
          <NumberInput value={kg} onChange={setKg} decimal max={400} placeholder="80.5" className="num" />
        </label>
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} max={toLocalDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="btn primary block" disabled={!kg} onClick={save}>Сохранить</button>
        {existing && onDelete && <button className="btn danger block" onClick={() => onDelete(existing.id)}>Удалить</button>}
      </div>
    </Sheet>
  );
}
