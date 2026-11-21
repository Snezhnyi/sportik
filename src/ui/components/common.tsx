import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useSyncStatus } from '../../data/sync';
import { useNav } from '../nav';
import { haptic } from '../../telegram/tg';
import { plural } from '../../lib/format';

export function Header({ title, back, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNav();
  return (
    <div className="header">
      {back && (
        <button className="back" onClick={() => nav.pop()} aria-label="Назад">
          <Icon name="back" />
        </button>
      )}
      <h1 className="ellipsis">{title}</h1>
      {right}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="grabber" />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

// ---------- confirm + toast (app-wide) ----------

interface ConfirmOptions { title: string; text?: string; ok?: string; danger?: boolean }
interface UiApi {
  confirm(o: ConfirmOptions): Promise<boolean>;
  toast(text: string): void;
}
const UiCtx = createContext<UiApi>({ confirm: async () => false, toast: () => {} });
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const toast = useCallback((text: string) => {
    setToastText(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastText(null), 2400);
  }, []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <UiCtx.Provider value={{ confirm, toast }}>
      {children}
      <Sheet open={!!dialog} onClose={() => close(false)} title={dialog?.title}>
        {dialog?.text && <p className="muted" style={{ marginTop: -6 }}>{dialog.text}</p>}
        <div className="grid-2 mt-16">
          <button className="btn" onClick={() => close(false)}>Отмена</button>
          <button className={`btn ${dialog?.danger ? 'danger' : 'primary'}`} onClick={() => { haptic.impact(); close(true); }}>
            {dialog?.ok ?? 'ОК'}
          </button>
        </div>
      </Sheet>
      {toastText && <div className="toast">{toastText}</div>}
    </UiCtx.Provider>
  );
}

export function SyncIndicator() {
  const s = useSyncStatus();
  const label =
    s.state === 'syncing' ? 'Синхронизация…'
    : s.state === 'offline' ? `Офлайн${s.pending ? ` · ${s.pending} ${plural(s.pending, 'изменение', 'изменения', 'изменений')} ждут` : ''}`
    : s.state === 'error' ? 'Ошибка синхронизации'
    : s.pending ? 'Ожидает отправки' : 'Сохранено';
  return (
    <span className={`sync ${s.state}`} title={s.error ?? undefined}>
      <span className="dot" />
      {label}
    </span>
  );
}

/** Numeric input that keeps its own text while typing ("12," / "") and reports parsed numbers. */
export function NumberInput({
  value, onChange, min = 0, max, decimal = false, placeholder, className, ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number; max?: number; decimal?: boolean;
  placeholder?: string; className?: string; ariaLabel?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : String(value));
  }, [value]);

  const commit = (t: string) => {
    setText(t);
    if (t.trim() === '') return onChange(null);
    const n = Number(t.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min, decimal ? n : Math.round(n))));
  };
  return (
    <input
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(value === null ? '' : String(value)); }}
      onChange={(e) => commit(e.target.value.replace(/[^\d.,]/g, ''))}
    />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, decimal, suffix }: {
  value: number | null; onChange: (v: number) => void; step?: number; min?: number; max?: number; decimal?: boolean; suffix?: string;
}) {
  const v = value ?? 0;
  const round = (x: number) => Math.round(x * 100) / 100;
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="icon-btn" onClick={() => { haptic.select(); onChange(Math.max(min, round(v - step))); }} aria-label="Меньше"><Icon name="minus" /></button>
      <div style={{ position: 'relative', flex: 1 }}>
        <NumberInput value={value} onChange={(x) => onChange(x ?? min)} decimal={decimal} min={min} max={max} className="num center" />
        {suffix && <span className="faint small" style={{ position: 'absolute', right: 10, top: 12 }}>{suffix}</span>}
      </div>
      <button className="icon-btn" onClick={() => { haptic.select(); onChange(Math.min(max, round(v + step))); }} aria-label="Больше"><Icon name="plus" /></button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => { haptic.select(); onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon = '🏋️', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div className="bold" style={{ color: 'var(--text-2)' }}>{title}</div>
      {children && <div className="small mt-8">{children}</div>}
    </div>
  );
}

/** Re-renders every `ms` — for live timers. Timers derive from stored timestamps, not from this tick. */
export function useNow(ms = 1000, active = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [ms, active]);
  return now;
}
