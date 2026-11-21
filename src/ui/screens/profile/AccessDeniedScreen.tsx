import { telegramUserId } from '../../../telegram/tg';
import { useUi } from '../../components/common';

/** Shown when the server rejects this Telegram account (not in ALLOWED_USER_IDS). */
export function AccessDeniedScreen() {
  const id = telegramUserId();
  const ui = useUi();
  return (
    <div className="screen no-tabbar" style={{ display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <div className="hero center" style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Доступ закрыт</h2>
        <p className="muted small">Это приватное приложение. Чтобы получить доступ, отправьте владельцу свой Telegram ID.</p>
        {id !== null && (
          <button
            className="btn block mt-12 num"
            onClick={() => { void navigator.clipboard?.writeText(String(id)).then(() => ui.toast('ID скопирован')); }}
          >
            ID: {id}
          </button>
        )}
      </div>
    </div>
  );
}
