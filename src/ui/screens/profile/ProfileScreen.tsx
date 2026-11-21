import { useEffect, useState } from 'react';
import { saveProfile, saveSettings, useProfile, useSettings, useWeights, useWorkouts, useLibrary } from '../../../data/repo';
import { Header, NumberInput, SyncIndicator, useUi } from '../../components/common';
import { Icon } from '../../components/Icon';
import { ProfileForm } from './ProfileForm';
import { useNav } from '../../nav';
import { formatDate } from '../../../lib/dates';
import { formatKg } from '../../../lib/format';
import { EQUIPMENT } from '../../../domain/exerciseLibrary';
import { syncNow, useSyncStatus } from '../../../data/sync';
import type { Profile } from '../../../domain/types';

export function ProfileScreen() {
  const stored = useProfile();
  const [draft, setDraft] = useState<Profile>(stored);
  const weights = useWeights();
  const nav = useNav();
  const ui = useUi();
  const settings = useSettings();
  const workouts = useWorkouts();
  const library = useLibrary();
  const sync = useSyncStatus();

  useEffect(() => setDraft(stored), [stored]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const current = weights[0];

  return (
    <div className="screen">
      <Header title="Профиль" right={<SyncIndicator />} />

      <button className="card clickable row" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push({ name: 'weights' })}>
        <div className="icon-btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="scale" /></div>
        <div className="grow">
          <div className="bold">Собственный вес</div>
          <div className="small muted">
            {current ? `${formatKg(current.weightKg)} кг · ${formatDate(current.date)}` : 'Нет записей'}
            {stored.targetWeightKg ? ` · цель ${formatKg(stored.targetWeightKg)} кг` : ''}
          </div>
        </div>
        <Icon name="chevron" className="faint" />
      </button>

      <div className="section-title">Характеристики</div>
      <div className="card">
        <ProfileForm value={draft} onChange={setDraft} />
        {dirty && (
          <button className="btn primary block mt-16" onClick={async () => { await saveProfile(draft); ui.toast('Профиль сохранён'); }}>
            Сохранить
          </button>
        )}
      </div>

      <div className="section-title">Шаг изменения веса</div>
      <div className="card stack">
        <div className="small muted">Минимальная прибавка, которую предлагает AdaptiveLoadEngine.</div>
        {EQUIPMENT.filter((e) => e.id !== 'band').map((e) => (
          <div key={e.id} className="row between">
            <span>{e.label}</span>
            <div style={{ width: 110, position: 'relative' }}>
              <NumberInput
                className="num center"
                decimal
                value={settings.increments[e.id]}
                onChange={(v) => v !== null && saveSettings({ ...settings, increments: { ...settings.increments, [e.id]: v } })}
              />
              <span className="faint small" style={{ position: 'absolute', right: 10, top: 12 }}>кг</span>
            </div>
          </div>
        ))}
        <label className="row between mt-8">
          <span>Звук по окончании отдыха</span>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={settings.sound} onChange={(e) => saveSettings({ ...settings, sound: e.target.checked })} />
        </label>
      </div>

      <div className="section-title">Данные</div>
      <div className="list">
        <button className="list-item" onClick={() => nav.push({ name: 'library' })}>
          <Icon name="list" /><span className="grow">Библиотека упражнений</span><Icon name="chevron" className="faint" />
        </button>
        <button className="list-item" onClick={() => nav.push({ name: 'recommendations' })}>
          <Icon name="flag" /><span className="grow">История рекомендаций</span><Icon name="chevron" className="faint" />
        </button>
        <button className="list-item" onClick={() => void import('../../../export/exportHistory').then((m) => m.exportHistory(workouts, library.byId, 'xlsx'))}>
          <Icon name="download" /><span className="grow">Экспорт истории в Excel</span>
        </button>
        <button className="list-item" onClick={() => void import('../../../export/exportHistory').then((m) => m.exportHistory(workouts, library.byId, 'csv'))}>
          <Icon name="download" /><span className="grow">Экспорт истории в CSV</span>
        </button>
        <button className="list-item" onClick={() => void syncNow()}>
          <Icon name="upload" />
          <span className="grow">Синхронизировать сейчас</span>
          <span className="small faint">{sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </button>
      </div>
      {sync.error && <div className="err-box mt-12">{sync.error}. Данные сохранены на устройстве и будут отправлены позже.</div>}
    </div>
  );
}
