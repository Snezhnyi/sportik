import { useMemo, useState } from 'react';
import { useLibrary, useProfile, useWeights, useWorkouts } from '../../../data/repo';
import { Empty, Header, Segmented, SyncIndicator } from '../../components/common';
import { LineChart } from '../../components/LineChart';
import { useNav } from '../../nav';
import { exerciseStats, overallStats, sortedWeights } from '../../../domain/stats';
import { formatDate, formatDuration } from '../../../lib/dates';
import { formatKg, formatVolume } from '../../../lib/format';

export function StatsScreen() {
  const workouts = useWorkouts();
  const weights = useWeights();
  const profile = useProfile();
  const library = useLibrary();
  const nav = useNav();
  const overall = useMemo(() => overallStats(workouts), [workouts]);

  // Exercises that have history, most frequently performed first.
  const performed = useMemo(() => {
    const count = new Map<string, number>();
    for (const w of workouts) if (w.status === 'completed') for (const e of w.exercises) if (e.sets.some((s) => s.done)) count.set(e.exerciseId, (count.get(e.exerciseId) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, name: library.byId.get(id)?.name ?? workouts.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)?.name ?? '?' }));
  }, [workouts, library]);

  const [exId, setExId] = useState<string | null>(null);
  const [metric, setMetric] = useState<'weight' | 'reps'>('weight');
  const current = exId ?? performed[0]?.id ?? null;
  const ex = useMemo(() => (current ? exerciseStats(workouts, current) : null), [workouts, current]);
  const bodyWeight = weights[0];

  return (
    <div className="screen">
      <Header title="Статистика" right={<SyncIndicator />} />
      <div className="grid-3">
        <div className="stat"><div className="v">{overall.workouts}</div><div className="l">Тренировок</div></div>
        <div className="stat"><div className="v" style={{ fontSize: 18 }}>{Math.round(overall.totalMs / 3_600_000 * 10) / 10} ч</div><div className="l">Общее время</div></div>
        <div className="stat"><div className="v" style={{ fontSize: 18 }}>{overall.avgMs ? formatDuration(overall.avgMs) : '—'}</div><div className="l">В среднем</div></div>
        <div className="stat"><div className="v">{overall.sets}</div><div className="l">Подходов</div></div>
        <div className="stat"><div className="v" style={{ fontSize: 18 }}>{formatVolume(overall.volume)}</div><div className="l">Объём</div></div>
        <button className="stat clickable" style={{ textAlign: 'left' }} onClick={() => nav.push({ name: 'weights' })}>
          <div className="v" style={{ fontSize: 18 }}>{bodyWeight ? `${formatKg(bodyWeight.weightKg)} кг` : '—'}</div><div className="l">Свой вес</div>
        </button>
      </div>

      <div className="section-title">Прогресс в упражнении</div>
      {performed.length && ex && current ? (
        <div className="card">
          <select value={current} onChange={(e) => setExId(e.target.value)}>
            {performed.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="mt-12">
            <Segmented value={metric} options={[{ value: 'weight', label: 'Рабочий вес' }, { value: 'reps', label: 'Повторения' }]} onChange={setMetric} />
          </div>
          <div className="mt-12">
            {ex.points.length >= 1 ? (
              <LineChart
                key={`${current}${metric}`}
                points={ex.points.map((p) => ({ x: p.date, y: metric === 'weight' ? p.topWeight : p.topReps }))}
                unit={metric === 'weight' ? 'кг' : 'повт.'}
              />
            ) : <Empty title="Нет данных" />}
            <div className="tiny faint mt-8">
              {metric === 'weight' ? 'Максимальный рабочий вес за тренировку.' : 'Повторения в лучшем подходе с максимальным весом.'}
            </div>
          </div>
          <div className="grid-2 mt-12">
            <div className="stat" style={{ background: 'var(--card-2)' }}>
              <div className="v" style={{ fontSize: 17 }}>{ex.record ? `${formatKg(ex.record.weight)} × ${ex.record.reps}` : '—'}</div>
              <div className="l">Личный рекорд (вес){ex.record ? ` · ${formatDate(ex.record.date)}` : ''}</div>
            </div>
            <div className="stat" style={{ background: 'var(--card-2)' }}>
              <div className="v" style={{ fontSize: 17 }}>{ex.best ? `${formatKg(ex.best.weight)} × ${ex.best.reps}` : '—'}</div>
              <div className="l">Лучший результат{ex.best ? ` · ~${Math.round(ex.best.e1rm)} кг 1ПМ` : ''}</div>
            </div>
            <div className="stat" style={{ background: 'var(--card-2)' }}>
              <div className="v" style={{ fontSize: 17 }}>{ex.lastWeight !== null ? `${formatKg(ex.lastWeight)} кг` : '—'}</div>
              <div className="l">Последний рабочий вес</div>
            </div>
            <div className="stat" style={{ background: 'var(--card-2)' }}>
              <div className="v" style={{ fontSize: 17 }}>{ex.totalSets}</div>
              <div className="l">Подходов всего</div>
            </div>
          </div>
        </div>
      ) : <div className="card"><Empty icon="📈" title="Пока нет данных">Графики появятся после первой тренировки.</Empty></div>}

      <div className="section-title">Собственный вес</div>
      <div className="card">
        {weights.length > 1 ? (
          <LineChart points={sortedWeights(weights).map((w) => ({ x: w.date, y: w.weightKg }))} unit="кг" target={profile.targetWeightKg} />
        ) : <Empty icon="⚖️" title={weights.length ? 'Нужно минимум два взвешивания' : 'Нет взвешиваний'} />}
        <button className="btn sm block mt-12" onClick={() => nav.push({ name: 'weights' })}>История измерений</button>
      </div>
    </div>
  );
}
