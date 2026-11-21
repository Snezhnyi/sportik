import { useMemo, useState } from 'react';
import { saveExercise, useLibrary, useWorkouts } from '../../../data/repo';
import { Header, Sheet } from '../../components/common';
import { Icon } from '../../components/Icon';
import { NewExerciseForm } from '../../components/ExercisePicker';
import { MUSCLE_GROUPS, equipmentLabel, normalizeName } from '../../../domain/exerciseLibrary';
import type { Exercise } from '../../../domain/types';

export function LibraryScreen() {
  const { list } = useLibrary();
  const workouts = useWorkouts();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const used = useMemo(() => {
    const s = new Set<string>();
    for (const w of workouts) for (const e of w.exercises) s.add(e.exerciseId);
    return s;
  }, [workouts]);

  const n = normalizeName(q);
  const visible = list.filter((e) => (showHidden || !e.hidden) && (!n || normalizeName(e.name).includes(n)));

  return (
    <div className="screen">
      <Header title="Упражнения" back right={<button className="icon-btn" onClick={() => setEditing('new')} aria-label="Добавить"><Icon name="plus" /></button>} />
      <div style={{ position: 'relative' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" style={{ paddingLeft: 38 }} />
        <span className="faint" style={{ position: 'absolute', left: 12, top: 12 }}><Icon name="search" size={18} /></span>
      </div>
      {MUSCLE_GROUPS.map((g) => {
        const items = visible.filter((e) => e.primary === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id}>
            <div className="section-title">{g.label} · {items.length}</div>
            <div className="list">
              {items.map((e) => (
                <button key={e.id} className="list-item" onClick={() => setEditing(e)} style={e.hidden ? { opacity: 0.5 } : undefined}>
                  <div className="grow">
                    <div>{e.name}</div>
                    <div className="tiny faint">{equipmentLabel(e.equipment)} · {e.mechanics === 'compound' ? 'базовое' : 'изолирующее'}{e.secondary.length ? ` · ${e.secondary.join(', ')}` : ''}</div>
                  </div>
                  {e.custom && <span className="chip">своё</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <button className="btn ghost block mt-16" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Скрыть скрытые' : 'Показать скрытые'}</button>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Новое упражнение' : 'Упражнение'}>
        {editing && (
          <>
            <NewExerciseForm initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onCreated={() => setEditing(null)} />
            {editing !== 'new' && (
              <button className="btn ghost block mt-8" onClick={async () => { await saveExercise({ ...editing, hidden: !editing.hidden }); setEditing(null); }}>
                {editing.hidden ? 'Показывать в списках' : used.has(editing.id) ? 'Скрыть (история сохранится)' : 'Скрыть из списков'}
              </button>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}
