import { useRef, useState } from 'react';
import { activateProgram, libraryNow, saveExercise, saveProgram, useLibrary, usePrograms } from '../../../data/repo';
import { Header, NumberInput, Segmented, Sheet, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { ExercisePicker } from '../../components/ExercisePicker';
import { useNav } from '../../nav';
import { INTENSITY_RIR, parseSheets, type ParseResult } from '../../../import/parseTable';
import { appendToProgram, draftToProgram, toDraft, type DraftExercise, type ImportDraft } from '../../../import/buildProgram';
import { MUSCLE_GROUPS } from '../../../domain/exerciseLibrary';
import type { Intensity, MuscleGroup } from '../../../domain/types';
import { repsRange, plural } from '../../../lib/format';
import { INTENSITY_LABELS } from '../run/rir';
import { haptic } from '../../../telegram/tg';

const COLUMN_LABELS: Record<string, string> = {
  name: 'упражнение', setsReps: 'подходы×повторы', sets: 'подходы', reps: 'повторения', weight: 'вес',
  intensity: 'интенсивность', rir: 'RIR', rpe: 'RPE', rest: 'отдых', notes: 'заметки',
};

export function ImportScreen({ programId }: { programId?: string }) {
  const nav = useNav();
  const ui = useUi();
  const library = useLibrary();
  const programs = usePrograms().filter((p) => p.status !== 'archived');
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'append'>(programId ? 'append' : 'new');
  const [target, setTarget] = useState(programId ?? '');
  const [openBlock, setOpenBlock] = useState(0);
  const [editing, setEditing] = useState<{ b: number; d: number; e: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      // SheetJS is large — loaded only when a file is actually imported.
      const { readSpreadsheet } = await import('../../../import/readFile');
      const sheets = await readSpreadsheet(file);
      const r = parseSheets(sheets);
      setFileName(file.name);
      setResult(r);
      if (!r.exerciseCount) {
        setDraft(null);
        setError('В файле не найдено ни одного упражнения. Проверьте, что в таблице есть колонка с названиями упражнений и колонка с подходами/повторениями (например «4х8-12»).');
      } else {
        setDraft(toDraft(r, library.list, file.name));
        setOpenBlock(0);
      }
    } catch (e) {
      setError(`Не удалось прочитать файл: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const updateEx = (b: number, d: number, e: number, patch: Partial<DraftExercise>) => setDraft((dr) => dr && ({
    ...dr,
    blocks: dr.blocks.map((bl, bi) => bi !== b ? bl : {
      ...bl,
      days: bl.days.map((dy, di) => di !== d ? dy : { ...dy, exercises: dy.exercises.map((ex, ei) => (ei === e ? { ...ex, ...patch } : ex)) }),
    }),
  }));
  const removeEx = (b: number, d: number, e: number) => setDraft((dr) => dr && ({
    ...dr,
    blocks: dr.blocks.map((bl, bi) => bi !== b ? bl : {
      ...bl,
      days: bl.days.map((dy, di) => di !== d ? dy : { ...dy, exercises: dy.exercises.filter((_, ei) => ei !== e) }),
    }),
  }));

  const submit = async () => {
    if (!draft) return;
    const lib = libraryNow();
    if (mode === 'new') {
      const { program, newExercises } = draftToProgram(draft, lib);
      for (const e of newExercises) await saveExercise(e);
      await saveProgram(program);
      const hasActive = programs.some((p) => p.status === 'active');
      if (!hasActive) await activateProgram(program.id);
      haptic.success();
      ui.toast(`Программа «${program.name}» создана`);
      nav.replace({ name: 'program', id: program.id });
      return;
    }
    const existing = programs.find((p) => p.id === target);
    if (!existing) return setError('Выберите программу, в которую добавить данные.');
    const res = appendToProgram(existing, draft, lib);
    if (!res.ok) return setError(res.reason);
    for (const e of res.newExercises) await saveExercise(e);
    await saveProgram(res.program);
    haptic.success();
    ui.toast(res.summary);
    nav.replace({ name: 'program', id: existing.id });
  };

  const unmatched = draft ? new Set(draft.blocks.flatMap((b) => b.days.flatMap((d) => d.exercises.filter((e) => !e.exerciseId).map((e) => e.name.toLowerCase())))).size : 0;
  const cur = editing && draft ? draft.blocks[editing.b].days[editing.d].exercises[editing.e] : null;

  return (
    <div className="screen">
      <Header title="Импорт программы" back />
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />

      {!draft && (
        <div className="hero center">
          <div style={{ fontSize: 36 }}>📄</div>
          <h2>Загрузите таблицу</h2>
          <p className="small muted">Excel (.xlsx, .xls) или CSV. Блоки, дни, упражнения, подходы×повторения, вес и интенсивность распознаются автоматически — перед сохранением всё можно проверить и исправить.</p>
          <button className="btn primary lg block" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> {busy ? 'Читаю файл…' : 'Выбрать файл'}
          </button>
        </div>
      )}

      {error && <div className="err-box mt-12">{error}</div>}

      {result && draft && (
        <>
          <div className="card">
            <div className="row between">
              <div className="grow">
                <div className="bold ellipsis">{fileName}</div>
                <div className="small muted">
                  {draft.blocks.length > 1 ? `${draft.blocks.length} ${plural(draft.blocks.length, 'блок', 'блока', 'блоков')} · ` : ''}
                  {draft.blocks[0]?.days.length} {plural(draft.blocks[0]?.days.length ?? 0, 'день', 'дня', 'дней')} в блоке · {result.exerciseCount} упр.
                </div>
              </div>
              <button className="btn sm" onClick={() => fileRef.current?.click()}>Другой файл</button>
            </div>
            <div className="row tiny faint mt-8" style={{ flexWrap: 'wrap', gap: 6 }}>
              Колонки: {Object.values(result.columns).flatMap((c) => Object.keys(c)).filter((v, i, a) => a.indexOf(v) === i).map((k) => <span key={k} className="chip">{COLUMN_LABELS[k] ?? k}</span>)}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="warn-box mt-12">
              <div className="bold">Проверьте ({result.warnings.length}):</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.warnings.slice(0, 12).map((w, i) => <li key={i}>{w.row ? `Строка ${w.row}: ` : ''}{w.message}</li>)}
              </ul>
            </div>
          )}
          {unmatched > 0 && (
            <div className="card tight mt-12 small">
              <span className="chip blue">новое</span> {unmatched} {plural(unmatched, 'упражнение не найдено', 'упражнения не найдены', 'упражнений не найдено')} в библиотеке — они будут созданы. Нажмите на упражнение, чтобы выбрать существующее или указать группу мышц.
            </div>
          )}

          <div className="section-title">Программа</div>
          <div className="card stack">
            <Segmented value={mode} options={[{ value: 'new', label: 'Новая программа' }, { value: 'append', label: 'Добавить в существующую' }]} onChange={(m) => { setMode(m); setError(null); }} />
            {mode === 'new' ? (
              <>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Название" />
                <div className="small muted">
                  Расписание: {draft.schedule.kind === 'cycle' ? `цикл ${draft.schedule.cycle.map((c) => (c === 'train' ? 'Т' : 'О')).join('')}` : 'дни недели'} — можно изменить после импорта.
                </div>
              </>
            ) : (
              <select value={target} onChange={(e) => { setTarget(e.target.value); setError(null); }}>
                <option value="">Выберите программу</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="section-title">Предпросмотр</div>
          <div className="stack">
            {draft.blocks.map((b, bi) => (
              <div key={b.key} className="card" style={{ padding: 12 }}>
                <button className="row" style={{ width: '100%' }} onClick={() => setOpenBlock(openBlock === bi ? -1 : bi)}>
                  <Icon name={openBlock === bi ? 'down' : 'chevron'} size={16} className="faint" />
                  <span className="bold grow" style={{ textAlign: 'left' }}>{b.name}</span>
                  <span className="tiny faint">{b.days.map((d) => d.exercises.length).join(' + ')} упр.</span>
                </button>
                {openBlock === bi && b.days.map((d, di) => (
                  <div key={d.key} className="mt-12">
                    <div className="small bold muted" style={{ margin: '0 4px 6px' }}>{d.name}</div>
                    <div className="list" style={{ background: 'var(--card-2)' }}>
                      {d.exercises.map((e, ei) => (
                        <button key={e.key} className="list-item" style={{ padding: '10px 12px', minHeight: 0 }} onClick={() => setEditing({ b: bi, d: di, e: ei })}>
                          <div className="grow">
                            <div className="small bold">{e.exerciseId ? library.byId.get(e.exerciseId)?.name : e.name}</div>
                            <div className="tiny faint num">
                              {e.sets ?? '?'} × {e.repsMin !== null ? repsRange(e.repsMin, e.repsMax ?? e.repsMin) : '?'}
                              {e.weight !== null ? ` · ${e.weight} кг` : ''}
                              {e.intensity ? ` · ${INTENSITY_LABELS[e.intensity].toLowerCase()} (RIR ${e.rirMin}–${e.rirMax})` : ''}
                            </div>
                          </div>
                          {!e.exerciseId && <span className="chip blue">новое</span>}
                          {e.issues.length > 0 && <span className="chip amber">!</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button className="btn primary lg block mt-16" onClick={submit}>
            {mode === 'new' ? 'Импортировать как новую программу' : 'Добавить в программу'}
          </button>
        </>
      )}

      <Sheet open={!!cur} onClose={() => setEditing(null)} title="Упражнение">
        {cur && editing && (
          <ImportedExerciseForm
            e={cur}
            matchedName={cur.exerciseId ? library.byId.get(cur.exerciseId)?.name ?? null : null}
            onChange={(patch) => updateEx(editing.b, editing.d, editing.e, patch)}
            onRemove={() => { removeEx(editing.b, editing.d, editing.e); setEditing(null); }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ImportedExerciseForm({ e, matchedName, onChange, onRemove }: {
  e: DraftExercise; matchedName: string | null;
  onChange: (p: Partial<DraftExercise>) => void; onRemove: () => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="small muted" style={{ marginTop: -8 }}>Строка {e.row}: «{e.name}»</div>
      {e.issues.length > 0 && <div className="warn-box">{e.issues.join('; ')}</div>}
      <div className="card tight" style={{ background: 'var(--card-2)' }}>
        {matchedName ? (
          <div className="row"><span className="grow small">В библиотеке: <b>{matchedName}</b></span><button className="link small" onClick={() => onChange({ exerciseId: null })}>Создать новое</button></div>
        ) : (
          <div className="stack">
            <div className="small">Будет создано новое упражнение «{e.name}»</div>
            <select value={e.newPrimary} onChange={(ev) => onChange({ newPrimary: ev.target.value as MuscleGroup })}>
              {MUSCLE_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
        )}
        <button className="btn sm block mt-8" onClick={() => setPicking(true)}>Выбрать из библиотеки</button>
      </div>
      <label className="field"><span>Название (для нового)</span><input value={e.name} onChange={(ev) => onChange({ name: ev.target.value })} /></label>
      <div className="grid-3">
        <label className="field"><span>Подходы</span><NumberInput value={e.sets} onChange={(v) => onChange({ sets: v })} max={20} className="num center" /></label>
        <label className="field"><span>Повт. от</span><NumberInput value={e.repsMin} onChange={(v) => onChange({ repsMin: v })} max={100} className="num center" /></label>
        <label className="field"><span>до</span><NumberInput value={e.repsMax} onChange={(v) => onChange({ repsMax: v })} max={100} className="num center" /></label>
      </div>
      <div className="grid-2">
        <label className="field"><span>Вес, кг</span><NumberInput value={e.weight} onChange={(v) => onChange({ weight: v })} decimal placeholder="—" className="num" /></label>
        <label className="field"><span>Интенсивность</span>
          <select value={e.intensity ?? ''} onChange={(ev) => {
            const i = (ev.target.value || null) as Intensity | null;
            onChange(i ? { intensity: i, rirMin: INTENSITY_RIR[i][0], rirMax: INTENSITY_RIR[i][1] } : { intensity: null, rirMin: null, rirMax: null });
          }}>
            <option value="">—</option>
            {(['light', 'medium', 'heavy'] as const).map((i) => <option key={i} value={i}>{INTENSITY_LABELS[i]}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Заметки</span><input value={e.notes} onChange={(ev) => onChange({ notes: ev.target.value })} /></label>
      <button className="btn danger block" onClick={onRemove}>Не импортировать эту строку</button>
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={(x) => onChange({ exerciseId: x.id })} />
    </div>
  );
}
