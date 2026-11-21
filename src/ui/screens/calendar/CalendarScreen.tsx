import { useMemo, useState } from 'react';
import { saveWorkout, setCalendarMark, useActiveProgram, useCalendarOverrides, useWorkouts } from '../../../data/repo';
import { Header, SyncIndicator, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import { buildCalendar, sequenceAt, type CalendarDay } from '../../../domain/schedule';
import { createManualWorkout } from '../../../domain/workout';
import { WEEKDAYS_SHORT, formatDate, monthTitle, toLocalDate, weekday, diffDays } from '../../../lib/dates';
import { STATUS_BG, STATUS_FG } from '../home/HomeScreen';
import { haptic } from '../../../telegram/tg';

const LEGEND = [
  { s: 'done', l: 'Выполнено' },
  { s: 'planned', l: 'Запланировано' },
  { s: 'rest', l: 'Отдых' },
  { s: 'missed', l: 'Пропущено' },
];

export function CalendarScreen() {
  const program = useActiveProgram();
  const workouts = useWorkouts();
  const overrides = useCalendarOverrides();
  const nav = useNav();
  const ui = useUi();
  const today = toLocalDate();
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState<string>(today);

  const first = toLocalDate(new Date(month.y, month.m, 1));
  const last = toLocalDate(new Date(month.y, month.m + 1, 0));
  const days = useMemo(() => buildCalendar(first, last, { program, workouts, overrides, today }), [first, last, program, workouts, overrides, today]);
  const lead = weekday(first);
  const sel = days.find((d) => d.date === selected) ?? null;

  const shift = (delta: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const markDone = async (d: CalendarDay) => {
    // Use the planned session if there is one; for past days take the program's current position.
    const item = d.plannedItem ?? (program ? sequenceAt(program, program.progressIndex) : null);
    const label = item?.day.name ?? 'Тренировка';
    if (!(await ui.confirm({ title: `Отметить «${label}» выполненной?`, text: `${formatDate(d.date, true)} — без записи подходов.`, ok: 'Отметить' }))) return;
    const w = createManualWorkout(d.date, program, item);
    await saveWorkout(w);
    haptic.success();
  };

  return (
    <div className="screen">
      <Header title="Календарь" right={<SyncIndicator />} />
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><Icon name="back" /></button>
          <button className="bold" onClick={() => { const d = new Date(); setMonth({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today); }}>{monthTitle(month.y, month.m)}</button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц"><Icon name="chevron" /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {WEEKDAYS_SHORT.map((d) => <div key={d} className="center tiny faint" style={{ paddingBottom: 4 }}>{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
          {days.map((d) => (
            <button
              key={d.date}
              onClick={() => { haptic.select(); setSelected(d.date); }}
              className="num"
              style={{
                aspectRatio: '1', borderRadius: 12, fontWeight: 650, fontSize: 14,
                background: STATUS_BG[d.status], color: STATUS_FG[d.status],
                outline: d.date === selected ? '2px solid var(--text)' : d.date === today ? '1.5px solid var(--text-3)' : 'none',
                outlineOffset: -2, position: 'relative',
              }}
            >
              {Number(d.date.slice(8))}
              {d.override && <span style={{ position: 'absolute', top: 4, right: 5, width: 4, height: 4, borderRadius: 2, background: 'currentColor' }} />}
            </button>
          ))}
        </div>
        <div className="row mt-12" style={{ flexWrap: 'wrap', gap: 12 }}>
          {LEGEND.map((x) => (
            <span key={x.s} className="row tiny muted" style={{ gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_FG[x.s] }} />{x.l}
            </span>
          ))}
        </div>
      </div>

      {sel && (
        <div className="card mt-12">
          <div className="row between">
            <div className="bold">{formatDate(sel.date, true)}</div>
            <span className="chip" style={{ background: STATUS_BG[sel.status], color: STATUS_FG[sel.status] }}>
              {sel.status === 'done' ? 'выполнено' : sel.status === 'planned' ? 'запланировано' : sel.status === 'missed' ? 'пропущено' : sel.status === 'rest' ? 'отдых' : 'нет плана'}
            </span>
          </div>
          {sel.plannedName && <div className="muted mt-8">План: <b>{sel.plannedName}</b>{sel.plannedItem && program && program.blocks.length > 1 ? ` · ${sel.plannedItem.block.name}` : ''}</div>}
          {sel.status === 'missed' && <div className="small muted mt-8">Запланированная тренировка не была выполнена.</div>}

          {sel.workouts.length > 0 && (
            <div className="list mt-12" style={{ background: 'var(--card-2)' }}>
              {sel.workouts.map((w) => (
                <button key={w.id} className="list-item" onClick={() => nav.push({ name: 'workout', id: w.id })}>
                  <span className="grow">{w.dayName}<span className="faint small">{w.manual ? ' · вручную' : ''}</span></span>
                  <Icon name="chevron" className="faint" />
                </button>
              ))}
            </div>
          )}

          <div className="grid-2 mt-12">
            {diffDays(sel.date, today) >= 0 && (
              <button className="btn sm" onClick={() => markDone(sel)}><Icon name="check" size={16} /> Выполнено</button>
            )}
            {sel.override?.mark === 'rest' || (sel.status === 'rest' && !sel.override) ? (
              sel.override?.mark === 'rest'
                ? <button className="btn sm" onClick={() => setCalendarMark(sel.date, null)}>Убрать отдых</button>
                : <button className="btn sm" onClick={() => setCalendarMark(sel.date, 'train')}>Сделать тренировочным</button>
            ) : sel.override?.mark === 'train' ? (
              <button className="btn sm" onClick={() => setCalendarMark(sel.date, null)}>Вернуть по расписанию</button>
            ) : (
              <button className="btn sm" onClick={() => setCalendarMark(sel.date, 'rest')}>День отдыха</button>
            )}
          </div>
          {!program && <div className="tiny faint mt-12">Активируйте программу, чтобы календарь показывал расписание.</div>}
        </div>
      )}
      {program && (
        <div className="tiny faint center mt-12">
          Расписание программы «{program.name}» с {formatDate(program.schedule.startDate, true)}. Будущие дни подписаны следующими тренировками по порядку.
        </div>
      )}
    </div>
  );
}
