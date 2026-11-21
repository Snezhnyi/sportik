import { useMemo } from 'react';
import { useDoc } from '../../../data/store';
import { useRecommendations, useWorkouts } from '../../../data/repo';
import { bestSets, doneSetsCount, elapsedMs, workoutVolume } from '../../../domain/workout';
import { formatDate, formatDuration } from '../../../lib/dates';
import { formatKg, formatVolume } from '../../../lib/format';
import { Empty } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import { RecommendationCard } from './RecommendationCard';

export function SummaryScreen({ id }: { id: string }) {
  const w = useDoc('workout', id);
  const history = useWorkouts();
  const recs = useRecommendations().filter((r) => r.workoutId === id);
  const nav = useNav();
  const best = useMemo(() => (w ? bestSets(w, history) : []), [w, history]);

  if (!w) return <div className="screen no-tabbar"><Empty title="Тренировка не найдена" /></div>;
  const exercisesDone = w.exercises.filter((e) => e.sets.some((s) => s.done)).length;
  const records = best.filter((b) => b.record);

  return (
    <div className="screen no-tabbar">
      <div className="hero center">
        <div style={{ fontSize: 40 }}>🎉</div>
        <h2>Тренировка завершена</h2>
        <div className="muted small">{formatDate(w.date, true)} · {[w.programName, w.blockName, w.dayName].filter(Boolean).join(' · ')}</div>
      </div>

      <div className="grid-2 mt-12">
        <div className="stat"><div className="v">{formatDuration(elapsedMs(w))}</div><div className="l">Общее время</div></div>
        <div className="stat"><div className="v">{formatVolume(workoutVolume(w))}</div><div className="l">Объём (вес × повт.)</div></div>
        <div className="stat"><div className="v">{exercisesDone}</div><div className="l">Упражнений</div></div>
        <div className="stat"><div className="v">{doneSetsCount(w)}</div><div className="l">Подходов</div></div>
      </div>

      {best.length > 0 && (
        <>
          <div className="section-title">Лучшие подходы{records.length ? ` · ${records.length} рекорд` : ''}</div>
          <div className="list">
            {best.map((b) => (
              <div key={b.exerciseId} className="list-item">
                <span className="grow ellipsis">{b.name}</span>
                {b.record && <span className="chip accent"><Icon name="star" size={12} /> {b.record === 'weight' ? 'рекорд веса' : 'рекорд'}</span>}
                <span className="num bold">{formatKg(b.weight)} × {b.reps}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {recs.length > 0 && (
        <>
          <div className="section-title">Нагрузка на следующую тренировку</div>
          <div className="stack">
            {recs.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </div>
        </>
      )}

      {w.comment && (
        <>
          <div className="section-title">Комментарий</div>
          <div className="card small">{w.comment}</div>
        </>
      )}

      <button className="btn primary block lg mt-16" onClick={() => { nav.reset(); nav.setTab('home'); }}>Готово</button>
    </div>
  );
}
