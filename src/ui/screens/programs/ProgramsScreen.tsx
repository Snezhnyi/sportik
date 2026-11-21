import { useState } from 'react';
import { activateProgram, saveProgram, usePrograms } from '../../../data/repo';
import { Empty, Header, Sheet, SyncIndicator } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import type { Program } from '../../../domain/types';
import { newId } from '../../../lib/id';
import { formatDate, toLocalDate } from '../../../lib/dates';
import { programSequence } from '../../../domain/schedule';

export function newProgram(name: string): Program {
  const now = Date.now();
  return {
    id: newId('prg'), name, description: '', createdAt: now, updatedAt: now, status: 'saved', activatedAt: null,
    schedule: { kind: 'cycle', cycle: ['train', 'train', 'rest', 'rest'], weekdays: [0, 2, 4], startDate: toLocalDate(), blockRepeats: 1 },
    blocks: [{ id: newId('blk'), name: 'Блок 1', days: [
      { id: newId('day'), name: 'День A', focus: '', exercises: [] },
      { id: newId('day'), name: 'День B', focus: '', exercises: [] },
    ] }],
    progressIndex: 0,
  };
}

export function ProgramsScreen() {
  const programs = usePrograms();
  const nav = useNav();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const active = programs.find((p) => p.status === 'active');
  const saved = programs.filter((p) => p.status === 'saved').sort((a, b) => (b.activatedAt ?? 0) - (a.activatedAt ?? 0) || b.updatedAt - a.updatedAt);
  const archived = programs.filter((p) => p.status === 'archived');

  const create = async () => {
    const p = newProgram(name.trim() || 'Новая программа');
    await saveProgram(p);
    if (!active) await activateProgram(p.id);
    setCreating(false);
    setName('');
    nav.push({ name: 'program', id: p.id });
  };

  return (
    <div className="screen">
      <Header title="Программы" right={<SyncIndicator />} />
      <div className="grid-2">
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Создать</button>
        <button className="btn" onClick={() => nav.push({ name: 'import' })}><Icon name="upload" /> Импорт Excel</button>
      </div>

      {active && (
        <>
          <div className="section-title">Активная</div>
          <ProgramCard p={active} />
        </>
      )}
      {saved.length > 0 && (
        <>
          <div className="section-title">Сохранённые</div>
          <div className="stack">{saved.map((p) => <ProgramCard key={p.id} p={p} />)}</div>
        </>
      )}
      {!programs.length && <Empty icon="🗂️" title="Программ пока нет">Создайте программу вручную или загрузите таблицу Excel/CSV.</Empty>}

      {archived.length > 0 && (
        <>
          <button className="section-title" style={{ width: 'calc(100% - 8px)' }} onClick={() => setShowArchive(!showArchive)}>
            <span>Архив ({archived.length})</span><Icon name={showArchive ? 'up' : 'down'} size={14} />
          </button>
          {showArchive && <div className="stack">{archived.map((p) => <ProgramCard key={p.id} p={p} />)}</div>}
        </>
      )}

      <div className="list mt-16">
        <button className="list-item" onClick={() => nav.push({ name: 'library' })}>
          <Icon name="list" /><span className="grow">Библиотека упражнений</span><Icon name="chevron" className="faint" />
        </button>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Новая программа">
        <label className="field"><span>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Программа A" autoFocus onKeyDown={(e) => e.key === 'Enter' && create()} />
        </label>
        <button className="btn primary block mt-12" onClick={create}>Создать</button>
      </Sheet>
    </div>
  );
}

function ProgramCard({ p }: { p: Program }) {
  const nav = useNav();
  const seq = programSequence(p);
  const days = p.blocks[0]?.days.length ?? 0;
  const pos = seq.length ? (p.progressIndex % seq.length) + 1 : 0;
  return (
    <button className="card clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ name: 'program', id: p.id })}>
      <div className="row between">
        <span className="card-title ellipsis grow">{p.name}</span>
        {p.status === 'active' && <span className="chip accent">активная</span>}
        {p.status === 'archived' && <span className="chip">архив</span>}
      </div>
      {p.description && <div className="small muted mt-8 ellipsis">{p.description}</div>}
      <div className="row tiny faint mt-8" style={{ flexWrap: 'wrap', gap: 10 }}>
        {p.blocks.length > 1 && <span>{p.blocks.length} блоков</span>}
        <span>{days} дн. в блоке</span>
        <span>{p.schedule.kind === 'cycle' ? `цикл ${p.schedule.cycle.map((c) => (c === 'train' ? 'Т' : 'О')).join('')}` : 'по дням недели'}</span>
        {seq.length > 0 && <span>тренировка {pos}/{seq.length}</span>}
        <span>изм. {formatDate(toLocalDate(p.updatedAt))}</span>
      </div>
    </button>
  );
}
