import { useState } from 'react';
import { useDoc } from '../../../data/store';
import { saveProgram, useLibrary } from '../../../data/repo';
import { Empty, Header, NumberInput, Sheet, Stepper, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { ExercisePicker } from '../../components/ExercisePicker';
import { useNav } from '../../nav';
import type { Intensity, ProgramDay, ProgramExercise } from '../../../domain/types';
import { defaultRestSec, muscleLabel } from '../../../domain/exerciseLibrary';
import { INTENSITY_RIR } from '../../../import/parseTable';
import { newId } from '../../../lib/id';
import { formatKg, repsRange } from '../../../lib/format';
import { INTENSITY_LABELS } from '../run/rir';

export function DayEditorScreen({ programId, blockId, dayId }: { programId: string; blockId: string; dayId: string }) {
  const p = useDoc('program', programId);
  const library = useLibrary();
  const nav = useNav();
  const ui = useUi();
  const [editing, setEditing] = useState<string | null>(null);
  const [picker, setPicker] = useState<'add' | { altFor: string } | null>(null);

  const block = p?.blocks.find((b) => b.id === blockId);
  const day = block?.days.find((d) => d.id === dayId);
  if (!p || !block || !day) return <div className="screen"><Header title="День" back /><Empty title="День не найден" /></div>;

  const saveDay = (d: ProgramDay) => saveProgram({
    ...p,
    blocks: p.blocks.map((b) => (b.id !== blockId ? b : { ...b, days: b.days.map((x) => (x.id === dayId ? d : x)) })),
  });
  const updateEx = (id: string, patch: Partial<ProgramExercise>) => saveDay({ ...day, exercises: day.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...day.exercises];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveDay({ ...day, exercises: arr });
  };
  const editingEx = day.exercises.find((e) => e.id === editing);

  return (
    <div className="screen">
      <Header title={day.name} back right={
        <button className="icon-btn" aria-label="Удалить день" onClick={async () => {
          if (await ui.confirm({ title: `Удалить «${day.name}»?`, ok: 'Удалить', danger: true })) {
            await saveProgram({ ...p, blocks: p.blocks.map((b) => (b.id !== blockId ? b : { ...b, days: b.days.filter((d) => d.id !== dayId) })) });
            nav.pop();
          }
        }}><Icon name="trash" /></button>
      } />
      {p.blocks.length > 1 && <div className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>{p.name} · {block.name}</div>}

      <div className="card stack">
        <label className="field"><span>Название дня</span>
          <input defaultValue={day.name} key={`n${day.name}`} onBlur={(e) => e.target.value.trim() && e.target.value !== day.name && saveDay({ ...day, name: e.target.value.trim() })} />
        </label>
        <label className="field"><span>Фокус (необязательно)</span>
          <input defaultValue={day.focus} key={`f${day.focus}`} placeholder="Грудь, плечи, трицепс" onBlur={(e) => e.target.value !== day.focus && saveDay({ ...day, focus: e.target.value })} />
        </label>
      </div>

      <div className="section-title">Упражнения</div>
      <div className="stack">
        {day.exercises.map((pe, i) => {
          const ex = library.byId.get(pe.exerciseId);
          return (
            <div key={pe.id} className="card tight">
              <div className="row">
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEditing(pe.id)}>
                  <div className="bold">{i + 1}. {ex?.name ?? 'Неизвестное упражнение'}</div>
                  <div className="small muted num">
                    {pe.sets} × {repsRange(pe.repsMin, pe.repsMax)}
                    {pe.weight !== null ? ` · ${formatKg(pe.weight)} кг` : ''}
                    {` · отдых ${Math.round(pe.restSec / 60 * 10) / 10} мин`}
                    {pe.intensity ? ` · ${INTENSITY_LABELS[pe.intensity].toLowerCase()}` : ''}
                  </div>
                  {pe.alternatives.length > 0 && <div className="tiny faint mt-8">Замены: {pe.alternatives.map((a) => library.byId.get(a)?.name).filter(Boolean).join(', ')}</div>}
                </button>
                <div className="stack" style={{ gap: 4 }}>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => move(i, -1)} aria-label="Выше"><Icon name="up" size={15} /></button>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => move(i, 1)} aria-label="Ниже"><Icon name="down" size={15} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {!day.exercises.length && <Empty icon="➕" title="Добавьте первое упражнение" />}
        <button className="btn primary block" onClick={() => setPicker('add')}><Icon name="plus" /> Добавить упражнение</button>
      </div>

      <ExercisePicker
        open={picker === 'add'}
        onClose={() => setPicker(null)}
        onPick={(e) => {
          const pe: ProgramExercise = {
            id: newId('pex'), exerciseId: e.id, sets: 3, repsMin: 8, repsMax: 12, weight: null, restSec: defaultRestSec(e),
            intensity: null, rirMin: null, rirMax: null, notes: '', alternatives: [],
          };
          saveDay({ ...day, exercises: [...day.exercises, pe] });
        }}
      />
      <ExercisePicker
        open={!!picker && picker !== 'add'}
        title="Альтернативное упражнение"
        exclude={editingEx ? [editingEx.exerciseId, ...editingEx.alternatives] : []}
        onClose={() => setPicker(null)}
        onPick={(e) => editingEx && updateEx(editingEx.id, { alternatives: [...editingEx.alternatives, e.id] })}
      />

      <Sheet open={!!editingEx && !picker} onClose={() => setEditing(null)} title={editingEx ? library.byId.get(editingEx.exerciseId)?.name : ''}>
        {editingEx && (
          <ExerciseForm
            pe={editingEx}
            muscle={(() => { const m = library.byId.get(editingEx.exerciseId); return m ? muscleLabel(m.primary) : ''; })()}
            altNames={editingEx.alternatives.map((a) => ({ id: a, name: library.byId.get(a)?.name ?? '?' }))}
            onChange={(patch) => updateEx(editingEx.id, patch)}
            onAddAlt={() => setPicker({ altFor: editingEx.id })}
            onRemove={async () => {
              setEditing(null);
              await saveDay({ ...day, exercises: day.exercises.filter((e) => e.id !== editingEx.id) });
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ExerciseForm({ pe, muscle, altNames, onChange, onAddAlt, onRemove }: {
  pe: ProgramExercise;
  muscle: string;
  altNames: { id: string; name: string }[];
  onChange: (patch: Partial<ProgramExercise>) => void;
  onAddAlt: () => void;
  onRemove: () => void;
}) {
  const setIntensity = (i: Intensity | null) => onChange(i ? { intensity: i, rirMin: INTENSITY_RIR[i][0], rirMax: INTENSITY_RIR[i][1] } : { intensity: null, rirMin: null, rirMax: null });
  return (
    <div className="stack" style={{ gap: 14 }}>
      {muscle && <div className="small muted" style={{ marginTop: -8 }}>{muscle}</div>}
      <div className="field"><span>Подходы</span><Stepper value={pe.sets} min={1} max={20} onChange={(v) => onChange({ sets: Math.max(1, v) })} /></div>
      <div className="grid-2">
        <div className="field"><span>Повторы от</span><Stepper value={pe.repsMin} min={1} max={100} onChange={(v) => onChange({ repsMin: v, repsMax: Math.max(v, pe.repsMax) })} /></div>
        <div className="field"><span>до</span><Stepper value={pe.repsMax} min={1} max={100} onChange={(v) => onChange({ repsMax: v, repsMin: Math.min(v, pe.repsMin) })} /></div>
      </div>
      <div className="grid-2">
        <label className="field"><span>Рекоменд. вес, кг</span>
          <NumberInput value={pe.weight} onChange={(v) => onChange({ weight: v })} decimal max={1000} placeholder="—" className="num" />
        </label>
        <div className="field"><span>Отдых, сек</span><Stepper value={pe.restSec} step={15} min={0} max={900} onChange={(v) => onChange({ restSec: v })} /></div>
      </div>
      <div className="field">
        <span>Интенсивность (целевой RIR)</span>
        <div className="segmented">
          {([null, 'light', 'medium', 'heavy'] as const).map((i) => (
            <button key={i ?? 'none'} className={pe.intensity === i ? 'on' : ''} onClick={() => setIntensity(i)}>
              {i ? `${INTENSITY_LABELS[i]} ${INTENSITY_RIR[i].join('–')}` : 'Нет'}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Альтернативные упражнения</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {altNames.map((a) => (
            <button key={a.id} className="chip" onClick={() => onChange({ alternatives: pe.alternatives.filter((x) => x !== a.id) })}>
              {a.name} <Icon name="close" size={12} />
            </button>
          ))}
          <button className="chip accent" onClick={onAddAlt}><Icon name="plus" size={12} /> Добавить</button>
        </div>
      </div>
      <label className="field"><span>Заметки</span>
        <textarea defaultValue={pe.notes} key={pe.id} onBlur={(e) => e.target.value !== pe.notes && onChange({ notes: e.target.value })} placeholder="Техника, темп, хват…" />
      </label>
      <button className="btn danger block" onClick={onRemove}><Icon name="trash" /> Убрать из дня</button>
    </div>
  );
}
