import { useMemo, useState } from 'react';
import { useActiveProgram, useActiveWorkout, usePrograms, useWorkouts } from '../../../data/repo';
import { Empty, Header, SyncIndicator } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import { programSequence, sequenceLabel } from '../../../domain/schedule';
import { doneSetsCount, elapsedMs, workoutVolume } from '../../../domain/workout';
import { formatDate, formatDuration } from '../../../lib/dates';
import { formatVolume } from '../../../lib/format';
import { useStartWorkout } from '../run/useStartWorkout';

export function WorkoutsScreen() {
  const programs = usePrograms().filter((p) => p.status !== 'archived');
  const active = useActiveProgram();
  const running = useActiveWorkout();
  const workouts = useWorkouts().filter((w) => w.status === 'completed');
  const nav = useNav();
  const start = useStartWorkout();
  const [programId, setProgramId] = useState<string | null>(null);
  const program = programs.find((p) => p.id === programId) ?? active ?? programs[0] ?? null;
  const [blockIdx, setBlockIdx] = useState<number | null>(null);

  const seq = useMemo(() => (program ? programSequence(program) : []), [program]);
  const nextItem = program && seq.length ? seq[program.progressIndex % seq.length] : null;
  const shownBlock = blockIdx ?? nextItem?.blockIndex ?? 0;
  // One entry per day of the shown block (first repeat): the user picks any day manually.
  const items = seq.filter((s) => s.blockIndex === shownBlock && s.repeat === (shownBlock === nextItem?.blockIndex ? nextItem.repeat : 0));

  return (
    <div className="screen">
      <Header title="Тренировки" right={<SyncIndicator />} />

      {running && (
        <button className="card clickable row" style={{ width: '100%', textAlign: 'left', border: '1.5px solid var(--accent)' }} onClick={() => nav.push({ name: 'run' })}>
          <Icon name="timer" />
          <span className="grow bold">Продолжить: {running.dayName}</span>
          <Icon name="chevron" className="faint" />
        </button>
      )}

      <div className="section-title">Начать тренировку</div>
      {program ? (
        <div className="card">
          {programs.length > 1 && (
            <select value={program.id} onChange={(e) => { setProgramId(e.target.value); setBlockIdx(null); }} style={{ marginBottom: 10 }}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === 'active' ? ' (активная)' : ''}</option>)}
            </select>
          )}
          {program.blocks.length > 1 && (
            <div className="row" style={{ overflowX: 'auto', gap: 6, paddingBottom: 8 }}>
              {program.blocks.map((b, i) => (
                <button key={b.id} className={`chip ${i === shownBlock ? 'accent' : ''}`} onClick={() => setBlockIdx(i)}>{b.name}</button>
              ))}
            </div>
          )}
          <div className="list" style={{ background: 'var(--card-2)' }}>
            {items.map((it) => (
              <button key={`${it.index}`} className="list-item" disabled={!!running} onClick={() => start(program, it)}>
                <div className="grow">
                  <div className="bold">{it.day.name}</div>
                  <div className="tiny faint">{it.day.exercises.length} упр.{sequenceLabel(program, it) ? ` · ${sequenceLabel(program, it)}` : ''}</div>
                </div>
                {nextItem?.index === it.index && <span className="chip accent">по плану</span>}
                <Icon name="play" size={18} className="faint" />
              </button>
            ))}
            {!items.length && <div className="empty small">В программе нет дней с упражнениями</div>}
          </div>
        </div>
      ) : (
        <Empty title="Нет программ">
          <button className="btn primary mt-12" onClick={() => nav.setTab('programs')}>Создать программу</button>
        </Empty>
      )}

      <div className="section-title">История</div>
      {workouts.length ? (
        <div className="list">
          {workouts.map((w) => (
            <button key={w.id} className="list-item" onClick={() => nav.push({ name: 'workout', id: w.id })}>
              <div className="grow">
                <div className="bold ellipsis">{w.dayName}</div>
                <div className="tiny faint ellipsis">
                  {formatDate(w.date)} · {w.manual ? 'отмечено вручную' : `${formatDuration(elapsedMs(w))} · ${doneSetsCount(w)} подх. · ${formatVolume(workoutVolume(w))}`}
                </div>
              </div>
              <Icon name="chevron" className="faint" />
            </button>
          ))}
        </div>
      ) : <Empty icon="📋" title="Завершённых тренировок пока нет" />}
    </div>
  );
}
