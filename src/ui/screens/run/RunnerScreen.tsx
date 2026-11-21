import { useCallback, useEffect, useMemo, useState } from 'react';
import './runner.css';
import { get } from '../../../data/store';
import { completeWorkout, deleteWorkout, saveWorkout, useActiveWorkout, useLibrary, useRecommendations, useSettings, useWorkouts } from '../../../data/repo';
import * as W from '../../../domain/workout';
import { incrementFor, intensityAdjustment, targetRir } from '../../../domain/adaptiveLoad';
import { muscleLabel } from '../../../domain/exerciseLibrary';
import type { Exercise, Workout } from '../../../domain/types';
import { Empty, Sheet, useNow, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { ExercisePicker } from '../../components/ExercisePicker';
import { useNav } from '../../nav';
import { formatDuration } from '../../../lib/dates';
import { formatKg, repsRange } from '../../../lib/format';
import { haptic } from '../../../telegram/tg';
import { SetEditor } from './SetEditor';
import { RestPanel } from './RestPanel';
import { INTENSITY_LABELS, RIR_LABELS, rirTargetText } from './rir';
import { unlockAudio } from './sound';

export function RunnerScreen() {
  const workout = useActiveWorkout();
  const nav = useNav();
  if (!workout) {
    return (
      <div className="screen no-tabbar">
        <Empty icon="✅" title="Нет активной тренировки">
          <button className="btn primary mt-12" onClick={() => nav.pop()}>Назад</button>
        </Empty>
      </div>
    );
  }
  return <Runner key={workout.id} workout={workout} />;
}

type SheetKind = 'replace' | 'add' | 'menu' | 'finish' | 'rir' | null;

function Runner({ workout }: { workout: Workout }) {
  const nav = useNav();
  const ui = useUi();
  const library = useLibrary();
  const settings = useSettings();
  const history = useWorkouts();
  const recommendations = useRecommendations();
  const now = useNow(workout.rest ? 250 : 1000);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [comment, setComment] = useState(workout.comment);

  /** Every change is written immediately (IndexedDB) — a reload or crash loses nothing. */
  const apply = useCallback((fn: (w: Workout) => Workout) => {
    const latest = get('workout', workout.id) ?? workout;
    void saveWorkout(fn(latest));
  }, [workout]);

  const idx = Math.min(workout.currentExercise, workout.exercises.length - 1);
  const ex = workout.exercises[idx];
  const meta: Exercise | undefined = ex ? library.byId.get(ex.exerciseId) : undefined;
  const increment = meta ? incrementFor(meta.equipment, settings) : 2.5;
  const firstUndone = ex?.sets.find((s) => !s.done) ?? null;
  const focused = ex?.sets.find((s) => s.id === focusSetId) ?? firstUndone;
  const allDone = !!ex && ex.sets.length > 0 && ex.sets.every((s) => s.done);
  const nextIdx = W.nextUnfinished(workout, idx);
  const isLastExercise = nextIdx === -1 || (nextIdx === idx);

  useEffect(() => setFocusSetId(null), [idx]);

  // History for the current exercise (excluding this workout) — first time vs. prefilled.
  const lastPerf = useMemo(() => (ex ? W.performances(history, ex.exerciseId, workout.id)[0] ?? null : null), [history, ex, workout.id]);
  const adjustment = useMemo(() => {
    if (!ex || !lastPerf) return null;
    const adj = intensityAdjustment({ sets: lastPerf.sets, target: lastPerf.exercise.target }, ex.target, increment);
    if (!adj) return null;
    const undone = ex.sets.filter((s) => !s.done);
    // Hide once applied (or if the user already typed something else).
    return undone.length && undone.some((s) => s.weight === adj.lastWeight) ? adj : null;
  }, [ex, lastPerf, increment]);

  if (!ex) {
    return (
      <div className="screen no-tabbar">
        <Empty title="В тренировке нет упражнений">
          <button className="btn primary mt-12" onClick={() => setSheet('add')}>Добавить упражнение</button>
        </Empty>
        <ExercisePicker open={sheet === 'add'} onClose={() => setSheet(null)} onPick={(e) => addExercise(e)} />
      </div>
    );
  }

  function addExercise(e: Exercise) {
    const target = W.newExerciseTarget(e);
    const wex = W.buildWorkoutExercise(e, target, {}, W.performances(history, e.id, workout.id), recommendations);
    apply((w) => W.goToExercise(W.addExercise(w, wex), w.exercises.length));
  }

  function replaceWith(e: Exercise) {
    const target = { ...ex.target, restSec: ex.target.restSec };
    const wex = W.buildWorkoutExercise(e, target, { notes: ex.notes }, W.performances(history, e.id, workout.id), recommendations);
    apply((w) => W.replaceExercise(w, idx, wex));
    ui.toast('Заменено только в этой тренировке');
  }

  const complete = (setId: string) => {
    unlockAudio();
    haptic.impact();
    apply((w) => W.completeSet(w, idx, setId));
    setFocusSetId(null);
  };

  const finish = async () => {
    setSheet(null);
    const done = await completeWorkout(get('workout', workout.id) ?? workout, comment);
    haptic.success();
    nav.replace({ name: 'summary', id: done.id });
  };

  const discard = async () => {
    setSheet(null);
    if (await ui.confirm({ title: 'Удалить тренировку?', text: 'Все записанные подходы этой тренировки будут удалены.', ok: 'Удалить', danger: true })) {
      await deleteWorkout(workout.id);
      nav.pop();
    }
  };

  const rirTarget = ex.target.rirMin !== null ? targetRir(ex.target) : null;
  const doneSets = W.doneSetsCount(workout);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const media = meta?.mediaUrl;

  return (
    <div className="screen no-tabbar">
      <div className="run-top">
        <button className="icon-btn" onClick={() => nav.pop()} aria-label="Свернуть"><Icon name="back" /></button>
        <div className="run-clock">
          {formatDuration(W.elapsedMs(workout, now), true)}
          <small>{doneSets}/{totalSets} подходов</small>
        </div>
        <button className="icon-btn" onClick={() => { haptic.tap(); apply((w) => W.pauseWorkout(w)); }} aria-label="Пауза"><Icon name="pause" /></button>
        <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="Меню"><Icon name="more" /></button>
      </div>

      <div className="ex-strip">
        {workout.exercises.map((e, i) => (
          <button key={e.id} className={`ex-pill ${i === idx ? 'cur' : e.status}`} onClick={() => { haptic.select(); apply((w) => W.goToExercise(w, i)); }}>
            {e.status === 'done' && i !== idx && <Icon name="check" size={13} stroke={3} />}
            <span>{i + 1}. {e.name}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <h2 className="ex-name">{ex.name}</h2>
            <div className="small muted mt-8">
              {meta ? [muscleLabel(meta.primary), ...meta.secondary].join(' · ') : ''}
            </div>
          </div>
          {ex.originalExerciseId && <span className="chip amber">замена</span>}
        </div>
        {media && (/\.(mp4|webm|mov)(\?|$)/i.test(media)
          ? <video className="ex-media" src={media} muted loop playsInline autoPlay />
          : <img className="ex-media" src={media} alt="" loading="lazy" />)}
        <div className="targets">
          <div><div className="v">{ex.target.sets}</div><div className="l">подходы</div></div>
          <div><div className="v">{repsRange(ex.target.repsMin, ex.target.repsMax)}</div><div className="l">повт.</div></div>
          <div><div className="v">{ex.target.weight !== null ? formatKg(ex.target.weight) : '—'}</div><div className="l">вес, кг</div></div>
          <div><div className="v">{Math.round(ex.target.restSec / 60 * 10) / 10}′</div><div className="l">отдых</div></div>
        </div>
        {(ex.target.intensity || rirTarget) && (
          <button className="row mt-12 small" style={{ gap: 6 }} onClick={() => setSheet('rir')}>
            {ex.target.intensity && <span className="chip accent">{INTENSITY_LABELS[ex.target.intensity]}</span>}
            {rirTarget && <span className="chip">цель {rirTargetText(ex.target.rirMin, ex.target.rirMax)}</span>}
            <Icon name="info" size={16} className="faint" />
          </button>
        )}
        {ex.notes && <div className="small muted mt-12">{ex.notes}</div>}
        {!lastPerf && <div className="small mt-12" style={{ color: 'var(--blue)' }}>Первое выполнение — введите вес и повторения вручную.</div>}
        {adjustment && (
          <div className="warn-box mt-12">
            <div>{adjustment.reason}</div>
            <button className="btn sm primary mt-8" onClick={() => {
              apply((w) => ({ ...w, exercises: w.exercises.map((e, i) => i !== idx ? e : { ...e, sets: e.sets.map((s) => s.done ? s : { ...s, weight: adjustment.weight }) }) }));
              haptic.tap();
            }}>
              Поставить {formatKg(adjustment.weight)} кг
            </button>
          </div>
        )}
      </div>

      <div className="stack mt-12" style={{ gap: 8 }}>
        {ex.sets.map((s, i) => s.id === focused?.id && !s.done ? (
          <SetEditor
            key={s.id}
            index={i}
            set={s}
            weightStep={increment}
            repsHint={repsRange(ex.target.repsMin, ex.target.repsMax)}
            rirTarget={rirTarget}
            onChange={(patch) => apply((w) => W.updateSet(w, idx, s.id, patch))}
            onComplete={() => complete(s.id)}
            onRemove={() => apply((w) => W.removeSet(w, idx, s.id))}
          />
        ) : (
          <button
            key={s.id}
            className={`set-row ${s.done ? 'done' : 'pending'}`}
            onClick={() => {
              haptic.select();
              if (s.done) apply((w) => W.uncompleteSet(w, idx, s.id));
              setFocusSetId(s.id);
            }}
          >
            <span className="n">{s.done ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
            <span className="val">
              {s.weight !== null ? `${formatKg(s.weight)} кг` : '— кг'} × {s.reps ?? repsRange(ex.target.repsMin, ex.target.repsMax)}
            </span>
            {s.rir !== null && <span className="chip">RIR {s.rir}</span>}
            {s.done ? <Icon name="edit" size={16} className="faint" /> : <span className="tiny faint">план</span>}
          </button>
        ))}
      </div>

      <div className="grid-3 mt-12">
        <button className="btn sm" onClick={() => { haptic.tap(); apply((w) => W.addSet(w, idx)); }}><Icon name="plus" size={16} /> Подход</button>
        <button className="btn sm" onClick={() => setSheet('replace')}><Icon name="swap" size={16} /> Замена</button>
        <button className="btn sm" onClick={() => { haptic.tap(); apply((w) => W.skipExercise(w, idx)); }}><Icon name="skip" size={16} /> Пропуск</button>
      </div>

      {allDone && (
        isLastExercise ? (
          <button className="btn primary block lg mt-16" onClick={() => setSheet('finish')}><Icon name="flag" /> Завершить тренировку</button>
        ) : (
          <button className="btn primary block lg mt-16" onClick={() => { haptic.impact(); apply((w) => W.goToExercise(W.skipRest(w), nextIdx)); }}>
            Следующее: {workout.exercises[nextIdx].name} <Icon name="chevron" size={18} />
          </button>
        )
      )}
      {!allDone && (
        <button className="btn ghost block mt-16" onClick={() => setSheet('finish')}>Завершить тренировку досрочно</button>
      )}

      {workout.rest && <div className="rest-spacer" />}
      {workout.rest && !workout.pausedAt && (
        <RestPanel
          rest={workout.rest}
          now={now}
          sound={settings.sound}
          nextLabel={allDone ? (isLastExercise ? 'Готово' : 'К следующему упражнению') : 'Следующий подход'}
          onAdjust={(d) => apply((w) => W.adjustRest(w, d))}
          onTogglePause={() => apply((w) => W.toggleRestPause(w))}
          onSkip={() => apply((w) => (allDone && !isLastExercise ? W.goToExercise(W.skipRest(w), nextIdx) : W.skipRest(w)))}
        />
      )}

      {workout.pausedAt && (
        <div className="paused-veil">
          <div className="center">
            <div className="faint small">Тренировка на паузе</div>
            <div className="rest-time mt-8">{formatDuration(W.elapsedMs(workout, now), true)}</div>
            <button className="btn primary lg mt-16" style={{ minWidth: 220 }} onClick={() => { haptic.impact(); apply((w) => W.resumeWorkout(w)); }}>
              <Icon name="play" /> Продолжить
            </button>
          </div>
        </div>
      )}

      <ExercisePicker
        open={sheet === 'replace'}
        onClose={() => setSheet(null)}
        title={`Заменить «${ex.name}»`}
        suggested={ex.alternatives}
        exclude={[ex.exerciseId]}
        onPick={replaceWith}
      />
      <ExercisePicker open={sheet === 'add'} onClose={() => setSheet(null)} onPick={addExercise} title="Добавить упражнение" />

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={workout.dayName}>
        <div className="list">
          <button className="list-item" onClick={() => setSheet('add')}><Icon name="plus" /> Добавить упражнение</button>
          <button className="list-item" onClick={() => { setSheet(null); apply((w) => W.pauseWorkout(w)); }}><Icon name="pause" /> Пауза</button>
          <button className="list-item" onClick={() => setSheet('finish')}><Icon name="flag" /> Завершить тренировку</button>
          <button className="list-item" style={{ color: 'var(--red)' }} onClick={discard}><Icon name="trash" /> Удалить тренировку</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'finish'} onClose={() => setSheet(null)} title="Завершить тренировку?">
        <p className="muted small" style={{ marginTop: -6 }}>
          Выполнено {doneSets} из {totalSets} подходов. Неподтверждённые подходы не сохранятся — это только рекомендации.
        </p>
        <label className="field">
          <span>Комментарий</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Самочувствие, заметки…" />
        </label>
        <button className="btn primary block lg mt-12" onClick={finish}>Завершить</button>
        <button className="btn ghost block mt-8" onClick={() => setSheet(null)}>Продолжить тренировку</button>
      </Sheet>

      <Sheet open={sheet === 'rir'} onClose={() => setSheet(null)} title="Запас повторений (RIR)">
        <p className="small muted" style={{ marginTop: -6 }}>
          После подхода отметьте, сколько повторений вы ещё могли бы сделать с правильной техникой.
        </p>
        <div className="list">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <div key={r} className="list-item" style={rirTarget && r >= rirTarget[0] && r <= rirTarget[1] ? { background: 'var(--accent-soft)' } : undefined}>
              <span className="bold num" style={{ width: 28 }}>{r === 6 ? '6+' : r}</span>
              <span className="grow small">{RIR_LABELS[r]}</span>
            </div>
          ))}
        </div>
        <p className="small faint mt-12">
          Лёгкая интенсивность ≈ RIR 5–6, средняя ≈ 3–4, тяжёлая ≈ 0–1. Подсвечена цель этого упражнения.
        </p>
      </Sheet>
    </div>
  );
}
