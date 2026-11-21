import { useMemo, useState } from 'react';
import { Sheet } from './common';
import { Icon } from './Icon';
import { saveExercise, useLibrary } from '../../data/repo';
import { EQUIPMENT, MUSCLE_GROUPS, muscleLabel, equipmentLabel, normalizeName } from '../../domain/exerciseLibrary';
import type { Equipment, Exercise, Mechanics, MuscleGroup } from '../../domain/types';
import { newId } from '../../lib/id';

/** Bottom sheet to pick an exercise: suggested alternatives first, then the whole library with search. */
export function ExercisePicker({ open, onClose, onPick, suggested = [], title = 'Выбор упражнения', exclude = [] }: {
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  suggested?: string[];
  title?: string;
  exclude?: string[];
}) {
  const { list, byId } = useLibrary();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const n = normalizeName(q);
    return list.filter((e) => !e.hidden && !exclude.includes(e.id)
      && (group === 'all' || e.primary === group)
      && (!n || normalizeName(e.name).includes(n) || e.aliases?.some((a) => normalizeName(a).includes(n))));
  }, [list, q, group, exclude]);
  const alts = suggested.map((id) => byId.get(id)).filter((e): e is Exercise => !!e);

  const pick = (e: Exercise) => {
    onPick(e);
    setQ('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {creating ? (
        <NewExerciseForm initialName={q} onCancel={() => setCreating(false)} onCreated={(e) => { setCreating(false); pick(e); }} />
      ) : (
        <>
          {alts.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 0 }}>Альтернативы</div>
              <div className="list">
                {alts.map((e) => <Row key={e.id} e={e} onClick={() => pick(e)} accent />)}
              </div>
              <div className="section-title">Вся база</div>
            </>
          )}
          <div className="row" style={{ position: 'relative' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск упражнения" style={{ paddingLeft: 38 }} />
            <span className="faint" style={{ position: 'absolute', left: 12, top: 12 }}><Icon name="search" size={18} /></span>
          </div>
          <div className="row mt-8" style={{ overflowX: 'auto', gap: 6, paddingBottom: 4 }}>
            <button className={`chip ${group === 'all' ? 'accent' : ''}`} onClick={() => setGroup('all')}>Все</button>
            {MUSCLE_GROUPS.map((g) => (
              <button key={g.id} className={`chip ${group === g.id ? 'accent' : ''}`} onClick={() => setGroup(g.id)}>{g.label}</button>
            ))}
          </div>
          <div className="list mt-8">
            {filtered.slice(0, 80).map((e) => <Row key={e.id} e={e} onClick={() => pick(e)} />)}
            {!filtered.length && <div className="empty small">Ничего не найдено</div>}
          </div>
          <button className="btn block mt-12" onClick={() => setCreating(true)}><Icon name="plus" /> Своё упражнение{q ? ` «${q}»` : ''}</button>
        </>
      )}
    </Sheet>
  );
}

function Row({ e, onClick, accent }: { e: Exercise; onClick: () => void; accent?: boolean }) {
  return (
    <button className="list-item" onClick={onClick}>
      <div className="grow">
        <div className={accent ? 'bold' : ''}>{e.name}</div>
        <div className="tiny faint">{muscleLabel(e.primary)} · {equipmentLabel(e.equipment)}{e.custom ? ' · своё' : ''}</div>
      </div>
      <Icon name="plus" className="faint" size={18} />
    </button>
  );
}

export function NewExerciseForm({ initialName = '', initial, onCancel, onCreated }: {
  initialName?: string;
  initial?: Exercise;
  onCancel: () => void;
  onCreated: (e: Exercise) => void;
}) {
  const [name, setName] = useState(initial?.name ?? initialName);
  const [primary, setPrimary] = useState<MuscleGroup>(initial?.primary ?? 'other');
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'other');
  const [mechanics, setMechanics] = useState<Mechanics>(initial?.mechanics ?? 'isolation');
  const [secondary, setSecondary] = useState((initial?.secondary ?? []).join(', '));
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? '');

  const save = async () => {
    const e: Exercise = {
      ...initial,
      id: initial?.id ?? newId('ex'),
      name: name.trim(),
      primary, equipment, mechanics,
      secondary: secondary.split(',').map((s) => s.trim()).filter(Boolean),
      mediaUrl: mediaUrl.trim() || undefined,
      custom: initial ? initial.custom : true,
    };
    await saveExercise(e);
    onCreated(e);
  };

  return (
    <div className="stack">
      <label className="field"><span>Название</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="grid-2">
        <label className="field"><span>Группа мышц</span>
          <select value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Оборудование</span>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Тип</span>
        <select value={mechanics} onChange={(e) => setMechanics(e.target.value as Mechanics)}>
          <option value="compound">Базовое (многосуставное)</option>
          <option value="isolation">Изолирующее</option>
        </select>
      </label>
      <label className="field"><span>Дополнительные мышцы (через запятую)</span><input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="трицепс, передняя дельта" /></label>
      <label className="field"><span>Ссылка на фото/видео (необязательно)</span><input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" /></label>
      <div className="grid-2">
        <button className="btn" onClick={onCancel}>Отмена</button>
        <button className="btn primary" disabled={!name.trim()} onClick={save}>Сохранить</button>
      </div>
    </div>
  );
}
