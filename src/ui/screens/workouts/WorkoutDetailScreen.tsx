import { useState } from 'react';
import { useDoc } from '../../../data/store';
import { deleteWorkout, saveWorkout } from '../../../data/repo';
import { doneSetsCount, elapsedMs, workoutVolume } from '../../../domain/workout';
import { formatDate, formatDuration } from '../../../lib/dates';
import { formatKg, formatVolume } from '../../../lib/format';
import { Empty, Header, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';

export function WorkoutDetailScreen({ id }: { id: string }) {
  const w = useDoc('workout', id);
  const nav = useNav();
  const ui = useUi();
  const [comment, setComment] = useState<string | null>(null);
  if (!w) return <div className="screen"><Header title="Тренировка" back /><Empty title="Не найдена" /></div>;

  const start = new Date(w.startedAt);
  const end = w.finishedAt ? new Date(w.finishedAt) : null;
  const time = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="screen">
      <Header title={w.dayName} back right={
        <button className="icon-btn" aria-label="Удалить" onClick={async () => {
          if (await ui.confirm({ title: 'Удалить тренировку из истории?', ok: 'Удалить', danger: true })) {
            await deleteWorkout(w.id);
            nav.pop();
          }
        }}><Icon name="trash" /></button>
      } />
      <div className="muted small" style={{ marginTop: -8, marginBottom: 12 }}>
        {formatDate(w.date, true)}{!w.manual && end ? ` · ${time(start)}–${time(end)}` : ''} · {[w.programName, w.blockName].filter(Boolean).join(' · ')}
      </div>

      {!w.manual && (
        <div className="grid-3">
          <div className="stat"><div className="v" style={{ fontSize: 18 }}>{formatDuration(elapsedMs(w))}</div><div className="l">Время</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 18 }}>{doneSetsCount(w)}</div><div className="l">Подходов</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 18 }}>{formatVolume(workoutVolume(w))}</div><div className="l">Объём</div></div>
        </div>
      )}

      {w.exercises.map((e) => (
        <div key={e.id} className="card mt-12">
          <div className="row between">
            <span className="bold">{e.name}</span>
            {e.status === 'skipped' && <span className="chip">пропущено</span>}
            {e.originalExerciseId && <span className="chip amber">замена</span>}
          </div>
          {e.startedAt && e.finishedAt && <div className="tiny faint">{formatDuration(e.finishedAt - e.startedAt)}</div>}
          <div className="stack mt-8" style={{ gap: 4 }}>
            {e.sets.filter((s) => s.done).map((s, i) => (
              <div key={s.id} className="row small num">
                <span className="faint" style={{ width: 20 }}>{i + 1}</span>
                <span className="grow bold">{formatKg(s.weight)} кг × {s.reps}</span>
                {s.rir !== null && <span className="muted">RIR {s.rir}</span>}
                {s.restTakenSec !== null && <span className="faint" style={{ width: 54, textAlign: 'right' }}>{Math.floor(s.restTakenSec / 60)}:{String(s.restTakenSec % 60).padStart(2, '0')}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section-title">Комментарий</div>
      <textarea value={comment ?? w.comment} onChange={(e) => setComment(e.target.value)} placeholder="Заметки о тренировке" />
      {comment !== null && comment !== w.comment && (
        <button className="btn primary block mt-8" onClick={async () => { await saveWorkout({ ...w, comment }); setComment(null); ui.toast('Сохранено'); }}>Сохранить комментарий</button>
      )}
    </div>
  );
}
