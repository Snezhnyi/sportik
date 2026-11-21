import { useMemo, useState } from 'react';
import {
  useActiveProgram, useActiveWorkout, useCalendarOverrides, useLibrary, useProfile, useRecommendations, useWeights, useWorkouts,
} from '../../../data/repo';
import { SyncIndicator, useNow } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import { buildCalendar, nextSession, sequenceLabel } from '../../../domain/schedule';
import { doneSetsCount, elapsedMs } from '../../../domain/workout';
import { addDays, formatDate, formatDuration, toLocalDate, weekday } from '../../../lib/dates';
import { formatKg, plural, repsRange } from '../../../lib/format';
import { useStartWorkout } from '../run/useStartWorkout';
import { WeightSheet } from '../profile/WeightsScreen';

export function HomeScreen() {
  const profile = useProfile();
  const program = useActiveProgram();
  const active = useActiveWorkout();
  const workouts = useWorkouts();
  const recs = useRecommendations();
  const weights = useWeights();
  const overrides = useCalendarOverrides();
  const library = useLibrary();
  const nav = useNav();
  const start = useStartWorkout();
  const [weighIn, setWeighIn] = useState(false);
  const now = useNow(1000, !!active);

  const today = toLocalDate();
  const item = program ? nextSession(program) : null;
  const pending = recs.filter((r) => r.decision === 'pending').length;

  const week = useMemo(() => {
    const monday = addDays(today, -weekday(today));
    return buildCalendar(monday, addDays(monday, 6), { program, workouts, overrides, today });
  }, [today, program, workouts, overrides]);
  const todayInfo = week.find((d) => d.date === today);
  const lastDone = workouts.find((w) => w.status === 'completed');
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="screen">
      <div className="row between" style={{ margin: '4px 0 16px' }}>
        <div>
          <div className="faint small">{formatDate(today)}</div>
          <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em' }}>{greeting}{profile.name ? `, ${profile.name}` : ''}</div>
        </div>
        <SyncIndicator />
      </div>

      {active ? (
        <button className="hero clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ name: 'run' })}>
          <div className="row between">
            <span className="chip accent"><Icon name="timer" size={14} /> {active.pausedAt ? 'На паузе' : 'Идёт тренировка'}</span>
            <span className="num bold" style={{ fontSize: 20 }}>{formatDuration(elapsedMs(active, now), true)}</span>
          </div>
          <h2>{active.dayName}</h2>
          <div className="muted small">{[active.programName, active.blockName].filter(Boolean).join(' · ')}</div>
          <div className="progress mt-12">
            <div style={{ width: `${(doneSetsCount(active) / Math.max(1, active.exercises.reduce((n, e) => n + e.sets.length, 0))) * 100}%` }} />
          </div>
          <div className="btn primary block lg mt-16">Продолжить</div>
        </button>
      ) : program && item ? (
        <div className="hero">
          <div className="row between">
            <span className="chip">{todayInfo?.status === 'planned' ? 'Сегодня по плану' : todayInfo?.status === 'done' ? 'Сегодня уже сделано' : 'Следующая тренировка'}</span>
            <span className="faint small ellipsis" style={{ maxWidth: '50%' }}>{program.name}</span>
          </div>
          <h2>{item.day.name}</h2>
          <div className="muted small">{sequenceLabel(program, item) || `${item.day.exercises.length} упражнений`}</div>
          <div className="stack mt-12" style={{ gap: 6 }}>
            {item.day.exercises.slice(0, 6).map((pe) => (
              <div key={pe.id} className="row small">
                <span className="grow ellipsis">{library.byId.get(pe.exerciseId)?.name ?? 'Упражнение'}</span>
                <span className="faint num">{pe.sets} × {repsRange(pe.repsMin, pe.repsMax)}</span>
              </div>
            ))}
            {item.day.exercises.length > 6 && <div className="faint small">и ещё {item.day.exercises.length - 6}</div>}
          </div>
          <button className="btn primary block lg mt-16" onClick={() => start(program, item)}>
            <Icon name="play" size={18} /> Начать тренировку
          </button>
          <button className="btn ghost block sm mt-8" onClick={() => nav.setTab('workouts')}>Выбрать другой день</button>
        </div>
      ) : (
        <div className="hero">
          <h2>Нет активной программы</h2>
          <p className="muted small">Создайте программу вручную или импортируйте её из Excel/CSV.</p>
          <div className="grid-2">
            <button className="btn primary" onClick={() => nav.setTab('programs')}>Создать</button>
            <button className="btn" onClick={() => { nav.setTab('programs'); nav.push({ name: 'import' }); }}><Icon name="upload" size={18} /> Импорт</button>
          </div>
        </div>
      )}

      {pending > 0 && (
        <button className="card clickable row mt-12" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ name: 'recommendations' })}>
          <div className="icon-btn" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="flag" /></div>
          <div className="grow">
            <div className="bold">Рекомендации по нагрузке</div>
            <div className="small muted">{pending} {plural(pending, 'ждёт', 'ждут', 'ждут')} решения</div>
          </div>
          <Icon name="chevron" className="faint" />
        </button>
      )}

      <div className="section-title">Неделя</div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {week.map((d) => (
          <div key={d.date} className="center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span className="tiny faint">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][weekday(d.date)]}</span>
            <span
              className="num small bold"
              style={{
                width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center',
                background: STATUS_BG[d.status], color: STATUS_FG[d.status],
                outline: d.date === today ? '2px solid var(--text-3)' : 'none', outlineOffset: 1,
              }}
            >
              {Number(d.date.slice(8))}
            </span>
          </div>
        ))}
      </div>

      <div className="grid-2 mt-12">
        <button className="stat clickable" style={{ textAlign: 'left' }} onClick={() => setWeighIn(true)}>
          <div className="v">{weights[0] ? `${formatKg(weights[0].weightKg)}` : '—'}<span className="small faint"> кг</span></div>
          <div className="l">Вес · нажмите, чтобы записать</div>
        </button>
        <button className="stat clickable" style={{ textAlign: 'left' }} onClick={() => lastDone && nav.push({ name: 'workout', id: lastDone.id })}>
          <div className="v ellipsis" style={{ fontSize: 17, paddingTop: 4 }}>{lastDone ? formatDate(lastDone.date) : '—'}</div>
          <div className="l ellipsis">{lastDone ? `Последняя: ${lastDone.dayName}` : 'Тренировок ещё не было'}</div>
        </button>
      </div>

      <WeightSheet entry={weighIn ? 'new' : null} onClose={() => setWeighIn(false)} />
    </div>
  );
}

export const STATUS_BG: Record<string, string> = {
  done: 'var(--green-soft)', planned: 'var(--blue-soft)', missed: 'var(--red-soft)', rest: 'var(--gray-soft)', none: 'transparent',
};
export const STATUS_FG: Record<string, string> = {
  done: 'var(--green)', planned: 'var(--blue)', missed: 'var(--red)', rest: 'var(--text-3)', none: 'var(--text-3)',
};
