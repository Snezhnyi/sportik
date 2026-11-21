import { useState } from 'react';
import { useDoc } from '../../../data/store';
import { activateProgram, archiveProgram, deleteProgram, duplicateProgram, saveProgram, useLibrary } from '../../../data/repo';
import { Empty, Header, Segmented, Sheet, Stepper, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav';
import type { Program, ProgramBlock, ScheduleSlot } from '../../../domain/types';
import { programSequence, sequenceLabel } from '../../../domain/schedule';
import { newId } from '../../../lib/id';
import { WEEKDAYS_SHORT, formatDate, toLocalDate } from '../../../lib/dates';
import { plural } from '../../../lib/format';
import { haptic } from '../../../telegram/tg';

export function ProgramScreen({ id }: { id: string }) {
  const p = useDoc('program', id);
  const nav = useNav();
  const ui = useUi();
  const [menu, setMenu] = useState(false);
  const [posSheet, setPosSheet] = useState(false);
  if (!p) return <div className="screen"><Header title="Программа" back /><Empty title="Программа не найдена" /></div>;

  const update = (patch: Partial<Program>) => saveProgram({ ...p, ...patch });
  const updateBlocks = (blocks: ProgramBlock[]) => update({ blocks });
  const seq = programSequence(p);
  const current = seq.length ? seq[p.progressIndex % seq.length] : null;

  const addBlock = () => {
    const last = p.blocks[p.blocks.length - 1];
    // A new block copies the previous one's days — periodized programs mostly change sets/intensity.
    const block: ProgramBlock = last
      ? { id: newId('blk'), name: `Блок ${p.blocks.length + 1}`, days: last.days.map((d) => ({ ...structuredClone(d), id: newId('day'), exercises: d.exercises.map((e) => ({ ...e, id: newId('pex') })) })) }
      : { id: newId('blk'), name: 'Блок 1', days: [] };
    updateBlocks([...p.blocks, block]);
  };

  return (
    <div className="screen">
      <Header title={p.name} back right={<button className="icon-btn" onClick={() => setMenu(true)} aria-label="Действия"><Icon name="more" /></button>} />

      {p.status !== 'active' ? (
        <button className="btn primary block" onClick={async () => { await activateProgram(p.id); haptic.success(); ui.toast('Программа активна'); }}>
          Сделать активной
        </button>
      ) : (
        <div className="card tight row">
          <span className="chip accent">активная</span>
          <span className="small muted grow ellipsis">Следующая: {current ? `${current.day.name}${sequenceLabel(p, current) ? ` · ${sequenceLabel(p, current)}` : ''}` : '—'}</span>
          <button className="link small" onClick={() => setPosSheet(true)}>Изменить</button>
        </div>
      )}

      <div className="section-title">Описание</div>
      <div className="card stack">
        <input defaultValue={p.name} key={`n${p.updatedAt}`} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && update({ name: e.target.value.trim() })} placeholder="Название" />
        <textarea defaultValue={p.description} key={`d${p.updatedAt}`} onBlur={(e) => e.target.value !== p.description && update({ description: e.target.value })} placeholder="Описание программы" />
        <div className="tiny faint">Создана {formatDate(toLocalDate(p.createdAt), true)} · изменена {formatDate(toLocalDate(p.updatedAt), true)}</div>
      </div>

      <div className="section-title">Расписание</div>
      <ScheduleEditor p={p} onChange={(schedule) => update({ schedule })} />

      <div className="section-title">
        <span>{p.blocks.length > 1 ? 'Блоки и дни' : 'Тренировочные дни'}</span>
        <button className="link small" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={addBlock}>+ блок</button>
      </div>
      <div className="stack">
        {p.blocks.map((b, bi) => (
          <BlockCard
            key={b.id}
            p={p}
            block={b}
            showHeader={p.blocks.length > 1}
            onChange={(nb) => updateBlocks(p.blocks.map((x) => (x.id === b.id ? nb : x)))}
            onRemove={async () => {
              if (await ui.confirm({ title: `Удалить «${b.name}»?`, text: 'История тренировок не пострадает.', ok: 'Удалить', danger: true })) {
                updateBlocks(p.blocks.filter((x) => x.id !== b.id));
              }
            }}
            onMove={(dir) => {
              const arr = [...p.blocks];
              const j = bi + dir;
              if (j < 0 || j >= arr.length) return;
              [arr[bi], arr[j]] = [arr[j], arr[bi]];
              updateBlocks(arr);
            }}
          />
        ))}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={p.name}>
        <div className="list">
          <button className="list-item" onClick={() => { setMenu(false); nav.push({ name: 'import', programId: p.id }); }}><Icon name="upload" /> Добавить из Excel/CSV</button>
          <button className="list-item" onClick={async () => { setMenu(false); const c = await duplicateProgram(p.id); if (c) { ui.toast('Копия создана'); nav.replace({ name: 'program', id: c.id }); } }}><Icon name="copy" /> Дублировать</button>
          <button className="list-item" onClick={async () => { setMenu(false); await archiveProgram(p.id, p.status !== 'archived'); ui.toast(p.status === 'archived' ? 'Возвращена из архива' : 'Перемещена в архив'); }}>
            <Icon name="archive" /> {p.status === 'archived' ? 'Вернуть из архива' : 'В архив'}
          </button>
          <button className="list-item" style={{ color: 'var(--red)' }} onClick={async () => {
            setMenu(false);
            if (await ui.confirm({ title: `Удалить «${p.name}»?`, text: 'Программа будет удалена. Проведённые тренировки останутся в истории и статистике.', ok: 'Удалить', danger: true })) {
              await deleteProgram(p.id);
              nav.pop();
            }
          }}><Icon name="trash" /> Удалить</button>
        </div>
      </Sheet>

      <Sheet open={posSheet} onClose={() => setPosSheet(false)} title="Следующая тренировка">
        <p className="small muted" style={{ marginTop: -6 }}>Выберите, с какой тренировки продолжить программу.</p>
        <div className="list">
          {seq.map((s) => (
            <button key={s.index} className="list-item" onClick={() => { update({ progressIndex: s.index }); setPosSheet(false); }}>
              <span className="faint num" style={{ width: 24 }}>{s.index + 1}</span>
              <span className="grow">{s.day.name}<span className="faint small">{sequenceLabel(p, s) ? ` · ${sequenceLabel(p, s)}` : ''}</span></span>
              {s.index === p.progressIndex % seq.length && <Icon name="check" className="faint" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function ScheduleEditor({ p, onChange }: { p: Program; onChange: (s: Program['schedule']) => void }) {
  const s = p.schedule;
  const toggleSlot = (i: number) => {
    const cycle = [...s.cycle];
    cycle[i] = cycle[i] === 'train' ? 'rest' : 'train';
    onChange({ ...s, cycle });
  };
  const presets: { label: string; cycle: ScheduleSlot[] }[] = [
    { label: '2×2', cycle: ['train', 'train', 'rest', 'rest'] },
    { label: '1×1', cycle: ['train', 'rest'] },
    { label: '2×1', cycle: ['train', 'train', 'rest'] },
    { label: '3×1', cycle: ['train', 'train', 'train', 'rest'] },
  ];
  return (
    <div className="card stack">
      <Segmented value={s.kind} options={[{ value: 'cycle', label: 'Цикл дней' }, { value: 'weekly', label: 'Дни недели' }]} onChange={(kind) => onChange({ ...s, kind })} />
      {s.kind === 'cycle' ? (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {presets.map((pr) => (
              <button key={pr.label} className={`chip ${pr.cycle.join() === s.cycle.join() ? 'accent' : ''}`} onClick={() => onChange({ ...s, cycle: pr.cycle })}>{pr.label}</button>
            ))}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {s.cycle.map((c, i) => (
              <button key={i} onClick={() => toggleSlot(i)} className="center small bold"
                style={{ width: 44, height: 44, borderRadius: 12, background: c === 'train' ? 'var(--blue-soft)' : 'var(--gray-soft)', color: c === 'train' ? 'var(--blue)' : 'var(--text-3)' }}>
                {c === 'train' ? 'Т' : 'О'}
                <div className="tiny" style={{ fontWeight: 500 }}>{i + 1}</div>
              </button>
            ))}
            <button className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => onChange({ ...s, cycle: [...s.cycle, 'rest'] })} aria-label="Добавить день"><Icon name="plus" /></button>
            {s.cycle.length > 1 && <button className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => onChange({ ...s, cycle: s.cycle.slice(0, -1) })} aria-label="Убрать день"><Icon name="minus" /></button>}
          </div>
          <div className="tiny faint">Т — тренировка, О — отдых. Нажмите на день, чтобы переключить. Цикл повторяется с даты начала.</div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {WEEKDAYS_SHORT.map((d, i) => {
            const on = s.weekdays.includes(i);
            return (
              <button key={d} className="small bold" style={{ height: 40, borderRadius: 11, background: on ? 'var(--blue-soft)' : 'var(--card-2)', color: on ? 'var(--blue)' : 'var(--text-3)' }}
                onClick={() => onChange({ ...s, weekdays: on ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort() })}>
                {d}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid-2">
        <label className="field"><span>Дата начала</span>
          <input type="date" value={s.startDate} onChange={(e) => e.target.value && onChange({ ...s, startDate: e.target.value })} />
        </label>
        {p.blocks.length > 1 && (
          <div className="field"><span>Повторов блока</span>
            <Stepper value={s.blockRepeats} min={1} max={12} onChange={(v) => onChange({ ...s, blockRepeats: Math.max(1, v) })} />
          </div>
        )}
      </div>
    </div>
  );
}

function BlockCard({ p, block, showHeader, onChange, onRemove, onMove }: {
  p: Program; block: ProgramBlock; showHeader: boolean;
  onChange: (b: ProgramBlock) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const nav = useNav();
  const library = useLibrary();
  const [open, setOpen] = useState(!showHeader || p.blocks.length <= 2);
  const addDay = () => {
    const day = { id: newId('day'), name: `День ${String.fromCharCode(65 + block.days.length)}`, focus: '', exercises: [] };
    onChange({ ...block, days: [...block.days, day] });
    nav.push({ name: 'day', programId: p.id, blockId: block.id, dayId: day.id });
  };

  return (
    <div className="card" style={{ padding: showHeader ? 14 : 8 }}>
      {showHeader && (
        <div className="row">
          <button className="grow row" style={{ textAlign: 'left' }} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'down' : 'chevron'} size={16} className="faint" />
            <input defaultValue={block.name} key={block.name} onClick={(e) => e.stopPropagation()}
              onBlur={(e) => e.target.value.trim() && e.target.value !== block.name && onChange({ ...block, name: e.target.value.trim() })}
              style={{ background: 'transparent', padding: '4px 0', fontWeight: 650 }} />
          </button>
          <span className="tiny faint">{block.days.length} {plural(block.days.length, 'день', 'дня', 'дней')}</span>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => onMove(-1)} aria-label="Выше"><Icon name="up" size={16} /></button>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => onMove(1)} aria-label="Ниже"><Icon name="down" size={16} /></button>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onRemove} aria-label="Удалить блок"><Icon name="trash" size={16} /></button>
        </div>
      )}
      {open && (
        <div className="stack" style={{ marginTop: showHeader ? 10 : 0, gap: 6 }}>
          {block.days.map((d) => (
            <button key={d.id} className="list-item" style={{ background: 'var(--card-2)', borderRadius: 12 }}
              onClick={() => nav.push({ name: 'day', programId: p.id, blockId: block.id, dayId: d.id })}>
              <div className="grow">
                <div className="bold">{d.name}</div>
                <div className="tiny faint ellipsis">
                  {d.exercises.length ? d.exercises.map((e) => library.byId.get(e.exerciseId)?.name ?? '?').join(' · ') : 'Нет упражнений'}
                </div>
              </div>
              <Icon name="chevron" className="faint" />
            </button>
          ))}
          <button className="btn sm ghost" onClick={addDay}><Icon name="plus" size={16} /> Добавить день</button>
        </div>
      )}
    </div>
  );
}
