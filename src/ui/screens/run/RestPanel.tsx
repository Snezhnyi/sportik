import { useEffect, useRef } from 'react';
import type { RestTimer } from '../../../domain/types';
import { restRemainingMs } from '../../../domain/workout';
import { formatClock } from '../../../lib/dates';
import { Icon } from '../../components/Icon';
import { haptic } from '../../../telegram/tg';
import { beep } from './sound';

/**
 * Rest countdown. Remaining time is derived from stored timestamps, so it is correct
 * after Telegram was minimized or the page reloaded — the interval only repaints.
 */
export function RestPanel({ rest, now, sound, nextLabel, onAdjust, onTogglePause, onSkip }: {
  rest: RestTimer;
  now: number;
  sound: boolean;
  nextLabel: string;
  onAdjust: (deltaSec: number) => void;
  onTogglePause: () => void;
  onSkip: () => void;
}) {
  const remaining = restRemainingMs(rest, now);
  const over = remaining <= 0;
  const notified = useRef<string | null>(null);

  useEffect(() => {
    const key = `${rest.setId}:${rest.startedAt}`;
    if (over && notified.current !== key) {
      notified.current = key;
      // Don't re-notify for a rest that ended long ago while the app was in background.
      if (-remaining < 15_000) {
        haptic.success();
        if (sound) beep();
      }
    }
  }, [over, remaining, rest.setId, rest.startedAt, sound]);

  const pct = rest.durationMs > 0 ? Math.min(100, Math.max(0, (1 - remaining / rest.durationMs) * 100)) : 100;

  return (
    <div className={`rest-panel ${over ? 'over' : ''}`}>
      <div className="row between">
        <div>
          <div className="small faint">{over ? 'Отдых окончен' : rest.pausedAt ? 'Отдых на паузе' : 'Отдых'}</div>
          <div className="rest-time" style={{ color: over ? 'var(--accent)' : undefined }}>
            {over ? `+${formatClock(-remaining / 1000)}` : formatClock(remaining / 1000)}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={() => { haptic.tap(); onAdjust(-15); }} aria-label="Минус 15 секунд"><span className="small bold">−15</span></button>
          <button className="icon-btn" onClick={() => { haptic.tap(); onAdjust(15); }} aria-label="Плюс 15 секунд"><span className="small bold">+15</span></button>
          <button className="icon-btn" onClick={() => { haptic.tap(); onTogglePause(); }} aria-label={rest.pausedAt ? 'Продолжить' : 'Пауза'}>
            <Icon name={rest.pausedAt ? 'play' : 'pause'} />
          </button>
        </div>
      </div>
      <div className="rest-bar"><div style={{ width: `${pct}%` }} /></div>
      <button className={`btn block ${over ? 'primary' : ''}`} onClick={() => { haptic.tap(); onSkip(); }}>
        {over ? nextLabel : <><Icon name="skip" size={16} /> Пропустить отдых</>}
      </button>
    </div>
  );
}
